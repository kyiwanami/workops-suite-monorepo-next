// 業務のルールで操作できないときのエラーです。メッセージは利用者にそのまま見せます。
export class BusinessError extends Error {}

// 操作する対象が見つからないときのエラーです。扱える部署の対象でないときも同じにします。
export const notFoundError = () => new BusinessError('対象が見つかりません。');

// ロールが足りず操作できないときのエラーです。
export const roleError = () => new BusinessError('この操作をする権限がありません。');
