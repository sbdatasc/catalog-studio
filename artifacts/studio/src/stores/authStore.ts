import { create } from "zustand";
import { getApiBase } from "@/lib/apiClient";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  systemRole: "user" | "platform_admin";
  isActive: boolean;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setTokenAndUser: (token: string, user: AuthUser) => void;
  reset: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
}

const initialState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  ...initialState,

  setTokenAndUser(token: string, user: AuthUser) {
    set({ user, accessToken: token, isAuthenticated: true });
  },

  reset() {
    set({ ...initialState });
  },

  async login(email: string, password: string) {
    set({ isLoading: true });
    try {
      const res = await fetch(`${getApiBase()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (!res.ok || body.error) {
        throw new Error(body.error?.message ?? "Login failed");
      }
      const { user, accessToken } = body.data as { user: AuthUser; accessToken: string };
      set({ user, accessToken, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  async register(email: string, password: string, confirmPassword: string) {
    set({ isLoading: true });
    try {
      const res = await fetch(`${getApiBase()}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, confirmPassword }),
      });
      const body = await res.json();
      if (!res.ok || body.error) {
        throw new Error(body.error?.message ?? "Registration failed");
      }
      const { user, accessToken } = body.data as { user: AuthUser; accessToken: string };
      set({ user, accessToken, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  async logout() {
    const { accessToken } = get();
    try {
      await fetch(`${getApiBase()}/auth/logout`, {
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        credentials: "include",
      });
    } catch {
      // Silent — clear local state regardless
    }
    set({ ...initialState });
  },

  async refresh(): Promise<boolean> {
    try {
      const res = await fetch(`${getApiBase()}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        set({ ...initialState });
        return false;
      }
      const body = await res.json();
      if (body.error) {
        set({ ...initialState });
        return false;
      }
      const { user, accessToken } = body.data as { user: AuthUser; accessToken: string };
      set({ user, accessToken, isAuthenticated: true });
      return true;
    } catch {
      set({ ...initialState });
      return false;
    }
  },
}));
