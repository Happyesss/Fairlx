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
};

export default nextConfig;
