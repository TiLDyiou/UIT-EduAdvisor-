/** @type {import('next').NextConfig} */
const apiInternal =
  process.env.API_INTERNAL_URL?.replace(/\/$/, "") || "http://api:8000";

const nextConfig = {
  // standalone keeps the Docker runtime image small (~150MB instead of ~1GB)
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiInternal}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
