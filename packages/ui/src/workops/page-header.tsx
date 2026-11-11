import type { ReactNode } from 'react';

// 画面の題と主操作の行です。題を左に、主操作を右に置き、収まらないときは主操作を下に折り返します。
export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </div>
  );
}
