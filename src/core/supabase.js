// ─── core/supabase.js ──────────────────────────────────────────────────────
// Cliente Supabase + constantes de sincronización. El cliente se inicializa
// una sola vez al importar este módulo; si falla, supabaseClient queda en null
// y la app cae a fallback localStorage.

import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://oryixvodfqojunnqbkln.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yeWl4dm9kZnFvanVubnFia2xuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODUzMjAsImV4cCI6MjA5MTQ2MTMyMH0.03nXDh5qj7N-RiCqXxGKvhfZSVWDmuV4hFwTOZ66ZCQ';
export const SYNC_CHANNEL = 'agro-charay-sync';
export const SYNC_KEYS = [
  'solicitudesGasto', 'solicitudesCompra', 'recomendaciones',
  'ordenesCompra', 'notificaciones', 'delegaciones'
];

let _client = null;
try {
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
} catch (e) {
  console.warn('Supabase init falló — fallback a localStorage:', e);
  _client = null;
}
export const supabaseClient = _client;
