import { useAuth } from './AuthContext';

// Agency now comes from the authenticated user's record.
// Kept as a thin hook so existing feature pages keep working unchanged.
export function useAgency() {
  const { agency, loading } = useAuth();
  return { agency, loading, error: null as string | null };
}
