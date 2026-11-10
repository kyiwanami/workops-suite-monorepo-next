// アプリのビルドで Tailwind CSS を処理します。各アプリの postcss.config.mjs がこの設定を読みます。
const config = {
  plugins: { '@tailwindcss/postcss': {} },
};

export default config;
