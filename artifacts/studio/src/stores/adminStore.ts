import { create } from "zustand";
import { getApiBase } from "@/lib/apiClient";
import { useAuthStore } from "@/stores/authStore";

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  systemRole: "user" | "platform_admin";
  isActive: boolean;
  isSelf: boolean;
  createdAt: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

interface Pagination {
  page: number;
  total: number;
  limit: number;
  hasMore: boolean;
}

interface AdminState {
  users: AdminUser[];
  usersLoading: boolean;
  usersError: ApiError | null;
  pagination: Pagination;

  fetchUsers: (params?: { search?: string; page?: number; limit?: number }) => Promise<void>;
  updateUser: (user: AdminUser) => void;
  reset: () => void;
}

const DEFAULT_PAGINATION: Pagination = {
  page: 1,
  total: 0,
  limit: 50,
  hasMore: false,
};

async function adminFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error: ApiError | null }> {
  const accessToken = useAuthStore.getState().accessToken;
  const res = await fetch(`${getApiBase()}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });
  const body = await res.json();
  return body;
}

export const useAdminStore = create<AdminState>()((set, get) => ({
  users: [],
  usersLoading: false,
  usersError: null,
  pagination: DEFAULT_PAGINATION,

  async fetchUsers(params) {
    set({ usersLoading: true, usersError: null });
    try {
      const qs = new URLSearchParams();
      if (params?.search) qs.set("search", params.search);
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));

      const { data, error } = await adminFetch<{
        users: AdminUser[];
        total: number;
        page: number;
        limit: number;
      }>(`/admin/users?${qs.toString()}`);

      if (error || !data) {
        set({
          usersLoading: false,
          usersError: error ?? { code: "UNKNOWN", message: "Failed to load users" },
        });
        return;
      }

      set({
        users: data.users,
        usersLoading: false,
        pagination: {
          page: data.page,
          total: data.total,
          limit: data.limit,
          hasMore: data.page * data.limit < data.total,
        },
      });
    } catch {
      set({
        usersLoading: false,
        usersError: { code: "NETWORK_ERROR", message: "Network error — please try again" },
      });
    }
  },

  updateUser(user: AdminUser) {
    set((state) => ({
      users: state.users.map((u) => (u.id === user.id ? user : u)),
    }));
  },

  reset() {
    set({
      users: [],
      usersLoading: false,
      usersError: null,
      pagination: DEFAULT_PAGINATION,
    });
  },
}));
