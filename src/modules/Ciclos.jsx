// ─── modules/Ciclos.jsx ───────────────────────────────────────────

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
import {
  postCultivoCatalogo, patchCultivoCatalogo,
} from '../core/supabaseWriters.js';
import { useIsMobile } from '../components/mobile/useIsMobile.js';


export default function CiclosModule({ userRol, puedeEditar }) {
  const { state, dispatch } = useData();
  const isMobile = useIsMobile();
  const [vista, setVista]   = useState("lista");    // lista | detalle | editProds | editLotes | cultivos
  const [selCiclo, setSelCiclo] = useState(null);   // id del ciclo en edición/detalle

  // Form nuevo/edición del ciclo (solo datos básicos)
  const [formCiclo, setFormCiclo] = useState({ nombre:"", fechaInicio:"", fechaFin:"", notas:"", predeterminado:true });
  const [modoForm,  setModoForm]  = useState("nuevo"); // nuevo | editar

  // Panel productores
  const [busqProd, setBusqProd]   = useState("");
  const [prodsSel, setProdsSel]   = useState([]);    // ids seleccionados en el ciclo

  // Panel lotes — asignaciones { loteId: { productorId|null, supAsignada } }[]
  const [asignaciones, setAsign]  = useState([]);    // [{ loteId, productorId, supAsignada }]
  const [prodFiltroLotes, setProdFiltroLotes] = useState("__todos__");
  const [busqLotes, setBusqLotes] = useState("");
  // Cultivos del ciclo
  const [vistaEditCultivos, setVistaEditCultivos] = useState(false);
  const [cultivosSel, setCultivosSel] = useState([]); // [{cultivoId, cultivoNombre, variedad}]
  const [nuevoCultNombre, setNuevoCultNombre] = useState("");
  const [nuevoCultVar, setNuevoCultVar] = useState("");
  const [cultivoSelIdx, setCultivoSelIdx] = useState(null); // índice en cultivosSel

  const ciclos          = state.ciclos || [];
  const productores     = (state.productores||[]).filter(p=>p.activo!==false);
  const lotes           = state.lotes || [];
  const cultivosCat     = state.cultivosCatalogo || [];
  const [cultivoFiltro, setCultivoFiltro] = useState(null);
  const [nuevoCult, setNuevoCult]         = useState("");
  const [nuevaVar,  setNuevaVar]          = useState("");
  const [editCultNom, setEditCultNom]     = useState("");
  const [prodsCultivos, setProdsCultivos] = useState({});

  const cicloSel    = ciclos.find(c=>c.id===selCiclo);

  const nomProd = (p) => p ? (p.alias || [p.apPat,p.apMat,p.nombres].filter(Boolean).join(" ")) : "—";
  const fmt2 = n => (parseFloat(n)||0).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2});

  // Superficie ya asignada de un lote en la sesión actual de edición
  const supAsignadaLote = (loteId) =>
    asignaciones.filter(a=>a.loteId===loteId).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);

  const supDisponibleLote = (loteId, excludeIndex=null) => {
    const lote = lotes.find(l=>l.id===loteId);
    const usada = asignaciones
      .filter((a,i)=>a.loteId===loteId && i!==excludeIndex)
      .reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
    return Math.max(0, (lote?.supCredito||0) - usada);
  };

  // ── Abrir formulario nuevo ciclo ──────────────────────────────────────────
  const abrirNuevo = () => {
    setFormCiclo({ nombre:"", fechaInicio:"", fechaFin:"", notas:"", predeterminado: ciclos.length===0 });
    setModoForm("nuevo");
    setVista("form");
  };

  // ── Guardar/actualizar ciclo (datos básicos) ──────────────────────────────
  const guardarCiclo = () => {
    if (!formCiclo.nombre.trim()) return;
    if (modoForm==="nuevo") {
      const id = Date.now();
      const nuevo = {
        id,
        nombre:       formCiclo.nombre.trim().toUpperCase(),
        fechaInicio:  formCiclo.fechaInicio,
        fechaFin:     formCiclo.fechaFin,
        notas:        formCiclo.notas.trim(),
        predeterminado: formCiclo.predeterminado,
        productores:  [],
        asignaciones: [],
        cultivosDelCiclo: [],
      };
      dispatch({ type:"ADD_CICLO", payload: nuevo });
      if (formCiclo.predeterminado) dispatch({ type:"SET_CICLO_PRED", payload: id });
      setSelCiclo(id);
      setCultivosSel([]);
      setVistaEditCultivos(true); // Abrir cultivos inmediatamente al crear ciclo
      setVista("detalle");
    } else {
      dispatch({ type:"UPD_CICLO", payload:{ ...cicloSel, ...formCiclo, nombre: formCiclo.nombre.trim().toUpperCase() }});
      if (formCiclo.predeterminado) dispatch({ type:"SET_CICLO_PRED", payload: selCiclo });
      setVista("detalle");
    }
  };

  // ── Guardar productores del ciclo ─────────────────────────────────────────
  const guardarProductores = (cultivosMap) => {
    const pc = prodsSel.map(id=>({ productorId:id, cultivos: cultivosMap?.[id]||[] }));
    dispatch({ type:"UPD_CICLO", payload:{ ...cicloSel, productores: prodsSel, productoresCultivos: pc }});
    setVista("detalle");
  };

  // ── Guardar lotes del ciclo ───────────────────────────────────────────────
  const guardarLotes = () => {
    const asigNormalizadas = asignaciones.map(a => ({
      ...a,
      productorId: a.productorId === null || a.productorId === undefined ? null : parseInt(a.productorId)||a.productorId,
      supAsignada: parseFloat(a.supAsignada)||0
    }));
    dispatch({ type:"UPD_CICLO", payload:{ ...cicloSel, asignaciones: asigNormalizadas }});
    setVista("detalle");
  };

  // ── Abrir panel productores ───────────────────────────────────────────────
  const abrirProductores = (ciclo) => {
    setSelCiclo(ciclo.id);
    setProdsSel(ciclo.productores||[]);
    // Inicializar cultivos por productor desde los datos guardados
    const mapCults = Object.fromEntries(
      (ciclo.productoresCultivos||[]).map(pc=>[pc.productorId, pc.cultivos||[]])
    );
    setProdsCultivos(mapCults);
    setBusqProd("");
    setVista("editProds");
  };

  // ── Abrir panel lotes ─────────────────────────────────────────────────────
  const abrirLotes = (ciclo) => {
    setSelCiclo(ciclo.id);
    setAsign([...(ciclo.asignaciones||[])]);
    setProdFiltroLotes("__todos__");
    setBusqLotes("");
    setVista("editLotes");
  };

  const setPredeterminado = (id) => dispatch({ type:"SET_CICLO_PRED", payload: id });

  // ── Cultivos del ciclo ────────────────────────────────────────────────────
  const abrirCultivos = (ciclo) => {
    setSelCiclo(ciclo.id);
    setVista("cultivos");
  };

  const agregarCultivoCiclo = (cultivoId, cultivoNombre, variedad) => {
    if (!cultivoId || !variedad) return;
    const ciclo = ciclos.find(c=>c.id===selCiclo);
    if (!ciclo) return;
    const ya = (ciclo.cultivosDelCiclo||[]).some(c=>c.cultivoId===cultivoId&&c.variedad===variedad);
    if (ya) return;
    dispatch({ type:"UPD_CICLO", payload:{
      ...ciclo,
      cultivosDelCiclo:[...(ciclo.cultivosDelCiclo||[]),{cultivoId, cultivoNombre, variedad}]
    }});
  };

  const quitarCultivoCiclo = (cultivoId, variedad) => {
    const ciclo = ciclos.find(c=>c.id===selCiclo);
    if (!ciclo) return;
    dispatch({ type:"UPD_CICLO", payload:{
      ...ciclo,
      cultivosDelCiclo:(ciclo.cultivosDelCiclo||[]).filter(c=>!(c.cultivoId===cultivoId&&c.variedad===variedad))
    }});
  };

  const crearCultivoCat = () => {
    if (!nuevoCult.trim()) return;
    const ya = cultivosCat.find(c=>c.nombre.toUpperCase()===nuevoCult.trim().toUpperCase());
    if (ya) { setNuevoCult(""); return; }
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `cult-${Date.now()}`;
    const payload = { id, nombre: nuevoCult.trim(), variedades: [] };
    dispatch({ type:"ADD_CULTIVO_CAT", payload });
    postCultivoCatalogo(payload);
    setNuevoCult("");
  };

  const agregarVariedadCat = (cultivoId) => {
    if (!nuevaVar.trim()) return;
    const cult = cultivosCat.find(c=>c.id===cultivoId);
    if (!cult || cult.variedades.includes(nuevaVar.trim())) return;
    const nuevasVariedades = [...cult.variedades, nuevaVar.trim()];
    dispatch({ type:"ADD_VAR_CAT", payload:{ cultivoId, variedad:nuevaVar.trim() }});
    patchCultivoCatalogo(cultivoId, { variedades: nuevasVariedades });
    setNuevaVar("");
  };
  const eliminarCiclo = (id) => { dispatch({ type:"DEL_CICLO", payload: id }); setVista("lista"); };

  // ────────────────────────────────────────────────────────────────────────────
  // VISTA: FORM (nuevo/editar ciclo)
  // ────────────────────────────────────────────────────────────────────────────
  if (vista==="form") return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <button className="btn btn-secondary" onClick={()=>setVista(selCiclo?"detalle":"lista")}>← Cancelar</button>
        <div style={{fontFamily:"Georgia, serif",fontSize:20,fontWeight:700}}>
          {modoForm==="nuevo" ? "Nuevo Ciclo Agrícola" : `Editar — ${cicloSel?.nombre}`}
        </div>
      </div>
      <div className="card"><div className="card-body">
        <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:"#8a8070",marginBottom:12,paddingBottom:4,borderBottom:"1px solid #ddd5c0"}}>Datos del ciclo</div>

        <div className="form-group">
          <label className="form-label">Nombre del ciclo *</label>
          <input className="form-input" value={formCiclo.nombre}
            onChange={e=>setFormCiclo(f=>({...f,nombre:e.target.value.toUpperCase()}))}
            placeholder="OI 2025-2026"/>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Fecha inicio</label>
            <input className="form-input" type="date" value={formCiclo.fechaInicio}
              onChange={e=>setFormCiclo(f=>({...f,fechaInicio:e.target.value}))}/>
          </div>
          <div className="form-group">
            <label className="form-label">Fecha fin</label>
            <input className="form-input" type="date" value={formCiclo.fechaFin}
              onChange={e=>setFormCiclo(f=>({...f,fechaFin:e.target.value}))}/>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notas</label>
          <textarea className="form-textarea" value={formCiclo.notas}
            onChange={e=>setFormCiclo(f=>({...f,notas:e.target.value}))}
            placeholder="Observaciones del ciclo…"/>
        </div>

        {/* Switch predeterminado */}
        <div onClick={()=>setFormCiclo(f=>({...f,predeterminado:!f.predeterminado}))}
          style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer",padding:"12px 14px",
            borderRadius:8,background:formCiclo.predeterminado?"#e8f4e1":"#f7f5f0",
            border:`1.5px solid ${formCiclo.predeterminado?"#2d5a1b":"#ddd5c0"}`,marginBottom:24}}>
          <div style={{width:42,height:24,borderRadius:12,background:formCiclo.predeterminado?"#2d5a1b":"#c0b9a8",
            position:"relative",transition:"background 0.2s",flexShrink:0}}>
            <div style={{position:"absolute",top:3,left:formCiclo.predeterminado?20:3,width:18,height:18,
              borderRadius:"50%",background:"white",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/>
          </div>
          <div>
            <div style={{fontWeight:600,fontSize:13,color:formCiclo.predeterminado?"#2d5a1b":"#3d3525"}}>
              {formCiclo.predeterminado?"✅ Será el ciclo predeterminado":"Establecer como ciclo predeterminado"}
            </div>
            <div style={{fontSize:11,color:"#8a8070",marginTop:2}}>El sistema mostrará datos de este ciclo en todos los módulos</div>
          </div>
        </div>

        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button className="btn btn-secondary" onClick={()=>setVista(selCiclo?"detalle":"lista")}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardarCiclo} disabled={!formCiclo.nombre.trim()}>
            💾 {modoForm==="nuevo"?"Crear ciclo":"Guardar cambios"}
          </button>
        </div>
      </div></div>
    </div>
  );

  // ────────────────────────────────────────────────────────────────────────────
  // VISTA: CULTIVOS Y VARIEDADES
  // ────────────────────────────────────────────────────────────────────────────
  if (vista==="cultivos") {
    const cicloSel2 = ciclos.find(c=>c.id===selCiclo);
    const cultivosCiclo = cicloSel2?.cultivosDelCiclo || [];

    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <button className="btn btn-secondary" onClick={()=>setVista("detalle")}>← Volver</button>
          <div style={{fontFamily:"Georgia, serif",fontSize:20,fontWeight:700,flex:1}}>
            🌽 Cultivos y Variedades — {cicloSel2?.nombre}
          </div>
        </div>

        {/* Cultivos asignados a este ciclo */}
        <div className="card" style={{marginBottom:16}}>
          <div className="card-header"><div className="card-title">Cultivos de este ciclo</div></div>
          <div className="card-body">
            {cultivosCiclo.length===0
              ? <div style={{color:"#8a8070",fontSize:13,textAlign:"center",padding:20}}>Sin cultivos asignados — agrega uno del catálogo</div>
              : <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                  {cultivosCiclo.map((c,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:10,background:"#f0f8e8",border:"2px solid #2d5a1b"}}>
                      <span style={{fontSize:18}}>🌾</span>
                      <div>
                        <div style={{fontWeight:700,fontSize:13,color:"#2d5a1b"}}>{c.cultivoNombre}</div>
                        <div style={{fontSize:11,color:"#5a7a3a"}}>Var. {c.variedad}</div>
                      </div>
                      {puedeEditar&&(
                        <button onClick={()=>quitarCultivoCiclo(c.cultivoId,c.variedad)}
                          style={{background:"none",border:"none",cursor:"pointer",color:"#c0392b",fontSize:16,lineHeight:1}}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>

        {/* Catálogo de cultivos */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          {/* Panel izquierdo: catálogo */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">📚 Catálogo de Cultivos</div>
              {puedeEditar&&(
                <div style={{display:"flex",gap:6}}>
                  <input className="form-input" value={nuevoCult} onChange={e=>setNuevoCult(e.target.value)}
                    placeholder="Nuevo cultivo..." style={{width:130,fontSize:12}}
                    onKeyDown={e=>e.key==="Enter"&&crearCultivoCat()}/>
                  <button className="btn btn-primary btn-sm" onClick={crearCultivoCat}>＋</button>
                </div>
              )}
            </div>
            <div className="card-body" style={{padding:0}}>
              {cultivosCat.map(cult=>(
                <div key={cult.id} style={{borderBottom:"1px solid #f0ece4"}}>
                  {/* Fila del cultivo */}
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",
                    background:cultivoFiltro===cult.id?"#f0f8e8":"white",cursor:"pointer"}}
                    onClick={()=>setCultivoFiltro(cultivoFiltro===cult.id?null:cult.id)}>
                    <span style={{fontSize:18}}>🌾</span>
                    <span style={{fontWeight:700,fontSize:13,flex:1}}>{cult.nombre}</span>
                    <span style={{fontSize:11,color:"#8a8070"}}>{cult.variedades.length} var.</span>
                    <span style={{fontSize:12,color:"#8a8070"}}>{cultivoFiltro===cult.id?"▲":"▼"}</span>
                  </div>
                  {/* Variedades expandidas */}
                  {cultivoFiltro===cult.id&&(
                    <div style={{padding:"8px 16px 12px",background:"#faf8f3"}}>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
                        {cult.variedades.map((v,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",
                            borderRadius:20,background:"white",border:"1px solid #ddd5c0",fontSize:12}}>
                            <span>{v}</span>
                            {puedeEditar&&(
                              <button onClick={()=>{
                                if(window.confirm(`¿Eliminar variedad "${v}"?`)){
                                  const nuevasVariedades = cult.variedades.filter((_,j)=>j!==i);
                                  dispatch({type:"UPD_CULTIVO_CAT",payload:{
                                    ...cult, variedades: nuevasVariedades
                                  }});
                                  patchCultivoCatalogo(cult.id, { variedades: nuevasVariedades });
                                }
                              }} style={{background:"none",border:"none",cursor:"pointer",color:"#c0392b",fontSize:12,lineHeight:1}}>✕</button>
                            )}
                          </div>
                        ))}
                      </div>
                      {puedeEditar&&(
                        <div style={{display:"flex",gap:6}}>
                          <input className="form-input" value={nuevaVar}
                            onChange={e=>setNuevaVar(e.target.value)}
                            placeholder="Nueva variedad..." style={{flex:1,fontSize:12}}
                            onKeyDown={e=>e.key==="Enter"&&agregarVariedadCat(cult.id)}/>
                          <button className="btn btn-secondary btn-sm" onClick={()=>agregarVariedadCat(cult.id)}>＋ Variedad</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Panel derecho: agregar al ciclo */}
          <div className="card">
            <div className="card-header"><div className="card-title">＋ Agregar al ciclo</div></div>
            <div className="card-body" style={{display:"flex",flexDirection:"column",gap:12}}>
              {cultivosCat.map(cult=>(
                <div key={cult.id} style={{padding:"10px 14px",borderRadius:8,border:"1px solid #e8e0d0",background:"#faf8f3"}}>
                  <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>🌾 {cult.nombre}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {cult.variedades.map((v,i)=>{
                      const yaEsta = cultivosCiclo.some(c=>c.cultivoId===cult.id&&c.variedad===v);
                      return (
                        <button key={i} onClick={()=>!yaEsta&&agregarCultivoCiclo(cult.id,cult.nombre,v)}
                          className={yaEsta?"btn btn-sm":"btn btn-sm btn-secondary"}
                          style={yaEsta?{background:"#d4edda",color:"#155724",border:"1px solid #c3e6cb",cursor:"default"}:{}}
                          disabled={yaEsta}>
                          {yaEsta?"✅ ":""}{v}
                        </button>
                      );
                    })}
                    {cult.variedades.length===0&&(
                      <span style={{fontSize:11,color:"#8a8070"}}>Sin variedades — agrégalas en el catálogo</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // VISTA: EDITAR PRODUCTORES
  // ────────────────────────────────────────────────────────────────────────────
  if (vista==="editProds") {
    const cicloSel2b      = ciclos.find(c=>c.id===selCiclo);
    const cultivosCicloAct2 = cicloSel2b?.cultivosDelCiclo||[];
    const prodsFiltrados = productores.filter(p=>{
      const q = busqProd.toLowerCase();
      return !q || nomProd(p).toLowerCase().includes(q) || (p.rfc||"").toLowerCase().includes(q);
    });
    const todosSelec = prodsFiltrados.every(p=>prodsSel.includes(p.id));
    const toggleTodos = () => {
      if (todosSelec) setProdsSel(prev=>prev.filter(id=>!prodsFiltrados.find(p=>p.id===id)));
      else setProdsSel(prev=>[...new Set([...prev, ...prodsFiltrados.map(p=>p.id)])]);
    };

    return (
      <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 120px)"}}>
        {/* Header fijo */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexShrink:0}}>
          <button className="btn btn-secondary" onClick={()=>setVista("detalle")}>← Volver</button>
          <div style={{fontFamily:"Georgia, serif",fontSize:20,fontWeight:700,flex:1}}>
            Productores — {cicloSel?.nombre}
          </div>
          <div style={{fontSize:13,color:"#8a8070"}}>{prodsSel.length} seleccionados</div>
        </div>

        <div className="card" style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
          {/* Barra de herramientas */}
          <div style={{padding:"12px 16px",borderBottom:"1px solid #ddd5c0",flexShrink:0}}>
            <input className="form-input" value={busqProd}
              onChange={e=>setBusqProd(e.target.value)}
              placeholder="🔍  Buscar productor por nombre o RFC…"
              style={{fontSize:13,marginBottom:8}}/>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-sm btn-secondary" onClick={toggleTodos}>
                {todosSelec?"☐ Desmarcar todos":"☑ Seleccionar todos"}
              </button>
              <span style={{fontSize:12,color:"#8a8070",alignSelf:"center"}}>
                {prodsFiltrados.length} productores visibles
              </span>
            </div>
          </div>

          {/* Lista con scroll */}
          <div style={{overflowY:"auto",flex:1,padding:"8px 16px"}}>
            {prodsFiltrados.length===0 ? (
              <div style={{padding:"20px 0",textAlign:"center",color:"#8a8070",fontSize:13}}>Sin resultados</div>
            ) : prodsFiltrados.map(p=>{
              const marcado = prodsSel.includes(p.id);
              const multCult = cultivosCicloAct2.length > 1;
              // Cultivos asignados a este productor (guardados en prodsCultivos)
              const cultsProd = prodsCultivos[p.id] || [];
              return (
                <div key={p.id} style={{borderRadius:8,marginTop:6,border:`1.5px solid ${marcado?"#2d5a1b":"#ddd5c0"}`,background:marcado?"#f0faf0":"#f7f5f0",overflow:"hidden"}}>
                  <div onClick={()=>setProdsSel(prev=>marcado?prev.filter(x=>x!==p.id):[...prev,p.id])}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"11px 12px",cursor:"pointer"}}>
                    <div style={{width:14,height:14,borderRadius:"50%",background:p.color||"#8a8070",flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:13,color:marcado?"#2d5a1b":"#3d3525"}}>{nomProd(p)}</div>
                      <div style={{fontSize:10,color:"#8a8070"}}>{p.tipo==="moral"?"Persona Moral":"RESICO"} · {p.rfc||"Sin RFC"}</div>
                    </div>
                    <div style={{width:22,height:22,borderRadius:4,border:`2px solid ${marcado?"#2d5a1b":"#c0b9a8"}`,
                      background:marcado?"#2d5a1b":"white",display:"flex",alignItems:"center",
                      justifyContent:"center",color:"white",fontSize:14,flexShrink:0}}>
                      {marcado?"✓":""}
                    </div>
                  </div>
                  {/* Selector de cultivos si hay más de uno y el productor está seleccionado */}
                  {marcado && multCult && (
                    <div style={{padding:"6px 12px 10px",borderTop:"1px dashed #c8e0c8",background:"rgba(45,90,27,0.03)"}}>
                      <div style={{fontSize:10,color:"#5a7a3a",fontWeight:600,marginBottom:6}}>¿Para qué cultivo(s)?</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {cultivosCicloAct2.map((cv,i)=>{
                          const activo = cultsProd.some(c=>c.cultivoId===cv.cultivoId&&c.variedad===cv.variedad);
                          return (
                            <button key={i} onClick={e=>{e.stopPropagation();
                              setProdsCultivos(prev=>({...prev,[p.id]:activo
                                ? (prev[p.id]||[]).filter(c=>!(c.cultivoId===cv.cultivoId&&c.variedad===cv.variedad))
                                : [...(prev[p.id]||[]),{cultivoId:cv.cultivoId,cultivoNombre:cv.cultivoNombre,variedad:cv.variedad}]
                              }));
                            }}
                            style={{fontSize:11,padding:"4px 10px",borderRadius:20,cursor:"pointer",fontWeight:activo?700:400,
                              border:`1.5px solid ${activo?"#2d5a1b":"#b0c0b0"}`,
                              background:activo?"#d4edda":"white",color:activo?"#155724":"#3d3525"}}>
                              {activo?"✅ ":""}{cv.cultivoNombre} — {cv.variedad}
                            </button>
                          );
                        })}
                        <button onClick={e=>{e.stopPropagation();
                          setProdsCultivos(prev=>({...prev,[p.id]:cultivosCicloAct2}));
                        }} style={{fontSize:11,padding:"4px 10px",borderRadius:20,cursor:"pointer",
                          border:"1.5px solid #1565C0",background:"#e3f2fd",color:"#1565C0"}}>
                          Todos
                        </button>
                      </div>
                      {cultsProd.length===0&&<div style={{fontSize:10,color:"#c0392b",marginTop:4}}>⚠️ Selecciona al menos un cultivo</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer fijo */}
          <div style={{padding:"12px 16px",borderTop:"1px solid #ddd5c0",flexShrink:0,display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button className="btn btn-secondary" onClick={()=>setVista("detalle")}>Cancelar</button>
            <button className="btn btn-primary" onClick={()=>guardarProductores(prodsCultivos)}>
              💾 Guardar productores ({prodsSel.length})
            </button>
          </div>
        </div>
      </div>
    );
  }


  // ────────────────────────────────────────────────────────────────────────────
  // VISTA: ASIGNAR LOTES — flujo por productor
  // ────────────────────────────────────────────────────────────────────────────
  if (vista==="editLotes") {
    const cicloEditando      = ciclos.find(c=>c.id===selCiclo);
    const cultivosDelCicloEdit = cicloEditando?.cultivosDelCiclo || [];
    const prodsDelCiclo = [
      { id: null, alias:"📌 Sin productor asignado", color:"#8a8070", apPat:"", apMat:"", nombres:"Sin productor asignado", tipo:"" },
      ...productores.filter(p=>(cicloSel?.productores||[]).includes(p.id))
    ];

    // Productor actualmente en foco (null = sin prod, undefined = ninguno seleccionado)
    const prodActivo = prodFiltroLotes === "__todos__" ? undefined : prodFiltroLotes;
    const prodObj    = prodsDelCiclo.find(p=>String(p.id)===String(prodActivo));

    // Lotes filtrados por búsqueda
    const lotesFiltrados = lotes.filter(l=>{
      const q = busqLotes.toLowerCase();
      return !q || [l.apodo,l.lote,l.propietario,l.ejido,l.folioCorto]
        .some(v=>v&&String(v).toLowerCase().includes(q));
    });

    // Sup usada en OTROS ciclos (no el que estamos editando)
    const supUsadaEnOtrosCiclos = (loteId) => {
      return ciclos
        .filter(c=>c.id!==selCiclo)
        .flatMap(c=>c.asignaciones||[])
        .filter(a=>a.loteId===loteId)
        .reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
    };

    // Sup disponible de un lote: descuenta asignaciones en TODOS los ciclos
    const supDispParaProd = (loteId) => {
      const lote       = lotes.find(l=>l.id===loteId);
      const total      = parseFloat(lote?.supCredito)||0;
      const enOtros    = supUsadaEnOtrosCiclos(loteId);
      const enEsteCiclo = asignaciones
        .filter(a => a.loteId===loteId && String(a.productorId)!==String(prodActivo))
        .reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
      return Math.max(0, total - enOtros - enEsteCiclo);
    };

    // Indica si un lote está completamente ocupado en otros ciclos
    const loteOcupado = (loteId) => {
      const lote    = lotes.find(l=>l.id===loteId);
      const total   = parseFloat(lote?.supCredito)||0;
      const enOtros = supUsadaEnOtrosCiclos(loteId);
      // Ocupado si enOtros cubre todo el total, o si no queda superficie libre
      return enOtros >= total && total > 0;
    };
    const haDispo = (loteId) => {
      const lote    = lotes.find(l=>l.id===loteId);
      const total   = parseFloat(lote?.supCredito)||0;
      const enOtros = supUsadaEnOtrosCiclos(loteId);
      return Math.max(0, total - enOtros);
    };

    const asigDeEsteProd = asignaciones.filter(a=>String(a.productorId)===String(prodActivo));
    const totalHaProd    = (asigDeEsteProd||[]).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
    const totalHaAsig    = (asignaciones||[]).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);

    const toggleLote = (loteId) => {
      const idx = asignaciones.findIndex(a=>a.loteId===loteId && String(a.productorId)===String(prodActivo));
      if (idx>=0) {
        setAsign(prev=>prev.filter((_,i)=>i!==idx));
      } else {
        const disp = supDispParaProd(loteId);
        if (disp>0) setAsign(prev=>[...prev,{ loteId, productorId: prodActivo===undefined?null:prodActivo, supAsignada: disp }]);
      }
    };

    const actualizarSupProd = (loteId, val) => {
      const lote = lotes.find(l=>l.id===loteId);
      const disp = supDispParaProd(loteId);
      const actual = asignaciones.find(a=>a.loteId===loteId && String(a.productorId)===String(prodActivo));
      const maxVal = disp + (parseFloat(actual?.supAsignada)||0);
      const v = Math.round(Math.min(Math.max(0.01, parseFloat(val)||0), maxVal) * 100) / 100;
      setAsign(prev=>prev.map(a=>(a.loteId===loteId && String(a.productorId)===String(prodActivo)) ? {...a,supAsignada:v} : a));
    };

    const fmt2loc = n => (parseFloat(n)||0).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2});

    return (
      <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 120px)"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexShrink:0,flexWrap:"wrap"}}>
          <button className="btn btn-secondary" onClick={()=>setVista("detalle")}>← Volver</button>
          <div style={{fontFamily:"Georgia, serif",fontSize:20,fontWeight:700,flex:1}}>
            Predios — {cicloSel?.nombre}
          </div>
          <div style={{fontSize:13,color:"#2d5a1b",fontFamily:"monospace",fontWeight:700}}>{fmt2loc(totalHaAsig)} ha total</div>
        </div>

        {/* Aviso si no hay superficie disponible */}
        {(()=>{
          const totalDisp = (lotesFiltrados||[]).reduce((s,l)=>{
            const enOtros = ciclos.filter(c=>c.id!==selCiclo).flatMap(c=>c.asignaciones||[]).filter(a=>a.loteId===l.id).reduce((ss,a)=>ss+(parseFloat(a.supAsignada)||0),0);
            return s + Math.max(0,(parseFloat(l.supCredito)||0)-enOtros);
          },0);
          return totalDisp===0 ? (
            <div style={{padding:"10px 14px",background:"#fff0f0",border:"1px solid #f5c6cb",borderRadius:8,marginBottom:12,fontSize:12,color:"#c0392b",fontWeight:600}}>
              🔴 Todos los lotes registrados están en uso en otros ciclos activos. Para asignar lotes a este ciclo, primero registra la cosecha de los ciclos existentes o agrega nuevos lotes.
            </div>
          ) : null;
        })()}

        <div style={{display:"flex",gap:12,flex:1,minHeight:0}}>

          {/* ── Panel izquierdo: selector de productor ── */}
          <div style={{width:220,flexShrink:0,display:"flex",flexDirection:"column",gap:6}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"#8a8070",marginBottom:2}}>Seleccionar productor</div>
            <div style={{overflowY:"auto",flex:1}}>
              {prodsDelCiclo.map(p=>{
                const isActivo = String(p.id)===String(prodActivo);
                const hasProd  = asignaciones.filter(a=>String(a.productorId)===String(p.id)).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
                return (
                  <div key={String(p.id)} onClick={()=>setProdFiltroLotes(String(p.id))}
                    style={{padding:"10px 12px",borderRadius:8,cursor:"pointer",marginBottom:6,
                      border:`1.5px solid ${isActivo?"#2d5a1b":"#ddd5c0"}`,
                      background:isActivo?"#e8f4e1":"white",transition:"all 0.12s"}}>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <div style={{width:10,height:10,borderRadius:"50%",background:p.color,flexShrink:0}}/>
                      <div style={{fontWeight:isActivo?700:500,fontSize:12,color:isActivo?"#2d5a1b":"#3d3525",lineHeight:1.3}}>
                        {p.alias || [p.apPat,p.nombres].filter(Boolean).join(" ")}
                      </div>
                    </div>
                    {hasProd>0 && (
                      <div style={{fontFamily:"monospace",fontSize:11,color:"#2d5a1b",fontWeight:700,marginTop:4,paddingLeft:17}}>
                        {fmt2loc(hasProd)} ha
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Panel derecho: lotes del productor seleccionado ── */}
          <div className="card" style={{flex:1,display:"flex",flexDirection:"column",minHeight:0,margin:0}}>
            {prodActivo===undefined ? (
              <div className="empty-state">
                <div className="empty-icon">👈</div>
                <div className="empty-title">Selecciona un productor</div>
                <div className="empty-sub">Elige del panel izquierdo para asignarle predios</div>
              </div>
            ) : (
              <>
                {/* Header del panel */}
                <div style={{padding:"12px 16px",borderBottom:"1px solid #ddd5c0",flexShrink:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <div style={{width:12,height:12,borderRadius:"50%",background:prodObj?.color||"#8a8070",flexShrink:0}}/>
                    <div style={{fontWeight:700,fontSize:14,color:"#3d3525"}}>
                      {prodObj?.alias || [prodObj?.apPat,prodObj?.nombres].filter(Boolean).join(" ") || "Sin productor"}
                    </div>
                    <div style={{marginLeft:"auto",fontFamily:"monospace",fontSize:13,fontWeight:700,color:"#2d5a1b"}}>
                      {fmt2loc(totalHaProd)} ha asignadas
                    </div>
                  </div>
                  <input className="form-input" value={busqLotes}
                    onChange={e=>setBusqLotes(e.target.value)}
                    placeholder="🔍  Folio corto, apodo, lote, propietario…"
                    style={{fontSize:12}}/>
                  <div style={{fontSize:11,color:"#8a8070",marginTop:5}}>
                    {lotesFiltrados.length} predios · {asigDeEsteProd.length} asignados a este productor
                  </div>
                </div>

                {/* Lista de lotes con scroll */}
                <div style={{overflowY:"auto",flex:1,padding:"8px 12px"}}>
                  {lotesFiltrados.map(l=>{
                    const asigProd = asignaciones.find(a=>a.loteId===l.id && String(a.productorId)===String(prodActivo));
                    const marcado  = !!asigProd;
                    const supTotal = parseFloat(l.supCredito)||0;
                    const enOtros  = supUsadaEnOtrosCiclos(l.id);
                    const dispReal = Math.max(0, supTotal - enOtros);
                    const disp     = marcado ? Math.max(0, dispReal) : dispReal;
                    const pct      = supTotal>0 ? Math.min(100,(enOtros/supTotal)*100) : 0;
                    const noDisp   = dispReal<=0 && !marcado;

                    return (
                      <div key={l.id} style={{
                        borderRadius:8,border:`1.5px solid ${marcado?"#2d5a1b":noDisp?"#e0d8cc":"#ddd5c0"}`,
                        background:marcado?"#f0faf0":noDisp?"#f5f4f0":"white",
                        marginBottom:8,overflow:"hidden",opacity:noDisp?0.6:1,
                        transition:"all 0.12s"}}>
                        {/* Fila principal — click para toggle */}
                        <div onClick={()=>!noDisp&&toggleLote(l.id)}
                          style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
                            cursor:noDisp?"not-allowed":"pointer"}}>
                          {/* Checkbox visual */}
                          <div style={{width:20,height:20,borderRadius:4,flexShrink:0,
                            border:`2px solid ${marcado?"#2d5a1b":noDisp?"#c0b9a8":"#b0a890"}`,
                            background:marcado?"#2d5a1b":"white",
                            display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:13}}>
                            {marcado?"✓":""}
                          </div>
                          {/* Info lote */}
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:600,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              {l.folioCorto ? <span style={{fontFamily:"monospace",color:"#5a7a3a",marginRight:6}}>{l.folioCorto}</span> : ""}
                              {l.apodo}{l.lote?` · ${l.lote}`:""}
                            </div>
                            <div style={{fontSize:10,color:"#8a8070",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              {l.propietario||"—"} · {l.ejido||"—"} · Sup. Cred: <strong>{fmt2loc(supTotal)} ha</strong>
                            </div>
                          </div>
                          {/* Disponibilidad */}
                          <div style={{textAlign:"right",flexShrink:0}}>
                            {noDisp ? (
                              <div>
                                <div style={{fontSize:10,fontWeight:700,color:"#c0392b"}}>🔴 En uso</div>
                                <div style={{fontSize:9,color:"#8a8070",marginTop:2}}>
                                  {fmt2loc(enOtros)} ha en otros ciclos
                                </div>
                              </div>
                            ) : (
                              <>
                                <div style={{fontSize:10,fontWeight:600,color:disp<0.5?"#e67e22":"#2d5a1b"}}>
                                  {fmt2loc(disp)} ha disp
                                </div>
                                <div style={{width:70,height:4,borderRadius:2,background:"#e8e0d0",marginTop:3,overflow:"hidden"}}>
                                  <div style={{height:"100%",borderRadius:2,width:`${pct}%`,
                                    background:pct>=100?"#c0392b":pct>60?"#e67e22":"#2d5a1b",transition:"width 0.2s"}}/>
                                </div>
                                <div style={{fontSize:9,color:"#a09880",marginTop:1}}>de {fmt2loc(supTotal)} ha</div>
                              </>
                            )}
                          </div>
                        </div>
                        {/* Campo de superficie y cultivo si está marcado */}
                        {marcado && (
                          <div style={{borderTop:"1px dashed #c8e0c8",background:"rgba(45,90,27,0.03)"}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px 6px"}}>
                              <span style={{fontSize:11,color:"#8a8070"}}>Ha asignadas:</span>
                              <input type="number" step="0.01" min="0.01" max={supDispParaProd(l.id)+(parseFloat(asigProd.supAsignada)||0)}
                                value={parseFloat(asigProd.supAsignada||0).toFixed(2)}
                                onChange={e=>actualizarSupProd(l.id,e.target.value)}
                                style={{width:80,padding:"4px 8px",border:"1.5px solid #2d5a1b",borderRadius:6,
                                  fontFamily:"monospace",fontSize:13,fontWeight:700,color:"#2d5a1b"}}/>
                              <span style={{fontSize:10,color:"#8a8070"}}>máx: {fmt2loc(supDispParaProd(l.id)+(parseFloat(asigProd.supAsignada)||0))} ha</span>
                            </div>
                            {cultivosDelCicloEdit.length>1&&(()=>{
                              // Solo mostrar cultivos asignados a ESTE productor
                              const cicloAct = ciclos.find(c=>c.id===selCiclo);
                              const pcEntry  = (cicloAct?.productoresCultivos||[]).find(pc=>String(pc.productorId)===String(prodActivo));
                              const cultsProducer = pcEntry?.cultivos||[];
                              // Si el productor tiene cultivos asignados, filtrar; si no, mostrar todos
                              const opcionesCult = cultsProducer.length>0
                                ? cultivosDelCicloEdit.filter(cv=>cultsProducer.some(c=>c.cultivoId===cv.cultivoId&&c.variedad===cv.variedad))
                                : cultivosDelCicloEdit;
                              return opcionesCult.length>0 ? (
                                <div style={{padding:"0 12px 8px"}}>
                                  <div style={{fontSize:10,color:"#5a7a3a",fontWeight:600,marginBottom:4}}>Cultivo de este lote:</div>
                                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                                    {opcionesCult.map((cv,ci)=>{
                                      const selCV = asigProd.cultivoId===cv.cultivoId&&asigProd.variedad===cv.variedad;
                                      return (
                                        <button key={ci} onClick={()=>setAsign(prev=>prev.map(a=>
                                          (a.loteId===l.id&&String(a.productorId)===String(prodActivo))
                                            ? {...a,cultivoId:cv.cultivoId,cultivoNombre:cv.cultivoNombre,variedad:cv.variedad}
                                            : a
                                        ))}
                                        style={{fontSize:11,padding:"3px 10px",borderRadius:20,cursor:"pointer",
                                          border:`1.5px solid ${selCV?"#2d5a1b":"#b0c0b0"}`,
                                          background:selCV?"#d4edda":"white",color:selCV?"#155724":"#3d3525",fontWeight:selCV?700:400}}>
                                          {selCV?"✅ ":""}{cv.cultivoNombre} — {cv.variedad}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null;
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div style={{padding:"10px 16px",borderTop:"1px solid #ddd5c0",flexShrink:0,
                  display:"flex",gap:10,justifyContent:"flex-end",alignItems:"center"}}>
                  <span style={{fontSize:12,color:"#8a8070",flex:1}}>
                    Total general: <strong style={{color:"#2d5a1b",fontFamily:"monospace"}}>{fmt2loc(totalHaAsig)} ha</strong> asignadas en {asignaciones.length} registros
                  </span>
                  <button className="btn btn-secondary" onClick={()=>setVista("detalle")}>Cancelar</button>
                  <button className="btn btn-primary" onClick={guardarLotes}>
                    💾 Guardar ({asignaciones.length})
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }


  // ────────────────────────────────────────────────────────────────────────────
  // VISTA: DETALLE del ciclo
  // ────────────────────────────────────────────────────────────────────────────
  if (vista==="detalle" && selCiclo) {
    const c = ciclos.find(x=>x.id===selCiclo);
    if (!c) { setVista("lista"); return null; }

    // IDs de productores con asignaciones (comparación de tipo segura)
    const prodIds = [...new Set((c.asignaciones||[])
      .map(a=>a.productorId)
      .filter(v=>v!==null && v!==undefined && v!=="")
    )].map(id=>typeof id==="string"?parseInt(id)||id:id);

    // Ordenar alfabéticamente por nombre del productor
    prodIds.sort((a,b)=>{
      const pa = productores.find(x=>x.id===a);
      const pb = productores.find(x=>x.id===b);
      const na = pa ? (pa.alias||[pa.apPat,pa.nombres].filter(Boolean).join(" ")) : "";
      const nb = pb ? (pb.alias||[pb.apPat,pb.nombres].filter(Boolean).join(" ")) : "";
      return na.localeCompare(nb,"es");
    });

    const sinProd = (c.asignaciones||[]).filter(a=>a.productorId===null||a.productorId===undefined||a.productorId==="");
    const totalHa = (c.asignaciones||[]).reduce((s,a)=>s+(a.supAsignada||0),0);

    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
          <button className="btn btn-secondary" onClick={()=>setVista("lista")}>← Volver</button>
          <div style={{fontFamily:"Georgia, serif",fontSize:20,fontWeight:700,flex:1}}>
            {c.nombre}
            {c.predeterminado&&<span style={{marginLeft:10,background:"#e8f4e1",color:"#2d5a1b",fontSize:11,fontWeight:700,padding:"2px 10px",borderRadius:20,border:"1px solid #2d5a1b"}}>✅ Predeterminado</span>}
          </div>
        </div>

        {/* Stats */}
        <div className="stat-grid" style={{gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",marginBottom:20}}>
          <div className="stat-card green"><div className="stat-icon">📅</div><div className="stat-label">Ciclo</div><div className="stat-value" style={{fontSize:15}}>{c.nombre}</div><div className="stat-sub">{c.fechaInicio||"—"} → {c.fechaFin||"—"}</div></div>
          <div className="stat-card sky"><div className="stat-icon">👥</div><div className="stat-label">Productores</div><div className="stat-value">{(c.productores||[]).length}</div><div className="stat-sub">En este ciclo</div></div>
          <div className="stat-card gold"><div className="stat-icon">🌾</div><div className="stat-label">Ha Asignadas</div><div className="stat-value">{fmt2(totalHa)}</div><div className="stat-sub">{(c.asignaciones||[]).length} asignaciones</div></div>
          <div className="stat-card rust"><div className="stat-icon">📋</div><div className="stat-label">Predios</div><div className="stat-value">{[...new Set((c.asignaciones||[]).map(a=>a.loteId))].length}</div><div className="stat-sub">Lotes con asignación</div></div>
          <div className="stat-card sky" style={{borderLeft:"4px solid #1565C0",gridColumn:"span 4"}} onClick={()=>{setCultivosSel(c.cultivosDelCiclo||[]);setVistaEditCultivos(true);}} >
            <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
              <div style={{fontSize:22}}>🌽</div>
              <div>
                <div style={{fontSize:11,color:"#5a6a5a",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Cultivos del ciclo</div>
                {(c.cultivosDelCiclo||[]).length===0
                  ? <div style={{fontSize:13,color:"#e67e22",fontWeight:600}}>⚠️ Sin cultivos definidos — haz clic para agregar</div>
                  : <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:4}}>
                      {(c.cultivosDelCiclo||[]).map((cv,i)=>(
                        <span key={i} style={{background:"#dbeafe",color:"#1565C0",fontSize:12,fontWeight:600,padding:"3px 12px",borderRadius:20,border:"1px solid #93c5fd"}}>
                          🌽 {cv.cultivoNombre} — {cv.variedad}
                        </span>
                      ))}
                    </div>
                }
              </div>
              <div style={{marginLeft:"auto",fontSize:11,color:"#8a8070"}}>✏️ Editar cultivos</div>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20}}>
          <button className="btn btn-secondary" onClick={()=>{ setFormCiclo({nombre:c.nombre,fechaInicio:c.fechaInicio||"",fechaFin:c.fechaFin||"",notas:c.notas||"",predeterminado:c.predeterminado||false}); setModoForm("editar"); setVista("form"); }}>✏️ Editar datos</button>
          <button className="btn btn-primary" style={{background:"#1565C0"}} onClick={()=>abrirCultivos(c)}>🌽 Cultivos y Variedades</button>
          <button className="btn btn-secondary" onClick={()=>abrirProductores(c)}>👥 Productores del ciclo</button>
          <button className="btn btn-primary"   onClick={()=>abrirLotes(c)}>🌾 Asignar predios</button>
          {!c.predeterminado && <button className="btn btn-secondary" onClick={()=>setPredeterminado(c.id)}>⭐ Hacer predeterminado</button>}
          {userRol==="admin" && <button className="btn btn-danger" onClick={()=>{if(window.confirm("¿Eliminar este ciclo?"))eliminarCiclo(c.id);}}>🗑 Eliminar</button>}
        </div>


        {/* Sin productor — PRIMERO */}
        {sinProd.length>0 && (
          <div className="card" style={{marginBottom:12}}>
            <div className="card-header">
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:12,height:12,borderRadius:"50%",background:"#8a8070"}}/>
                <div className="card-title">📌 Sin productor asignado</div>
              </div>
              <div style={{fontFamily:"monospace",fontWeight:700,color:"#8a8070",fontSize:14}}>{fmt2((sinProd||[]).reduce((s,a)=>s+(a.supAsignada||0),0))} ha</div>
            </div>
            <div className="table-wrap-scroll"><table style={{minWidth:500}}>
              <thead><tr><th>Folio</th><th>Apodo / Lote</th><th>Propietario</th><th>Ejido</th><th style={{textAlign:"right"}}>Sup. Crédito</th><th style={{textAlign:"right"}}>Ha Asignadas</th></tr></thead>
              <tbody>{sinProd.map((a,i)=>{
                const l=lotes.find(x=>x.id===a.loteId);
                const bg=i%2===0?"white":"#faf8f3";
                return(<tr key={i}>
                  <td style={{background:bg,fontFamily:"monospace",fontSize:11,color:"#5a7a3a"}}>{l?.folioCorto||"—"}</td>
                  <td style={{background:bg,fontWeight:600}}>{l?.apodo||"—"}{l?.lote?` · ${l.lote}`:""}</td>
                  <td style={{background:bg,fontSize:11}}>{l?.propietario||"—"}</td>
                  <td style={{background:bg,fontSize:11}}>{l?.ejido||"—"}</td>
                  <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{fmt2(l?.supCredito)}</td>
                  <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#8a8070",fontSize:12}}>{fmt2(a.supAsignada)}</td>
                </tr>);
              })}</tbody>
            </table></div>
          </div>
        )}

        {/* Tablas por productor — orden alfabético */}
        {prodIds.map(pid=>{
          const p = productores.find(x=>x.id===pid || x.id===parseInt(pid));
          const asigs = (c.asignaciones||[]).filter(a=>String(a.productorId)===String(pid));
          const totalProd = (asigs||[]).reduce((s,a)=>s+(a.supAsignada||0),0);
          return (
            <div key={String(pid)} className="card" style={{marginBottom:12}}>
              <div className="card-header">
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:12,height:12,borderRadius:"50%",background:p?.color||"#8a8070"}}/>
                  <div className="card-title">{p ? nomProd(p) : `Productor #${pid}`}</div>
                </div>
                <div style={{fontFamily:"monospace",fontWeight:700,color:"#2d5a1b",fontSize:14}}>{fmt2(totalProd)} ha</div>
              </div>
              <div className="table-wrap-scroll">
                <table style={{minWidth:500}}>
                  <thead><tr>
                    <th>Folio</th><th>Apodo / Lote</th><th>Propietario</th><th>Ejido</th>
                    <th style={{textAlign:"right"}}>Sup. Crédito</th><th style={{textAlign:"right"}}>Ha Asignadas</th>
                  </tr></thead>
                  <tbody>{asigs.map((a,i)=>{
                    const l=lotes.find(x=>x.id===a.loteId);
                    const bg=i%2===0?"white":"#faf8f3";
                    return(<tr key={i}>
                      <td style={{background:bg,fontFamily:"monospace",fontSize:11,color:"#5a7a3a"}}>{l?.folioCorto||"—"}</td>
                      <td style={{background:bg,fontWeight:600}}>{l?.apodo||"—"}{l?.lote?` · ${l.lote}`:""}</td>
                      <td style={{background:bg,fontSize:11}}>{l?.propietario||"—"}</td>
                      <td style={{background:bg,fontSize:11}}>{l?.ejido||"—"}</td>
                      <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{fmt2(l?.supCredito)}</td>
                      <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#2d5a1b",fontSize:12}}>{fmt2(a.supAsignada)}</td>
                    </tr>);
                  })}</tbody>
                </table>
              </div>
            </div>
          );
        })}
        {(c.asignaciones||[]).length===0 && (c.productores||[]).length===0 && (
          <div className="empty-state"><div className="empty-icon">🌾</div><div className="empty-title">Ciclo recién creado</div><div className="empty-sub">Usa los botones de arriba para agregar productores y asignar predios</div></div>
        )}
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // VISTA: LISTA DE CICLOS
  // ────────────────────────────────────────────────────────────────────────────
  const cicloActual = ciclos.find(c=>c.id===state.cicloActivoId)||ciclos.find(c=>c.id===state.cicloActivoId)||ciclos.find(c=>c.predeterminado)||ciclos[0];
  const totalHaActual = cicloActual ? (cicloActual.asignaciones||[]).reduce((s,a)=>s+(a.supAsignada||0),0) : 0;

  return (
    <div>
      <div className="stat-grid" style={{gridTemplateColumns:"repeat(4,1fr)",marginBottom:20}}>
        <div className="stat-card green"><div className="stat-icon">📅</div><div className="stat-label">Ciclo predeterminado</div><div className="stat-value" style={{fontSize:15}}>{cicloActual?.nombre||"Sin ciclo"}</div><div className="stat-sub">{cicloActual?"✅ Activo":"—"}</div></div>
        <div className="stat-card sky"><div className="stat-icon">👥</div><div className="stat-label">Productores</div><div className="stat-value">{cicloActual?[...new Set((cicloActual.asignaciones||[]).map(a=>a.productorId).filter(Boolean))].length:0}</div><div className="stat-sub">Con predios asignados</div></div>
        <div className="stat-card gold"><div className="stat-icon">🌾</div><div className="stat-label">Ha del ciclo</div><div className="stat-value">{fmt2(totalHaActual)}</div><div className="stat-sub">Superficie asignada</div></div>
        <div className="stat-card rust"><div className="stat-icon">🗂</div><div className="stat-label">Total ciclos</div><div className="stat-value">{ciclos.length}</div><div className="stat-sub">Registrados</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Ciclos Agrícolas</div>
          <button className="btn btn-primary btn-sm" onClick={abrirNuevo}>＋ Nuevo ciclo</button>
        </div>
        {ciclos.length===0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <div className="empty-title">Sin ciclos registrados</div>
            <div className="empty-sub">Crea el primer ciclo para empezar</div>
            <button className="btn btn-primary" onClick={abrirNuevo}>＋ Crear primer ciclo</button>
          </div>
        ) : (
          <div style={{padding:"0 16px 16px"}}>
            {ciclos.map(c=>{
              const haTotal=(c.asignaciones||[]).reduce((s,a)=>s+(a.supAsignada||0),0);
              const nProd=[...new Set((c.asignaciones||[]).map(a=>a.productorId).filter(Boolean))].length;
              return (
                <div key={c.id} onClick={()=>{setSelCiclo(c.id);setVista("detalle");}}
                  style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderRadius:10,
                    border:`1.5px solid ${c.predeterminado?"#2d5a1b":"#ddd5c0"}`,
                    background:c.predeterminado?"#f0faf0":"white",marginTop:10,cursor:"pointer",transition:"all 0.15s"}}>
                  <div style={{fontSize:28}}>{c.predeterminado?"📅":"🗂"}</div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <div style={{fontFamily:"Georgia, serif",fontSize:16,fontWeight:700}}>{c.nombre}</div>
                      {c.predeterminado&&<span style={{background:"#e8f4e1",color:"#2d5a1b",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,border:"1px solid #2d5a1b"}}>✅ PREDETERMINADO</span>}
                    </div>
                    <div style={{fontSize:11,color:"#8a8070",marginTop:3}}>
                      {nProd} productores · {fmt2(haTotal)} ha · {(c.asignaciones||[]).length} asignaciones
                      {c.fechaInicio?` · ${c.fechaInicio}`:""}
                    </div>
                    {(c.cultivosDelCiclo||[]).length>0&&(
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
                        {(c.cultivosDelCiclo||[]).map((cv,i)=>(
                          <span key={i} style={{fontSize:10,padding:"1px 8px",borderRadius:10,background:"#dbeafe",color:"#1565C0",fontWeight:600}}>
                            🌽 {cv.cultivoNombre} — {cv.variedad}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div onClick={e=>e.stopPropagation()}>
                    {!c.predeterminado&&<button className="btn btn-sm btn-secondary" onClick={()=>setPredeterminado(c.id)}>⭐ Predeterminado</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
