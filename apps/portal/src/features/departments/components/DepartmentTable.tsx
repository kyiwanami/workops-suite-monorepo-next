import type { listDepartments } from '../data';

// 部署の一覧表です。
export function DepartmentTable({
  departments,
}: {
  departments: Awaited<ReturnType<typeof listDepartments>>;
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>部署コード</th>
          <th>部署名</th>
          <th>表示順</th>
          <th>備考</th>
        </tr>
      </thead>
      <tbody>
        {departments.map((item) => (
          <tr key={item.id}>
            <td>{item.code}</td>
            <td>{item.name}</td>
            <td>{item.sortOrder}</td>
            <td>{item.notes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
