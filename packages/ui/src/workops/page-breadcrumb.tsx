import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@workops/ui/components/breadcrumb';
import Link from 'next/link';
import type { ReactNode } from 'react';

// 詳細・作成のページの上に出す、一覧へのリンクと今のページの名前です。
export function PageBreadcrumb({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild className="font-bold text-primary hover:text-primary hover:underline">
            <Link href={href}>{label}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>／</BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbPage>{children}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
