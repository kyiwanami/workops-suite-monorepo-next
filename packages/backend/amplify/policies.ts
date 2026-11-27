import type { Stack } from 'aws-cdk-lib';
import { CfnPolicy, type Gateway, Policy, type PolicyEngine, PolicyStatement } from 'aws-cdk-lib/aws-bedrockagentcore';
import type { IDependable } from 'constructs';

// ロールごとに使えるツールです。業務の処理が求めるロールに合わせます。全体管理者はすべてのツールを使えます。
const tools = {
  // 閲覧者以上
  viewer: [
    'list-assets', // 資産の一覧
    'get-asset', // 資産の詳細
    'list-asset-types', // 資産種別の一覧
    'list-departments', // 部署の一覧
    'list-members', // 担当者の候補の一覧
    'list-requests', // 申請の一覧
    'get-request', // 申請の詳細
    'list-request-types', // 申請種別の一覧
  ],
  // 担当者以上
  editor: [
    'create-asset', // 資産の登録
    'update-asset', // 資産の編集
    'create-request', // 申請の作成
    'update-request', // 申請の編集
    'submit-request', // 申請の提出
    'withdraw-request', // 申請の取下げ
  ],
  // 承認者
  manager: [
    'delete-asset', // 資産の削除
    'create-asset-type', // 資産種別の登録
    'approve-request', // 申請の承認
    'reject-request', // 申請の却下
    'return-request', // 申請の差戻し
  ],
};

// 他の利用者が書いた自由記述（件名・説明・理由・資産名・種別の説明）を返す読み取りツールです。
const freeTextTools = ['list-assets', 'get-asset', 'list-asset-types', 'list-requests', 'get-request', 'list-request-types'];

// Gateway のツールの呼び出しを評価するポリシーです。
// ポリシーはツールの定義で検証されるため、Gateway がターゲットからツールの定義を読んだあとに作ります。
// JWT のクレームは Cedar ではタグになり、L2 の部品では読めないため、Cedar の文で書きます。
export function createPolicies(props: {
  stack: Stack;
  policyEngine: PolicyEngine;
  gateway: Gateway;
  target: IDependable;
}) {
  const { stack, policyEngine, target } = props;
  const resource = `AgentCore::Gateway::"${props.gateway.gatewayArn}"`;
  const actions = (names: string[]) => names.map((name) => `AgentCore::Action::"workops___${name}"`).join(', ');

  // ロールごとのツールの許可です。
  const roles = [
    { role: 'viewer', names: tools.viewer, condition: 'principal.hasTag("app_role")' },
    {
      role: 'editor',
      names: tools.editor,
      condition: 'principal.hasTag("app_role") && (principal.getTag("app_role") == "editor" || principal.getTag("app_role") == "manager")',
    },
    { role: 'manager', names: tools.manager, condition: 'principal.hasTag("app_role") && principal.getTag("app_role") == "manager"' },
  ];
  for (const { role, names, condition } of roles) {
    const policy = new Policy(stack, `Policy-${role}`, {
      policyEngine,
      policyName: role,
      statement: PolicyStatement.fromCedar(
        `permit(principal is AgentCore::OAuthUser, action in [${actions(names)}], resource == ${resource}) when { ${condition} };`,
      ),
    });
    policy.node.addDependency(target);
  }
  const admin = new Policy(stack, 'Policy-admin', {
    policyEngine,
    policyName: 'admin',
    statement: PolicyStatement.fromCedar(
      `permit(principal is AgentCore::OAuthUser, action, resource == ${resource}) when { principal.hasTag("app_admin") && principal.getTag("app_admin") == "true" };`,
    ),
  });
  admin.node.addDependency(target);

  // 他の利用者が書いた自由記述を返す読み取りツールの結果に、攻撃の文が入っていないかを調べます。
  // ガードレールの条件は L2 で書けないため、L1 で書きます。
  // 誤検知と信頼度を見て閾値を決めるまでは、止めずに記録だけします。
  const attackDetection = new CfnPolicy(stack, 'Policy-tool-result-attack', {
    name: 'tool_result_attack',
    policyEngineId: policyEngine.policyEngineId,
    definition: {
      policy: {
        statement: [
          `suppressOutput(principal, action in [${actions(freeTextTools)}], resource == ${resource})`,
          'when guardrails {',
          '  BedrockGuardrails::PromptAttack(["PROMPT_INJECTION", "JAILBREAK"], ["$.result.content[*].text"])',
          '    .maxConfidenceScore().greaterThan(decimal("0.4"))',
          '};',
        ].join('\n'),
      },
    },
    validationMode: 'IGNORE_ALL_FINDINGS',
    enforcementMode: 'LOG_ONLY',
  });
  attackDetection.node.addDependency(target);
}
