// 製品のシンボルです。ライトテーマとダークテーマで、ロゴの固定色の版を切り替えます。
export function Logo() {
  return (
    <>
      <svg className="size-7 dark:hidden" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(0 1)">
          <path d="M59.05 29.75 A28 12 -15 0 0 4.95 44.25" fill="none" stroke="#0f8f80" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
          <path d="M10 14 L21 47 L32 22 L43 47 L54 14" fill="none" stroke="#2459d6" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4.95 44.25 A28 12 -15 0 0 58.47 34.15" fill="none" stroke="#0f8f80" strokeWidth="6" strokeLinecap="round" />
          <path d="M61.5 27.8 L63.4 37.6 L52.6 32.5 Z" fill="#0f8f80" stroke="#0f8f80" strokeWidth="1.5" strokeLinejoin="round" />
        </g>
      </svg>
      <svg className="hidden size-7 dark:block" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(0 1)">
          <path d="M59.05 29.75 A28 12 -15 0 0 4.95 44.25" fill="none" stroke="#3fd2bf" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
          <path d="M10 14 L21 47 L32 22 L43 47 L54 14" fill="none" stroke="#6f9cff" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4.95 44.25 A28 12 -15 0 0 58.47 34.15" fill="none" stroke="#3fd2bf" strokeWidth="6" strokeLinecap="round" />
          <path d="M61.5 27.8 L63.4 37.6 L52.6 32.5 Z" fill="#3fd2bf" stroke="#3fd2bf" strokeWidth="1.5" strokeLinejoin="round" />
        </g>
      </svg>
    </>
  );
}
