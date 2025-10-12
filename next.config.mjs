/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize for Appwrite Sites deployment
  output: 'standalone',
  
  // Ensure proper image handling
  images: {
    unoptimized: true,
  },
  
  // Enable experimental features for better SSR support
  experimental: {
    serverComponentsExternalPackages: ['node-appwrite'],
  },

  // Add headers for CORS and font handling
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
