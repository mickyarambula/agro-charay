import React, { useEffect, useState } from 'react';

const TOAST_EVENT = 'agro-mobile-toast';
const DURATION = 3000;

const TYPE_STYLES = {
  success: { bg: '#15803D', color: '#ffffff' },
  error:   { bg: '#ef4444', color: '#ffffff' },
  info:    { bg: '#1f2937', color: '#ffffff' },
};

export function showToast(message, type = 'info') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, type } }));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const onToast = (e) => {
      const id = Date.now() + Math.random();
      const { message, type } = e.detail || {};
      setToasts((prev) => [...prev, { id, message, type: type || 'info' }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, DURATION);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        zIndex: 10000,
        pointerEvents: 'none',
        padding: '0 16px',
      }}
    >
      {toasts.map((t) => {
        const st = TYPE_STYLES[t.type] || TYPE_STYLES.info;
        return (
          <div
            key={t.id}
            role="status"
            style={{
              background: st.bg,
              color: st.color,
              padding: '14px 20px',
              borderRadius: 999,
              fontSize: 15,
              fontWeight: 600,
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)',
              maxWidth: 460,
              textAlign: 'center',
              pointerEvents: 'auto',
              animation: 'agro-toast-in 220ms ease',
            }}
          >
            {t.message}
          </div>
        );
      })}
      <style>{`
        @keyframes agro-toast-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
