import { createDepartmentAction } from '../actions';

// 部署の登録フォームです。
export function DepartmentForm() {
  return (
    <form action={createDepartmentAction}>
      <label>
        部署コード
        <input name="code" />
      </label>
      <label>
        部署名
        <input name="name" />
      </label>
      <label>
        表示順
        <input name="sortOrder" type="number" />
      </label>
      <label>
        備考
        <input name="notes" />
      </label>
      <button type="submit">登録</button>
    </form>
  );
}
