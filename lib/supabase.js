import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// .env dosyasından Supabase URL ve anon key'i al
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Supabase istemcisini oluştur
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  },
  // Real-time özelliklerini devre dışı bırak
  realtime: {
    enabled: false
  }
}); 