import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // MediaPipe Tasks Vision is ESM + wasm loaded from CDN at runtime.
  transpilePackages: ["@mediapipe/tasks-vision", "three", "@react-three/fiber", "@react-three/drei"],
};

export default nextConfig;
