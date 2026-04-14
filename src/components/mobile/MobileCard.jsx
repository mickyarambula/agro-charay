import React from 'react';

// Paleta Organic Biophilic (ui-ux-pro-max)
const C = {
  primary:    '#15803D',
  secondary:  '#22C55E',
  cta:        '#CA8A04',
  bg:         '#F0FDF4',
  text:       '#14532D',
  muted:      '#4b5563',
  border:     '#d1d5db',
  borderSoft: '#e5e7eb',
};

const ESTATUS_STYLE = {
  pendiente:  { bg: '#fef3c7', color: '#f59e0b', border: '#f59e0b', label: 'Pendiente' },
  enProgreso: { bg: '#dbeafe', color: '#3b82f6', border: '#3b82f6', label: 'En progreso' },
  completado: { bg: '#dcfce7', color: '#15803D', border: '#15803D', label: 'Completado' },
  cancelado:  { bg: '#fee2e2', color: '#ef4444', border: '#ef4444', label: 'Cancelado' },
};

const focusStyleId = 'mobilecard-focus-style';

function ensureFocusStyle() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(focusStyleId)) return;
  const el = document.createElement('style');
  el.id = focusStyleId;
  el.textContent = `
    .mobilecard-btn:focus-visible {
      outline: 2px solid ${C.primary};
      outline-offset: 2px;
    }
    .mobilecard-root:focus-visible {
      outline: 2px solid ${C.primary};
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(el);
}

export default function MobileCard({ orden, onCompletar, onEditar, onClick }) {
  React.useEffect(() => { ensureFocusStyle(); }, []);

  if (!orden) return null;
  const est = ESTATUS_STYLE[orden.estatus] || ESTATUS_STYLE.pendiente;
  const terminado = orden.estatus === 'completado' || orden.estatus === 'cancelado';
  const clickable = typeof onClick === 'function';

  return (
    <div
      className={clickable ? 'mobilecard-root' : undefined}
      onClick={clickable ? onClick : undefined}
      tabIndex={clickable ? 0 : undefined}
      style={{
        background: C.bg,
        border: `1px solid ${C.borderSoft}`,
        boxShadow: '0 2px 8px rgba(21, 128, 61, 0.12)',
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        cursor: clickable ? 'pointer' : 'default',
        touchAction: 'manipulation',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{
          padding: '6px 14px',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 700,
          background: est.bg,
          color: est.color,
          border: `1px solid ${est.border}33`,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>{est.label}</span>
        <div style={{
          fontSize: 17,
          fontWeight: 700,
          color: C.text,
          flex: 1,
          minWidth: 0,
        }}>{orden.tipoTrabajo || 'Trabajo'}</div>
        {orden.horaInicio && (
          <span style={{ fontSize: 12, color: C.muted }}>⏰ {orden.horaInicio}</span>
        )}
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: '#374151', marginBottom: 14 }}>
        <div>👷 <strong style={{ color: C.text }}>{orden.operadorNombre || '—'}</strong></div>
        <div>📍 <strong style={{ color: C.primary }}>{orden.loteNombre || '—'}</strong></div>
        <div>🚜 <strong style={{ color: C.text }}>{orden.maquinariaNombre || '—'}</strong></div>
        {orden.horasEstimadas > 0 && (
          <div>⏱ <strong style={{ color: C.text }}>{orden.horasEstimadas}h</strong> estimadas</div>
        )}
      </div>

      {/* Footer */}
      {!terminado && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="mobilecard-btn"
            onClick={(e) => { e.stopPropagation(); onCompletar && onCompletar(); }}
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: 10,
              border: 'none',
              background: C.cta,
              color: '#ffffff',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              touchAction: 'manipulation',
              transition: 'background-color 180ms ease',
            }}
          >
            ✅ Completar
          </button>
          <button
            className="mobilecard-btn"
            onClick={(e) => { e.stopPropagation(); onEditar && onEditar(); }}
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: '#f3f4f6',
              color: '#374151',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              touchAction: 'manipulation',
              transition: 'background-color 180ms ease',
            }}
          >
            ✏️ Editar
          </button>
        </div>
      )}
    </div>
  );
}
