import { notFound } from 'next/navigation';

// どのページにも当たらない URL です。表示できないページの案内を、画面の枠の中に出します。
export default function UnknownPage() {
  notFound();
}
