/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone keeps the Docker runtime image small (~150MB instead of ~1GB)
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
