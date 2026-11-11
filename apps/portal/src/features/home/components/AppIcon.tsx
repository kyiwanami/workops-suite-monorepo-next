'use client';

import { DynamicIcon, iconNames } from 'lucide-react/dynamic';

// 登録されたアイコン名が、lucide のアイコン名かを確かめます。
const isIconName = (name: string | null): name is (typeof iconNames)[number] =>
  iconNames.some((iconName) => iconName === name);

// アプリのタイルに出すアイコンです。lucide にない名前のときは何も出しません。
export function AppIcon({ name }: { name: string | null }) {
  return isIconName(name) && <DynamicIcon name={name} className="size-5 text-primary" />;
}
