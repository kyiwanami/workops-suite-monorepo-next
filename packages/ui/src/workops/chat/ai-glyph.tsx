import { cn } from '@workops/ui/lib/utils';

// AIを示す、ロゴの「Wを囲む軌道の矢印」を線画にしたグリフです。中心の点が業務、回る矢印が業務を前へ進めるAIを表します。
// AIの印はこのグリフだけで、起動ボタンとパネルの見出しにだけ出します。色は ai です。
export function AiGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-5 shrink-0 text-ai', className)}
    >
      <path d="M12.04 5.80A9.0 6.5 -20.0 1 0 20.71 11.70L21.01 9.11" />
      <path d="M23.22 12.60 21.01 9.11 18.06 11.99" />
      <circle cx="12" cy="12.5" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
