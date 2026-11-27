import { strict as assert } from 'node:assert';
import { Duration, Names, type Stack } from 'aws-cdk-lib';
import type { RestApi } from 'aws-cdk-lib/aws-apigateway';
import type { CfnGuardrail, CfnGuardrailVersion } from 'aws-cdk-lib/aws-bedrock';
import type { Gateway, PolicyEngine, Runtime } from 'aws-cdk-lib/aws-bedrockagentcore';
import { ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { Function, type IFunction } from 'aws-cdk-lib/aws-lambda';
import { FilterPattern } from 'aws-cdk-lib/aws-logs';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { MetricStatistic, MonitoringFacade, SnsAlarmActionStrategy } from 'cdk-monitoring-constructs';

// アラームの通知先のメールアドレスです。デプロイのときの環境変数で指定します。
const alarmEmail = process.env.ALARM_EMAIL;

// AI機能のアラームです。条件は詳細設計の初期値で、運用後の実測で見直します。通知は SNS のトピックからメールで送ります。
// メトリクスは5分ごとに見ます（ライブラリの既定）。
export function createAlarms(props: {
  stack: Stack;
  gateway: Gateway;
  runtime: Runtime;
  policyEngine: PolicyEngine;
  api: RestApi;
  chatFunction: IFunction;
  guardrail: CfnGuardrail;
  guardrailVersion: CfnGuardrailVersion;
}) {
  const { stack, gateway, runtime, policyEngine, chatFunction } = props;
  assert(alarmEmail !== undefined, '環境変数 ALARM_EMAIL に、アラームの通知先のメールアドレスを指定してください。');
  assert(chatFunction instanceof Function);

  const topic = new Topic(stack, 'AlarmTopic');
  topic.addSubscription(new EmailSubscription(alarmEmail));
  const monitoring = new MonitoringFacade(stack, 'Monitoring', {
    // アラームの名前はアカウントとリージョンで一意のため、スタックごとに一意の接頭辞を付けます。
    alarmFactoryDefaults: {
      alarmNamePrefix: Names.uniqueResourceName(stack, { maxLength: 40 }),
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

  // BFF：Lambda のエラーは5分で5件以上（4件を超える）、実行時間の p90 は240秒以上
  monitoring.monitorLambdaFunction({
    lambdaFunction: chatFunction,
    addFaultCountAlarm: { Critical: { maxErrorCount: 4 } },
    addLatencyP90Alarm: { Critical: { maxLatency: Duration.seconds(240) } },
  });

  // BFF が Harness の呼び出しに失敗した回数です。構造化ログの失敗の記録から数えます。
  const harnessErrors = chatFunction.logGroup
    .addMetricFilter('HarnessErrors', {
      filterPattern: FilterPattern.all(FilterPattern.stringValue('$.event', '=', 'invoke'), FilterPattern.stringValue('$.error', '=', 'failed')),
      metricNamespace: 'Workops/Chat',
      metricName: 'HarnessErrors',
      metricValue: '1',
    })
    .metric({ statistic: MetricStatistic.SUM });

  // Policy のメトリクスは、CDK の部品のメソッドが文書と違う名前と次元で作るため、文書の名前と次元で作ります。
  const policy = { OperationName: 'AuthorizeAction', PolicyEngine: policyEngine.policyEngineId };
  const guardrail = { GuardrailArn: props.guardrail.attrGuardrailArn, GuardrailVersion: props.guardrailVersion.attrVersion };
  const sum = { statistic: MetricStatistic.SUM };

  // チャットのAPI・AgentCore・Guardrail・BFF の Harness の呼び出しです。メトリクスを渡して監視します。
  // チャットのAPIは、ライブラリの API Gateway の監視が CDK の RestApi の型を受け取れない（exactOptionalPropertyTypes）ため、ここで監視します。
  monitoring.monitorCustom({
    alarmFriendlyName: 'Ai',
    metricGroups: [
      {
        title: 'チャットのAPI',
        metrics: [{ alarmFriendlyName: 'ChatApi5XXError', metric: props.api.metricServerError(sum), addAlarm: atLeast(5) }],
      },
      {
        title: 'Gateway',
        metrics: [
          { alarmFriendlyName: 'GatewaySystemErrors', metric: gateway.metricSystemErrors(sum), addAlarm: atLeast(5) },
          { alarmFriendlyName: 'GatewayThrottles', metric: gateway.metricThrottles(sum), addAlarm: atLeast(5) },
        ],
      },
      {
        title: '業務MCPサーバー',
        metrics: [
          { alarmFriendlyName: 'McpServerSystemErrors', metric: runtime.metricSystemErrors(sum), addAlarm: atLeast(5) },
          { alarmFriendlyName: 'McpServerThrottles', metric: runtime.metricThrottles(sum), addAlarm: atLeast(5) },
        ],
      },
      {
        title: 'Policy',
        metrics: [
          {
            alarmFriendlyName: 'PolicyMismatchErrors',
            metric: metrics.createMetric('MismatchErrors', MetricStatistic.SUM, 'MismatchErrors', policy, undefined, 'AWS/Bedrock-AgentCore'),
            addAlarm: atLeast(1),
          },
          {
            alarmFriendlyName: 'PolicyDenyDecisions',
            metric: metrics.createMetric('DenyDecisions', MetricStatistic.SUM, 'DenyDecisions', policy, undefined, 'AWS/Bedrock-AgentCore'),
            addAlarm: atLeast(20),
          },
        ],
      },
      {
        title: 'Guardrail と Harness',
        metrics: [
          {
            alarmFriendlyName: 'GuardrailIntervened',
            metric: metrics.createMetric('InvocationsIntervened', MetricStatistic.SUM, 'InvocationsIntervened', guardrail, undefined, 'AWS/Bedrock/Guardrails'),
            addAlarm: atLeast(5),
          },
          { alarmFriendlyName: 'ChatHarnessErrors', metric: harnessErrors, addAlarm: atLeast(5) },
        ],
      },
    ],
  });
}
