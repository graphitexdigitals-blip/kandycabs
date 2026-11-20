/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@kandy-cabs/db', '@kandy-cabs/shared'],
  experimental: {
    serverComponentsExternalPackages: ['pdfkit', 'fontkit', 'unicode-properties'],
    outputFileTracingIncludes: {
      '/api/**/*': [
        './node_modules/pdfkit/**/*',
        './node_modules/fontkit/**/*',
      ],
    },
  },
};

export default nextConfig;
