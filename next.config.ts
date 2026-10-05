import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: [
    '192.168.22.161',
    '192.168.26.80',
    '192.168.*.*',
    '10.*.*.*',
    'localhost',
    '127.0.0.1',
  ],
  experimental: {
    serverActions: {
      allowedOrigins: [
        '192.168.22.161:3000',
        '192.168.26.80:3000',
        'localhost:3000',
        '127.0.0.1:3000',
      ],
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
