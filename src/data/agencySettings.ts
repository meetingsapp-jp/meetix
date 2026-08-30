import { supabase } from '../lib/supabaseClient';

function client() {
  if (!supabase) throw new Error('Supabase no está configurado (.env).');
  return supabase;
}

// Uploads a logo into the agency's folder and returns its public URL.
export async function uploadLogo(agencyId: string, file: File): Promise<string> {
  const db = client();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `${agencyId}/logo-${Date.now()}.${ext}`;
  const { error } = await db.storage.from('logos').upload(path, file, { upsert: true, cacheControl: '3600' });
  if (error) throw new Error(error.message);
  const { data } = db.storage.from('logos').getPublicUrl(path);
  return data.publicUrl;
}

export async function updateBranding(
  agencyId: string,
  branding: { name?: string; brand_color?: string | null; logo_url?: string | null },
): Promise<void> {
  const { error } = await client().from('agencies').update(branding).eq('id', agencyId);
  if (error) throw new Error(error.message);
}
