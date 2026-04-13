// ─── modules/Lotes.jsx ───────────────────────────────────────────

import React, { useState, useReducer, useContext, useCallback, useRef, useEffect, useMemo } from 'react';
import { useData } from '../core/DataContext.jsx';
import {
  T, css, confirmarEliminar, puedeEliminarLote, puedeEliminarProductor,
  puedeEliminarMaquina, puedeEliminarOperador, MOTIVOS_CANCELACION,
  CULTIVOS, ESTADOS_FENOL, TIPOS_TRABAJO, CAT_INSUMO, UNIDADES, CAT_GASTO,
  filtrarPorProductor, PROD_COLORES, ordenarProductores, nomCompleto,
  mxnFmt, fmt, today, fenologiaColor, estadoColor
} from '../shared/utils.js';
import {
  Modal, ModalCancelacion, ModalReactivacion, BadgeCancelado,
  BtnExport, NavBadge
} from '../shared/Modal.jsx';
import {
  ROLES, ACCESO, USUARIOS, getRolInfo, getRolesDisponibles,
  getRolPermisos, getPermisosUsuario
} from '../shared/roles.js';
import {
  calcularInteresCredito, calcularInteresCargosCredito, calcularFinancieros,
  calcularCreditoProd, calcularVencimiento, getParamsCultivo, calcularAlertas,
  exportarExcel, descargarHTML, exportarExcelProductor, generarHTMLProductor,
  generarHTMLTodos, exportarExcelTodos, navRowProps, FiltroSelect, PanelAlertas
} from '../shared/helpers.jsx';


export default function LotesModule({ userRol, puedeEditar }) {
  const { state, dispatch } = useData();
  const [modo, setModo]     = useState("lista");   // lista | detalle | form | analisis | fenologia
  const [sel, setSel]       = useState(null);
  const [editando, setEditando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEjido, setFiltroEjido] = useState("TODOS");
  // Análisis
  const [agruparPor, setAgruparPor]   = useState("propietario"); // propietario | apodo | ejido | arrendatario
  const [filtroSel,  setFiltroSel]    = useState("");

  // ── Combos dinámicos ──────────────────────────────────────────────────────
  const ransInicio   = [...new Set((state.lotes||[]).map(l=>l.ran).filter(Boolean))].sort();
  const apodosInicio = ["NO DEFINIDO", ...new Set((state.lotes||[]).map(l=>l.apodo).filter(b=>b&&b!=="NO DEFINIDO"))].sort((a,b)=>a==="NO DEFINIDO"?-1:b==="NO DEFINIDO"?1:a.localeCompare(b,"es"));
  const propsInicio  = [...new Set((state.lotes||[]).map(l=>l.propietario).filter(Boolean))].sort();
  const ejidosInicio = [...new Set((state.lotes||[]).map(l=>l.ejido).filter(Boolean))].sort();

  const [optsRan,   agregarRan]   = useComboDinamico(ransInicio);
  const [optsApodo, agregarApodo] = useComboDinamico(apodosInicio);
  const [optsProp,  agregarProp]  = useComboDinamico(propsInicio);
  const [optsEjido, agregarEjido] = useComboDinamico(ejidosInicio);

  const emptyForm = {
    folioCorto:"", docLegal:"", ran:"", lote:"", apodo:"",
    propietario:"", estado:"SINALOA", municipio:"EL FUERTE", ejido:"",
    supCertificado:"", supModulo:"",
  };
  const [form, setForm] = useState(emptyForm);

  const lotes = state.lotes || [];

  // Superficie crédito calculada en tiempo real
  const supCreditoForm = calcSupCredito(form.supCertificado, form.supModulo);

  // Filtros lista
  const ejidosDisponibles = ["TODOS", ...new Set(lotes.map(l=>l.ejido).filter(Boolean))].sort();
  const lotesFiltrados = lotes.filter(l => {
    const matchEjido = filtroEjido === "TODOS" || l.ejido === filtroEjido;
    const q = busqueda.toLowerCase();
    const matchBusq = !q || [l.folioCorto,l.docLegal,l.lote,l.apodo,l.propietario,l.ejido,l.ran]
      .some(v => v && String(v).toLowerCase().includes(q));
    return matchEjido && matchBusq;
  });

  const totalHaCredito     = (lotes||[]).reduce((s,l)=>s+(l.supCredito||0),0);
  const totalHaModulo      = (lotes||[]).reduce((s,l)=>s+(l.supModulo||0),0);
  const totalHaCertificado = (lotes||[]).reduce((s,l)=>s+(l.supCertificado||0),0);

  const abrirForm = (l=null) => {
    if (l) {
      setForm({
        folioCorto:   String(l.folioCorto||""),
        docLegal:     l.docLegal||"",
        ran:          l.ran||"",
        lote:         l.lote||"",
        apodo:        l.apodo||"NO DEFINIDO",
        propietario:  l.propietario||"",
        estado:       "SINALOA",
        municipio:    l.municipio||"EL FUERTE",
        ejido:        l.ejido||"",
        supCertificado: l.supCertificado>0 ? String(l.supCertificado) : "",
        supModulo:    l.supModulo>0 ? String(l.supModulo) : "",
      });
      setEditando(true);
    } else {
      setForm(emptyForm);
      setEditando(false);
    }
    setModo("form");
  };

  const guardar = () => {
    // El autocomplete ya guarda el valor en form directamente
    // Si es valor nuevo, agregarlo al combo para futuros usos
    if (form.ran   && !optsRan.includes(form.ran))     agregarRan(form.ran);
    if (form.apodo && !optsApodo.includes(form.apodo)) agregarApodo(form.apodo);
    if (form.propietario && !optsProp.includes(form.propietario)) agregarProp(form.propietario);
    if (form.ejido && !optsEjido.includes(form.ejido)) agregarEjido(form.ejido);

    const ranFinal   = form.ran   || "";
    const apodoFinal = form.apodo.trim() || "NO DEFINIDO";
    const propFinal  = form.propietario || "";
    const ejidoFinal = form.ejido || "";

    const sc = parseFloat(form.supCertificado) || 0;
    const sm = parseFloat(form.supModulo) || 0;

    const payload = {
      folioCorto:     form.folioCorto.trim().toUpperCase(),
      docLegal:       form.docLegal.trim().toUpperCase(),
      ran:            ranFinal,
      lote:           form.lote.trim().toUpperCase(),
      apodo:          apodoFinal,
      propietario:    propFinal,
      estado:         "SINALOA",
      municipio:      form.municipio,
      ejido:          ejidoFinal,
      supCertificado: sc,
      supModulo:      sm,
      supCredito:     calcSupCredito(sc, sm),
      // compatibilidad con resto del sistema
      nombre:         apodoFinal + (form.lote ? " "+form.lote : ""),
      hectareas:      calcSupCredito(sc, sm),
    };

    if (editando && sel) {
      dispatch({ type:"UPD_LOTE", payload:{...sel, ...payload} });
    } else {
      dispatch({ type:"ADD_LOTE", payload });
    }
    setModo("lista"); setSel(null);
  };


  const fmt2 = n => typeof n==="number" ? n.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2}) : "—";

  // ── DETALLE ────────────────────────────────────────────────────────────────
  if (modo==="detalle" && sel) {
    const l = lotes.find(x=>x.id===sel.id)||sel;
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
          <button className="btn btn-secondary" onClick={()=>{setModo("lista");setSel(null);}}>← Volver</button>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,flex:1}}>
            {l.apodo||"Lote"} {l.lote?"· "+l.lote:""}
          </div>
          {puedeEditar && <button className="btn btn-secondary" onClick={()=>abrirForm(l)}>✏️ Editar</button>}
        </div>

        <div className="stat-grid" style={{gridTemplateColumns:"repeat(3,1fr)",marginBottom:20}}>
          <div className="stat-card green">
            <div className="stat-icon">📐</div><div className="stat-label">Sup. Certificado</div>
            <div className="stat-value">{fmt2(l.supCertificado)} <span style={{fontSize:13,fontWeight:400}}>ha</span></div>
          </div>
          <div className="stat-card sky">
            <div className="stat-icon">🗺</div><div className="stat-label">Sup. Módulo</div>
            <div className="stat-value">{fmt2(l.supModulo)} <span style={{fontSize:13,fontWeight:400}}>ha</span></div>
          </div>
          <div className="stat-card gold">
            <div className="stat-icon">💳</div><div className="stat-label">Sup. Crédito</div>
            <div className="stat-value">{fmt2(l.supCredito)} <span style={{fontSize:13,fontWeight:400}}>ha</span></div>
            <div className="stat-sub">Menor de certificado/módulo</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">📋 Datos del Predio</div></div>
          <div className="card-body">
            {[
              ["Folio Corto",      l.folioCorto||"—"],
              ["Documento Legal",  l.docLegal||"—"],
              ["RAN",              l.ran||"—"],
              ["Lote",             l.lote||"—"],
              ["Apodo",            l.apodo||"—"],
              ["Propietario",      l.propietario||"—"],
              ["Estado",           l.estado||"SINALOA"],
              ["Municipio",        l.municipio||"—"],
              ["Ejido",            l.ejido||"—"],
            ].map(([lab,val])=>(
              <div key={lab} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.line}`}}>
                <span style={{fontSize:12,color:T.fog,flexShrink:0,paddingRight:12}}>{lab}</span>
                <span style={{fontSize:13,fontWeight:600,textAlign:"right",wordBreak:"break-all"}}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {(puedeEditar || userRol==="admin") && (
          <div style={{display:"flex",gap:10,marginTop:16,flexWrap:"wrap"}}>
            {puedeEditar && <button className="btn btn-secondary" onClick={()=>abrirForm(l)} style={{flex:1}}>✏️ Editar</button>}
            {userRol==="admin" && <button className="btn btn-danger" onClick={()=>{
  const razones = puedeEliminarLote(l.id, state);
  if (razones.length>0) { alert("No se puede eliminar este lote porque " + razones.join(", ") + "."); return; }
  confirmarEliminar("¿Eliminar este lote? Esta acción no se puede deshacer.",()=>{dispatch({type:"DEL_LOTE",payload:l.id});setModo("lista");setSel(null);});
}} style={{flex:1}}>🗑 Eliminar</button>}
          </div>
        )}
      </div>
    );
  }

  // ── FORMULARIO ─────────────────────────────────────────────────────────────
  if (modo==="form") {
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
          <button className="btn btn-secondary" onClick={()=>setModo(sel?"detalle":"lista")}>← Volver</button>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700}}>
            {editando?"Editar Lote":"Nuevo Lote"}
          </div>
        </div>

        <div className="card"><div className="card-body">

          {/* Identificación */}
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:T.fog,marginBottom:10,paddingBottom:4,borderBottom:`1px solid ${T.line}`}}>Identificación del Predio</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Folio Corto</label>
              <input className="form-input" value={form.folioCorto} onChange={e=>setForm(f=>({...f,folioCorto:e.target.value.toUpperCase()}))} placeholder="1020184"/>
            </div>
            <div className="form-group">
              <label className="form-label">Documento Legal</label>
              <input className="form-input" value={form.docLegal} onChange={e=>setForm(f=>({...f,docLegal:e.target.value.toUpperCase()}))} placeholder="No.000001020184"/>
            </div>
          </div>

          <ComboConNuevo
            label="Registro Agrario Nacional (RAN)"
            value={form.ran} opts={optsRan}
            onSelect={v=>setForm(f=>({...f,ran:v}))}
            placeholder="25010003113101934R"/>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Lote</label>
              <input className="form-input" value={form.lote} onChange={e=>setForm(f=>({...f,lote:e.target.value.toUpperCase()}))} placeholder="17246-1"/>
            </div>
            <ComboConNuevo
              label="Apodo del Lote"
              value={form.apodo} opts={optsApodo}
              onSelect={v=>setForm(f=>({...f,apodo:v}))}
              placeholder="LAS 33"/>
          </div>

          <ComboConNuevo
            label="Propietario"
            value={form.propietario} opts={optsProp}
            onSelect={v=>setForm(f=>({...f,propietario:v}))}
            placeholder="APELLIDO APELLIDO NOMBRE"/>

          {/* Ubicación */}
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:T.fog,margin:"18px 0 10px",paddingBottom:4,borderBottom:`1px solid ${T.line}`}}>Ubicación</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Estado</label>
              <input className="form-input" value="SINALOA" disabled style={{background:T.mist,color:T.fog}}/>
            </div>
            <ComboConNuevo
              label="Municipio"
              value={form.municipio} opts={MUNICIPIOS_SIN}
              onSelect={v=>setForm(f=>({...f,municipio:v}))}
              placeholder="EL FUERTE"/>
          </div>

          <ComboConNuevo
            label="Ejido"
            value={form.ejido} opts={optsEjido}
            onSelect={v=>setForm(f=>({...f,ejido:v}))}
            placeholder="CONCEPCION DE CHARAY"/>

          {/* Superficies */}
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:T.fog,margin:"18px 0 10px",paddingBottom:4,borderBottom:`1px solid ${T.line}`}}>Superficies</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Sup. Certificado (ha)</label>
              <input className="form-input" type="number" step="0.01" min="0"
                value={form.supCertificado} onChange={e=>setForm(f=>({...f,supCertificado:e.target.value}))}
                placeholder="6.70" style={{fontFamily:"'DM Mono',monospace"}}/>
            </div>
            <div className="form-group">
              <label className="form-label">Sup. Módulo (ha)</label>
              <input className="form-input" type="number" step="0.01" min="0"
                value={form.supModulo} onChange={e=>setForm(f=>({...f,supModulo:e.target.value}))}
                placeholder="6.91" style={{fontFamily:"'DM Mono',monospace"}}/>
            </div>
          </div>

          {/* Superficie crédito calculada */}
          <div style={{background:T.mist,borderRadius:8,padding:"12px 16px",border:`1px solid ${T.line}`,display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:T.inkLt}}>Superficie Crédito (calculada)</div>
              <div style={{fontSize:10,color:T.straw,marginTop:2}}>📌 Automático — menor entre Certificado y Módulo</div>
            </div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:18,fontWeight:700,color:T.field}}>
              {supCreditoForm > 0 ? supCreditoForm.toFixed(2)+" ha" : "—"}
            </div>
          </div>

          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button className="btn btn-secondary" onClick={()=>setModo(sel?"detalle":"lista")} style={{flex:1}}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} style={{flex:1}}>
              💾 {editando?"Guardar cambios":"Agregar lote"}
            </button>
          </div>

        </div></div>
      </div>
    );
  }

  // ── Arrendatario (productor que trabaja cada lote en ciclo activo) ────────────
  const cicloActivo = (state.ciclos||[]).find(c=>c.id===state.cicloActivoId) || (state.ciclos||[])[0];
  const asigsCiclo  = cicloActivo?.asignaciones || [];
  const arrendatarioDeLote = (loteId) => {
    const asig = asigsCiclo.find(a=>String(a.loteId)===String(loteId));
    if(!asig) return null;
    return (state.productores||[]).find(p=>String(p.id)===String(asig.productorId)) || null;
  };
  const buildGrupos = (campo) => {
    const grupos = {};
    lotes.forEach(l => {
      let key = "";
      if(campo==="propietario")       key = l.propietario || "Sin propietario";
      else if(campo==="apodo")        key = l.apodo || "Sin apodo";
      else if(campo==="ejido")        key = l.ejido || "Sin ejido";
      else if(campo==="arrendatario") {
        const p = arrendatarioDeLote(l.id);
        key = p ? (p.alias||p.apPat) : "Sin arrendatario";
      }
      if(!grupos[key]) grupos[key] = { lotes:[], haCred:0, haMod:0, haCert:0 };
      grupos[key].lotes.push(l);
      grupos[key].haCred += l.supCredito  || 0;
      grupos[key].haMod  += l.supModulo   || 0;
      grupos[key].haCert += l.supCertificado || 0;
    });
    return Object.entries(grupos)
      .sort((a,b)=>b[1].haCred-a[1].haCred)
      .map(([nombre,d])=>({ nombre, ...d }));
  };

  // ── ANÁLISIS ──────────────────────────────────────────────────────────────────
  // ── VISTA FENOLOGÍA ───────────────────────────────────────────────────────
  if (modo==="fenologia") {
    const bitacora   = state.bitacora || [];
    const lotes      = state.lotes    || [];
    const cicloPred  = (state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[])[0];
    const asigs      = cicloPred?.asignaciones || [];

    // Build fenologia history per lote from bitacora
    const fenolPorLote = {};
    bitacora
      .filter(b=>b.tipo==="fenol" && b.data?.fenologia)
      .sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)))
      .forEach(b=>{
        const ids = Array.isArray(b.loteIds) ? b.loteIds : (b.loteId?[b.loteId]:[]);
        ids.forEach(lid=>{
          const key = String(lid);
          if(!fenolPorLote[key]) fenolPorLote[key]=[];
          fenolPorLote[key].push({ fecha:b.fecha, etapa:b.data.fenologia, obs:b.data.observacion||"", operador:b.operador||"" });
        });
      });

    const ETAPAS = ["Presiembra","Vegetativo","Macollamiento","Encañazón","Espigamiento","Floración","Llenado","Madurez","Cosechado"];
    const ETAPA_COLOR = {
      "Presiembra":"#8a8070","Vegetativo":"#4a8c2a","Macollamiento":"#2d5a1b",
      "Encañazón":"#1a6ea8","Espigamiento":"#c8a84b","Floración":"#e67e22",
      "Llenado":"#c0392b","Madurez":"#856404","Cosechado":"#5b9fd6"
    };

    // Lotes en el ciclo activo
    const lotesEnCiclo = lotes.filter(l=>asigs.some(a=>String(a.loteId)===String(l.id)));

    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          <button className="btn btn-secondary" onClick={()=>setModo("lista")}>← Volver</button>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,flex:1}}>
            🌿 Seguimiento Fenológico del Ciclo
          </div>
        </div>

        {/* Leyenda de etapas */}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
          {ETAPAS.map(e=>(
            <span key={e} style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,
              background:ETAPA_COLOR[e]+'22', color:ETAPA_COLOR[e], border:`1px solid ${ETAPA_COLOR[e]}44`}}>
              {e}
            </span>
          ))}
        </div>

        {lotesEnCiclo.length===0 ? (
          <div className="empty-state">
            <div className="empty-icon">🌿</div>
            <div className="empty-title">Sin lotes en el ciclo activo</div>
          </div>
        ) : (
          <div className="card">
            <div className="table-wrap-scroll">
              <table style={{minWidth:700}}>
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Propietario</th>
                    <th style={{textAlign:"right"}}>Ha</th>
                    <th>Etapa actual</th>
                    <th>Último registro</th>
                    <th>Historial</th>
                  </tr>
                </thead>
                <tbody>
                  {lotesEnCiclo.map((l,i)=>{
                    const hist = fenolPorLote[String(l.id)] || [];
                    const ultima = hist[hist.length-1];
                    const ha = asigs.filter(a=>String(a.loteId)===String(l.id)).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
                    const bg = i%2===0?"white":"#faf8f3";
                    const color = ultima ? (ETAPA_COLOR[ultima.etapa]||T.fog) : T.fog;
                    return (
                      <tr key={l.id}>
                        <td style={{background:bg,fontWeight:700}}>{l.apodo&&l.apodo!=="NO DEFINIDO"?l.apodo:l.folioCorto}</td>
                        <td style={{background:bg,fontSize:12,color:T.fog}}>{l.propietario||"—"}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{ha>0?ha.toFixed(2):"—"}</td>
                        <td style={{background:bg}}>
                          {ultima ? (
                            <span style={{padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:700,
                              background:color+'22',color,border:`1px solid ${color}44`}}>
                              {ultima.etapa}
                            </span>
                          ) : <span style={{color:T.fog,fontSize:12}}>Sin registro</span>}
                        </td>
                        <td style={{background:bg,fontSize:11,color:T.fog}}>
                          {ultima ? `${ultima.fecha}${ultima.operador?' · '+ultima.operador:''}` : "—"}
                        </td>
                        <td style={{background:bg}}>
                          <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                            {hist.map((h,j)=>(
                              <span key={j} title={`${h.fecha}: ${h.etapa}${h.obs?' — '+h.obs:''}`}
                                style={{width:10,height:10,borderRadius:"50%",display:"inline-block",
                                  background:ETAPA_COLOR[h.etapa]||T.fog,cursor:"default"}}>
                              </span>
                            ))}
                            {hist.length===0&&<span style={{fontSize:10,color:T.fog}}>—</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detalle — registros recientes */}
        {Object.keys(fenolPorLote).length>0&&(
          <div className="card" style={{marginTop:16}}>
            <div className="card-header"><div className="card-title">Registros Recientes de Fenología</div></div>
            <div className="table-wrap-scroll">
              <table>
                <thead><tr><th>Fecha</th><th>Lote</th><th>Etapa</th><th>Observación</th><th>Operador</th></tr></thead>
                <tbody>
                  {bitacora.filter(b=>b.tipo==="fenol"&&b.data?.fenologia)
                    .sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)))
                    .slice(0,20)
                    .map((b,i)=>{
                      const ids = Array.isArray(b.loteIds)?b.loteIds:(b.loteId?[b.loteId]:[]);
                      const nomLotes = ids.map(lid=>{const l=lotes.find(x=>String(x.id)===String(lid));return l?(l.apodo&&l.apodo!=="NO DEFINIDO"?l.apodo:l.folioCorto):lid;}).join(", ");
                      const color = ETAPA_COLOR[b.data.fenologia]||T.fog;
                      const bg = i%2===0?"white":"#faf8f3";
                      return (
                        <tr key={b.id}>
                          <td style={{background:bg,fontFamily:"monospace",fontSize:12}}>{b.fecha}</td>
                          <td style={{background:bg,fontSize:12,fontWeight:600}}>{nomLotes||"—"}</td>
                          <td style={{background:bg}}>
                            <span style={{padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700,
                              background:color+'22',color,border:`1px solid ${color}44`}}>
                              {b.data.fenologia}
                            </span>
                          </td>
                          <td style={{background:bg,fontSize:12,color:T.fog}}>{b.data.observacion||"—"}</td>
                          <td style={{background:bg,fontSize:12,color:T.fog}}>{b.operador||"—"}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (modo==="analisis") {
    const DIMENSIONES = [
      { id:"propietario",  label:"Propietario",  icon:"👤" },
      { id:"apodo",        label:"Apodo/Módulo", icon:"🏷" },
      { id:"ejido",        label:"Ejido",        icon:"🌾" },
      { id:"arrendatario", label:"Arrendatario", icon:"🚜" },
    ];
    const grupos = buildGrupos(agruparPor);
    const grupoSel = filtroSel ? grupos.find(g=>g.nombre===filtroSel) : null;
    const lotesDelGrupo = grupoSel ? grupoSel.lotes : [];
    const opcionesGrupo = grupos.map(g=>({
      valor:g.nombre, label:g.nombre,
      sub:`${g.lotes.length} lotes`,
      monto:g.haCred, count:g.lotes.length,
    }));
    const fmtHa = n => parseFloat(n||0).toFixed(2);

    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
          <button className="btn btn-secondary" onClick={()=>{setModo("lista");setFiltroSel("");}}>← Volver</button>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,flex:1}}>Análisis de Superficie</div>
          {puedeEditar && <button className="btn btn-primary btn-sm" onClick={()=>abrirForm()}>＋ Nuevo lote</button>}
        </div>
        {/* KPIs */}
        <div className="stat-grid" style={{gridTemplateColumns:"repeat(4,1fr)",marginBottom:20}}>
          {[
            {card:"green",  icon:"🌾", label:"Total Lotes",     valor:lotes.length,    sub:`${grupos.length} ${DIMENSIONES.find(d=>d.id===agruparPor)?.label}s`},
            {card:"sky",    icon:"💳", label:"Ha Crédito",      valor:fmtHa(totalHaCredito)+" ha",  sub:"base para crédito"},
            {card:"purple", icon:"📐", label:"Ha Módulo",       valor:fmtHa(totalHaModulo)+" ha",   sub:"superficie módulo"},
            {card:"gold",   icon:"📜", label:"Ha Certificado",  valor:fmtHa(totalHaCertificado)+" ha", sub:"sup. certificada"},
          ].map(({card,icon,label,valor,sub})=>(
            <div key={label} className={`stat-card ${card}`}>
              <div className="stat-icon">{icon}</div><div className="stat-label">{label}</div>
              <div className="stat-value" style={{fontSize:16}}>{valor}</div>
              <div className="stat-sub">{sub}</div>
            </div>
          ))}
        </div>
        {/* Selector dimensión + FiltroSelect */}
        <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
          <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${T.line}`}}>
            {DIMENSIONES.map(d=>(
              <div key={d.id} onClick={()=>{setAgruparPor(d.id);setFiltroSel("");}}
                style={{padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer",
                  background:agruparPor===d.id?T.field:"white",
                  color:agruparPor===d.id?"white":T.fog,transition:"all 0.15s"}}>
                {d.icon} {d.label}
              </div>
            ))}
          </div>
          <FiltroSelect
            valor={filtroSel} onChange={setFiltroSel}
            opciones={opcionesGrupo}
            placeholder={`Buscar ${DIMENSIONES.find(d=>d.id===agruparPor)?.label}...`}
            width={250}
            mxnFmt={n=>fmtHa(n)+" ha"}
          />
          {filtroSel && (
            <span style={{padding:"3px 10px",borderRadius:12,background:"#e8f4e8",color:"#2d5a1b",
              fontSize:11,fontWeight:700,border:"1px solid #4a8c2a44",cursor:"pointer"}}
              onClick={()=>setFiltroSel("")}>
              {DIMENSIONES.find(d=>d.id===agruparPor)?.icon} {filtroSel} ✕
            </span>
          )}
        </div>
        {/* Panel detalle del grupo seleccionado */}
        {grupoSel && (
          <div style={{marginBottom:16,borderRadius:10,overflow:"hidden",border:"2px solid #2d5a1b33",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
            <div style={{background:"#2d5a1b15",padding:"12px 16px",borderBottom:"1px solid #2d5a1b22",
              display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#2d5a1b"}}>{DIMENSIONES.find(d=>d.id===agruparPor)?.icon} {grupoSel.nombre}</div>
                <div style={{fontSize:11,color:T.fog,marginTop:2}}>{grupoSel.lotes.length} lotes</div>
              </div>
              <div style={{display:"flex",gap:20}}>
                {[["💳 Ha Crédito",grupoSel.haCred,"#1a6ea8"],["📐 Ha Módulo",grupoSel.haMod,"#5b9fd6"],["📜 Ha Cert.",grupoSel.haCert,"#8e44ad"]].map(([l,v,c])=>(
                  <div key={l} style={{textAlign:"right"}}>
                    <div style={{fontSize:10,color:T.fog}}>{l}</div>
                    <div style={{fontFamily:"monospace",fontWeight:800,fontSize:20,color:c}}>{fmtHa(v)} ha</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{minWidth:700,width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:T.mist,fontSize:11,fontWeight:700,color:T.fog,textTransform:"uppercase",letterSpacing:"0.06em"}}>
                    <th style={{padding:"8px 14px",textAlign:"left"}}>Apodo</th>
                    <th style={{padding:"8px 14px",textAlign:"left"}}>Propietario</th>
                    <th style={{padding:"8px 14px",textAlign:"left"}}>Arrendatario</th>
                    <th style={{padding:"8px 14px",textAlign:"left"}}>Ejido</th>
                    <th style={{padding:"8px 14px",textAlign:"right"}}>Ha Cred.</th>
                    <th style={{padding:"8px 14px",textAlign:"right"}}>Ha Mód.</th>
                    <th style={{padding:"8px 14px",textAlign:"right"}}>Ha Cert.</th>
                    <th style={{padding:"8px 14px",textAlign:"left"}}>Folio</th>
                  </tr>
                </thead>
                <tbody>
                  {lotesDelGrupo.map((l,i)=>{
                    const arr = arrendatarioDeLote(l.id);
                    const bg = i%2===0?"white":"#faf8f3";
                    return (
                      <tr key={l.id} style={{cursor:"pointer",transition:"filter 0.12s"}}
                        onMouseEnter={e=>e.currentTarget.style.filter="brightness(0.93)"}
                        onMouseLeave={e=>e.currentTarget.style.filter=""}
                        onClick={()=>{setSel(l);setModo("detalle");}}>
                        <td style={{background:bg,padding:"9px 14px",fontWeight:700,fontSize:13}}>{l.apodo||"—"}</td>
                        <td style={{background:bg,padding:"9px 14px",fontSize:12,color:T.fog}}>{l.propietario||"—"}</td>
                        <td style={{background:bg,padding:"9px 14px"}}>
                          {arr ? <span style={{display:"flex",alignItems:"center",gap:5}}>
                            <span style={{width:7,height:7,borderRadius:"50%",background:arr.color,display:"inline-block"}}/>
                            <span style={{fontSize:12,fontWeight:600,color:arr.color}}>{arr.alias||arr.apPat}</span>
                          </span> : <span style={{fontSize:11,color:T.fog}}>Sin asignar</span>}
                        </td>
                        <td style={{background:bg,padding:"9px 14px",fontSize:12,color:T.fog}}>{l.ejido||"—"}</td>
                        <td style={{background:bg,padding:"9px 14px",textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#1a6ea8"}}>{fmtHa(l.supCredito)}</td>
                        <td style={{background:bg,padding:"9px 14px",textAlign:"right",fontFamily:"monospace",color:"#5b9fd6"}}>{fmtHa(l.supModulo)}</td>
                        <td style={{background:bg,padding:"9px 14px",textAlign:"right",fontFamily:"monospace",color:"#8e44ad"}}>{fmtHa(l.supCertificado)}</td>
                        <td style={{background:bg,padding:"9px 14px",fontFamily:"monospace",fontSize:11,color:T.fog}}>{l.folioCorto||"—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{background:"#f0f7ec",fontWeight:700}}>
                    <td style={{padding:"9px 14px",fontSize:12}} colSpan={4}>TOTAL — {lotesDelGrupo.length} lotes</td>
                    <td style={{padding:"9px 14px",textAlign:"right",fontFamily:"monospace",color:"#1a6ea8"}}>{fmtHa(grupoSel.haCred)}</td>
                    <td style={{padding:"9px 14px",textAlign:"right",fontFamily:"monospace",color:"#5b9fd6"}}>{fmtHa(grupoSel.haMod)}</td>
                    <td style={{padding:"9px 14px",textAlign:"right",fontFamily:"monospace",color:"#8e44ad"}}>{fmtHa(grupoSel.haCert)}</td>
                    <td/>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
        {/* Barras por grupo */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Distribución por {DIMENSIONES.find(d=>d.id===agruparPor)?.label}</div>
            <span style={{fontFamily:"monospace",fontSize:11,color:T.fog}}>{fmtHa(totalHaCredito)} ha crédito total</span>
          </div>
          <div className="card-body">
            {grupos.map((g,i)=>{
              const pct = totalHaCredito>0?Math.min(100,g.haCred/totalHaCredito*100):0;
              const col = ["#2d5a1b","#1a6ea8","#c8a84b","#c0392b","#8e44ad","#e67e22","#27ae60","#5b9fd6","#7f8c8d"][i%9];
              const isSel = filtroSel===g.nombre;
              return (
                <div key={g.nombre} style={{marginBottom:10,cursor:"pointer",
                  opacity:filtroSel&&!isSel?0.4:1,transition:"opacity 0.2s"}}
                  onClick={()=>setFiltroSel(isSel?"":g.nombre)}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:3}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:col,flexShrink:0}}/>
                      <span style={{fontSize:12,fontWeight:isSel?700:500,color:isSel?col:"#3d3525",
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:260}}>
                        {g.nombre}
                      </span>
                      <span style={{fontSize:10,color:T.fog,flexShrink:0}}>{g.lotes.length} lot.</span>
                    </div>
                    <div style={{display:"flex",gap:12,alignItems:"baseline",flexShrink:0}}>
                      <span style={{fontSize:10,color:T.fog}}>{pct.toFixed(1)}%</span>
                      <span style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:col}}>{fmtHa(g.haCred)} ha</span>
                    </div>
                  </div>
                  <div style={{height:8,borderRadius:4,background:"#eee",overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:4,background:col,width:`${pct}%`,transition:"width 0.5s"}}/>
                  </div>
                  {isSel && (
                    <div style={{display:"flex",gap:14,marginTop:3}}>
                      {[["Crédito",g.haCred,"#1a6ea8"],["Módulo",g.haMod,"#5b9fd6"],["Certif.",g.haCert,"#8e44ad"]].map(([lbl,v,c])=>(
                        <span key={lbl} style={{fontSize:10,color:c,fontFamily:"monospace"}}>
                          {lbl}: <strong>{fmtHa(v)}</strong> ha
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── LISTA ──────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="stat-grid" style={{gridTemplateColumns:"repeat(5,1fr)",marginBottom:20}}>
        <div className="stat-card green">
          <div className="stat-icon">🌾</div><div className="stat-label">Total Lotes</div>
          <div className="stat-value">{lotes.length}</div>
          <div className="stat-sub">{ejidosDisponibles.filter(e=>e!=="TODOS").join(" · ")}</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon">📜</div><div className="stat-label">Ha Certificado Total</div>
          <div className="stat-value">{fmt2(totalHaCertificado)} <span style={{fontSize:13,fontWeight:400}}>ha</span></div>
          <div className="stat-sub">Superficie certificada</div>
        </div>
        <div className="stat-card sky">
          <div className="stat-icon">📐</div><div className="stat-label">Ha Módulo Total</div>
          <div className="stat-value">{fmt2(totalHaModulo)} <span style={{fontSize:13,fontWeight:400}}>ha</span></div>
          <div className="stat-sub">Superficie de módulo</div>
        </div>
        <div className="stat-card gold">
          <div className="stat-icon">💳</div><div className="stat-label">Ha Crédito Total</div>
          <div className="stat-value">{fmt2(totalHaCredito)} <span style={{fontSize:13,fontWeight:400}}>ha</span></div>
          <div className="stat-sub">Base para crédito</div>
        </div>
        <div className="stat-card rust">
          <div className="stat-icon">🏘</div><div className="stat-label">Ejidos</div>
          <div className="stat-value">{ejidosDisponibles.filter(e=>e!=="TODOS").length}</div>
          <div className="stat-sub">Ejidos registrados</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Padrón de Lotes y Parcelas</div>
          <BtnExport onClick={()=>exportarExcel("Lotes_Parcelas",[{
            nombre:"Lotes",
            headers:["Apodo","Folio","Doc Legal","RAN","Lote","Propietario","Ejido","Sup Módulo","Sup Crédito"],
            rows:(state.lotes||[]).map(l=>[l.apodo,l.folioCorto,l.docLegal,l.ran,l.lote,l.propietario,l.ejido,l.supModulo,l.supCredito])
          }])}/>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            {/* Filtro ejido */}
            <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${T.line}`}}>
              {ejidosDisponibles.map(e=>(
                <div key={e} onClick={()=>setFiltroEjido(e)}
                  style={{padding:"6px 10px",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",
                    background:filtroEjido===e?T.field:"white",
                    color:filtroEjido===e?"white":T.fog,
                    transition:"all 0.15s"}}>
                  {e==="TODOS"?"🌐 Todos":e}
                </div>
              ))}
            </div>
            {puedeEditar && <button className="btn btn-primary btn-sm" onClick={()=>abrirForm()}>＋ Nuevo lote</button>}
            <button className="btn btn-secondary btn-sm" onClick={()=>setModo("analisis")}
              style={{background:"#f0f7ec",border:"1px solid #4a8c2a44",color:"#2d5a1b",fontWeight:600}}>
              📊 Análisis
            </button>
            <button className="btn btn-secondary btn-sm" onClick={()=>setModo("fenologia")}
              style={{background:"#e8f4fd",border:"1px solid #1a6ea844",color:"#1a6ea8",fontWeight:600}}>
              🌿 Fenología
            </button>
          </div>
        </div>

        <div style={{padding:"10px 16px 0"}}>
          <input className="form-input" value={busqueda} onChange={e=>setBusqueda(e.target.value)}
            placeholder="🔍  Buscar por folio, apodo, propietario, lote…"
            style={{fontSize:13}}/>
        </div>
        <div style={{padding:"6px 16px 0",fontSize:11,color:T.fog}}>
          {lotesFiltrados.length} de {lotes.length} lotes
        </div>

        <div style={{background:"#f0f7f0",border:"1px solid #c8e0c8",borderRadius:8,padding:"8px 14px",fontSize:12,color:"#4a6a4a",margin:"10px 16px 0"}}>
          💡 Toca una fila para ver el detalle · Desliza → para ver todas las columnas
        </div>

        <div className="table-wrap-scroll">
          <table style={{minWidth:1100}}>
            <thead>
              <tr>
                <th style={{minWidth:110,position:"sticky",left:0,top:0,zIndex:4,background:"#f7f5f0",boxShadow:"3px 0 6px rgba(0,0,0,0.08)"}}>Apodo</th>
                <th style={{minWidth:100}}>Folio Corto</th>
                <th style={{minWidth:180}}>Documento Legal</th>
                <th style={{minWidth:160}}>RAN</th>
                <th style={{minWidth:100}}>Lote</th>
                <th style={{minWidth:220}}>Propietario</th>
                <th style={{minWidth:120}}>Ejido</th>
                <th style={{minWidth:120}}>Municipio</th>
                <th style={{minWidth:90,textAlign:"right"}}>Sup. Cert.</th>
                <th style={{minWidth:90,textAlign:"right"}}>Sup. Mód.</th>
                <th style={{minWidth:90,textAlign:"right"}}>Sup. Cred.</th>
                <th style={{minWidth:70}}></th>
              </tr>
            </thead>
            <tbody>
              {lotesFiltrados.map((l, idx) => {
                const bgFila = idx%2===0 ? "white" : "#faf8f3";
                return (
                  <tr key={l.id} style={{cursor:"pointer"}} onClick={()=>{setSel(l);setModo("detalle");}}>
                    <td style={{position:"sticky",left:0,zIndex:2,background:bgFila,boxShadow:"3px 0 6px rgba(0,0,0,0.06)"}}>
                      <span style={{fontWeight:600,fontSize:12}}>{l.apodo||"—"}</span>
                    </td>
                    <td style={{background:bgFila,fontSize:11,fontFamily:"'DM Mono',monospace"}}>{l.folioCorto||"—"}</td>
                    <td style={{background:bgFila,fontSize:11,fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap"}}>{l.docLegal||"—"}</td>
                    <td style={{background:bgFila,fontSize:11,fontFamily:"'DM Mono',monospace",color:T.fog,whiteSpace:"nowrap"}}>{l.ran||"—"}</td>
                    <td style={{background:bgFila,fontSize:12}}>{l.lote||"—"}</td>
                    <td style={{background:bgFila,fontSize:11,whiteSpace:"nowrap"}}>{l.propietario||"—"}</td>
                    <td style={{background:bgFila,fontSize:11}}>{l.ejido||"—"}</td>
                    <td style={{background:bgFila,fontSize:11}}>{l.municipio||"—"}</td>
                    <td style={{background:bgFila,textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:12}}>{l.supCertificado>0?fmt2(l.supCertificado):"—"}</td>
                    <td style={{background:bgFila,textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:12}}>{l.supModulo>0?fmt2(l.supModulo):"—"}</td>
                    <td style={{background:bgFila,textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700,color:T.field}}>{l.supCredito>0?fmt2(l.supCredito):"—"}</td>
                    <td style={{background:bgFila}} onClick={e=>e.stopPropagation()}>
                      <div style={{display:"flex",gap:4}}>
                        {puedeEditar && <button className="btn btn-sm btn-secondary" onClick={()=>{setSel(l);abrirForm(l);}}>✏️</button>}
                        {userRol==="admin" && <button className="btn btn-sm btn-danger" onClick={()=>{
  const razones = puedeEliminarLote(l.id, state);
  if (razones.length>0) { alert("No se puede eliminar: " + razones.join(", ") + "."); return; }
  confirmarEliminar("¿Eliminar este lote?",()=>dispatch({type:"DEL_LOTE",payload:l.id}));
}}>🗑</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
