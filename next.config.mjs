/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  // pdfkit must not be bundled by Next.js (uses Node.js streams/buffers directly)
  serverExternalPackages: ['pdfkit'],
};

export default nextConfig;
