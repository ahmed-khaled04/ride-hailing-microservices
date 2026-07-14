import { Request, Response } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

export const tripsProxy = createProxyMiddleware<Request, Response>({
  target: "http://trip-service:3002",
  changeOrigin: true,
  pathRewrite: { "^/": "/trips/" },
  on: {
    proxyReq: (proxyReq, req) => {
      if (req.user) {
        proxyReq.setHeader("x-user-id", String(req.user.sub));
        proxyReq.setHeader("x-user-role", String(req.user.role));
      }
    },
  },
});
