import type { ReactNode } from "react";
import { RouteVisual } from "./RouteVisual";
import "./AuthShell.css";

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-shell">
      <div className="auth-shell__form-pane">
        <div className="auth-shell__form-wrap">
          <div className="auth-shell__brand">Transit</div>
          <div className="auth-shell__eyebrow">{eyebrow}</div>
          <h1 className="auth-shell__title">{title}</h1>
          <p className="auth-shell__subtitle">{subtitle}</p>
          {children}
        </div>
      </div>
      <div className="auth-shell__visual-pane">
        <RouteVisual />
      </div>
    </div>
  );
}
