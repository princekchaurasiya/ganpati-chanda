const { createProxyMiddleware } = require("http-proxy-middleware");

const target = process.env.BACKEND_PROXY_TARGET || "http://127.0.0.1:18080";

module.exports = function setupProxy(app) {
  const apiProxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    secure: false,
    logLevel: "warn",
  });
  app.use("/api", apiProxy);
  app.use("/health", apiProxy);
};
