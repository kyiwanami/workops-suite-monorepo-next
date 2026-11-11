import type { ReactNode } from 'react';

// 申請の操作ボタンを並べる帯です。広い画面では右寄せで並べ、狭い画面では画面下部に固定して、ボタンを高さ 48px で横に広げます。
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-end gap-2 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-10 max-md:flex-nowrap max-md:border-t max-md:bg-card max-md:p-3 max-md:[&_button]:h-12 max-md:[&_button]:flex-1">
      {children}
    </div>
  );
}
