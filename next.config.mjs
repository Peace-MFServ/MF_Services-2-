/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloud Run serves the app from a container, so build a self-contained
  // server bundle rather than relying on node_modules being present.
  output: "standalone",
};

export default nextConfig;
