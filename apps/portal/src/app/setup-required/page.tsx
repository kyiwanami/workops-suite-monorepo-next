import { getEmail } from '@/user';

// 部署・ロールが未設定の利用者に、全体管理者による設定が必要なことを伝えます。
export default async function SetupRequiredPage() {
  const email = await getEmail();
  return (
    <main>
      <p>全体管理者による部署とロールの設定が必要です。</p>
      <p>{email}</p>
    </main>
  );
}
