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
  // @react-pdf/renderer må lastes direkte fra node_modules og ikke bundlet av
  // Next.js – ellers oppstår to separate React-instanser som krasjer PDF-rendering.
  serverExternalPackages: ['@react-pdf/renderer'],
};

export default nextConfig;
