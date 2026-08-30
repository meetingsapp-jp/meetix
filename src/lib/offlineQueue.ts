// A tiny localStorage-backed queue for actions taken while offline (no
// connectivity at the airport, etc.). Currently only "marcar llegada" uses
// it, but the shape is generic enough to extend later.
import { setArrived } from '../data/coordinator';

export interface QueuedArrival {
  id: string; // queue entry id (not the passenger id)
  agencyId: string;
  passengerId: string;
  passengerName: string;
  arrived: boolean;
  queuedAt: string;
}

const KEY = 'meetix.offlineQueue.arrivals';

function read(): QueuedArrival[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedArrival[]) : [];
  } catch {
    return [];
  }
}

function write(items: QueuedArrival[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable (private mode, quota) — the queue is best-effort */
  }
}

export function getQueuedArrivals(): QueuedArrival[] {
  return read();
}

export function enqueueArrival(item: Omit<QueuedArrival, 'id' | 'queuedAt'>): void {
  const items = read();
  items.push({ ...item, id: crypto.randomUUID(), queuedAt: new Date().toISOString() });
  write(items);
}

// Attempts to replay every queued arrival. Entries that succeed are removed;
// entries that fail (still offline, or a real error) stay queued.
export async function flushArrivalQueue(): Promise<{ synced: number; remaining: number }> {
  const items = read();
  if (!items.length) return { synced: 0, remaining: 0 };

  const stillQueued: QueuedArrival[] = [];
  let synced = 0;
  for (const item of items) {
    try {
      await setArrived(item.agencyId, item.passengerId, item.arrived);
      synced++;
    } catch {
      stillQueued.push(item);
    }
  }
  write(stillQueued);
  return { synced, remaining: stillQueued.length };
}
