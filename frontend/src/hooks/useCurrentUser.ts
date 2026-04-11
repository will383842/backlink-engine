import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export function useCurrentUser(options: { enabled?: boolean } = {}) {
  return useQuery<CurrentUser>({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { data } = await api.get("/auth/me");
      return data.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: options.enabled ?? true,
  });
}
