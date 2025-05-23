import { supabase } from '../lib/supabase';

// Aktif kullanıcının profilini getirir
export async function getCurrentUserProfile() {
  // Önce oturumdaki kullanıcıyı al
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Kullanıcı oturumu bulunamadı');

  // profiles tablosundan verileri çek
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, created_at, email, updated_at, image_url')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  return data;
} 