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
    // Mark canvas as external to prevent build-time issues
    // Canvas is only used in server-side code for image thumbnails
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        'canvas',
      ]
    }
    return config
  },
}

module.exports = nextConfig