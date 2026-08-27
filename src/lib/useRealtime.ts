import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Hook para sincronizar una lista desde Supabase con real-time.
 * Escucha INSERT/UPDATE/DELETE en la tabla y actualiza la lista automáticamente.
 */
export function useRealtimeList<T extends { id: string }>(
  table: string,
  query: (db: typeof supabase) => Promise<T[]>,
  deps: unknown[] = [],
): [data: T[], loading: boolean, error: string | null] {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let channel: RealtimeChannel | null = null;

    const load = async () => {
      try {
        setError(null);
        const result = await query(supabase);
        if (active) setData(result);
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    // Subscribe to real-time changes
    channel = supabase
      .channel(`${table}:changes`)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table },
        async () => {
          if (!active) return;
          // Reload data on any change
          try {
            const result = await query(supabase);
            setData(result);
          } catch (e) {
            setError((e as Error).message);
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      if (channel) channel.unsubscribe();
    };
  }, deps);

  return [data, loading, error];
}

/**
 * Hook para sincronizar un valor individual con real-time.
 * Ideal para contadores o estados simples que cambian frecuentemente.
 */
export function useRealtimeValue<T>(
  table: string,
  selector: (db: typeof supabase) => Promise<T>,
  deps: unknown[] = [],
): [value: T | null, loading: boolean, error: string | null] {
  const [value, setValue] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let channel: RealtimeChannel | null = null;

    const load = async () => {
      try {
        setError(null);
        const result = await selector(supabase);
        if (active) setValue(result);
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    // Subscribe to real-time changes
    channel = supabase
      .channel(`${table}:value`)
      .on('postgres_changes' as any, { event: '*', schema: 'public', table }, async () => {
        if (!active) return;
        try {
          const result = await selector(supabase);
          setValue(result);
        } catch (e) {
          setError((e as Error).message);
        }
      })
      .subscribe();

    return () => {
      active = false;
      if (channel) channel.unsubscribe();
    };
  }, deps);

  return [value, loading, error];
}
