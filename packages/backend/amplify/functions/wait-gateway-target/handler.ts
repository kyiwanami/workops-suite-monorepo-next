import { BedrockAgentCoreControlClient, GetGatewayTargetCommand } from '@aws-sdk/client-bedrock-agentcore-control';
import type { CloudFormationCustomResourceEvent } from 'aws-lambda';

const client = new BedrockAgentCoreControlClient();

// 同期を始めた時刻より後に同期が終わり、ターゲットが使える状態になったら完了にします。始めた時刻は、同期を始める関数が返します。
// 同期に失敗したら、デプロイを失敗させます。
export const handler = async (event: CloudFormationCustomResourceEvent & { Data: { startedAt: string } }) => {
  if (event.RequestType === 'Delete') {
    return { IsComplete: true };
  }
  const { gatewayIdentifier, targetId } = event.ResourceProperties;
  const target = await client.send(new GetGatewayTargetCommand({ gatewayIdentifier, targetId }));
  if (target.status === 'SYNCHRONIZE_UNSUCCESSFUL' || target.status === 'FAILED') {
    throw new Error(`ツールの定義を取り直せませんでした：${target.status}`, { cause: target.statusReasons });
  }
  const synchronized = target.lastSynchronizedAt !== undefined && target.lastSynchronizedAt >= new Date(event.Data.startedAt);
  return { IsComplete: target.status === 'READY' && synchronized };
};
