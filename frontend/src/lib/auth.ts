const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? "http://localhost:3000";
const TOKEN_KEY = "transit_token";

export type Role = "rider" | "driver";

export interface AuthPayload {
  sub: string;
  role: Role;
  iat: number;
  exp: number;
}

async function request(path: string, body: unknown) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message ?? "Something went wrong. Try again.");
  }
  return json;
}

export async function signup(params: {
  email: string;
  password: string;
  name: string;
  role: Role;
}) {
  const json = await request("/auth/signup", params);
  setToken(json.token);
  return json.token as string;
}

export async function login(params: { email: string; password: string }) {
  const json = await request("/auth/login", params);
  setToken(json.token);
  return json.token as string;
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function decodeToken(token: string): AuthPayload {
  return JSON.parse(atob(token.split(".")[1]));
}

export function getCurrentUser(): AuthPayload | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = decodeToken(token);
    if (payload.exp * 1000 < Date.now()) {
      clearToken();
      return null;
    }
    return payload;
  } catch {
    clearToken();
    return null;
  }
}
