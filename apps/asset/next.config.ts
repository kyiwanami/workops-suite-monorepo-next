import type { NextConfig } from 'next';

// モノレポ内のTypeScriptのパッケージを、このアプリのビルドで変換します。
const nextConfig: NextConfig = {
  // 開発サーバーの変換の結果をディスクに残さず、起動のたびに作り直します。止めている間に共有のパッケージが変わると、残した結果と食い違って再読込を繰り返すためです。
  experimental: { turbopackFileSystemCacheForDev: false },
  transpilePackages: ['@workops/ui', '@workops/server', '@workops/blocks', '@workops/domain', '@workops/schema'],
};

export default nextConfig;
