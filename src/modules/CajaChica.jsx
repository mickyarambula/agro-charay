// ─── modules/CajaChica.jsx ─────────────────────────────────────────
// Fondo de caja chica con vistas diferenciadas por rol:
//  - Encargado: ve saldo, registra gastos, solicita reposición
//  - Admin/Daniela: asigna/repone fondo, aprueba/rechaza gastos
//  - Socio: solo lectura

import React, { useState } from 'react';
import { useData } from '../core/DataContext.jsx';
import { T, mxnFmt } from '../shared/utils.js';
import { Modal } from '../shared/Modal.jsx';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../core/supabase.js';

export default function CajaChicaModule({ userRol, usuario }) {
  const { state, dispatch } = useData();
  const hoy = new Date().toISOString().split('T')[0];

  const fondo = state.cajaChicaFondo || null;
  const movimientos = state.cajaChicaMovimientos || [];

  const esEncargado = userRol === 'encargado';
  const esAdmin = userRol === 'admin' || userRol === 'daniela';
  const esSocio = userRol === 'socio';

  const [modalGasto, setModalGasto] = useState(false);
  const [modalFondo, setModalFondo] = useState(false);
  const [formGasto, setFormGasto] = useState({
    concepto: '', monto: '', fecha: hoy, foto_url: '', notas: '',
  });
  const [formFondo, setFormFondo] = useState({ monto: '', notas: '' });

  // ─── Cálculos derivados ─────────────────────────────────────────
  const montoAsignado = parseFloat(fondo?.montoAsignado || 0);
  const montoDisponible = parseFloat(fondo?.monto_disponible || 0);
  const pctUsado = montoAsignado > 0 ? ((montoAsignado - montoDisponible) / montoAsignado) * 100 : 0;
  const pctDisponible = Math.max(0, 100 - pctUsado);
  const saldoBajo = montoAsignado > 0 && pctDisponible < 20;
  const colorNivel = pctDisponible > 50 ? '#2d7a2d' : pctDisponible > 20 ? '#c8a84b' : '#c84b4b';

  const movsFondo = fondo ? movimientos.filter(m => String(m.fondoId) === String(fondo.id)) : movimientos;
  const misMovs = esEncargado
    ? movsFondo.filter(m => m.registradoPor === usuario?.usuario)
    : movsFondo;
  const pendientesAdmin = movsFondo.filter(m => m.estatus === 'pendiente');
  const aprobadosSocio = movsFondo.filter(m => m.estatus === 'aprobado').slice(0, 5);

  const cerrarGasto = () => { setModalGasto(false); setFormGasto({ concepto:'', monto:'', fecha:hoy, foto_url:'', notas:'' }); };
  const cerrarFondo = () => { setModalFondo(false); setFormFondo({ monto:'', notas:'' }); };

  // ─── Handlers ───────────────────────────────────────────────────
  const guardarGasto = async () => {
    const monto = parseFloat(formGasto.monto) || 0;
    if (!formGasto.concepto || !monto) { alert('Concepto y monto son requeridos.'); return; }
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `mov-${Date.now()}`;
    const payload = {
      id,
      fondoId: fondo?.id || null,
      tipo: 'gasto',
      concepto: formGasto.concepto,
      monto,
      foto_url: formGasto.foto_url || '',
      estatus: 'pendiente',
      registradoPor: usuario?.usuario || userRol,
      aprobadoPor: '',
      fecha: formGasto.fecha,
      notas: formGasto.notas || '',
      created_at: new Date().toISOString(),
    };
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/caja_chica_movimientos`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          id,
          fondo_id: fondo?.id || null,
          tipo: 'gasto',
          concepto: payload.concepto,
          monto: payload.monto,
          foto_url: payload.foto_url,
          estatus: 'pendiente',
          registrado_por: payload.registradoPor,
          fecha: payload.fecha,
          notas: payload.notas,
        }),
      });
    } catch(e) { console.warn('[Supabase] caja_chica gasto fail:', e); }
    dispatch({ type: 'ADD_CAJA_CHICA_GASTO', payload });
    cerrarGasto();
  };

  const guardarFondo = async () => {
    const monto = parseFloat(formFondo.monto) || 0;
    if (!monto) { alert('El monto es requerido.'); return; }

    // Reposición: sumar al fondo existente
    if (fondo?.id) {
      const nuevoAsignado = montoAsignado + monto;
      const nuevoDisponible = montoDisponible + monto;
      const payload = {
        ...fondo,
        montoAsignado: nuevoAsignado,
        monto_disponible: nuevoDisponible,
        estatus: 'activo',
      };
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/caja_chica_fondos?id=eq.${encodeURIComponent(fondo.id)}`, {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            monto_asignado: nuevoAsignado,
            monto_disponible: nuevoDisponible,
            estatus: 'activo',
          }),
        });
      } catch(e) { console.warn('[Supabase] caja_chica fondo patch fail:', e); }
      dispatch({ type: 'SET_CAJA_CHICA_FONDO', payload });
    } else {
      // Nuevo fondo
      const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `fondo-${Date.now()}`;
      const payload = {
        id,
        cicloId: state.cicloActivoId || null,
        montoAsignado: monto,
        monto_disponible: monto,
        estatus: 'activo',
        creadoPor: usuario?.usuario || userRol,
        fechaApertura: hoy,
        notas: formFondo.notas || '',
      };
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/caja_chica_fondos`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            id,
            monto_asignado: monto,
            monto_disponible: monto,
            estatus: 'activo',
            creado_por: payload.creadoPor,
            fecha_apertura: hoy,
            notas: payload.notas,
          }),
        });
      } catch(e) { console.warn('[Supabase] caja_chica fondo post fail:', e); }
      dispatch({ type: 'SET_CAJA_CHICA_FONDO', payload });
    }
    cerrarFondo();
  };

  const aprobarGasto = async (mov) => {
    if (!window.confirm(`¿Aprobar gasto "${mov.concepto}" por ${mxnFmt(mov.monto)}?`)) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/caja_chica_movimientos?id=eq.${encodeURIComponent(mov.id)}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ estatus: 'aprobado', aprobado_por: usuario?.usuario || userRol }),
      });
      if (fondo?.id) {
        const nuevoDisp = Math.max(0, montoDisponible - mov.monto);
        await fetch(`${SUPABASE_URL}/rest/v1/caja_chica_fondos?id=eq.${encodeURIComponent(fondo.id)}`, {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ monto_disponible: nuevoDisp, estatus: nuevoDisp<=0 ? 'agotado' : 'activo' }),
        });
      }
    } catch(e) { console.warn('[Supabase] aprobar gasto fail:', e); }
    dispatch({ type: 'UPDATE_CAJA_CHICA_MOV', payload: { id: mov.id, estatus: 'aprobado', aprobadoPor: usuario?.usuario || userRol, monto: mov.monto } });
  };

  const rechazarGasto = async (mov) => {
    if (!window.confirm(`¿Rechazar gasto "${mov.concepto}"?`)) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/caja_chica_movimientos?id=eq.${encodeURIComponent(mov.id)}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ estatus: 'rechazado', aprobado_por: usuario?.usuario || userRol }),
      });
    } catch(e) { console.warn('[Supabase] rechazar gasto fail:', e); }
    dispatch({ type: 'UPDATE_CAJA_CHICA_MOV', payload: { id: mov.id, estatus: 'rechazado', aprobadoPor: usuario?.usuario || userRol } });
  };

  const handleFotoUpload = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => setFormGasto(g => ({ ...g, foto_url: ev.target.result }));
    reader.readAsDataURL(f);
  };

  // ─── Estilos comunes ────────────────────────────────────────────
  const statusColor = (est) => ({
    pendiente: { bg:'#fef3c7', fg:'#92400e', label:'⏳ Pendiente' },
    aprobado:  { bg:'#dcfce7', fg:'#15803D', label:'✅ Aprobado' },
    rechazado: { bg:'#fee2e2', fg:'#991b1b', label:'❌ Rechazado' },
  })[est] || { bg:'#f3f4f6', fg:'#6b7280', label: est };

  // ═══════════════════════════════════════════════════════════════
  // VISTA ENCARGADO
  // ═══════════════════════════════════════════════════════════════
  if (esEncargado) {
    return (
      <div>
        <div style={{fontFamily:'Georgia, serif',fontSize:22,fontWeight:700,color:'#1a2e1a',marginBottom:4}}>
          💵 Caja Chica
        </div>
        <div style={{fontSize:12,color:'#b0a090',marginBottom:20}}>Fondo para gastos menores de campo</div>

        {!fondo ? (
          <div style={{background:'#fff',border:'1px solid #ede5d8',borderRadius:10,padding:24,textAlign:'center'}}>
            <div style={{fontSize:48,marginBottom:8}}>💵</div>
            <div style={{fontSize:14,color:'#1a2e1a',fontWeight:500}}>Sin fondo activo</div>
            <div style={{fontSize:12,color:'#b0a090',marginTop:6}}>Solicita a administración que asigne un fondo inicial.</div>
          </div>
        ) : (
          <>
            {/* KPI saldo */}
            <div style={{background:'#fff',border:'1px solid #ede5d8',borderLeft:`6px solid ${colorNivel}`,borderRadius:10,padding:20,marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:'#b0a090',letterSpacing:1,textTransform:'uppercase',marginBottom:6}}>Saldo disponible</div>
              <div style={{fontSize:36,fontFamily:'Georgia, serif',fontWeight:400,color:colorNivel,lineHeight:1}}>
                {mxnFmt(montoDisponible)}
              </div>
              <div style={{fontSize:12,color:'#6b7280',marginTop:4}}>de {mxnFmt(montoAsignado)} asignado</div>
              <div style={{height:10,borderRadius:5,background:'#ede5d8',overflow:'hidden',marginTop:12}}>
                <div style={{height:'100%',width:`${pctDisponible}%`,background:colorNivel,transition:'width 0.3s'}}/>
              </div>
              <div style={{fontSize:10,color:'#b0a090',marginTop:4,textAlign:'center'}}>
                {Math.round(pctDisponible)}% disponible · {Math.round(pctUsado)}% usado
              </div>
              {saldoBajo && (
                <div style={{marginTop:12,padding:'10px 14px',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,color:'#991b1b',fontSize:12,fontWeight:500}}>
                  ⚠ Saldo bajo — solicita reposición a administración
                </div>
              )}
            </div>

            <button
              onClick={()=>setModalGasto(true)}
              style={{
                width:'100%',minHeight:52,marginBottom:20,
                background:'#1a3a0f',color:'#fff',border:'none',borderRadius:10,
                fontSize:15,fontFamily:'Georgia, serif',fontWeight:400,cursor:'pointer',
              }}>
              + Registrar Gasto
            </button>

            <div style={{fontSize:11,fontWeight:700,color:'#b0a090',letterSpacing:1,textTransform:'uppercase',marginBottom:10}}>
              Mis gastos del fondo
            </div>
            {misMovs.length === 0 ? (
              <div style={{textAlign:'center',padding:24,color:'#b0a090',fontSize:13,background:'#fff',border:'1px dashed #ede5d8',borderRadius:10}}>
                Sin gastos registrados
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {misMovs.map(m => {
                  const st = statusColor(m.estatus);
                  return (
                    <div key={m.id} style={{background:'#fff',border:'1px solid #ede5d8',borderLeft:`4px solid ${st.fg}`,borderRadius:10,padding:'12px 14px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,marginBottom:4}}>
                        <div style={{fontSize:14,fontWeight:600,color:'#1a2e1a',flex:1}}>{m.concepto}</div>
                        <div style={{fontSize:15,fontFamily:'Georgia, serif',color:'#c84b4b',fontWeight:500}}>{mxnFmt(m.monto)}</div>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                        <div style={{fontSize:11,color:'#6b7280'}}>{m.fecha}</div>
                        <span style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:999,background:st.bg,color:st.fg}}>{st.label}</span>
                      </div>
                      {m.notas && <div style={{fontSize:11,color:'#6b7280',marginTop:4,fontStyle:'italic'}}>{m.notas}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Modal registro gasto */}
        {modalGasto && (
          <Modal title="➕ Registrar Gasto" onClose={cerrarGasto}
            footer={
              <>
                <button className="btn btn-secondary" onClick={cerrarGasto}>Cancelar</button>
                <button className="btn btn-primary" onClick={guardarGasto}>💾 Guardar</button>
              </>
            }>
            <div className="form-group">
              <label className="form-label">Concepto *</label>
              <input className="form-input" value={formGasto.concepto}
                onChange={e=>setFormGasto(g=>({...g,concepto:e.target.value}))}
                placeholder="Ej. Compra de refrigerios cuadrilla"/>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Monto *</label>
                <input className="form-input" type="number" value={formGasto.monto}
                  onChange={e=>setFormGasto(g=>({...g,monto:e.target.value}))} placeholder="0"/>
              </div>
              <div className="form-group">
                <label className="form-label">Fecha</label>
                <input className="form-input" type="date" value={formGasto.fecha}
                  onChange={e=>setFormGasto(g=>({...g,fecha:e.target.value}))}/>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Foto del ticket (opcional)</label>
              <input type="file" accept="image/*" capture="environment" onChange={handleFotoUpload}/>
              {formGasto.foto_url && <img src={formGasto.foto_url} alt="ticket" style={{marginTop:8,maxWidth:'100%',maxHeight:180,borderRadius:8}}/>}
            </div>
            <div className="form-group">
              <label className="form-label">Notas</label>
              <input className="form-input" value={formGasto.notas}
                onChange={e=>setFormGasto(g=>({...g,notas:e.target.value}))}
                placeholder="Observaciones opcionales"/>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // VISTA SOCIO (solo lectura)
  // ═══════════════════════════════════════════════════════════════
  if (esSocio) {
    return (
      <div>
        <div style={{fontFamily:'Georgia, serif',fontSize:22,fontWeight:700,color:'#1a2e1a',marginBottom:4}}>
          💵 Caja Chica
        </div>
        <div style={{fontSize:12,color:'#b0a090',marginBottom:20}}>Estado del fondo y últimos movimientos</div>
        {!fondo ? (
          <div style={{background:'#fff',border:'1px solid #ede5d8',borderRadius:10,padding:24,textAlign:'center',color:'#b0a090',fontSize:13}}>
            Sin fondo activo
          </div>
        ) : (
          <>
            <div style={{background:'#fff',border:'1px solid #ede5d8',borderLeft:`6px solid ${colorNivel}`,borderRadius:10,padding:20,marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:'#b0a090',letterSpacing:1,textTransform:'uppercase',marginBottom:6}}>Fondo activo</div>
              <div style={{fontSize:28,fontFamily:'Georgia, serif',color:colorNivel}}>{mxnFmt(montoDisponible)}</div>
              <div style={{fontSize:12,color:'#6b7280'}}>de {mxnFmt(montoAsignado)} · {Math.round(pctUsado)}% gastado</div>
              <div style={{height:8,borderRadius:4,background:'#ede5d8',overflow:'hidden',marginTop:10}}>
                <div style={{height:'100%',width:`${pctDisponible}%`,background:colorNivel}}/>
              </div>
            </div>
            <div style={{fontSize:11,fontWeight:700,color:'#b0a090',letterSpacing:1,textTransform:'uppercase',marginBottom:10}}>
              Últimos 5 gastos aprobados
            </div>
            {aprobadosSocio.length === 0 ? (
              <div style={{textAlign:'center',padding:24,color:'#b0a090',fontSize:13,background:'#fff',border:'1px dashed #ede5d8',borderRadius:10}}>Sin movimientos aprobados</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {aprobadosSocio.map(m => (
                  <div key={m.id} style={{background:'#fff',border:'1px solid #ede5d8',borderLeft:'4px solid #2d7a2d',borderRadius:10,padding:'12px 14px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}>
                      <div style={{fontSize:13,fontWeight:600,color:'#1a2e1a'}}>{m.concepto}</div>
                      <div style={{fontSize:14,fontFamily:'Georgia, serif',color:'#c84b4b'}}>{mxnFmt(m.monto)}</div>
                    </div>
                    <div style={{fontSize:11,color:'#6b7280',marginTop:2}}>{m.fecha} · {m.registradoPor}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // VISTA ADMIN / DANIELA
  // ═══════════════════════════════════════════════════════════════
  return (
    <div>
      <div style={{fontFamily:'Georgia, serif',fontSize:22,fontWeight:700,color:'#1a2e1a',marginBottom:4}}>
        💵 Caja Chica
      </div>
      <div style={{fontSize:12,color:'#b0a090',marginBottom:20}}>Gestión del fondo y aprobación de gastos</div>

      {saldoBajo && pendientesAdmin.length > 0 && (
        <div style={{marginBottom:16,padding:'12px 16px',background:'#fef3c7',border:'1px solid #fde68a',borderRadius:10,color:'#92400e',fontSize:13}}>
          ⚠ Saldo bajo ({Math.round(pctDisponible)}% disponible) y hay {pendientesAdmin.length} gasto(s) pendiente(s). Considera reponer el fondo.
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        {/* Panel izquierdo: fondo */}
        <div style={{background:'#fff',border:'1px solid #ede5d8',borderRadius:10,padding:18}}>
          <div style={{fontSize:11,fontWeight:700,color:'#b0a090',letterSpacing:1,textTransform:'uppercase',marginBottom:10}}>
            Fondo activo
          </div>
          {fondo ? (
            <>
              <div style={{fontSize:30,fontFamily:'Georgia, serif',color:colorNivel,lineHeight:1}}>{mxnFmt(montoDisponible)}</div>
              <div style={{fontSize:12,color:'#6b7280',marginTop:4}}>de {mxnFmt(montoAsignado)} asignado</div>
              <div style={{height:12,borderRadius:6,background:'#ede5d8',overflow:'hidden',marginTop:12}}>
                <div style={{height:'100%',width:`${pctDisponible}%`,background:colorNivel}}/>
              </div>
              <div style={{fontSize:10,color:'#b0a090',marginTop:4,textAlign:'center'}}>
                {Math.round(pctDisponible)}% disponible · {Math.round(pctUsado)}% usado · Estado: {fondo.estatus}
              </div>
            </>
          ) : (
            <div style={{fontSize:13,color:'#b0a090',padding:16,textAlign:'center'}}>Sin fondo. Asigna uno para empezar.</div>
          )}
          <button onClick={()=>setModalFondo(true)}
            style={{
              width:'100%',marginTop:14,minHeight:44,
              background:'#1a3a0f',color:'#fff',border:'none',borderRadius:8,
              fontSize:14,fontFamily:'Georgia, serif',cursor:'pointer',
            }}>
            {fondo ? '💰 Reponer fondo' : '➕ Asignar fondo inicial'}
          </button>
        </div>

        {/* Panel derecho: pendientes */}
        <div style={{background:'#fff',border:'1px solid #ede5d8',borderRadius:10,padding:18}}>
          <div style={{fontSize:11,fontWeight:700,color:'#b0a090',letterSpacing:1,textTransform:'uppercase',marginBottom:10}}>
            Gastos pendientes ({pendientesAdmin.length})
          </div>
          {pendientesAdmin.length === 0 ? (
            <div style={{textAlign:'center',padding:16,color:'#b0a090',fontSize:13}}>Sin gastos pendientes</div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:400,overflowY:'auto'}}>
              {pendientesAdmin.map(m => (
                <div key={m.id} style={{border:'1px solid #ede5d8',borderRadius:8,padding:'10px 12px',background:'#faf8f3'}}>
                  <div style={{display:'flex',justifyContent:'space-between',gap:8,marginBottom:4}}>
                    <div style={{fontSize:13,fontWeight:600,color:'#1a2e1a'}}>{m.concepto}</div>
                    <div style={{fontSize:14,fontFamily:'Georgia, serif',color:'#c84b4b'}}>{mxnFmt(m.monto)}</div>
                  </div>
                  <div style={{fontSize:11,color:'#6b7280',marginBottom:6}}>
                    {m.fecha} · por <strong>{m.registradoPor}</strong>
                  </div>
                  {m.foto_url && <img src={m.foto_url} alt="ticket" style={{maxWidth:'100%',maxHeight:100,borderRadius:6,marginBottom:6}}/>}
                  {m.notas && <div style={{fontSize:11,color:'#6b7280',fontStyle:'italic',marginBottom:6}}>{m.notas}</div>}
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={()=>aprobarGasto(m)} style={{flex:1,padding:'6px 10px',background:'#dcfce7',color:'#15803D',border:'1px solid #2d7a2d',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                      ✅ Aprobar
                    </button>
                    <button onClick={()=>rechazarGasto(m)} style={{flex:1,padding:'6px 10px',background:'#fee2e2',color:'#991b1b',border:'1px solid #c84b4b',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                      ❌ Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal asignar/reponer fondo */}
      {modalFondo && (
        <Modal title={fondo ? '💰 Reponer fondo' : '➕ Asignar fondo inicial'} onClose={cerrarFondo}
          footer={
            <>
              <button className="btn btn-secondary" onClick={cerrarFondo}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarFondo}>💾 Guardar</button>
            </>
          }>
          <div className="form-group">
            <label className="form-label">Monto a {fondo ? 'reponer' : 'asignar'} *</label>
            <input className="form-input" type="number" value={formFondo.monto}
              onChange={e=>setFormFondo(f=>({...f,monto:e.target.value}))} placeholder="0"/>
          </div>
          <div className="form-group">
            <label className="form-label">Notas</label>
            <input className="form-input" value={formFondo.notas}
              onChange={e=>setFormFondo(f=>({...f,notas:e.target.value}))}
              placeholder="Motivo, referencia, etc."/>
          </div>
          {fondo && (
            <div style={{padding:'10px 14px',background:'#f0f7ec',borderRadius:8,fontSize:12,color:'#1a3a0f'}}>
              Nuevo saldo estimado: {mxnFmt(montoDisponible + (parseFloat(formFondo.monto)||0))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
