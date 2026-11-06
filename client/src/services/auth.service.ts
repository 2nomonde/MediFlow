import { api, tokenStorage } from "./api";
import type { ApiSuccessResponse } from "@/types/api";
import type { AuthUser } from "@/types/auth";

interface LoginResponseData {
  user: AuthUser;
  accessToken: string;
  tokenType: string;
  expiresIn: string;
}

interface MeResponseData {
  user: AuthUser;
}

export const authService = {
  async login(email: string, password: string): Promise<AuthUser> {
    const { data } = await api.post<ApiSuccessResponse<LoginResponseData>>("/auth/login", {
      email,
      password,
    });
    tokenStorage.set(data.data.accessToken);
    return data.data.user;
  },

  async me(): Promise<AuthUser> {
    const { data } = await api.get<ApiSuccessResponse<MeResponseData>>("/auth/me");
    return data.data.user;
  },

  async logout(): Promise<void> {
    try {
      await api.post("/auth/logout");
    } finally {
      // Clear locally regardless of whether the network call succeeded —
      // the user must never be stuck "logged in" client-side just
      // because the logout request failed to reach the server.
      tokenStorage.clear();
    }
  },
};
