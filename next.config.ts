import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@libsql/client'],
  outputFileTracingIncludes: {
    '/**': ['./data/bbk.db'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to all image hosts (Google Drive, WordPress, Vercel, etc.)
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  turbopack: {},
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
