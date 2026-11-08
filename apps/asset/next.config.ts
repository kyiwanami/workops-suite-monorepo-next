import type { NextConfig } from 'next';

// モノレポ内のTypeScriptのパッケージを、このアプリのビルドで変換します。
const nextConfig: NextConfig = {
  transpilePackages: ['@workops/server', '@workops/blocks'],
};

export default nextConfig;
