/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
      },
    ],
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // Mark canvas and pdfjs-dist as external to prevent build-time issues
    // These are only used in server-side code for PDF/image thumbnails
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        'canvas',
        'pdfjs-dist',
      ]
    }
    return config
  },
}

module.exports = nextConfig