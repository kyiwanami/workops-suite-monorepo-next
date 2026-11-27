'use client';

import { PageError } from '@workops/ui/workops/page-error';

export default function MemberError({ retry }: { retry: () => void }) {
  return <PageError retry={retry} />;
}
