import { supabaseClient } from './supabase.js';

let realtimeChannel = null;
const listeners = new Map();

export const initRealtime = () => {
  if (realtimeChannel) return realtimeChannel;
  realtimeChannel = supabaseClient
    .channel('ordenes-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes_trabajo' }, (payload) => {
      console.log('Realtime event:', payload);
      listeners.forEach(cb => cb(payload));
    })
    .subscribe((status) => {
      console.log('Realtime status:', status);
    });
  return realtimeChannel;
};

export const subscribeToOrdenes = (key, callback) => {
  listeners.set(key, callback);
  return () => listeners.delete(key);
};
