import { toolApproval } from '@workops/blocks/schema';
import { and, eq, inArray, TransactionRollbackError } from 'drizzle-orm';
import type { AwsDataApiPgDatabase } from 'drizzle-orm/aws-data-api/pg';

// 確認カードを表示したことを記録します。依頼した利用者を作成者・更新者にします。
export async function recordToolRequests(
  db: AwsDataApiPgDatabase,
  sub: string,
  requests: Array<{ toolUseId: string; conversationId: string; toolName: string; input: (typeof toolApproval.$inferInsert)['input'] }>,
) {
  const now = new Date().toISOString();
  await db
    .insert(toolApproval)
    .values(requests.map((request) => ({ ...request, status: 'requested' as const, createdAt: now, createdBy: sub, updatedAt: now, updatedBy: sub })))
    .onConflictDoNothing();
}

// 確認カードの判断を記録します。1つの応答の判断をまとめて記録し、状態が requested の行だけを更新します。
// すべて記録できたら true を返します。判断済みの行があれば、どれも記録せずに false を返します。
export async function recordToolDecisions(
  db: AwsDataApiPgDatabase,
  sub: string,
  decisions: Array<{ toolUseId: string; status: 'approved' | 'denied' }>,
) {
  const now = new Date().toISOString();
  try {
    return await db.transaction(async (tx) => {
      for (const decision of decisions) {
        const updated = await tx
          .update(toolApproval)
          .set({ status: decision.status, updatedAt: now, updatedBy: sub })
          .where(and(eq(toolApproval.toolUseId, decision.toolUseId), eq(toolApproval.status, 'requested')))
          .returning({ toolUseId: toolApproval.toolUseId });
        if (updated.length === 0) {
          tx.rollback();
        }
      }
      return true;
    });
  } catch (error) {
    if (error instanceof TransactionRollbackError) {
      return false;
    }
    throw error;
  }
}

// 判断されなかった確認カードを、判断せずに次の依頼をした（abandoned）か、期限を過ぎてから判断した（expired）状態にします。
// 状態が requested の行だけを更新します。
export async function closeToolRequests(db: AwsDataApiPgDatabase, sub: string, toolUseIds: string[], status: 'abandoned' | 'expired') {
  await db
    .update(toolApproval)
    .set({ status, updatedAt: new Date().toISOString(), updatedBy: sub })
    .where(and(inArray(toolApproval.toolUseId, toolUseIds), eq(toolApproval.status, 'requested')));
}

// 承認したツール呼び出しの実行結果を記録します。
export async function recordToolResult(db: AwsDataApiPgDatabase, sub: string, toolUseId: string, status: 'succeeded' | 'failed') {
  await db
    .update(toolApproval)
    .set({ status, updatedAt: new Date().toISOString(), updatedBy: sub })
    .where(and(eq(toolApproval.toolUseId, toolUseId), eq(toolApproval.status, 'approved')));
}

// 会話の確認カードの記録を返します。依頼した利用者本人の記録だけを返します。
export async function listToolApprovals(db: AwsDataApiPgDatabase, sub: string, conversationId: string) {
  return db
    .select({ toolUseId: toolApproval.toolUseId, status: toolApproval.status })
    .from(toolApproval)
    .where(and(eq(toolApproval.conversationId, conversationId), eq(toolApproval.createdBy, sub)));
}
