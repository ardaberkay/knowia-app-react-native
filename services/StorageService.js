import { supabase } from '../lib/supabase';

export const uploadCardImage = async (deckId, userId, buffer) => {
  const filePath = `card_${deckId}_${userId}_${Date.now()}.webp`;
  const { error } = await supabase.storage
    .from('images')
    .upload(filePath, buffer, { contentType: 'image/webp', upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('images').getPublicUrl(filePath);
  return urlData.publicUrl;
};

export const uploadAvatar = async (userId, buffer) => {
  const filePath = `user_${userId}_${Date.now()}.webp`;
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
