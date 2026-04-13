// ─── shared/Modal.jsx ───────────────────────────────────────────────────────
// Componentes reutilizables: Modal, BadgeCancelado, ModalCancelacion,
// ModalReactivacion, BtnExport, NavBadge.

import React, { useState } from 'react';
import { T, MOTIVOS_CANCELACION } from './utils.js';

export function Modal({ title, onClose, footer, children }) {
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function ModalCancelacion({ titulo, onConfirmar, onCerrar }) {
  const [motivo, setMotivo] = useState(MOTIVOS_CANCELACION[0]);
  const [comentario, setComentario] = useState("");

  return (
    <Modal title={`Cancelar: ${titulo}`} onClose={onCerrar}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCerrar}>← Volver</button>
          <button className="btn btn-danger" onClick={() => {
            if (!motivo) return;
            onConfirmar({ motivo, comentario });
          }}>🚫 Confirmar Cancelación</button>
        </>
      }>
      <div style={{marginBottom:12,padding:"10px 14px",background:"#fff3cd",borderRadius:8,border:"1px solid #ffc107",fontSize:13,color:"#856404"}}>
        ⚠️ Este registro quedará <strong>cancelado e inhabilitado</strong>. No se sumará en totales pero quedará visible en el historial. Solo el Administrador puede reactivarlo.
      </div>
      <div className="form-group">
        <label className="form-label">Motivo de cancelación *</label>
        <select className="form-select" value={motivo} onChange={e => setMotivo(e.target.value)}>
          {MOTIVOS_CANCELACION.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Comentario adicional (opcional)</label>
        <input className="form-input" value={comentario}
          onChange={e => setComentario(e.target.value)}
          placeholder="Describe el motivo con más detalle..." />
      </div>
    </Modal>
  );
}

export function ModalReactivacion({ titulo, onConfirmar, onCerrar }) {
  const [motivo, setMotivo] = useState("Cancelación incorrecta");
  const [comentario, setComentario] = useState("");

  return (
    <Modal title={`Reactivar: ${titulo}`} onClose={onCerrar}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCerrar}>← Volver</button>
          <button className="btn btn-primary" onClick={() => onConfirmar({ motivo, comentario })}>
            ✅ Confirmar Reactivación
          </button>
        </>
      }>
      <div style={{marginBottom:12,padding:"10px 14px",background:"#d4edda",borderRadius:8,border:"1px solid #28a745",fontSize:13,color:"#155724"}}>
        ✅ Este registro volverá a estar <strong>activo</strong> y se sumará en los totales.
      </div>
      <div className="form-group">
        <label className="form-label">Motivo de reactivación *</label>
        <select className="form-select" value={motivo} onChange={e => setMotivo(e.target.value)}>
          <option value="Cancelación incorrecta">Cancelación incorrecta</option>
          <option value="Error al cancelar">Error al cancelar</option>
          <option value="Otro">Otro</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Comentario adicional (opcional)</label>
        <input className="form-input" value={comentario}
          onChange={e => setComentario(e.target.value)}
          placeholder="Explica por qué se reactiva..." />
      </div>
    </Modal>
  );
}

export function BadgeCancelado({ registro }) {
  if (!registro?.cancelado) return null;
  return (
    <span title={`Cancelado: ${registro.motivoCancelacion || ""} — ${registro.fechaCancelacion || ""}`}
      style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:8,
        background:"#c0392b22",color:"#c0392b",border:"1px solid #c0392b44",
        marginLeft:4,verticalAlign:"middle",letterSpacing:0.5}}>
      CANCELADO
    </span>
  );
}

export function BtnExport({ onClick, label="📥 Exportar Excel", style={} }) {
  return (
    <button onClick={onClick}
      style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",
        borderRadius:7,border:"1.5px solid #2d5a1b",background:"white",
        color:"#2d5a1b",fontSize:12,fontWeight:600,cursor:"pointer",...style}}>
      {label}
    </button>
  );
}

export function NavBadge({ label }) {
  return <span style={{fontSize:10,color:"#8a8070",fontWeight:500,cursor:"pointer"}}>→ {label}</span>;
}

