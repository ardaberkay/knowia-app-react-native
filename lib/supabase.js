import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// Supabase URL ve anonim anahtarınızı buraya ekleyin
const supabaseUrl = 'https://xgciwiqbtxzccabwbqtl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnY2l3aXFidHh6Y2NhYndicXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5MDk0NzksImV4cCI6MjA2MjQ4NTQ3OX0.blbTBXmPPuSLhzc1rxDuV2jtKpGsHMCgIb18TSlqn9I';

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