import { Request, Response } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

export const offersProxy = createProxyMiddleware<Request, Response>({
  target: "http://matching-service:3003",
  changeOrigin: true,
  pathRewrite: { "^/": "/offers/" },
  on: {
    proxyReq: (proxyReq, req) => {
      if (req.user) {
        proxyReq.setHeader("x-user-id", String(req.user.sub));
        proxyReq.setHeader("x-user-role", String(req.user.role));
      }
    },
  },
});
