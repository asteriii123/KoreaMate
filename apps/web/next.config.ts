import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  typedRoutes: true,
  transpilePackages: ["@koreamate/contracts"],
};

export default nextConfig;
