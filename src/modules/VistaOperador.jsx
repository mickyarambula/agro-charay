// ─── modules/VistaOperador.jsx ──────────────────────────────────────────
// Vista minimalista para el rol "campo" (tractorista / operador).
// No tiene sidebar ni menú. Solo muestra las órdenes del día asignadas
// al usuario actual y dos acciones primarias.

import React, { useState } from 'react';
import { useData } from '../core/DataContext.jsx';
import { T } from '../shared/utils.js';
import { Modal } from '../shared/Modal.jsx';

export default function VistaOperador({ usuario, onLogout }) {
  const { state, dispatch } = useData();
  const hoy = new Date().toISOString().split("T")[0];

  // El Operador de Campo SUPERVISA todas las órdenes — hoy + ayer por si quedó
  // algo pendiente del día anterior.
  const ayer = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split("T")[0]; })();
  const misOrdenes = (state.ordenesTrabajo || [])
    .filter(o => o.fecha === hoy || o.fecha === ayer)
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

  // Operadores y lotes para resolver nombres en cada orden
  const operadores = state.operadores || [];
  const lotes      = state.lotes      || [];
  const maquinaria = state.maquinaria || [];

  const [modalNovedad, setModalNovedad] = useState(false);
  const [textoNovedad, setTextoNovedad] = useState("");

  const finalizarTrabajo = (orden) => {
    if (!orden) return;
    const payload = {
      ...orden,
      estatus: "completado",
      horaFin: new Date().toISOString(),
    };
    dispatch({ type: "UPD_ORDEN_TRABAJO", payload });
    // Registra en bitácora automáticamente, etiquetado con origen + ordenId
    dispatch({ type: "ADD_BITACORA", payload: {
      tipo: orden.tipo || "reporte",
      loteId: orden.loteId,
      fecha: hoy,
      operador: usuario?.nombre || usuario?.usuario,
      operadorId: usuario?.id,
      maquinariaId: orden.maquinariaId || "",
      horas: orden.horasEstimadas || 0,
      notas: `Completado desde orden #${orden.id}`,
      origen: "orden_trabajo",
      ordenId: orden.id,
      data: { titulo: orden.descripcion || "Trabajo completado" },
    }});
  };

  const reportarNovedad = () => {
    if (!textoNovedad.trim()) return;
    dispatch({ type: "ADD_NOTIF", payload: {
      para: "encargado",
      tipo: "alerta",
      titulo: "⚠️ Novedad de campo",
      mensaje: `${usuario?.nombre || usuario?.usuario}: ${textoNovedad.trim()}`,
    }});
    dispatch({ type: "ADD_NOTIF", payload: {
      para: "admin",
      tipo: "alerta",
      titulo: "⚠️ Novedad de campo",
      mensaje: `${usuario?.nombre || usuario?.usuario}: ${textoNovedad.trim()}`,
    }});
    setModalNovedad(false);
    setTextoNovedad("");
    alert("✅ Novedad enviada al encargado.");
  };

  const saludo = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  })();

  const nombreLote = (lid) => {
    if (!lid) return "—";
    const l = lotes.find(x => String(x.id) === String(lid));
    return l ? (l.apodo && l.apodo !== "NO DEFINIDO" ? l.apodo : l.folioCorto) : `Lote #${lid}`;
  };
  const nombreMaq = (mid) => {
    if (!mid) return "—";
    const m = maquinaria.find(x => String(x.id) === String(mid));
    return m ? m.nombre : `Máquina #${mid}`;
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #faf8f3 0%, #f2ede3 100%)",
      padding: "0 0 80px 0",
    }}>
      {/* HEADER — saludo + logout */}
      <div style={{
        padding: "20px 20px 24px",
        background: "linear-gradient(135deg, #2d5a1b 0%, #4a8c2a 100%)",
        color: "white",
        boxShadow: "0 2px 12px rgba(45,90,27,0.25)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 4 }}>{saludo},</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>
              {usuario?.nombre?.split(" ")[0] || "Operador"} 👷
            </div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8, textTransform: "capitalize" }}>
              {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long" })}
            </div>
          </div>
          <button onClick={onLogout}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.25)",
              color: "white",
              padding: "8px 14px",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}>
            Salir
          </button>
        </div>
      </div>

      {/* TÍTULO DE LA SECCIÓN */}
      <div style={{ padding: "24px 20px 12px" }}>
        <div style={{
          fontFamily: "Georgia, serif",
          fontSize: 22,
          fontWeight: 700,
          color: "#3d3525",
        }}>
          📋 Órdenes del Campo
        </div>
        <div style={{ fontSize: 13, color: "#8a8070", marginTop: 4 }}>
          {misOrdenes.length === 0
            ? "No hay trabajos programados"
            : `${misOrdenes.length} trabajo${misOrdenes.length === 1 ? "" : "s"} (hoy + pendientes ayer)`}
        </div>
      </div>

      {/* LISTA DE ÓRDENES */}
      <div style={{ padding: "0 20px" }}>
        {misOrdenes.length === 0 ? (
          <div style={{
            background: "white",
            borderRadius: 16,
            padding: "48px 24px",
            textAlign: "center",
            border: "2px dashed #ddd5c0",
            marginTop: 8,
          }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🌾</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#3d3525", marginBottom: 6 }}>
              Todo limpio por hoy
            </div>
            <div style={{ fontSize: 13, color: "#8a8070" }}>
              Cuando el encargado te asigne un trabajo aparecerá aquí.
            </div>
          </div>
        ) : (
          misOrdenes.map(orden => {
            const completado = orden.estatus === "completado";
            const esDeAyer = orden.fecha === ayer;
            return (
              <div key={orden.id} style={{
                background: "white",
                borderRadius: 16,
                marginBottom: 14,
                padding: "18px 20px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                borderLeft: `6px solid ${completado ? "#16a085" : "#2d5a1b"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#3d3525", flex: 1, lineHeight: 1.3 }}>
                    {orden.tipoTrabajo || orden.descripcion || "Trabajo"}
                    {esDeAyer && !completado && (
                      <span style={{
                        marginLeft: 8, fontSize: 10, fontWeight: 700,
                        padding: "2px 8px", borderRadius: 10,
                        background: "#fff3cd", color: "#856404",
                      }}>⏰ AYER</span>
                    )}
                  </div>
                  {completado && <span style={{ fontSize: 22 }}>✅</span>}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                    <span style={{ fontSize: 20 }}>👷</span>
                    <span style={{ color: "#5a5040" }}>
                      Tractorista: <strong style={{ color: "#2d5a1b" }}>
                        {operadores.find(o => String(o.id) === String(orden.operadorId))?.nombre || "Sin asignar"}
                      </strong>
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                    <span style={{ fontSize: 20 }}>📍</span>
                    <span style={{ color: "#5a5040" }}>
                      Lote: <strong style={{ color: "#2d5a1b" }}>{nombreLote(orden.loteId)}</strong>
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                    <span style={{ fontSize: 20 }}>🚜</span>
                    <span style={{ color: "#5a5040" }}>
                      Máquina: <strong style={{ color: "#2d5a1b" }}>{nombreMaq(orden.maquinariaId)}</strong>
                    </span>
                  </div>
                  {orden.horasEstimadas && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                      <span style={{ fontSize: 20 }}>⏱</span>
                      <span style={{ color: "#5a5040" }}>
                        Estimado: <strong style={{ color: "#2d5a1b" }}>{orden.horasEstimadas} h</strong>
                      </span>
                    </div>
                  )}
                  {orden.notas && (
                    <div style={{
                      padding: "10px 12px",
                      background: "#faf8f3",
                      borderRadius: 10,
                      fontSize: 13,
                      color: "#5a5040",
                      fontStyle: "italic",
                    }}>
                      "{orden.notas}"
                    </div>
                  )}
                </div>

                {!completado && (
                  <button
                    onClick={() => finalizarTrabajo(orden)}
                    style={{
                      width: "100%",
                      padding: "16px",
                      borderRadius: 12,
                      border: "none",
                      background: "#16a085",
                      color: "white",
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: "0 3px 10px rgba(0,0,0,0.15)",
                    }}>
                    ✅ Marcar como completado
                  </button>
                )}

                {completado && (
                  <div style={{
                    padding: "12px",
                    background: "#d4efdf",
                    borderRadius: 10,
                    textAlign: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#117a65",
                  }}>
                    ✓ Trabajo completado
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* BOTÓN FIJO INFERIOR: Reportar al encargado */}
      <div style={{
        position: "fixed",
        bottom: 16,
        left: 0,
        right: 0,
        padding: "0 20px",
        zIndex: 50,
      }}>
        <button
          onClick={() => setModalNovedad(true)}
          style={{
            width: "100%",
            padding: "18px",
            borderRadius: 14,
            border: "none",
            background: "#e67e22",
            color: "white",
            fontSize: 17,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(230,126,34,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}>
          <span style={{ fontSize: 24 }}>📢</span>
          Reportar al encargado
        </button>
      </div>

      {/* MODAL: Reportar al encargado */}
      {modalNovedad && (
        <Modal
          title="📢 Reportar al encargado"
          onClose={() => { setModalNovedad(false); setTextoNovedad(""); }}
          footer={
            <>
              <button className="btn btn-secondary"
                onClick={() => { setModalNovedad(false); setTextoNovedad(""); }}>
                Cancelar
              </button>
              <button className="btn btn-primary"
                onClick={reportarNovedad}
                disabled={!textoNovedad.trim()}
                style={{ background: "#e67e22", border: "none", fontSize: 15, padding: "12px 24px", fontWeight: 700 }}>
                📢 Enviar al encargado
              </button>
            </>
          }>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{
              padding: "12px 14px",
              background: "#fff3cd",
              borderRadius: 10,
              fontSize: 13,
              color: "#856404",
              border: "1px solid #ffc107",
            }}>
              Describe la novedad (plaga, falla de máquina, lluvia, problema en campo, etc.). El encargado recibirá la alerta al instante.
            </div>
            <div className="form-group">
              <label className="form-label">¿Qué está pasando?</label>
              <textarea
                className="form-input"
                rows={5}
                value={textoNovedad}
                onChange={e => setTextoNovedad(e.target.value)}
                placeholder="Ej. Se atascó el tractor en el lote 3, necesito apoyo..."
                style={{ fontSize: 15, minHeight: 120 }}
                autoFocus
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
