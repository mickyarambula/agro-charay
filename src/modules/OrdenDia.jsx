// ─── modules/OrdenDia.jsx ───────────────────────────────────────────────────
// Módulo del Encargado para crear y monitorear órdenes de trabajo del día.
// Al crear una orden, se abre WhatsApp con el mensaje pre-armado hacia el
// tractorista asignado.

import React, { useState } from 'react';
import { useData } from '../core/DataContext.jsx';
import { T } from '../shared/utils.js';
import { Modal } from '../shared/Modal.jsx';
import { useIsMobile } from '../components/mobile/useIsMobile.js';
import MobileCard from '../components/mobile/MobileCard.jsx';
import BottomSheet from '../components/mobile/BottomSheet.jsx';
import SkeletonCard from '../components/mobile/SkeletonCard.jsx';
import ToastContainer, { showToast } from '../components/mobile/Toast.jsx';

const TIPOS_TRABAJO = [
  "Barbecho", "Rastreo", "Nivelación", "Surcado", "Siembra", "Fertilización",
  "Riego", "Aplicación herbicida", "Aplicación fungicida", "Aplicación insecticida",
  "Cosecha", "Transporte", "Mantenimiento", "Otro"
];

// Estatus simplificado: Pendiente → Completado. "En progreso" eliminado.
const ESTATUS_COLORES = {
  pendiente:    { bg: "#fff3cd", color: "#856404", border: "#ffc107", label: "⏳ Pendiente" },
  completado:   { bg: "#d4efdf", color: "#117a65", border: "#16a085", label: "✅ Completado" },
  cancelado:    { bg: "#fdf0ef", color: "#c0392b", border: "#c0392b", label: "🚫 Cancelado" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Supabase sync helpers (no dependen de cliente — usan fetch directo)
// ─────────────────────────────────────────────────────────────────────────────
const SUPA_URL = 'https://oryixvodfqojunnqbkln.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yeWl4dm9kZnFvanVubnFia2xuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODUzMjAsImV4cCI6MjA5MTQ2MTMyMH0.03nXDh5qj7N-RiCqXxGKvhfZSVWDmuV4hFwTOZ66ZCQ';

async function guardarOrdenEnSupabase(orden, operador, lote, maquina) {
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/ordenes_trabajo`, {
      method: 'POST',
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        fecha: orden.fecha,
        tipo: orden.tipoTrabajo,
        estatus: orden.estatus || 'pendiente',
        operador_nombre:   operador?.nombre || '',
        maquinaria_nombre: maquina?.nombre || '',
        lote_nombre:       lote?.apodo || lote?.nombre || '',
        insumo_nombre:     orden.insumoNombre || '',
        hora_inicio:       orden.horaInicio || null,
        horas_estimadas:   parseFloat(orden.horasEstimadas) || 0,
        notas:             orden.notas || '',
        creado_por:        orden.creadoPor || '',
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('[Supabase] orden POST failed:', res.status, errText);
      throw new Error('status ' + res.status + ': ' + errText);
    }
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : rows;
    return row?.id || null;
  } catch (e) { console.warn('[Supabase] orden save failed:', e.message); return null; }
}

async function completarOrdenEnSupabase(orden) {
  try {
    const wid = orden?.supabaseId || orden?.id;
    if (!wid) return;
    await fetch(`${SUPA_URL}/rest/v1/ordenes_trabajo?id=eq.${encodeURIComponent(String(wid))}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        estatus: 'completado',
        hora_fin: new Date().toISOString().slice(0,19),
      }),
    });
  } catch (e) { console.warn('[Supabase] orden update failed:', e.message); }
}

async function actualizarOrdenEnSupabase(orden, operador, lote, maquina) {
  try {
    const wid = orden?.supabaseId || orden?.id;
    if (!wid) return;
    await fetch(`${SUPA_URL}/rest/v1/ordenes_trabajo?id=eq.${encodeURIComponent(String(wid))}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        tipo: orden.tipoTrabajo,
        operador_nombre:   operador?.nombre || '',
        maquinaria_nombre: maquina?.nombre || '',
        lote_nombre:       lote?.apodo || lote?.nombre || '',
        insumo_nombre:     orden.insumoNombre || '',
        hora_inicio:       orden.horaInicio || null,
        horas_estimadas:   parseFloat(orden.horasEstimadas) || 0,
        notas:             orden.notas || '',
      }),
    });
  } catch (e) { console.warn('[Supabase] orden patch failed:', e.message); }
}

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
    `🔧 *${orden.tipoTrabajo || "Trabajo asignado"}*`,
    `📍 Lote: ${nombreLote}`,
    `🚜 Máquina: ${nombreMaq}`,
    orden.insumoNombre ? `🌱 Insumo: ${orden.insumoNombre}` : "",
    orden.horaInicio ? `⏰ Hora: ${orden.horaInicio}` : "",
    orden.horasEstimadas ? `⌛ Duración estimada: ${orden.horasEstimadas}h` : "",
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
  const isMobile = useIsMobile();
  const { state, dispatch } = useData();
  const [cargando, setCargando] = useState(true);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullStartRef = React.useRef(null);
  const PULL_THRESHOLD = 100;

  const SUPA_URL2 = 'https://oryixvodfqojunnqbkln.supabase.co';
  const SUPA_KEY2 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yeWl4dm9kZnFvanVubnFia2xuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODUzMjAsImV4cCI6MjA5MTQ2MTMyMH0.03nXDh5qj7N-RiCqXxGKvhfZSVWDmuV4hFwTOZ66ZCQ';

  const recargarOrdenes = React.useCallback(() => {
    return fetch(`${SUPA_URL2}/rest/v1/ordenes_trabajo?select=*&order=created_at.desc&limit=200`, {
      headers: { apikey: SUPA_KEY2, Authorization: `Bearer ${SUPA_KEY2}` }
    })
    .then(r => r.json())
    .then(rows => {
      if (!Array.isArray(rows)) return;
      const mapped = rows.map(r => ({
        id: r.id, supabaseId: r.id,
        fecha: r.fecha, tipoTrabajo: r.tipo,
        estatus: r.estatus || 'pendiente',
        operadorNombre: r.operador_nombre || '',
        loteNombre: r.lote_nombre || '',
        maquinariaNombre: r.maquinaria_nombre || '',
        insumoNombre: r.insumo_nombre || '',
        horaInicio: r.hora_inicio || '',
        horasEstimadas: parseFloat(r.horas_estimadas) || 0,
        notas: r.notas || '',
        creadoPor: r.creado_por || '',
        creadoEn: r.created_at,
        origen: 'supabase',
      }));
      dispatch({ type: 'SYNC_STATE', payload: { ordenesTrabajo: mapped } });
    });
  }, [dispatch]);

  React.useEffect(() => {
    recargarOrdenes()
      .then(() => setCargando(false))
      .catch(e => { console.warn('OrdenDia fetch:', e); setCargando(false); });
  }, [recargarOrdenes]);

  // ── Pull-to-refresh (solo móvil) ─────────────────────────────
  React.useEffect(() => {
    if (!isMobile) return;
    const onTouchStart = (e) => {
      if (window.scrollY > 0 || refreshing) return;
      pullStartRef.current = e.touches[0].clientY;
    };
    const onTouchMove = (e) => {
      if (pullStartRef.current == null) return;
      const dy = e.touches[0].clientY - pullStartRef.current;
      if (dy > 0 && window.scrollY === 0) {
        setPullDistance(Math.min(dy, 160));
      }
    };
    const onTouchEnd = () => {
      if (pullStartRef.current == null) { setPullDistance(0); return; }
      if (pullDistance >= PULL_THRESHOLD && !refreshing) {
        setRefreshing(true);
        recargarOrdenes()
          .then(() => showToast('✅ Órdenes actualizadas', 'success'))
          .catch(() => showToast('❌ Error al recargar', 'error'))
          .finally(() => {
            setRefreshing(false);
            setPullDistance(0);
            pullStartRef.current = null;
          });
      } else {
        setPullDistance(0);
        pullStartRef.current = null;
      }
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isMobile, pullDistance, refreshing, recargarOrdenes]);
  const hoy = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  const operadores  = (state.operadores || []).filter(o => o.activo !== false);
  const lotes       = state.lotes      || [];
  const maquinaria  = state.maquinaria || [];
  const insumosArr  = state.insumos    || [];

  // ── Filtro de fecha: hoy / ayer / semana (últimos 7 días) ──
  const [filtroFecha, setFiltroFecha] = useState("hoy");
  const ayer = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split("T")[0]; })();
  const hace7 = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split("T")[0]; })();

  const ordenes = (state.ordenesTrabajo || []).filter(o => {
    if (!o.fecha) return false;
    if (filtroFecha === "hoy")   return o.fecha === hoy;
    if (filtroFecha === "ayer")  return o.fecha === ayer;
    if (filtroFecha === "semana") return o.fecha >= hace7 && o.fecha <= hoy;
    return true;
  });

  const [modalNew, setModalNew] = useState(false);
  const [editandoId, setEditandoId] = useState(null); // id de la orden en edición; null = nueva
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
    setEditandoId(null);
    setForm(emptyForm);
    setModalNew(true);
  };

  const abrirEditar = (orden) => {
    setEditandoId(orden.id);
    setForm({
      operadorId:     String(orden.operadorId || ""),
      loteId:         String(orden.loteId || ""),
      tipoTrabajo:    orden.tipoTrabajo || "",
      insumoId:       String(orden.insumoId || ""),
      maquinariaId:   String(orden.maquinariaId || ""),
      horaInicio:     orden.horaInicio || "",
      horasEstimadas: String(orden.horasEstimadas || ""),
      notas:          orden.notas || "",
    });
    setModalNew(true);
  };

  const cerrarModal = () => {
    setModalNew(false);
    setEditandoId(null);
    setForm(emptyForm);
  };

  const guardarOrden = () => {
    if (!form.operadorId || !form.loteId || !form.tipoTrabajo) return;

    const insumoSel = form.insumoId ? getInsumo(form.insumoId) : null;
    const basePayload = {
      ...form,
      operadorId: parseInt(form.operadorId, 10) || form.operadorId,
      loteId:     parseInt(form.loteId, 10)     || form.loteId,
      maquinariaId: form.maquinariaId ? (parseInt(form.maquinariaId, 10) || form.maquinariaId) : "",
      insumoId:   form.insumoId ? (parseInt(form.insumoId, 10) || form.insumoId) : "",
      insumoNombre: insumoSel?.insumo || "",
      horasEstimadas: parseFloat(form.horasEstimadas) || 0,
    };

    const op  = getOperador(basePayload.operadorId);
    const lot = getLote(basePayload.loteId);
    const maq = getMaquina(basePayload.maquinariaId);

    if (editandoId) {
      // ── Edición: preserva id, fecha y estatus originales ──
      const original = (state.ordenesTrabajo || []).find(o => o.id === editandoId);
      if (!original) { cerrarModal(); return; }
      const updated = {
        ...original,
        ...basePayload,
        id: editandoId,
        fecha: original.fecha,  // no mover de fecha
        estatus: original.estatus || "pendiente",
      };
      dispatch({ type: "UPD_ORDEN_TRABAJO", payload: updated });
      // Sync a Supabase (fire-and-forget)
      actualizarOrdenEnSupabase(updated, op, lot, maq);
      showToast('✅ Orden actualizada', 'success');
      dispatch({ type: "ADD_NOTIF", payload: {
        para: op?.usuario || "campo",
        tipo: "info",
        titulo: "✏️ Orden actualizada",
        mensaje: `Se actualizó: ${updated.tipoTrabajo} en ${nombreLote(lot)}`,
      }});
      cerrarModal();
      setTimeout(() => { enviarWhatsApp(updated, op, lot, maq); }, 100);
    } else {
      // ── Nueva orden ──
      const newId = Date.now();
      const payload = {
        ...basePayload,
        id: newId,  // id fijo para que el dispatch y el POST usen el mismo
        fecha: hoy,
        estatus: "pendiente",
        creadoPor: usuario?.usuario || userRol,
      };
      dispatch({ type: "ADD_ORDEN_TRABAJO", payload });
      // Sync a Supabase: captura UUID para futuros PATCH
      guardarOrdenEnSupabase(payload, op, lot, maq).then(supaId => {
        if (supaId) {
          dispatch({ type: "UPD_ORDEN_TRABAJO", payload: { ...payload, supabaseId: supaId } });
          showToast('✅ Orden creada', 'success');
        } else {
          showToast('❌ Error al guardar en Supabase', 'error');
        }
      });
      dispatch({ type: "ADD_NOTIF", payload: {
        para: op?.usuario || "campo",
        tipo: "info",
        titulo: "📋 Nueva orden de trabajo",
        mensaje: `${payload.tipoTrabajo} en ${nombreLote(lot)} — ${payload.horasEstimadas || 0}h estimadas`,
      }});
      cerrarModal();
      setTimeout(() => { enviarWhatsApp(payload, op, lot, maq); }, 100);
    }
  };

  const marcarCompletada = (orden) => {
    if (!window.confirm(`¿Marcar como completada la orden "${orden.tipoTrabajo}" de ${getOperador(orden.operadorId)?.nombre || orden.operadorNombre || "—"}?`)) return;
    dispatch({ type: "UPD_ORDEN_TRABAJO", payload: {
      ...orden,
      estatus: "completado",
      horaFin: new Date().toISOString(),
    }});
    // Sync a Supabase (fire-and-forget)
    completarOrdenEnSupabase(orden);
    showToast('✅ Orden completada', 'success');
    // Crear registro automático en bitácora, etiquetado con origen=orden_trabajo
    // y ordenId para correlación inversa (evita doble captura manual).
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
      origen: "orden_trabajo",
      ordenId: orden.id,
      data: { titulo: orden.tipoTrabajo, descripcion: orden.notas || "" },
    }});
  };

  const reenviarWhatsApp = (orden) => {
    const op  = getOperador(orden.operadorId);
    const lot = getLote(orden.loteId);
    const maq = getMaquina(orden.maquinariaId);
    // Fallback: si la orden no trae insumoNombre (legado), lo hidratamos desde state
    const insumoNombre = orden.insumoNombre || (orden.insumoId ? (getInsumo(orden.insumoId)?.insumo || "") : "");
    enviarWhatsApp({ ...orden, insumoNombre }, op, lot, maq);
  };

  const fechaLarga = new Date().toLocaleDateString("es-MX", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  // ─── KPIs (solo Pendientes y Completadas) ──
  const pendCount = ordenes.filter(o => o.estatus === "pendiente").length;
  const compCount = ordenes.filter(o => o.estatus === "completado").length;

  return (
    <div>
      {/* Pull-to-refresh indicator (solo móvil) */}
      {isMobile && (pullDistance > 0 || refreshing) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: Math.min(pullDistance, 80),
          background: '#F0FDF4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 600,
          color: '#15803D',
          zIndex: 9000,
          borderBottom: '1px solid #d1d5db',
          transition: refreshing ? 'height 200ms ease' : 'none',
        }}>
          {refreshing
            ? '⟳ Actualizando...'
            : pullDistance >= PULL_THRESHOLD
              ? '⬆ Suelta para recargar'
              : '⬇ Desliza para recargar'}
        </div>
      )}

      {/* Toast container (solo móvil) */}
      {isMobile && <ToastContainer />}

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
          {userRol !== "campo" && (
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
          )}
        </div>
      </div>

      {/* Selector de fecha */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { id: "hoy",    label: "📅 Hoy" },
          { id: "ayer",   label: "🕐 Ayer" },
          { id: "semana", label: "📆 Esta semana" },
        ].map(opt => {
          const sel = filtroFecha === opt.id;
          return (
            <button key={opt.id} onClick={() => setFiltroFecha(opt.id)}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: `1.5px solid ${sel ? "#2d5a1b" : "#ddd5c0"}`,
                background: sel ? "#f0f8e8" : "white",
                color: sel ? "#2d5a1b" : "#5a5040",
                fontSize: 13,
                fontWeight: sel ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.15s",
              }}>
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* KPIs — solo 2 estatus (pendiente, completado) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Pendientes",  val: pendCount, color: "#856404", icon: "⏳" },
          { label: "Completadas", val: compCount, color: "#16a085", icon: "✅" },
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
      {isMobile && cargando && ordenes.length === 0 ? (
        <SkeletonCard count={3} />
      ) : ordenes.length === 0 ? (
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
          {(() => {
            // Agrupamos por fecha si estamos viendo semana; si es hoy/ayer
            // creamos un solo grupo sin header.
            const grupos = {};
            ordenes.forEach(o => { (grupos[o.fecha] = grupos[o.fecha] || []).push(o); });
            const fechas = Object.keys(grupos).sort((a, b) => b.localeCompare(a));
            const mostrarHeaders = filtroFecha === "semana" && fechas.length > 1;

            return fechas.map(fecha => {
              const fechaHeader = new Date(fecha + 'T00:00:00').toLocaleDateString("es-MX", {
                weekday: "long", day: "2-digit", month: "long",
              });
              const esHoy  = fecha === hoy;
              const esAyer = fecha === ayer;
              return (
                <div key={fecha}>
                  {mostrarHeaders && (
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: "#8a8070",
                      textTransform: "uppercase", letterSpacing: 1,
                      marginTop: 4, marginBottom: 8, paddingLeft: 4,
                    }}>
                      {esHoy ? "HOY" : esAyer ? "AYER" : fechaHeader}
                      <span style={{ marginLeft: 8, fontSize: 10, color: "#8a8070", fontWeight: 500 }}>
                        · {grupos[fecha].length} orden{grupos[fecha].length === 1 ? "" : "es"}
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {grupos[fecha].map(orden => {
            const op  = getOperador(orden.operadorId);
            const lot = getLote(orden.loteId);
            const maq = getMaquina(orden.maquinariaId);
            const ins = getInsumo(orden.insumoId);
            const est = ESTATUS_COLORES[orden.estatus] || ESTATUS_COLORES.pendiente;
            if (isMobile) {
              return (
                <MobileCard
                  key={orden.id}
                  orden={{
                    tipoTrabajo: orden.tipoTrabajo,
                    operadorNombre: op?.nombre || orden.operadorNombre || '',
                    loteNombre: lot ? nombreLote(lot) : (orden.loteNombre || ''),
                    maquinariaNombre: maq?.nombre || orden.maquinariaNombre || '',
                    horasEstimadas: orden.horasEstimadas,
                    estatus: orden.estatus,
                    horaInicio: orden.horaInicio,
                  }}
                  onCompletar={() => marcarCompletada(orden)}
                  onEditar={() => abrirEditar(orden)}
                />
              );
            }
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
                      <div>👷 <strong>{op?.nombre || orden.operadorNombre || "Operador desconocido"}</strong></div>
                      <div>📍 Lote: <strong style={{ color: "#2d5a1b" }}>{lot ? nombreLote(lot) : (orden.loteNombre || "—")}</strong></div>
                      <div>🚜 Máquina: <strong>{maq?.nombre || orden.maquinariaNombre || "—"}</strong></div>
                      {(ins || orden.insumoNombre) && <div>🌱 Insumo: <strong>{ins?.insumo || orden.insumoNombre}</strong></div>}
                      {orden.horasEstimadas > 0 && <div>⏱ Duración: <strong>{orden.horasEstimadas}h</strong></div>}
                      {orden.notas && <div style={{ fontStyle: "italic", color: "#8a8070", marginTop: 4 }}>"{orden.notas}"</div>}
                    </div>
                  </div>
                </div>

                {orden.estatus !== "completado" && orden.estatus !== "cancelado" && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    <button onClick={() => abrirEditar(orden)}
                      style={{
                        padding: "10px 16px",
                        borderRadius: 8,
                        border: "1px solid #c8a84b",
                        background: "white",
                        color: "#8a6e10",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}>
                      ✏️ Editar
                    </button>
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
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* BottomSheet móvil: formulario simplificado */}
      {modalNew && isMobile && (
        <BottomSheet
          isOpen={modalNew}
          onClose={cerrarModal}
          title={editandoId ? "✏️ Editar orden" : "📋 Nueva orden"}
          footer={
            <button
              onClick={guardarOrden}
              disabled={!form.operadorId || !form.loteId || !form.tipoTrabajo}
              style={{
                width: '100%',
                minHeight: 52,
                marginTop: 8,
                borderRadius: 10,
                border: 'none',
                background: '#15803D',
                color: '#ffffff',
                fontSize: 16,
                fontWeight: 700,
                cursor: (!form.operadorId || !form.loteId || !form.tipoTrabajo) ? 'not-allowed' : 'pointer',
                opacity: (!form.operadorId || !form.loteId || !form.tipoTrabajo) ? 0.55 : 1,
                touchAction: 'manipulation',
              }}
            >
              {editandoId ? '💾 Guardar cambios' : '💾 Crear Orden'}
            </button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>👷 Tractorista *</label>
              <select
                value={form.operadorId}
                onChange={e => handleOperadorChange(e.target.value)}
                style={{ width: '100%', minHeight: 52, fontSize: 16, padding: '0 14px', borderRadius: 10, border: '1.5px solid #d1d5db', background: '#ffffff' }}
              >
                <option value="">— Seleccionar tractorista —</option>
                {operadores.map(o => (
                  <option key={o.id} value={o.id}>👷 {o.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>📍 Lote *</label>
              <select
                value={form.loteId}
                onChange={e => setForm(f => ({ ...f, loteId: e.target.value }))}
                style={{ width: '100%', minHeight: 52, fontSize: 16, padding: '0 14px', borderRadius: 10, border: '1.5px solid #d1d5db', background: '#ffffff' }}
              >
                <option value="">— Seleccionar lote —</option>
                {lotes.filter(l => l.activo !== false).map(l => (
                  <option key={l.id} value={l.id}>📍 {nombreLote(l)}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>🔧 Tipo de trabajo *</label>
              <select
                value={form.tipoTrabajo}
                onChange={e => setForm(f => ({ ...f, tipoTrabajo: e.target.value }))}
                style={{ width: '100%', minHeight: 52, fontSize: 16, padding: '0 14px', borderRadius: 10, border: '1.5px solid #d1d5db', background: '#ffffff' }}
              >
                <option value="">— Seleccionar tipo —</option>
                {TIPOS_TRABAJO.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>🚜 Máquina (opcional)</label>
              <select
                value={form.maquinariaId}
                onChange={e => setForm(f => ({ ...f, maquinariaId: e.target.value }))}
                style={{ width: '100%', minHeight: 52, fontSize: 16, padding: '0 14px', borderRadius: 10, border: '1.5px solid #d1d5db', background: '#ffffff' }}
              >
                <option value="">— Sin especificar —</option>
                {maquinaria.map(m => (
                  <option key={m.id} value={m.id}>🚜 {m.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>🌱 Insumo relacionado (opcional)</label>
              <select
                value={form.insumoId}
                onChange={e => setForm(f => ({ ...f, insumoId: e.target.value }))}
                style={{ width: '100%', minHeight: 52, fontSize: 16, padding: '0 14px', borderRadius: 10, border: '1.5px solid #d1d5db', background: '#ffffff' }}
              >
                <option value="">— Ninguno —</option>
                {[...new Map(insumosArr.filter(i => !i.cancelado).map(i => [i.insumo, i])).values()].map(i => (
                  <option key={i.id} value={i.id}>🌱 {i.insumo}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>⏱ Hora inicio</label>
                <input
                  type="time"
                  value={form.horaInicio}
                  onChange={e => setForm(f => ({ ...f, horaInicio: e.target.value }))}
                  style={{ width: '100%', minHeight: 52, fontSize: 16, padding: '0 14px', borderRadius: 10, border: '1.5px solid #d1d5db', background: '#ffffff' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>⏱ Duración (h)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="4"
                  value={form.horasEstimadas}
                  onChange={e => setForm(f => ({ ...f, horasEstimadas: e.target.value }))}
                  style={{ width: '100%', minHeight: 52, fontSize: 16, padding: '0 14px', borderRadius: 10, border: '1.5px solid #d1d5db', background: '#ffffff' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>📝 Notas adicionales</label>
              <textarea
                rows={3}
                value={form.notas}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Instrucciones específicas, observaciones..."
                style={{ width: '100%', minHeight: 96, fontSize: 16, padding: '12px 14px', borderRadius: 10, border: '1.5px solid #d1d5db', background: '#ffffff', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Modal Nueva Orden / Editar (escritorio) */}
      {modalNew && !isMobile && (
        <Modal title={editandoId ? "✏️ Editar orden de trabajo" : "📋 Nueva orden de trabajo"}
          onClose={cerrarModal}
          footer={
            <>
              <button className="btn btn-secondary" onClick={cerrarModal}>Cancelar</button>
              <button className="btn btn-primary"
                onClick={guardarOrden}
                disabled={!form.operadorId || !form.loteId || !form.tipoTrabajo}
                style={{ fontSize: 14, padding: "12px 20px", fontWeight: 700 }}>
                {editandoId ? "💾 Guardar cambios" : "💾 Crear + Enviar WhatsApp"}
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
                {[...new Map(insumosArr.filter(i => !i.cancelado).map(i => [i.insumo, i])).values()].map(i => (
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
