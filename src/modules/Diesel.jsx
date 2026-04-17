// ─── modules/Diesel.jsx ───────────────────────────────────────────
// Vista única con 3 modales: compra, gasolinera, carga de tractor.
// Cilindro de 10,000 L controlado por entradas y salidas internas.

import React, { useState } from 'react';
import { useData } from '../core/DataContext.jsx';
import { T, mxnFmt as sharedMxn, fmt, CAPACIDAD_TANQUE_DIESEL } from '../shared/utils.js';
import { Modal } from '../shared/Modal.jsx';
import { useIsMobile } from '../components/mobile/useIsMobile.js';
import AIInsight from '../components/AIInsight.jsx';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../core/supabase.js';

const CILINDRO_CAPACIDAD = CAPACIDAD_TANQUE_DIESEL;

export default function DieselModule({ userRol, usuario }) {
  const { state, dispatch } = useData();
  const isMobile = useIsMobile();

  const verPrecios = userRol === 'admin' || userRol === 'compras';
  const puedeComprar = userRol === 'admin' || userRol === 'compras';
  const puedeCargarTractor = userRol === 'admin' || userRol === 'encargado';

  const hoy = new Date().toISOString().split('T')[0];
  const mxnFmt = n => (parseFloat(n)||0).toLocaleString('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2,maximumFractionDigits:2});

  // ─── Estados de modales y filtros ──────────────────────────────
  const [modalCompra, setModalCompra] = useState(false);
  const [modalGasolinera, setModalGasolinera] = useState(false);
  const [modalCarga, setModalCarga] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [modalDetalle, setModalDetalle] = useState(null);
  const [motivoCancel, setMotivoCancel] = useState('');

  const emptyCompra = { fecha: hoy, litros: '', proveedor: '', precioLitro: '', total: '', notas: '' };
  const emptyGas    = { fecha: hoy, maquinariaId: '', litros: '', estacion: '', precioLitro: '', total: '', notas: '' };
  const emptyCarga  = { fecha: hoy, maquinariaId: '', loteId: '', litros: '', operadorId: '', notas: '', tipoLabor: '', hectareas: '' };
  const maqConsumos = state.maquinariaConsumos || [];
  const TIPOS_LABOR = ['Barbecho','Rastreo','Siembra','Fertilización','Aplicación herbicida','Aplicación insecticida','Cosecha / apoyo'];

  const [formCompra, setFormCompra] = useState(emptyCompra);
  const [formGas,    setFormGas]    = useState(emptyGas);
  const [formCarga,  setFormCarga]  = useState(emptyCarga);

  const cerrarCompra = () => { setModalCompra(false); setFormCompra(emptyCompra); };
  const cerrarGas    = () => { setModalGasolinera(false); setFormGas(emptyGas); };
  const cerrarCarga  = () => { setModalCarga(false); setFormCarga(emptyCarga); };

  // ─── Datos del ciclo ──────────────────────────────────────────
  const cicloFiltroId = state.cicloActivoId || 1;
  const diesel = (state.diesel||[]).filter(d => (d.cicloId||1) === cicloFiltroId);
  const dieselActivo = diesel.filter(d => !d.cancelado);

  const tipoMov = (d) => d.tipoMovimiento || d.tipo_movimiento || (d.esAjuste ? 'entrada' : 'salida_interna');
  const getLitros = (d) => parseFloat(d.cantidad || d.litros || 0) || 0;

  const entradas     = dieselActivo.filter(d => tipoMov(d) === 'entrada').reduce((s,d)=>s+getLitros(d),0);
  const salidasInt   = dieselActivo.filter(d => tipoMov(d) === 'salida_interna').reduce((s,d)=>s+getLitros(d),0);
  const salidasExt   = dieselActivo.filter(d => tipoMov(d) === 'salida_externa').reduce((s,d)=>s+getLitros(d),0);
  const saldoCilindro = Math.max(0, entradas - salidasInt);
  const nivelPct     = Math.min(100, (saldoCilindro / CILINDRO_CAPACIDAD) * 100);
  const saldoColor   = saldoCilindro > 1000 ? '#15803D' : saldoCilindro >= 200 ? '#f59e0b' : '#ef4444';
  const costoTotal   = dieselActivo.reduce((s,d)=>s+(parseFloat(d.importe)||0),0);

  // ─── Historial filtrado ───────────────────────────────────────
  const historial = [...dieselActivo]
    .filter(d => filtroTipo === 'todos' || tipoMov(d) === filtroTipo)
    .sort((a,b) => String(b.fechaSolicitud||b.fecha||'').localeCompare(String(a.fechaSolicitud||a.fecha||'')));

  // ─── Helpers de render ────────────────────────────────────────
  const nomMaq = id => (state.maquinaria||[]).find(m => String(m.id) === String(id))?.nombre || '';
  const nomLoteShort = id => {
    const l = (state.lotes||[]).find(x => String(x.id) === String(id));
    if (!l) return '';
    return l.apodo && l.apodo !== 'NO DEFINIDO' ? l.apodo : (l.folioCorto || `Lote #${id}`);
  };

  // ─── Guardar unificado ────────────────────────────────────────
  const guardarMovimiento = async (datos, tipo) => {
    const litros  = parseFloat(datos.litros) || 0;
    const precio  = parseFloat(datos.precioLitro) || 0;
    const importe = parseFloat(datos.total) || (litros * precio) || 0;

    if (!datos.fecha) { alert('La fecha es requerida.'); return false; }
    if (!litros || litros <= 0) { alert('Los litros son requeridos.'); return false; }

    if (tipo === 'salida_interna') {
      if (saldoCilindro <= 0) { alert('El cilindro está vacío. Contacta a compras para reabastecer.'); return false; }
      if (litros > saldoCilindro) { alert(`No hay suficiente diesel. Saldo actual: ${saldoCilindro.toLocaleString('es-MX')} L`); return false; }
    }

    if (tipo === 'entrada') {
      if (saldoCilindro + litros > CILINDRO_CAPACIDAD) {
        const disponible = Math.max(0, CILINDRO_CAPACIDAD - saldoCilindro);
        alert(`⚠️ No se puede agregar ${litros.toLocaleString('es-MX')} L. El tanque tiene ${saldoCilindro.toLocaleString('es-MX')} L y su capacidad es ${CILINDRO_CAPACIDAD.toLocaleString('es-MX')} L. Máximo ${disponible.toLocaleString('es-MX')} L disponibles.`);
        return false;
      }
    }

    const id = Date.now();
    const nuevoReg = {
      id,
      fecha: datos.fecha,
      fechaSolicitud: datos.fecha,
      fechaOrden: datos.fecha,
      cantidad: litros,
      precioLitro: precio,
      importe,
      proveedor: datos.proveedor || datos.estacion || '',
      maquinariaId: datos.maquinariaId || null,
      loteId: datos.loteId || null,
      operadorId: datos.operadorId || '',
      tipoMovimiento: tipo,
      esAjuste: false,
      cancelado: false,
      unidad: 'LT',
      notas: datos.notas || '',
    };

    // POST a Supabase (dispara realtime para otros usuarios)
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/diesel`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          fecha: datos.fecha,
          fecha_solicitud: datos.fecha,
          fecha_orden: datos.fecha,
          cantidad: litros,
          litros_recibidos: tipo === 'salida_interna' ? litros : 0,
          precio_litro: precio,
          importe,
          proveedor: datos.proveedor || datos.estacion || '',
          unidad: 'LT',
          ieps: 'SIN IEPS',
          es_ajuste: false,
          estatus: 'pendiente',
          cancelado: false,
          tipo_movimiento: tipo,
          operador: tipo==='salida_interna' ? ((state.operadores||[]).find(o=>String(o.id)===String(datos.operadorId))?.nombre || '') : null,
          concepto: tipo==='salida_interna' ? `${(state.maquinaria||[]).find(m=>String(m.id)===String(datos.maquinariaId))?.nombre||''} — ${datos.tipoLabor||''}`.trim() : '',
          registrado_por: usuario?.usuario || userRol || 'desconocido',
          notas: datos.notas || '',
        }),
      });
    } catch (e) {
      console.warn('Error guardando diesel en Supabase:', e);
    }

    dispatch({ type: 'ADD_DIESEL', payload: nuevoReg });

    // Espejo en Bitácora solo para salidas internas
    if (tipo === 'salida_interna') {
      const maq = (state.maquinaria||[]).find(m => String(m.id) === String(datos.maquinariaId));
      const op  = (state.operadores||[]).find(o => String(o.id) === String(datos.operadorId));
      dispatch({
        type: 'ADD_BITACORA',
        payload: {
          id: id + 1,
          tipo: 'diesel',
          fecha: datos.fecha,
          loteId: datos.loteId ? (parseInt(datos.loteId)||datos.loteId) : null,
          loteIds: datos.loteId ? [parseInt(datos.loteId)||datos.loteId] : [],
          operadorId: datos.operadorId || '',
          operador: op?.nombre || '',
          maquinariaId: datos.maquinariaId || '',
          cantidad: litros,
          unidad: 'L',
          horas: 0,
          notas: `Carga de diesel: ${litros}L — ${maq?.nombre || 'Sin tractor'}`,
          origen: 'diesel_cilindro',
          data: { litros, precioLitro: 0, actividad: 'Carga cilindro' },
        }
      });
    }
    return true;
  };

  const handleGuardarCompra = async () => { if (await guardarMovimiento(formCompra, 'entrada')) cerrarCompra(); };
  const handleGuardarGas    = async () => { if (await guardarMovimiento(formGas,    'salida_externa')) cerrarGas(); };
  const handleGuardarCarga  = async () => { if (await guardarMovimiento(formCarga,  'salida_interna')) cerrarCarga(); };

  // ─── Estilos reutilizables ────────────────────────────────────
  const fieldStyle = { width: '100%', minHeight: 44, fontSize: 16, padding: '0 12px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#ffffff' };
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 };

  // ─── Opciones de lotes para el selector (carga) ───────────────
  const optLotes = (state.lotes||[])
    .filter(l => l.activo !== false)
    .sort((a,b) => {
      const na = (a.apodo && a.apodo !== 'NO DEFINIDO' ? a.apodo : a.folioCorto || '');
      const nb = (b.apodo && b.apodo !== 'NO DEFINIDO' ? b.apodo : b.folioCorto || '');
      return na.localeCompare(nb);
    });

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <div>
      <AIInsight modulo="Diesel" contexto={{
        saldoCilindro, entradas, salidasInt, salidasExt,
        costoTotal: verPrecios ? costoTotal : undefined,
      }}/>

      {/* ═══ Card Cilindro ═══ */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderLeft: `6px solid ${saldoColor}`,
        borderRadius: 14,
        padding: '18px 18px 16px',
        marginBottom: 16,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        <div style={{fontSize:11,fontWeight:700,color:'#6b7280',letterSpacing:0.8,textTransform:'uppercase',marginBottom:6}}>
          🛢 Cilindro diesel
        </div>
        <div style={{fontSize: isMobile ? 32 : 36, fontWeight: 400, fontFamily: 'Georgia, serif', color: saldoColor, lineHeight: 1}}>
          {saldoCilindro.toLocaleString('es-MX', {maximumFractionDigits: 0})}
          <span style={{fontSize: 14, fontWeight: 500, color: '#6b7280', marginLeft: 8}}>
            / {CILINDRO_CAPACIDAD.toLocaleString('es-MX')} L
          </span>
        </div>
        <div style={{height: 12, borderRadius: 6, background: '#e5e7eb', overflow: 'hidden', marginTop: 12}}>
          <div style={{height: '100%', width: `${nivelPct}%`, background: saldoColor, transition: 'width 300ms ease'}} />
        </div>
        <div style={{fontSize: 10, color: '#b0a090', marginTop: 4, textAlign: 'center'}}>
          {saldoCilindro.toLocaleString('es-MX',{maximumFractionDigits:0})} L de {CILINDRO_CAPACIDAD.toLocaleString('es-MX')} L · {Math.round(nivelPct)}% de capacidad
        </div>

        {/* KPIs del cilindro */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: verPrecios ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
          gap: 8,
          marginTop: 12,
        }}>
          <div style={{textAlign:'center',padding:'8px 4px',background:'#dcfce7',borderRadius:8}}>
            <div style={{fontSize:9,fontWeight:700,color:'#15803D',textTransform:'uppercase'}}>📥 Entradas</div>
            <div style={{fontSize:14,fontWeight:700,color:'#15803D',marginTop:2,fontFamily:'monospace'}}>
              {entradas.toLocaleString('es-MX',{maximumFractionDigits:0})} L
            </div>
          </div>
          <div style={{textAlign:'center',padding:'8px 4px',background:'#fef5ed',borderRadius:8}}>
            <div style={{fontSize:9,fontWeight:700,color:'#e67e22',textTransform:'uppercase'}}>🛢 Cilindro</div>
            <div style={{fontSize:14,fontWeight:700,color:'#e67e22',marginTop:2,fontFamily:'monospace'}}>
              {salidasInt.toLocaleString('es-MX',{maximumFractionDigits:0})} L
            </div>
          </div>
          <div style={{textAlign:'center',padding:'8px 4px',background:'#fee2e2',borderRadius:8}}>
            <div style={{fontSize:9,fontWeight:700,color:'#991b1b',textTransform:'uppercase'}}>🏪 Gasolinera</div>
            <div style={{fontSize:14,fontWeight:700,color:'#991b1b',marginTop:2,fontFamily:'monospace'}}>
              {salidasExt.toLocaleString('es-MX',{maximumFractionDigits:0})} L
            </div>
          </div>
          {verPrecios && (
            <div style={{textAlign:'center',padding:'8px 4px',background:'#f3f4f6',borderRadius:8}}>
              <div style={{fontSize:9,fontWeight:700,color:'#374151',textTransform:'uppercase'}}>💵 Costo</div>
              <div style={{fontSize:12,fontWeight:700,color:'#374151',marginTop:2,fontFamily:'monospace'}}>
                {mxnFmt(costoTotal)}
              </div>
            </div>
          )}
        </div>

        {saldoCilindro < 200 && (
          <div style={{marginTop:10,fontSize:12,color:'#991b1b',fontWeight:600}}>⚠ Cilindro casi vacío. Contacta a compras.</div>
        )}
        {saldoCilindro >= 200 && saldoCilindro <= 1000 && (
          <div style={{marginTop:10,fontSize:12,color:'#92400e',fontWeight:600}}>⚠ Saldo bajo.</div>
        )}
      </div>

      {/* ═══ Botones por rol ═══ */}
      {puedeComprar && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 10,
          marginBottom: 14,
        }}>
          <button onClick={()=>setModalCompra(true)} style={{
            minHeight: 52, borderRadius: 10, border: 'none',
            background: '#15803D', color: '#ffffff',
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(21,128,61,0.2)',
            touchAction: 'manipulation',
          }}>📥 Registrar compra</button>
          <button onClick={()=>setModalGasolinera(true)} style={{
            minHeight: 52, borderRadius: 10,
            background: '#ffffff', color: '#ef4444',
            border: '1.5px solid #ef4444',
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
            touchAction: 'manipulation',
          }}>🏪 Gasolinera</button>
        </div>
      )}

      {puedeCargarTractor && (
        <button
          onClick={()=>setModalCarga(true)}
          disabled={saldoCilindro <= 0}
          style={{
            width: '100%',
            minHeight: 56,
            borderRadius: 12,
            border: 'none',
            background: saldoCilindro > 0 ? '#e67e22' : '#9ca3af',
            color: '#ffffff',
            fontSize: 17,
            fontWeight: 700,
            cursor: saldoCilindro > 0 ? 'pointer' : 'not-allowed',
            boxShadow: saldoCilindro > 0 ? '0 3px 12px rgba(230,126,34,0.28)' : 'none',
            marginBottom: 20,
            touchAction: 'manipulation',
          }}
        >
          ⛽ Registrar carga de tractor
        </button>
      )}

      {/* ═══ Pills filtro ═══ */}
      <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap'}}>
        {[
          {id:'todos', label:'Todos', bg:'#f3f4f6', fg:'#374151'},
          {id:'entrada', label:'📥 Entradas', bg:'#dcfce7', fg:'#15803D'},
          {id:'salida_interna', label:'🛢 Cilindro', bg:'#fef5ed', fg:'#e67e22'},
          {id:'salida_externa', label:'🏪 Gasolinera', bg:'#fee2e2', fg:'#991b1b'},
        ].map(opt => {
          const sel = filtroTipo === opt.id;
          return (
            <button key={opt.id}
              onClick={()=>setFiltroTipo(opt.id)}
              style={{
                padding: isMobile ? '10px 14px' : '6px 12px',
                minHeight: isMobile ? 44 : undefined,
                borderRadius: 999,
                border: `1.5px solid ${sel ? opt.fg : '#d1d5db'}`,
                background: sel ? opt.bg : '#ffffff',
                color: sel ? opt.fg : '#6b7280',
                fontSize: 12,
                fontWeight: sel ? 700 : 500,
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}>
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* ═══ Historial unificado ═══ */}
      <div style={{marginBottom:10,fontSize:11,fontWeight:700,color:'#8a8070',letterSpacing:1,textTransform:'uppercase'}}>
        Historial ({historial.length})
      </div>
      {historial.length === 0 ? (
        <div style={{textAlign:'center',padding:32,color:'#8a8070',fontSize:13,background:'#ffffff',borderRadius:12,border:'1px dashed #e5e7eb'}}>
          Sin registros
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {historial.map(d => {
            const tmov = tipoMov(d);
            const litros = getLitros(d);
            const litrosLabel = litros > 0 ? `${litros.toLocaleString('es-MX')} L` : '—';
            const cfg = tmov === 'entrada'
              ? { border: '#15803D', bg: '#dcfce7', fg: '#15803D', label: '📥 Entrada' }
              : tmov === 'salida_externa'
              ? { border: '#ef4444', bg: '#fee2e2', fg: '#991b1b', label: '🏪 Gasolinera' }
              : { border: '#e67e22', bg: '#fef5ed', fg: '#e67e22', label: '🛢 Cilindro' };
            const fecha = d.fechaSolicitud || d.fecha || '—';
            return (
              <div key={d.id} onClick={()=>setModalDetalle(d)} style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderLeft: `4px solid ${cfg.border}`,
                borderRadius: 12,
                padding: '12px 14px',
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,marginBottom:6}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:700,color:'#14532D'}}>{fecha}</div>
                    <span style={{
                      display:'inline-block',marginTop:4,
                      fontSize:9,fontWeight:700,padding:'3px 9px',borderRadius:999,
                      background:cfg.bg,color:cfg.fg,letterSpacing:0.3,
                    }}>{cfg.label}</span>
                  </div>
                  <div style={{fontSize:17,fontWeight:700,color:cfg.fg,fontFamily:'monospace'}}>
                    {litrosLabel}
                  </div>
                </div>
                {tmov === 'salida_interna' && (
                  <div style={{fontSize:12,color:'#6b7280'}}>
                    🚜 {nomMaq(d.maquinariaId) || '—'}
                    {d.loteId && ` · 📍 ${nomLoteShort(d.loteId)}`}
                  </div>
                )}
                {(tmov === 'entrada' || tmov === 'salida_externa') && d.proveedor && (
                  <div style={{fontSize:12,color:'#6b7280'}}>🏪 {d.proveedor}</div>
                )}
                {verPrecios && parseFloat(d.importe) > 0 && (
                  <div style={{fontSize:13,color:'#c0392b',fontWeight:600,marginTop:4}}>{mxnFmt(d.importe)}</div>
                )}
                {d.notas && <div style={{marginTop:4,fontSize:11,color:'#8a8070',fontStyle:'italic'}}>{d.notas}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════ MODAL 1 — Compra ══════ */}
      {modalCompra && (
        <Modal title="📥 Compra de Diesel" onClose={cerrarCompra}
          footer={
            <>
              <button className="btn btn-secondary" onClick={cerrarCompra}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleGuardarCompra} style={{background:'#15803D'}}>💾 Guardar</button>
            </>
          }>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div>
              <label style={labelStyle}>Fecha *</label>
              <input type="date" style={fieldStyle} value={formCompra.fecha}
                onChange={e=>setFormCompra(f=>({...f,fecha:e.target.value}))}/>
            </div>
            <div>
              <label style={labelStyle}>Litros comprados *</label>
              <input type="number" style={fieldStyle} value={formCompra.litros} placeholder="0"
                onChange={e=>{
                  const l = parseFloat(e.target.value)||0;
                  const p = parseFloat(formCompra.precioLitro)||0;
                  setFormCompra(f=>({...f,litros:e.target.value,total: l&&p ? (l*p).toFixed(2) : f.total}));
                }}/>
            </div>
            <div>
              <label style={labelStyle}>Proveedor</label>
              <input type="text" style={fieldStyle} value={formCompra.proveedor}
                onChange={e=>setFormCompra(f=>({...f,proveedor:e.target.value}))} placeholder="Ej. PEMEX"/>
            </div>
            {verPrecios && (
              <div>
                <label style={labelStyle}>Precio por litro $</label>
                <input type="number" style={fieldStyle} value={formCompra.precioLitro} placeholder="0.00"
                  onChange={e=>{
                    const p = parseFloat(e.target.value)||0;
                    const l = parseFloat(formCompra.litros)||0;
                    setFormCompra(f=>({...f,precioLitro:e.target.value,total: l&&p ? (l*p).toFixed(2) : f.total}));
                  }}/>
              </div>
            )}
            {verPrecios && (
              <div>
                <label style={labelStyle}>Total $ (calculado)</label>
                <input type="number" style={{...fieldStyle, fontFamily:'monospace', fontWeight:700, color:'#c0392b'}}
                  value={formCompra.total} placeholder="0.00"
                  onChange={e=>setFormCompra(f=>({...f,total:e.target.value}))}/>
              </div>
            )}
            <div>
              <label style={labelStyle}>Notas</label>
              <input type="text" style={fieldStyle} value={formCompra.notas}
                onChange={e=>setFormCompra(f=>({...f,notas:e.target.value}))} placeholder="# Factura, observaciones..."/>
            </div>
          </div>
        </Modal>
      )}

      {/* ══════ MODAL 2 — Gasolinera ══════ */}
      {modalGasolinera && (
        <Modal title="🏪 Carga en Gasolinera" onClose={cerrarGas}
          footer={
            <>
              <button className="btn btn-secondary" onClick={cerrarGas}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleGuardarGas} style={{background:'#ef4444'}}>💾 Guardar</button>
            </>
          }>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div>
              <label style={labelStyle}>Fecha *</label>
              <input type="date" style={fieldStyle} value={formGas.fecha}
                onChange={e=>setFormGas(f=>({...f,fecha:e.target.value}))}/>
            </div>
            <div>
              <label style={labelStyle}>🚜 Equipo / Vehículo</label>
              <select style={fieldStyle} value={formGas.maquinariaId}
                onChange={e=>setFormGas(f=>({...f,maquinariaId:e.target.value}))}>
                <option value="">— Otro / Sin especificar —</option>
                {(state.maquinaria||[]).map(m=>(
                  <option key={m.id} value={m.id}>{m.nombre}{m.tipo?` (${m.tipo})`:''}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Litros cargados *</label>
              <input type="number" style={fieldStyle} value={formGas.litros} placeholder="0"
                onChange={e=>{
                  const l = parseFloat(e.target.value)||0;
                  const p = parseFloat(formGas.precioLitro)||0;
                  setFormGas(f=>({...f,litros:e.target.value,total: l&&p ? (l*p).toFixed(2) : f.total}));
                }}/>
            </div>
            <div>
              <label style={labelStyle}>Estación / Proveedor</label>
              <input type="text" style={fieldStyle} value={formGas.estacion}
                onChange={e=>setFormGas(f=>({...f,estacion:e.target.value}))} placeholder="Ej. PEMEX Los Mochis"/>
            </div>
            {verPrecios && (
              <div>
                <label style={labelStyle}>Precio por litro $</label>
                <input type="number" style={fieldStyle} value={formGas.precioLitro} placeholder="0.00"
                  onChange={e=>{
                    const p = parseFloat(e.target.value)||0;
                    const l = parseFloat(formGas.litros)||0;
                    setFormGas(f=>({...f,precioLitro:e.target.value,total: l&&p ? (l*p).toFixed(2) : f.total}));
                  }}/>
              </div>
            )}
            {verPrecios && (
              <div>
                <label style={labelStyle}>Total $</label>
                <input type="number" style={{...fieldStyle, fontFamily:'monospace', fontWeight:700, color:'#c0392b'}}
                  value={formGas.total} placeholder="0.00"
                  onChange={e=>setFormGas(f=>({...f,total:e.target.value}))}/>
              </div>
            )}
            <div>
              <label style={labelStyle}>Notas</label>
              <input type="text" style={fieldStyle} value={formGas.notas}
                onChange={e=>setFormGas(f=>({...f,notas:e.target.value}))} placeholder="# Ticket, observaciones..."/>
            </div>
          </div>
        </Modal>
      )}

      {/* ══════ MODAL 3 — Carga de tractor ══════ */}
      {modalCarga && (
        <Modal title="⛽ Carga de Tractor" onClose={cerrarCarga}
          footer={
            <>
              <button className="btn btn-secondary" onClick={cerrarCarga}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleGuardarCarga} style={{background:'#e67e22'}}>💾 Guardar</button>
            </>
          }>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{fontSize:12,color:'#6b7280'}}>
              Saldo disponible: <strong style={{color:saldoColor}}>{saldoCilindro.toLocaleString('es-MX')} L</strong>
            </div>
            <div>
              <label style={labelStyle}>Fecha *</label>
              <input type="date" style={fieldStyle} value={formCarga.fecha}
                onChange={e=>setFormCarga(f=>({...f,fecha:e.target.value}))}/>
            </div>
            <div>
              <label style={labelStyle}>🚜 Tractor / Equipo *</label>
              <select style={fieldStyle} value={formCarga.maquinariaId}
                onChange={e=>setFormCarga(f=>({...f,maquinariaId:e.target.value}))}>
                <option value="">— Seleccionar —</option>
                {(state.maquinaria||[]).map(m=>(
                  <option key={m.id} value={m._uuid||m.id}>{m.nombre}{m.tipo?` (${m.tipo})`:''}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>📍 Lote</label>
              <select style={fieldStyle} value={formCarga.loteId}
                onChange={e=>setFormCarga(f=>({...f,loteId:e.target.value}))}>
                <option value="">— Sin especificar —</option>
                {optLotes.map(l => {
                  const ha = parseFloat(l.hectareas || l.supCredito || l.supModulo || 0).toFixed(1);
                  const apodo = l.apodo && l.apodo !== 'NO DEFINIDO' ? l.apodo : (l.folioCorto || `Lote #${l.id}`);
                  const prodTxt = l.propietario ? ` — ${l.propietario}` : '';
                  return <option key={l.id} value={l.id}>{apodo}{prodTxt} ({ha} ha)</option>;
                })}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Litros cargados *</label>
              <input type="number" style={fieldStyle} value={formCarga.litros} placeholder="0"
                onChange={e=>setFormCarga(f=>({...f,litros:e.target.value}))}/>
            </div>
            <div>
              <label style={labelStyle}>🔧 Tipo de labor</label>
              <select style={fieldStyle} value={formCarga.tipoLabor}
                onChange={e=>setFormCarga(f=>({...f,tipoLabor:e.target.value}))}>
                <option value="">— Sin especificar —</option>
                {TIPOS_LABOR.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>📐 Hectáreas a trabajar</label>
              <input type="number" style={fieldStyle} value={formCarga.hectareas} placeholder="0"
                onChange={e=>setFormCarga(f=>({...f,hectareas:e.target.value}))}/>
            </div>
            {/* Calculadora de consumo */}
            {formCarga.maquinariaId && formCarga.tipoLabor && parseFloat(formCarga.hectareas) > 0 && (() => {
              const consumo = maqConsumos.find(c => String(c.maquinariaId) === String(formCarga.maquinariaId) && c.tipoLabor === formCarga.tipoLabor);
              if (!consumo) return (
                <div style={{padding:'8px 12px',background:'#f3f4f6',borderRadius:8,fontSize:11,color:'#6b7280'}}>
                  Sin consumo configurado para esta labor — configura en Maquinaria
                </div>
              );
              const necesarios = consumo.litrosPorHa * parseFloat(formCarga.hectareas);
              const margen = (parseFloat(formCarga.litros)||0) - necesarios;
              const color = margen >= necesarios*0.1 ? '#166534' : margen >= 0 ? '#92400e' : '#991b1b';
              const bg = margen >= necesarios*0.1 ? '#f0fdf4' : margen >= 0 ? '#fef3c7' : '#fee2e2';
              return (
                <div style={{padding:'8px 12px',background:bg,border:`1px solid ${color}22`,borderRadius:8,fontSize:11,color}}>
                  {margen >= 0
                    ? `✅ Diesel suficiente — necesitas ${necesarios.toFixed(0)}L, cargas ${parseFloat(formCarga.litros)||0}L (${margen.toFixed(0)}L de margen)`
                    : `⚠ Insuficiente — necesitas ${necesarios.toFixed(0)}L para ${formCarga.hectareas} ha, faltan ${Math.abs(margen).toFixed(0)}L`}
                </div>
              );
            })()}
            <div>
              <label style={labelStyle}>👷 Operador</label>
              <select style={fieldStyle} value={formCarga.operadorId}
                onChange={e=>setFormCarga(f=>({...f,operadorId:e.target.value}))}>
                <option value="">— Sin especificar —</option>
                {(state.operadores||[]).filter(o=>o.activo!==false).map(o=>(
                  <option key={o.id} value={o.id}>{o.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Notas</label>
              <input type="text" style={fieldStyle} value={formCarga.notas}
                onChange={e=>setFormCarga(f=>({...f,notas:e.target.value}))} placeholder="Observaciones opcionales"/>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal detalle de movimiento */}
      {modalDetalle && (() => {
        const d = modalDetalle;
        const tmov = tipoMov(d);
        const litros = getLitros(d);
        const cfg = tmov === 'entrada'
          ? { bg:'#dcfce7', fg:'#15803D', label:'📥 Entrada' }
          : tmov === 'salida_externa'
          ? { bg:'#fee2e2', fg:'#991b1b', label:'🏪 Gasolinera' }
          : { bg:'#fef5ed', fg:'#e67e22', label:'🛢 Salida cilindro' };
        const puedeCancel = !d.cancelado && (
          (userRol === 'admin') ||
          (d.registradoPor === usuario?.usuario && (d.fechaSolicitud||d.fecha) === hoy)
        );
        const row = (icon, label, val) => val ? (
          <div style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'4px 0',borderBottom:'1px solid #f0ede6'}}>
            <span style={{color:'#b0a090'}}>{icon} {label}</span>
            <span style={{color:'#1a2e1a',fontWeight:500}}>{val}</span>
          </div>
        ) : null;
        return (
          <Modal title="Detalle del movimiento" onClose={()=>{setModalDetalle(null);setMotivoCancel('');}}>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:12,fontWeight:700,padding:'4px 12px',borderRadius:999,background:cfg.bg,color:cfg.fg}}>{cfg.label}</span>
                <span style={{fontSize:12,color:'#6b7280'}}>{d.fechaSolicitud||d.fecha||'—'}</span>
              </div>
              <div style={{fontSize:28,fontFamily:'Georgia, serif',color:'#1a2e1a',marginBottom:4}}>{litros > 0 ? `${litros.toLocaleString('es-MX')} L` : '—'}</div>

              {/* Campos comunes */}
              {verPrecios && parseFloat(d.importe) > 0 && row('💵','Importe',mxnFmt(d.importe))}
              {verPrecios && d.precioLitro && parseFloat(d.precioLitro)>0 && row('💲','Precio/L',`$${parseFloat(d.precioLitro).toFixed(2)}`)}
              {row('🏪','Proveedor',d.proveedor)}
              {/* Salida interna */}
              {row('🚜','Tractor',nomMaq(d.maquinariaId))}
              {row('📍','Lote',nomLoteShort(d.loteId))}
              {row('👷','Operador',d.operador || ((state.operadores||[]).find(o=>String(o.id)===String(d.operadorId))?.nombre))}
              {row('🔧','Concepto',d.concepto)}
              {row('📝','Notas',d.notas)}
              {row('👤','Registrado por',d.registradoPor)}
              {row('🕐','Creado',d.created_at ? new Date(d.created_at).toLocaleString('es-MX') : null)}

              {d.cancelado && (
                <div style={{padding:'10px 14px',background:'#fee2e2',borderRadius:8,fontSize:12,color:'#991b1b',marginTop:4}}>
                  🚫 Cancelado{d.motivoCancelacion ? ` — ${d.motivoCancelacion}` : ''}{d.canceladoPor ? ` por ${d.canceladoPor}` : ''}{d.fechaCancelacion ? ` el ${new Date(d.fechaCancelacion).toLocaleDateString('es-MX')}` : ''}
                </div>
              )}

              {/* Acciones admin: editar litros/notas */}
              {userRol === 'admin' && !d.cancelado && (
                <div style={{borderTop:'1px solid #ede5d8',paddingTop:10,marginTop:4}}>
                  <div style={{fontSize:11,color:'#b0a090',marginBottom:6}}>Edición rápida (admin):</div>
                  <div style={{display:'flex',gap:8,marginBottom:8}}>
                    <input id="edit-litros" type="number" defaultValue={litros} placeholder="Litros" style={{...fieldStyle,flex:1}}/>
                    <input id="edit-notas" type="text" defaultValue={d.notas||''} placeholder="Notas" style={{...fieldStyle,flex:2}}/>
                    <button onClick={async ()=>{
                      const newLitros = parseFloat(document.getElementById('edit-litros')?.value)||litros;
                      const newNotas = document.getElementById('edit-notas')?.value||d.notas||'';
                      try {
                        await fetch(`${SUPABASE_URL}/rest/v1/diesel?id=eq.${encodeURIComponent(String(d._uuid||d.id))}`,{
                          method:'PATCH',
                          headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`,'Content-Type':'application/json'},
                          body:JSON.stringify({cantidad:newLitros,litros_recibidos:newLitros,notas:newNotas}),
                        });
                      } catch(e){console.warn('Edit diesel fail:',e);}
                      dispatch({type:'UPDATE_DIESEL',payload:{id:d.id,cantidad:newLitros,notas:newNotas}});
                      setModalDetalle({...d,cantidad:newLitros,notas:newNotas});
                    }} style={{padding:'6px 14px',background:'#1a3a0f',color:'#fff',border:'none',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
                      💾
                    </button>
                  </div>
                </div>
              )}

              {puedeCancel && (
                <div style={{borderTop:'1px solid #ede5d8',paddingTop:10,marginTop:4}}>
                  <div style={{fontSize:11,color:'#b0a090',marginBottom:6}}>Cancelar este registro:</div>
                  <input type="text" style={{...fieldStyle,marginBottom:8}} value={motivoCancel}
                    onChange={e=>setMotivoCancel(e.target.value)} placeholder="Motivo de cancelación"/>
                  <button onClick={async ()=>{
                    if (!motivoCancel.trim()) { alert('Ingresa un motivo.'); return; }
                    try {
                      await fetch(`${SUPABASE_URL}/rest/v1/diesel?id=eq.${encodeURIComponent(String(d._uuid||d.id))}`,{
                        method:'PATCH',
                        headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`,'Content-Type':'application/json'},
                        body:JSON.stringify({cancelado:true,motivo_cancelacion:motivoCancel,cancelado_por:usuario?.usuario||userRol,fecha_cancelacion:new Date().toISOString()}),
                      });
                    } catch(e) { console.warn('Cancel diesel sync fail:', e); }
                    dispatch({type:'CANCEL_DIESEL',payload:{id:d.id,motivo:motivoCancel,canceladoPor:usuario?.usuario||userRol}});
                    setModalDetalle(null); setMotivoCancel('');
                  }} style={{width:'100%',padding:'8px',background:'#c84b4b',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                    🚫 Cancelar registro
                  </button>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
