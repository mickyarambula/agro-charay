// ─── core/push.js ───────────────────────────────────────────────
// Helper para notificaciones push PWA.
// - solicitarPermisoPush(): pide permiso al usuario y se suscribe al push manager
// - enviarNotifLocal(title, body, url): dispara una notificación en este mismo
//   dispositivo (útil para confirmar acciones del usuario o cambios locales).
// Las notificaciones entre dispositivos distintos requieren un servidor VAPID
// que reenvíe los mensajes — por ahora solo implementamos las locales.

export const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa40hJQvIzX1-bpBq1-gN8eDqBGmzpxpIFmPKIy0fZjJh0pLqtNR_qgT1Kmg0';

export async function solicitarPermisoPush() {
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return null;

  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return null;

  const registro = await navigator.serviceWorker.ready;

  let suscripcion = await registro.pushManager.getSubscription();
  if (!suscripcion) {
    try {
      suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    } catch (e) {
      console.warn('Push subscribe falló:', e);
      return null;
    }
  }

  return suscripcion;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export async function enviarNotifLocal(title, body, url = '/') {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const registro = await navigator.serviceWorker.ready;
    registro.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url },
    });
  } catch (e) {
    console.warn('showNotification falló:', e);
  }
}
