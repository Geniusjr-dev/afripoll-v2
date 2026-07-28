/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer, webpack }) => {
    // Rewrite "node:fs" -> "fs" etc. so webpack doesn't choke on the node: scheme (pptxgenjs 4.x).
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
        resource.request = resource.request.replace(/^node:/, "");
      })
    );
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("pptxgenjs", "docx", "xlsx", "file-saver");
    }
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false, https: false, http: false, path: false, stream: false,
      os: false, crypto: false, zlib: false, util: false, url: false, assert: false, buffer: false, process: false,
    };
    return config;
  },
};
export default nextConfig;
