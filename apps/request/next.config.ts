import type { NextConfig } from 'next';

// モノレポ内のTypeScriptのパッケージを、このアプリのビルドで変換します。
const nextConfig: NextConfig = {
  transpilePackages: ['@workops/ui', '@workops/server', '@workops/blocks', '@workops/domain', '@workops/schema'],
};

export default nextConfig;
