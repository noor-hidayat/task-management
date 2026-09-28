import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook to get current user from auth context.
 * Falls back to mock currentUser if not authenticated (for backward compatibility).
 */
export function useCurrentUser() {
  const { user } = useAuth();
  return user;
}