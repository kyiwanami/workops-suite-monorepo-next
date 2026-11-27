import 'server-only';
import { notFound } from 'next/navigation';

// 業務の処理が null を返したとき（見つからない・権限がない）は、見つからない画面を表示します。
export function found<T>(value: T | null) {
  if (value === null) {
    notFound();
  }
  return value;
}
