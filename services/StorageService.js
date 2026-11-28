import { supabase } from '../lib/supabase';

// New uploads live under the owner's folder ({userId}/…), so storage rules and
// account deletion can work per user. Older files use flat names that still
// contain the userId (card_{deckId}_{userId}_{ts}.webp, user_{userId}_{ts}.webp).

export const uploadCardImage = async (deckId, userId, buffer) => {
  // random part: several images can be uploaded in the same millisecond (CSV import)
  const filePath = `${userId}/card_${deckId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`;
  const { error } = await supabase.storage
    .from('images')
    .upload(filePath, buffer, { contentType: 'image/webp', upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('images').getPublicUrl(filePath);
  return urlData.publicUrl;
};

export const uploadAvatar = async (userId, buffer) => {
  const filePath = `${userId}/avatar_${Date.now()}.webp`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(filePath, buffer, { contentType: 'image/webp', upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
  return { publicUrl: urlData.publicUrl, filePath };
};

export const removeAvatar = async (imageFilePath) => {
  if (!imageFilePath) return;
  const { error } = await supabase.storage.from('avatars').remove([imageFilePath]);
  if (error) throw error;
};

/**
 * Public URL → object path inside the bucket (folders included), or null when
 * the URL isn't one of our files (e.g. an external image from a CSV).
 */
export const storagePathFromPublicUrl = (url, bucket) => {
  if (!url || typeof url !== 'string') return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const path = url.slice(i + marker.length).split('?')[0];
  try {
    return decodeURIComponent(path) || null;
  } catch {
    return path || null;
  }
};

const IN_BATCH = 20; // keeps the `in(...)` URL short

/**
 * Deletes card images that no card references any more. Call it AFTER the
 * database write (update/delete) succeeded, so a failed write never points at
 * a deleted file. Storage rules only let the owner delete, so other users'
 * files are skipped by the server. Never throws.
 */
export const removeUnusedCardImages = async (imageUrls) => {
  const urls = [...new Set((imageUrls || []).filter(Boolean))];
  if (urls.length === 0) return;
  try {
    const stillUsed = new Set();
    for (let i = 0; i < urls.length; i += IN_BATCH) {
      const { data, error } = await supabase
        .from('cards')
        .select('image')
        .in('image', urls.slice(i, i + IN_BATCH));
      if (error) throw error;
      (data || []).forEach((row) => stillUsed.add(row.image));
    }
    const paths = urls
      .filter((u) => !stillUsed.has(u))
      .map((u) => storagePathFromPublicUrl(u, 'images'))
      .filter(Boolean);
    if (paths.length === 0) return;
    const { error } = await supabase.storage.from('images').remove(paths);
    if (error) throw error;
  } catch (e) {
    if (__DEV__) console.warn('Card image cleanup failed:', e?.message);
  }
};
