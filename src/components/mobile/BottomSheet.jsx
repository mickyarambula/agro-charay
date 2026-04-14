import React, { useEffect, useState } from 'react';

// Paleta Organic Biophilic (ui-ux-pro-max)
const C = {
  primary:    '#15803D',
  bg:         '#F0FDF4',
  text:       '#14532D',
  border:     '#d1d5db',
};

const closeBtnStyleId = 'bottomsheet-close-style';
function ensureCloseBtnStyle() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(closeBtnStyleId)) return;
  const el = document.createElement('style');
  el.id = closeBtnStyleId;
  el.textContent = `
    .bottomsheet-close {
      transition: background-color 180ms ease, transform 180ms ease;
    }
    .bottomsheet-close:hover { background: #d1d5db; }
    .bottomsheet-close:active { transform: scale(0.94); }
    .bottomsheet-close:focus-visible {
      outline: 2px solid ${C.primary};
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(el);
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export default function BottomSheet({ isOpen, onClose, title, children, footer }) {
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => { ensureCloseBtnStyle(); }, []);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  const slideTransition = reducedMotion
    ? 'none'
    : 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)';
  const overlayTransition = reducedMotion ? 'none' : 'background 220ms ease';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: isOpen ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0)',
        pointerEvents: isOpen ? 'auto' : 'none',
        transition: overlayTransition,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 640,
          height: '90vh',
          background: C.bg,
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: slideTransition,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          touchAction: 'manipulation',
        }}
      >
        {/* Header fijo */}
        <div style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: `1px solid #e5e7eb`,
          boxShadow: '0 1px 0 rgba(21, 128, 61, 0.04)',
          background: C.bg,
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>{title}</div>
          <button
            className="bottomsheet-close"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              width: 48,
              height: 48,
              borderRadius: 999,
              border: 'none',
              background: '#e5e7eb',
              color: C.text,
              fontSize: 22,
              fontWeight: 700,
              cursor: 'pointer',
              lineHeight: 1,
              touchAction: 'manipulation',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div style={{
          flex: '1 1 auto',
          overflowY: 'auto',
          padding: 18,
          WebkitOverflowScrolling: 'touch',
        }}>
          {children}
        </div>

        {/* Footer fijo (opcional) */}
        {footer && (
          <div style={{
            flex: '0 0 auto',
            padding: 14,
            borderTop: `1px solid ${C.border}`,
            background: C.bg,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
