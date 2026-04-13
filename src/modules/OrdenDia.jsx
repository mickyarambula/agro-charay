// ─── modules/OrdenDia.jsx ───────────────────────────────────────────────────
// Módulo del Encargado para crear y monitorear órdenes de trabajo del día.
// Al crear una orden, se abre WhatsApp con el mensaje pre-armado hacia el
// tractorista asignado.

import React, { useState } from 'react';
import { useData } from '../core/DataContext.jsx';
import { T } from '../shared/utils.js';
import { Modal } from '../shared/Modal.jsx';

const TIPOS_TRABAJO = [
  "Barbecho", "Rastreo", "Nivelación", "Surcado", "Siembra", "Fertilización",
  "Riego", "Aplicación herbicida", "Aplicación fungicida", "Aplicación insecticida",
  "Cosecha", "Transporte", "Mantenimiento", "Otro"
];

const ESTATUS_COLORES = {
  pendiente:    { bg: "#fff3cd", color: "#856404", border: "#ffc107", label: "⏳ Pendiente" },
  en_progreso:  { bg: "#fef5ed", color: "#e67e22", border: "#e67e22", label: "🚜 En progreso" },
  completado:   { bg: "#d4efdf", color: "#117a65", border: "#16a085", label: "✅ Completado" },
  cancelado:    { bg: "#fdf0ef", color: "#c0392b", border: "#c0392b", label: "🚫 Cancelado" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper — abrir WhatsApp con mensaje pre-armado
// ─────────────────────────────────────────────────────────────────────────────
export function enviarWhatsApp(orden, operador, lote, maquina) {
  if (!operador?.telefono || !operador.telefono.trim()) {
    alert("Agrega el teléfono del tractorista en el módulo de Operadores.");
    return false;
  }
  // Limpiar teléfono: dejar solo dígitos, aplicar prefijo MX si no lo trae
  let tel = operador.telefono.replace(/\D/g, "");
  if (tel.length === 10) tel = "52" + tel;
  else if (tel.length === 12 && tel.startsWith("52")) {
    // ya OK
  } else if (tel.length < 10) {
    alert("El teléfono del tractorista parece incompleto. Revisa el módulo de Operadores.");
    return false;
  }

  const fechaStr = new Date(orden.fecha || new Date()).toLocaleDateString("es-MX", {
    weekday: "long", day: "2-digit", month: "long",
  });

  const nombreLote = lote
    ? (lote.apodo && lote.apodo !== "NO DEFINIDO" ? lote.apodo : lote.folioCorto || `Lote #${lote.id}`)
    : "—";
  const nombreMaq = maquina?.nombre || "Por asignar";

  const mensaje = [
    "🌾 *AgroSistema Charay*",
    `📅 ${fechaStr}`,
    "",
    `Hola ${operador.nombre}, tu trabajo de hoy:`,
    `✅ *${orden.tipoTrabajo || "Trabajo asignado"}*`,
    `📍 Lote: ${nombreLote}`,
    `🚜 Máquina: ${nombreMaq}`,
    orden.horaInicio ? `⏰ Hora: ${orden.horaInicio}` : "",
    orden.horasEstimadas ? `⏱ Duración estimada: ${orden.horasEstimadas}h` : "",
    orden.notas ? `📝 Notas: ${orden.notas}` : "",
    "",
    "Cualquier novedad reporta al encargado.",
  ].filter(Boolean).join("\n");

  const url = `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function OrdenDia({ userRol, usuario }) {
  const { state, dispatch } = useData();
  const hoy = new Date().toISOString().split("T")[0];

  const operadores  = (state.operadores || []).filter(o => o.activo !== false);
  const lotes       = state.lotes      || [];
  const maquinaria  = state.maquinaria || [];
  const insumosArr  = state.insumos    || [];
  const ordenes     = (state.ordenesTrabajo || []).filter(o => o.fecha === hoy);

  const [modalNew, setModalNew] = useState(false);
  const emptyForm = {
    operadorId: "",
    loteId: "",
    tipoTrabajo: "",
    insumoId: "",
    maquinariaId: "",
    horaInicio: "",
    horasEstimadas: "",
    notas: "",
  };
  const [form, setForm] = useState(emptyForm);

  // Resolvers
  const getOperador = (id) => operadores.find(o => String(o.id) === String(id));
  const getLote     = (id) => lotes.find(l => String(l.id) === String(id));
  const getMaquina  = (id) => maquinaria.find(m => String(m.id) === String(id));
  const getInsumo   = (id) => insumosArr.find(i => String(i.id) === String(id));
  const nombreLote  = (l) => l ? (l.apodo && l.apodo !== "NO DEFINIDO" ? l.apodo : l.folioCorto || `Lote #${l.id}`) : "—";

  // Cuando cambia el operador, prellena la máquina asignada si existe
  const handleOperadorChange = (id) => {
    const op = getOperador(id);
    // maquinaAsignada en operadores es un string tipo "T-1". Buscamos por nombre/placas.
    let maqId = "";
    if (op?.maquinaAsignada) {
      const m = maquinaria.find(x =>
        x.placas === op.maquinaAsignada ||
        x.nombre?.includes(op.maquinaAsignada)
      );
      if (m) maqId = String(m.id);
    }
    setForm(f => ({ ...f, operadorId: id, maquinariaId: maqId }));
  };

  const abrirNueva = () => {
    setForm(emptyForm);
    setModalNew(true);
  };

  const guardarOrden = () => {
    if (!form.operadorId || !form.loteId || !form.tipoTrabajo) return;

    const payload = {
      ...form,
      operadorId: parseInt(form.operadorId, 10) || form.operadorId,
      loteId:     parseInt(form.loteId, 10)     || form.loteId,
      maquinariaId: form.maquinariaId ? (parseInt(form.maquinariaId, 10) || form.maquinariaId) : "",
      insumoId:   form.insumoId ? (parseInt(form.insumoId, 10) || form.insumoId) : "",
      horasEstimadas: parseFloat(form.horasEstimadas) || 0,
      fecha: hoy,
      estatus: "pendiente",
      creadoPor: usuario?.usuario || userRol,
    };

    dispatch({ type: "ADD_ORDEN_TRABAJO", payload });

    // Notificación al operador (push interno)
    const op  = getOperador(payload.operadorId);
    const lot = getLote(payload.loteId);
    const maq = getMaquina(payload.maquinariaId);
    dispatch({ type: "ADD_NOTIF", payload: {
      para: op?.usuario || "campo",
      tipo: "info",
      titulo: "📋 Nueva orden de trabajo",
      mensaje: `${payload.tipoTrabajo} en ${nombreLote(lot)} — ${payload.horasEstimadas || 0}h estimadas`,
    }});

    setModalNew(false);
    setForm(emptyForm);

    // Abrir WhatsApp con el mensaje pre-armado
    setTimeout(() => {
      enviarWhatsApp(payload, op, lot, maq);
    }, 100);
  };

  const marcarCompletada = (orden) => {
    if (!window.confirm(`¿Marcar como completada la orden "${orden.tipoTrabajo}" de ${getOperador(orden.operadorId)?.nombre || "—"}?`)) return;
    dispatch({ type: "UPD_ORDEN_TRABAJO", payload: {
      ...orden,
      estatus: "completado",
      horaFin: new Date().toISOString(),
    }});
    // Crear registro automático en bitácora
    const maq = getMaquina(orden.maquinariaId);
    dispatch({ type: "ADD_BITACORA", payload: {
      tipo: "reporte",
      loteId: parseInt(orden.loteId, 10) || null,
      loteIds: orden.loteId ? [parseInt(orden.loteId, 10)] : [],
      fecha: hoy,
      operador: getOperador(orden.operadorId)?.nombre || "",
      operadorId: orden.operadorId,
      maquinariaId: orden.maquinariaId || "",
      horas: parseFloat(orden.horasEstimadas) || 0,
      notas: `Orden de trabajo completada: ${orden.tipoTrabajo}`,
      data: { titulo: orden.tipoTrabajo, descripcion: orden.notas || "" },
    }});
  };

  const reenviarWhatsApp = (orden) => {
    const op  = getOperador(orden.operadorId);
    const lot = getLote(orden.loteId);
    const maq = getMaquina(orden.maquinariaId);
    enviarWhatsApp(orden, op, lot, maq);
  };

  const fechaLarga = new Date().toLocaleDateString("es-MX", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  // ─── KPIs ──
  const pendCount = ordenes.filter(o => o.estatus === "pendiente").length;
  const progCount = ordenes.filter(o => o.estatus === "en_progreso").length;
  const compCount = ordenes.filter(o => o.estatus === "completado").length;

  return (
    <div>
      {/* Header */}
      <div style={{
        padding: "20px 24px",
        background: "linear-gradient(135deg, #2d5a1b 0%, #4a8c2a 100%)",
        color: "white",
        borderRadius: 14,
        marginBottom: 20,
        boxShadow: "0 3px 12px rgba(45,90,27,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
              📋 Órdenes del Día
            </div>
            <div style={{ fontSize: 13, opacity: 0.9, textTransform: "capitalize" }}>
              {fechaLarga}
            </div>
          </div>
          <button onClick={abrirNueva}
            style={{
              background: "white",
              color: "#2d5a1b",
              border: "none",
              padding: "12px 20px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}>
            + Nueva orden
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Pendientes",   val: pendCount, color: "#856404", icon: "⏳" },
          { label: "En progreso",  val: progCount, color: "#e67e22", icon: "🚜" },
          { label: "Completadas",  val: compCount, color: "#16a085", icon: "✅" },
        ].map(k => (
          <div key={k.label} style={{
            padding: "16px 14px",
            background: "white",
            borderRadius: 12,
            textAlign: "center",
            borderTop: `4px solid ${k.color}`,
            boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
          }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{k.icon}</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: k.color, lineHeight: 1 }}>{k.val}</div>
            <div style={{ fontSize: 11, color: "#8a8070", fontWeight: 600, marginTop: 4, letterSpacing: 0.5, textTransform: "uppercase" }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Lista de órdenes */}
      {ordenes.length === 0 ? (
        <div style={{
          background: "white",
          borderRadius: 14,
          padding: "48px 24px",
          textAlign: "center",
          border: "2px dashed #ddd5c0",
        }}>
          <div style={{ fontSize: 54, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#3d3525", marginBottom: 6 }}>
            Sin órdenes para hoy
          </div>
          <div style={{ fontSize: 13, color: "#8a8070" }}>
            Toca <strong>+ Nueva orden</strong> arriba para crear la primera.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ordenes.map(orden => {
            const op  = getOperador(orden.operadorId);
            const lot = getLote(orden.loteId);
            const maq = getMaquina(orden.maquinariaId);
            const ins = getInsumo(orden.insumoId);
            const est = ESTATUS_COLORES[orden.estatus] || ESTATUS_COLORES.pendiente;
            return (
              <div key={orden.id} style={{
                background: "white",
                borderRadius: 14,
                padding: "16px 20px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                borderLeft: `5px solid ${est.border}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{
                        padding: "4px 12px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        background: est.bg,
                        color: est.color,
                        border: `1px solid ${est.border}44`,
                      }}>{est.label}</span>
                      {orden.horaInicio && <span style={{ fontSize: 12, color: "#8a8070" }}>⏰ {orden.horaInicio}</span>}
                    </div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#3d3525", marginBottom: 4 }}>
                      {orden.tipoTrabajo || "Trabajo"}
                    </div>
                    <div style={{ fontSize: 13, color: "#5a5040", display: "flex", flexDirection: "column", gap: 3 }}>
                      <div>👷 <strong>{op?.nombre || "Operador desconocido"}</strong></div>
                      <div>📍 Lote: <strong style={{ color: "#2d5a1b" }}>{nombreLote(lot)}</strong></div>
                      <div>🚜 Máquina: <strong>{maq?.nombre || "—"}</strong></div>
                      {ins && <div>🌱 Insumo: <strong>{ins.insumo}</strong></div>}
                      {orden.horasEstimadas > 0 && <div>⏱ Duración: <strong>{orden.horasEstimadas}h</strong></div>}
                      {orden.notas && <div style={{ fontStyle: "italic", color: "#8a8070", marginTop: 4 }}>"{orden.notas}"</div>}
                    </div>
                  </div>
                </div>

                {orden.estatus !== "completado" && orden.estatus !== "cancelado" && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    <button onClick={() => reenviarWhatsApp(orden)}
                      style={{
                        padding: "10px 16px",
                        borderRadius: 8,
                        border: "1px solid #25D366",
                        background: "white",
                        color: "#25D366",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}>
                      💬 Reenviar WhatsApp
                    </button>
                    <button onClick={() => marcarCompletada(orden)}
                      style={{
                        padding: "10px 16px",
                        borderRadius: 8,
                        border: "none",
                        background: "#16a085",
                        color: "white",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}>
                      ✅ Marcar completada
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nueva Orden */}
      {modalNew && (
        <Modal title="📋 Nueva orden de trabajo" onClose={() => setModalNew(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModalNew(false)}>Cancelar</button>
              <button className="btn btn-primary"
                onClick={guardarOrden}
                disabled={!form.operadorId || !form.loteId || !form.tipoTrabajo}
                style={{ fontSize: 14, padding: "12px 20px", fontWeight: 700 }}>
                💾 Crear + Enviar WhatsApp
              </button>
            </>
          }>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Tractorista *</label>
              <select className="form-select"
                value={form.operadorId}
                onChange={e => handleOperadorChange(e.target.value)}>
                <option value="">— Seleccionar tractorista —</option>
                {operadores.map(o => (
                  <option key={o.id} value={o.id}>
                    👷 {o.nombre}{o.maquinaAsignada ? ` (${o.maquinaAsignada})` : ""}
                  </option>
                ))}
              </select>
              {form.operadorId && !getOperador(form.operadorId)?.telefono && (
                <div style={{ marginTop: 6, padding: "8px 12px", background: "#fff3cd", borderRadius: 6, fontSize: 11, color: "#856404" }}>
                  ⚠️ Este operador no tiene teléfono registrado. No se enviará WhatsApp.
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Lote *</label>
              <select className="form-select"
                value={form.loteId}
                onChange={e => setForm(f => ({ ...f, loteId: e.target.value }))}>
                <option value="">— Seleccionar lote —</option>
                {lotes.filter(l => l.activo !== false).map(l => (
                  <option key={l.id} value={l.id}>
                    📍 {nombreLote(l)}{l.propietario ? ` · ${l.propietario}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Tipo de trabajo *</label>
              <select className="form-select"
                value={form.tipoTrabajo}
                onChange={e => setForm(f => ({ ...f, tipoTrabajo: e.target.value }))}>
                <option value="">— Seleccionar tipo —</option>
                {TIPOS_TRABAJO.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Máquina (opcional)</label>
              <select className="form-select"
                value={form.maquinariaId}
                onChange={e => setForm(f => ({ ...f, maquinariaId: e.target.value }))}>
                <option value="">— Sin especificar —</option>
                {maquinaria.map(m => (
                  <option key={m.id} value={m.id}>🚜 {m.nombre}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Insumo relacionado (opcional)</label>
              <select className="form-select"
                value={form.insumoId}
                onChange={e => setForm(f => ({ ...f, insumoId: e.target.value }))}>
                <option value="">— Ninguno —</option>
                {insumosArr.filter(i => !i.cancelado).slice(0, 100).map(i => (
                  <option key={i.id} value={i.id}>🌱 {i.insumo}</option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Hora de inicio</label>
                <input className="form-input" type="time"
                  value={form.horaInicio}
                  onChange={e => setForm(f => ({ ...f, horaInicio: e.target.value }))}/>
              </div>
              <div className="form-group">
                <label className="form-label">Duración (horas)</label>
                <input className="form-input" type="number" step="0.5" min="0"
                  value={form.horasEstimadas}
                  onChange={e => setForm(f => ({ ...f, horasEstimadas: e.target.value }))}
                  placeholder="4"/>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notas adicionales</label>
              <textarea className="form-input" rows={3}
                value={form.notas}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Instrucciones específicas, observaciones..."/>
            </div>

            <div style={{ padding: "10px 14px", background: "#d4efdf", borderRadius: 8, fontSize: 12, color: "#117a65" }}>
              💬 Al crear, se abrirá WhatsApp automáticamente con el mensaje listo para enviar al tractorista.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
