import { createProxyMiddleware } from "http-proxy-middleware";

export const authProxy = createProxyMiddleware({
  target: "http://auth-service:3001",
  changeOrigin: true,
  pathRewrite: { "^/": "/auth/" },
});
