'use client';

import { isSpecType } from '@modelcontextprotocol/client';
import { Badge } from '@workops/ui/components/badge';
import { Button } from '@workops/ui/components/button';
import { Spinner } from '@workops/ui/components/spinner';
import { assetStatusBadges, formatAmount, formatDateTime, requestStatusBadges } from '@workops/ui/lib/labels';
import { fieldTitle, writeTools } from '@workops/schema/tools';
import type { ChatAddToolApproveResponseFunction, DynamicToolUIPart, JSONValue } from 'ai';
import { ArrowRightIcon, CircleAlertIcon, CircleCheckIcon } from 'lucide-react';
import type { ReactNode } from 'react';

// ツールの表示名です。Gateway のツールの title を AI SDK がツールのメタデータに入れます。
export function toolTitle(part: DynamicToolUIPart) {
  const title = part.toolMetadata?.['title'];
  return typeof title === 'string' ? title : part.toolName;
}

// 対象の値で、ID の項目に対応する名前の項目です。変更前の値を名前で出すのに使います。
const nameFields = new Map([
  ['assigneeSub', 'assigneeName'],
  ['assetTypeId', 'assetTypeName'],
  ['requestTypeId', 'requestTypeName'],
]);

// 資産と申請の状態の表示名です。
const statusBadges = new Map([...Object.entries(assetStatusBadges), ...Object.entries(requestStatusBadges)]);

// 状態のバッジです。
function StatusBadge({ status }: { status: string }) {
  const badge = statusBadges.get(status);
  if (badge === undefined) {
    return status;
  }
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
}

// 項目の値の表示です。状態はバッジ、金額は円、空は「未設定」（担当者は「未割当」）にします。
function formatValue(name: string, value: JSONValue | undefined): ReactNode {
  if (value === null || value === undefined) {
    return name === 'assigneeSub' ? '未割当' : '未設定';
  }
  if (name === 'status') {
    return <StatusBadge status={String(value)} />;
  }
  if (name === 'amount' && typeof value === 'number') {
    return formatAmount(value);
  }
  return String(value);
}

// ID の項目かです。
const isIdField = (name: string) => nameFields.has(name) || name.endsWith('Id');

// 入力の値の表示です。ID の項目は、BFF が引いた名前を出します。名前を引けなかった ID の項目は、変更後の値では「変更します」と書きます。
function inputValue(name: string, value: JSONValue | undefined, names: Map<string, string>): ReactNode {
  const named = names.get(name);
  if (named !== undefined) {
    return named;
  }
  if (isIdField(name) && value !== null) {
    return '変更します';
  }
  return formatValue(name, value);
}

// 「変更前 → 変更後」の表示です。
function Change({ before, after }: { before: ReactNode; after: ReactNode }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      {before}
      <ArrowRightIcon className="size-4 text-muted-foreground" />
      <span className="sr-only">から</span>
      {after}
    </span>
  );
}

type Row = { label: string; value: ReactNode };

// 確認カードに並べる行です。
// - 対象があれば、対象と、入力のうち今の値と違う項目の「変更前 → 変更後」を出します。状態を変える操作では状態の変化を出します
// - 対象がない新規作成や、対象を取れなかったときは、入力を項目名付きで並べます。表にないツールは入力をそのまま出します
function cardRows(part: DynamicToolUIPart, target: JSONValue | undefined, names: Map<string, string>): Row[] {
  const card = writeTools.get(part.toolName);
  if (card === undefined) {
    return [{ label: '入力', value: JSON.stringify(part.input) }];
  }
  const input = card.input.safeParse(part.input);
  if (!input.success) {
    return [{ label: '入力', value: JSON.stringify(part.input) }];
  }
  const values = new Map(Object.entries(input.data));
  // 入力に渡された項目です。編集では、変える項目だけが渡されます。
  const fields = Object.entries(card.input.shape)
    .filter(([name]) => values.has(name))
    .map(([name, field]) => ({ name, label: fieldTitle(field) ?? name }));
  // ID の項目は、名前を引けたものだけを出し、ID そのものは出しません。
  const inputRows = fields.flatMap(({ name, label }) => {
    const named = names.get(name);
    if (named !== undefined) {
      return [{ label, value: named }];
    }
    return isIdField(name) ? [] : [{ label, value: formatValue(name, values.get(name)) }];
  });
  if (card.target === null) {
    return inputRows;
  }
  const parsed = card.target.value.safeParse(target);
  if (!parsed.success) {
    return inputRows;
  }

  const rows: Row[] = [];
  if ('title' in parsed.data) {
    rows.push({ label: '対象', value: `${parsed.data.title}／${parsed.data.requesterName ?? ''}` });
    if (!values.has('amount')) {
      rows.push({ label: '金額', value: formatAmount(parsed.data.amount) });
    }
  } else {
    rows.push({ label: '対象', value: `${parsed.data.name}（${parsed.data.assetTypeName}）` });
  }

  // 対象のIDの項目は出しません。対象にない項目は入力を出し、対象と違う項目だけ「変更前 → 変更後」を出します。
  const current = new Map(Object.entries(parsed.data));
  const idFields = new Set(Object.keys(card.target.input.shape));
  for (const { name, label } of fields) {
    if (idFields.has(name)) {
      continue;
    }
    if (!current.has(name)) {
      const named = names.get(name);
      if (named !== undefined || !isIdField(name)) {
        rows.push({ label, value: named ?? formatValue(name, values.get(name)) });
      }
      continue;
    }
    if (current.get(name) === values.get(name)) {
      continue;
    }
    const before = formatValue(name, current.get(nameFields.get(name) ?? name));
    rows.push({ label, value: <Change before={before} after={inputValue(name, values.get(name), names)} /> });
  }

  const status = <StatusBadge status={String(current.get('status'))} />;
  if (card.nextStatus !== null) {
    rows.push({ label: '状態', value: <Change before={status} after={<StatusBadge status={card.nextStatus} />} /> });
  }
  if (part.toolName === 'delete-asset') {
    rows.push({ label: '状態', value: status });
  }
  return rows;
}

// 判断のあとに、罫線の下に出す結果です。実行していない・失敗した・変更した・実行中のどれかを出します。
function Outcome({ part, resultAt }: { part: DynamicToolUIPart; resultAt: string | undefined }) {
  const at = resultAt === undefined ? null : <span className="ml-auto font-mono text-[13px] text-muted-foreground">{formatDateTime(resultAt)}</span>;
  const failure = (text: string) => (
    <>
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
      <span>実行できませんでした。{text}</span>
      {at}
    </>
  );

  if (part.state === 'output-denied' || (part.state === 'approval-responded' && !part.approval.approved)) {
    return <span className="text-muted-foreground">この操作は実行していません。必要なら、もう一度依頼してください。</span>;
  }
  switch (part.state) {
    case 'output-error':
      return failure(part.errorText);
    case 'output-available':
      if (isSpecType.CallToolResult(part.output) && part.output.isError === true) {
        // ツールが返した失敗の理由です。MCP のツールの結果の文章を出します。
        return failure((part.output.content ?? []).flatMap((content) => (content.type === 'text' ? [content.text] : [])).join('\n'));
      }
      return (
        <>
          <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
          変更しました
          {at}
        </>
      );
  }
  return (
    <>
      <Spinner className="mt-0.5" />
      <span className="text-muted-foreground">実行しています…</span>
    </>
  );
}

// AIのツールの呼び出しを表示します。
// 読み取りのツールは、待っている間の表示（会話の下の1行）で示すため、ここでは何も出しません。
// 書込みのツールは確認カードです。承認を求めている間は確定ボタンを出し、判断のあとは罫線の下に結果と日時を出します。
// target は BFF が添えた、カードを表示した時点の対象の値、names は入力の ID の項目の名前、resultAt は実行の日時です。
// pending は回答を受け取っている間かです。対象の値と名前は回答の終わりまでに届くため、確定を求めるカードは受け取り終えてから出します。
export function ToolPart({
  part,
  target,
  names,
  resultAt,
  pending,
  onRespond,
}: {
  part: DynamicToolUIPart;
  target: JSONValue | undefined;
  names: Record<string, string> | undefined;
  resultAt: string | undefined;
  pending: boolean;
  onRespond: ChatAddToolApproveResponseFunction;
}) {
  if (part.providerExecuted === true || part.state === 'input-streaming' || part.state === 'input-available') {
    return null;
  }
  if (part.state === 'approval-requested' && pending) {
    return null;
  }
  const card = writeTools.get(part.toolName);

  // 見た目は通常のカードと同じにし、AI専用の色の面や枠は付けません。AIが作ったかではなく、何が変わるかに目を向けてもらうためです。
  return (
    <section className="flex flex-col gap-3 rounded-md border bg-card p-4 text-sm leading-[22px]">
      <h3 className="text-[15px] leading-6 font-bold">{card?.heading ?? toolTitle(part)}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {cardRows(part, target, new Map(names === undefined ? [] : Object.entries(names))).map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="wrap-break-word">{row.value}</dd>
          </div>
        ))}
      </dl>
      {part.state === 'approval-requested' ? (
        <>
          {card?.note && <p className="text-[13px] leading-5 text-muted-foreground">{card.note}</p>}
          {/* 左に「やめる」、右に操作の動詞の確定ボタンを置きます。誤って確定しないよう、フォーカスは「やめる」に置きます。 */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" autoFocus onClick={() => onRespond({ id: part.approval.id, approved: false })}>
              やめる
            </Button>
            <Button variant={card?.destructive ? 'destructive' : 'default'} onClick={() => onRespond({ id: part.approval.id, approved: true })}>
              {card?.action ?? '確定する'}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-start gap-2 border-t pt-3">
          <Outcome part={part} resultAt={resultAt} />
        </div>
      )}
    </section>
  );
}
