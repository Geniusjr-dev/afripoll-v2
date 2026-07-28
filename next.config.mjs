/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (isServer) {
      // These export libraries are browser-only; don't bundle them into the server build.
      config.externals = config.externals || [];
      config.externals.push("pptxgenjs", "docx", "xlsx", "file-saver");
    }
    // Some libs reference node: scheme modules; provide fallbacks so the client build ignores them.
    config.resolve = config.resolve || {};
    config.resolve.fallback = { ...(config.resolve.fallback || {}), fs: false, https: false, http: false, path: false, stream: false, os: false, crypto: false, zlib: false };
    return config;
  },
};
export default nextConfig;
