import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // The LMS reads curriculum/*.md at runtime (lib/lms/curriculum.ts).
  // Force-include those files in the serverless bundle so they exist on
  // Vercel — without this, fs reads of the curriculum dir 404 in prod.
  outputFileTracingIncludes: {
    "/learn": ["./curriculum/**/*.md"],
    "/learn/[day]": ["./curriculum/**/*.md"],
    "/admin": ["./curriculum/**/*.md"],
  },
};

export default nextConfig;
