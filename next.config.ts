import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure the bundled ENABLE word list ships with the serverless functions
  // that need it (word validation on submit).
  outputFileTracingIncludes: {
    "/api/play/submit": ["./src/data/wordlist.txt"],
    "/api/validate-word": ["./src/data/wordlist.txt"],
  },
};

export default nextConfig;
