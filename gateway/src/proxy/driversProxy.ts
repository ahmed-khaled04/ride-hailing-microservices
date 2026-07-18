import { Request, Response } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

export const driversProxy = createProxyMiddleware<Request, Response>({
  target: "http://location-service:3004",
  changeOrigin: true,
  pathRewrite: { "^/": "/drivers/" },
  on: {
    proxyReq: (proxyReq, req) => {
      if (req.user) {
        proxyReq.setHeader("x-user-id", String(req.user.sub));
        proxyReq.setHeader("x-user-role", String(req.user.role));
      }
    },
  },
});
