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
    // Mark certain packages as external to prevent build-time issues
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        'canvas',      // Canvas is only used in server-side code for image thumbnails
        'pdfjs-dist',  // pdfjs-dist must be external so it can load worker from node_modules at runtime
      ]
    }
    return config
  },
}

module.exports = nextConfig