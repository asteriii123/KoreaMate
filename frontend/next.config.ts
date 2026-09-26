import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  typedRoutes: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  transpilePackages: ["@koreamate/contracts"],
};

export default nextConfig;
