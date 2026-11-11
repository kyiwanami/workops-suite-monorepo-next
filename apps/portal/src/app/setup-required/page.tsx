import { Button } from '@workops/ui/components/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@workops/ui/components/empty';
import { getEmail } from '@/user';

// 部署・ロールが未設定の利用者に、全体管理者による設定が必要なことと、次の行動を伝えます。
// 別のアカウントの取り違えに気づけるよう、ログイン中のメールを出します。
export default async function SetupRequiredPage() {
  const email = await getEmail();
  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6 md:px-6">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>まだ所属が設定されていません</EmptyTitle>
          <EmptyDescription>
            アプリを使うには、全体管理者が部署とロールを設定する必要があります。設定が済むと、このページを再読み込みすれば使えるようになります。
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <a href="/">再読み込みする</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/api/auth/sign-out">ログアウトする</a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">ログイン中：{email}</p>
        </EmptyContent>
      </Empty>
    </main>
  );
}
