import { BedrockAgentCoreControlClient, SynchronizeGatewayTargetsCommand } from '@aws-sdk/client-bedrock-agentcore-control';
import type { CloudFormationCustomResourceEvent } from 'aws-lambda';

const client = new BedrockAgentCoreControlClient();

// 作成・更新のときに同期を始めます。同期する Gateway とターゲットは、カスタムリソースのプロパティで受け取ります。
// 同期は非同期で進むため、完了は別の関数で待ちます。始めた時刻を返し、待つ関数はそれより後に同期が終わったかで完了を判定します。
export const handler = async (event: CloudFormationCustomResourceEvent) => {
  const { gatewayIdentifier, targetId } = event.ResourceProperties;
  const physicalResourceId = `${gatewayIdentifier}/${targetId}`;
  if (event.RequestType === 'Delete') {
    return { PhysicalResourceId: physicalResourceId };
  }
  const startedAt = new Date().toISOString();
  await client.send(new SynchronizeGatewayTargetsCommand({ gatewayIdentifier, targetIdList: [targetId] }));
  return { PhysicalResourceId: physicalResourceId, Data: { startedAt } };
};
