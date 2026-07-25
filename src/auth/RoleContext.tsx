import { useAuth } from './AuthContext';

// Role now comes from the authenticated user (no more in-app selector).
// Kept as a thin hook so existing feature pages keep working unchanged.
export function useRole() {
  const { role, can } = useAuth();
  return { role, can };
}
