import { createContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { authService } from "@/services/auth.service";
import { registerUnauthorizedHandler, tokenStorage } from "@/services/api";
import type { AuthUser } from "@/types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True while the initial session check (or a login/logout) is in flight. */
  isLoading: boolean;
  /** Set when the session was ended by the server (401) rather than a user-initiated logout. */
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  // On first load, if a token is already stored (e.g. page refresh),
  // validate it against GET /api/auth/me rather than trusting it blindly —
  // it may have expired or the account may have been deactivated since.
  useEffect(() => {
    const token = tokenStorage.get();
    if (!token) {
      setIsLoading(false);
      return;
    }

    authService
      .me()
      .then(setUser)
      .catch(() => {
        tokenStorage.clear();
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Wired to the Axios 401 interceptor (services/api.ts) so ANY expired/
  // invalid token, from any request anywhere in the app, ends the
  // session consistently — not just ones that happen to go through login().
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      setUser(null);
      setSessionExpired(true);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const loggedInUser = await authService.login(email, password);
      setUser(loggedInUser);
      setSessionExpired(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setSessionExpired(false);
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        sessionExpired,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
