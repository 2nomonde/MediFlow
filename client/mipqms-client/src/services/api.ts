import axios, { AxiosError } from "axios";
import type { ApiErrorResponse } from "@/types/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

const TOKEN_STORAGE_KEY = "mipqms.accessToken";

/**
 * Token storage strategy — documented explicitly, per the Phase 5
 * requirement to be clear about this rather than leaving it implicit.
 *
 * The access token is kept in localStorage so a page refresh doesn't log
 * the user out (a plain in-memory variable would lose it on every
 * reload). The trade-off: localStorage is readable by any JavaScript
 * that runs on the page, so it is vulnerable to theft via a successful
 * XSS attack, unlike an httpOnly cookie which client-side JS can't read
 * at all. An httpOnly-cookie-based flow would be the stronger choice for
 * a production deployment, but it requires the backend to issue and
 * manage the cookie (Phase 4 issues a bearer token in the JSON response
 * body, not a cookie) — changing that is out of scope for this phase and
 * would mean revisiting Phase 4, not something to do silently here.
 * Combined with the Phase 4 access token's short (15 minute) expiry, the
 * exposure window if a token were ever stolen is intentionally small.
 */
export const tokenStorage = {
  get(): string | null {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  },
  set(token: string): void {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  },
  clear(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  },
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach the bearer token to every outgoing request, if we have one.
api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Fired by AuthContext once, on module load, so a 401 anywhere in the
 * app can clear auth state and redirect — without api.ts importing
 * AuthContext directly and creating a circular dependency.
 */
let onUnauthorized: (() => void) | null = null;
export function registerUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    if (error.response?.status === 401) {
      tokenStorage.clear();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);

/** Extracts a user-facing message from any Axios/API error, never a raw stack trace. */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorResponse | undefined;
    if (data?.message) return data.message;
    if (error.code === "ERR_NETWORK") {
      return "Can't reach the server. Check your connection and try again.";
    }
    if (error.response?.status === 503) {
      return "The service is temporarily unavailable. Please try again shortly.";
    }
  }
  return "Something went wrong. Please try again.";
}
