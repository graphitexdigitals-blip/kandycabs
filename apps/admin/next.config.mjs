/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@kandy-cabs/db', '@kandy-cabs/shared'],
  experimental: {
    serverComponentsExternalPackages: ['pdfkit', 'fontkit', 'unicode-properties'],
  },
};

export default nextConfig;
