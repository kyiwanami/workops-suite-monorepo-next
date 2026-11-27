import { strict as assert } from 'node:assert';
import { Duration, Names, type Stack } from 'aws-cdk-lib';
import type { RestApi } from 'aws-cdk-lib/aws-apigateway';
import type { CfnGuardrail, CfnGuardrailVersion } from 'aws-cdk-lib/aws-bedrock';
import type { CfnHarness, Gateway, PolicyEngine, Runtime } from 'aws-cdk-lib/aws-bedrockagentcore';
import { ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import type { IFunction } from 'aws-cdk-lib/aws-lambda';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { DefaultDashboardFactory, MetricStatistic, MonitoringFacade, SnsAlarmActionStrategy } from 'cdk-monitoring-constructs';

// アラームの通知先のメールアドレスです。デプロイのときの環境変数で指定します。
const alarmEmail = process.env.ALARM_EMAIL;

// AI機能のアラームです。通知は、対応の要るときだけ出します。
// - 入口（画面のチャットと、外部の MCP クライアント）で、利用者が受けた失敗を見ます
// - AWS のサービスの失敗は、そのサービス自身のメトリクスで見ます。アプリで読み替えません
// - 構造化ログは調べるために使い、通知の元にしません
// - 自分たちの部品と設定の誤り、セキュリティの兆候も通知します
// 条件は詳細設計の初期値で、運用後の実測で見直します。メトリクスは5分ごとに見ます（ライブラリの既定）。
export function createAlarms(props: {
  stack: Stack;
  gateway: Gateway;
  runtime: Runtime;
  policyEngine: PolicyEngine;
  api: RestApi;
  chatFunction: IFunction;
  harness: CfnHarness;
  guardrail: CfnGuardrail;
  guardrailVersion: CfnGuardrailVersion;
}) {
  const { stack, gateway, runtime, policyEngine, harness } = props;
  assert(alarmEmail !== undefined, '環境変数 ALARM_EMAIL に、アラームの通知先のメールアドレスを指定してください。');

  const topic = new Topic(stack, 'AlarmTopic', { enforceSSL: true });
  topic.addSubscription(new EmailSubscription(alarmEmail));
  // アラームとダッシュボードの名前はアカウントとリージョンで一意のため、スタックごとに一意の接頭辞を付けます。
  const prefix = Names.uniqueResourceName(stack, { maxLength: 40 });
  const monitoring = new MonitoringFacade(stack, 'Monitoring', {
    // アラームだけを作り、ダッシュボードは作りません。
    dashboardFactory: new DefaultDashboardFactory(stack, 'Dashboards', { dashboardNamePrefix: prefix, createDashboard: false }),
    alarmFactoryDefaults: {
      alarmNamePrefix: prefix,
      actionsEnabled: true,
      action: new SnsAlarmActionStrategy({ onAlarmTopic: topic }),
      // 条件は5分ごとの値で見るため、1回超えたら鳴らします（ライブラリの既定は3回続けて超えたとき）。
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
    },
  });
  const metrics = monitoring.createMetricFactory();

  // 件数の条件です。データのない時間は、起きていないものとして扱います。
  const atLeast = (threshold: number) => ({
    Critical: { threshold, comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD, treatMissingDataOverride: TreatMissingData.NOT_BREACHING },
  });
  const sum = { statistic: MetricStatistic.SUM };

  // 入口：画面のチャットの BFF。エラー（タイムアウト・メモリ不足・起動の失敗）は5分で5件以上（4件を超える）、実行時間の p90 は240秒以上
  monitoring.monitorLambdaFunction({
    lambdaFunction: props.chatFunction,
    addFaultCountAlarm: { Critical: { maxErrorCount: 4 } },
    addLatencyP90Alarm: { Critical: { maxLatency: Duration.seconds(240) } },
  });

  // Harness 自身のメトリクスの次元です。逐次返している途中の失敗を見ます。
  const harnessDimensions = {
    HarnessId: harness.attrArn,
    Name: `harness_${harness.harnessName}::DEFAULT`,
    Operation: 'InvokeAgentRuntime',
    EndpointQualifier: 'DEFAULT',
  };
  // Policy のメトリクスは、CDK の部品のメソッドが文書と違う名前と次元で作るため、文書の名前と次元で作ります。
  const policy = { OperationName: 'AuthorizeAction', PolicyEngine: policyEngine.policyEngineId };
  const guardrail = { GuardrailArn: props.guardrail.attrGuardrailArn, GuardrailVersion: props.guardrailVersion.attrVersion };

  // チャットのAPIは、ライブラリの API Gateway の監視が CDK の RestApi の型を受け取れない（exactOptionalPropertyTypes）ため、メトリクスを渡して監視します。
  monitoring.monitorCustom({
    alarmFriendlyName: 'Ai',
    metricGroups: [
      {
        title: '入口：画面のチャット',
        metrics: [
          { alarmFriendlyName: 'ChatApi5XXError', metric: props.api.metricServerError(sum), addAlarm: atLeast(5) },
          {
            alarmFriendlyName: 'HarnessSystemErrors',
            metric: metrics.createMetric('SystemErrors', MetricStatistic.SUM, 'Harness SystemErrors', harnessDimensions, undefined, 'AWS/Bedrock-AgentCore'),
            addAlarm: atLeast(5),
          },
        ],
      },
      {
        title: '入口：外部の MCP クライアント（Gateway）',
        metrics: [
          { alarmFriendlyName: 'GatewaySystemErrors', metric: gateway.metricSystemErrors(sum), addAlarm: atLeast(5) },
          { alarmFriendlyName: 'GatewayThrottles', metric: gateway.metricThrottles(sum), addAlarm: atLeast(5) },
        ],
      },
      {
        title: '部品と設定：業務MCPサーバー・Policy',
        metrics: [
          { alarmFriendlyName: 'McpServerSystemErrors', metric: runtime.metricSystemErrors(sum), addAlarm: atLeast(5) },
          { alarmFriendlyName: 'McpServerThrottles', metric: runtime.metricThrottles(sum), addAlarm: atLeast(5) },
          {
            alarmFriendlyName: 'PolicyMismatchErrors',
            metric: metrics.createMetric('MismatchErrors', MetricStatistic.SUM, 'MismatchErrors', policy, undefined, 'AWS/Bedrock-AgentCore'),
            addAlarm: atLeast(1),
          },
        ],
      },
      {
        title: 'セキュリティの兆候：Policy の拒否・Guardrail の介入',
        metrics: [
          {
            alarmFriendlyName: 'PolicyDenyDecisions',
            metric: metrics.createMetric('DenyDecisions', MetricStatistic.SUM, 'DenyDecisions', policy, undefined, 'AWS/Bedrock-AgentCore'),
            addAlarm: atLeast(20),
          },
          {
            alarmFriendlyName: 'GuardrailIntervened',
            metric: metrics.createMetric('InvocationsIntervened', MetricStatistic.SUM, 'InvocationsIntervened', guardrail, undefined, 'AWS/Bedrock/Guardrails'),
            addAlarm: atLeast(5),
          },
        ],
      },
    ],
  });
}
