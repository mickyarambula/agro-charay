// ─── modules/Insumos.jsx ───────────────────────────────────────────

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
import { useIsMobile } from '../components/mobile/useIsMobile.js';
import AIInsight from '../components/AIInsight.jsx';


export default function InsumosModule({ userRol, puedeEditar, onNavigate, navFiltro = {} }) {
  const { state, dispatch } = useData();
  const isMobile = useIsMobile();
  // ─── Visibilidad de precios: admin, socio y compras ven importes.
  //     encargado e ingeniero NO ven precios (solo nombres y cantidades).
  const verPrecios = userRol === "admin" || userRol === "compras";
  const nav = (page, pid, filtros) => onNavigate && onNavigate(page, pid, filtros);
  const hoy = new Date().toISOString().split("T")[0];
  const productores = state.productores || [];

  const [vista, setVista] = useState(navFiltro.vista || "resumen");
  const [cancelModal, setCancelModal]   = useState(null);
  const [recibirModal, setRecibirModal] = useState(null); // insumo a recibir
  const hoyIns = new Date().toISOString().split("T")[0];
  const emptyRecep = { cantidad:"", fecha:hoyIns, ubicacion:"Bodega", notas:"" };
  const [formRecep, setFormRecep]       = useState(emptyRecep);
  const [filtroCat,  setFiltroCat]  = useState(navFiltro.categoria || "todas");
  const [filtroProd, setFiltroProd] = useState(navFiltro.productor  || "todos");
  const [filtroConcepto, setFiltroConcepto] = useState(navFiltro.concepto || "");
  const [filtroProveedor, setFiltroProveedor] = useState(navFiltro.proveedor || "");
  const [importLog,  setImportLog]  = useState([]);
  const [importando, setImportando] = useState(false);
  const fileInputRef = useRef(null);

  const cicloFiltroId = state.cicloActivoId||1;
  const insumos = (state.insumos||[]).filter(i=>(i.cicloId||1)===cicloFiltroId);

  const emptyForm = {
    numSolicitud:"", numOrden:"", fechaSolicitud: hoy, fechaOrden: hoy,
    productorId:"", proveedor:"", categoria:"Semilla",
    insumo:"", cantidad:"", unidad:"BOLSA", precioUnitario:"", importe:"",
  };
  const [form, setForm] = useState(emptyForm);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const mxnFmt = n => (parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2});
  const nomProd = id => {
    if (!id) return "General";
    const p = productores.find(x=>x.id===parseInt(id)||x.id===id);
    return p ? (p.alias||p.apPat) : `Prod#${id}`;
  };

  const badgeEstatus = (ins) => {
    const est = ins.estatus||"pedido";
    const recib = parseFloat(ins.cantidadRecibida)||0;
    const pedido = parseFloat(ins.cantidad)||0;
    if (est==="recibido")  return <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:"#d4edda",color:"#155724",fontWeight:600}}>✅ Recibido</span>;
    if (est==="parcial")   return <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:"#fff3cd",color:"#856404",fontWeight:600}}>⏳ Parcial {recib}/{pedido}</span>;
    return <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:"#e2e3e5",color:"#383d41",fontWeight:600}}>📋 Pedido</span>;
  };

  const CAT_COLORS = {
    Semilla:"#c8a84b", Fertilizante:"#2d5a1b", Herbicida:"#b85c2c",
    Fungicida:"#1a6ea8", Insecticida:"#8e44ad", Foliar:"#27ae60",
    Adherente:"#7f8c8d", Otro:"#95a5a6"
  };
  const CAT_ICONS = {
    Semilla:"🌽", Fertilizante:"🌿", Herbicida:"🧴", Fungicida:"🔬",
    Insecticida:"🐛", Foliar:"🍃", Adherente:"💧", Otro:"📦"
  };

  // ── Filtrados ─────────────────────────────────────────────────────────────────
  const insumosFiltrados = insumos
    .filter(i => filtroCat==="todas" || i.categoria===filtroCat)
    .filter(i => filtroProd==="todos" || String(i.productorId)===String(filtroProd))
    .filter(i => !filtroConcepto || (i.insumo||"").toLowerCase().includes(filtroConcepto.toLowerCase()))
    .filter(i => !filtroProveedor || (i.proveedor||"").toLowerCase().includes(filtroProveedor.toLowerCase()));

  // ── Conceptos únicos por categoría ───────────────────────────────────────────
  const conceptosPorCat = {};
  CAT_INSUMO.forEach(c => {
    const nombres = [...new Set(
      insumos.filter(i=>i.categoria===c&&!i.cancelado).map(i=>(i.insumo||"").trim()).filter(Boolean)
    )].sort();
    if(nombres.length) conceptosPorCat[c] = nombres;
  });
  const conceptosDisponibles = filtroCat==="todas"
    ? [...new Set(insumos.filter(i=>!i.cancelado).map(i=>(i.insumo||"").trim()).filter(Boolean))].sort()
    : (conceptosPorCat[filtroCat] || []);

  // ── Agrupación por concepto ───────────────────────────────────────────────────
  const porConcepto = {};
  insumos.filter(i=>!i.cancelado)
    .filter(i=>filtroCat==="todas"||i.categoria===filtroCat)
    .forEach(i => {
      const key = (i.insumo||"Sin nombre").trim();
      if(!porConcepto[key]) porConcepto[key] = { total:0, cantidad:0, regs:0, cat:i.categoria, prods:new Set() };
      porConcepto[key].total += parseFloat(i.importe)||0;
      porConcepto[key].cantidad += parseFloat(i.cantidad)||0;
      porConcepto[key].regs++;
      porConcepto[key].prods.add(i.productorId);
    });
  const conceptosOrdenados = Object.entries(porConcepto)
    .sort((a,b)=>b[1].total-a[1].total)
    .map(([nombre,d])=>({nombre, ...d, prods:d.prods.size}));

  // ── Agrupación por proveedor ──────────────────────────────────────────────────
  const porProveedor = {};
  insumos.filter(i=>!i.cancelado&&(i.proveedor||"").trim()).forEach(i => {
    const key = (i.proveedor||"").trim();
    if(!porProveedor[key]) porProveedor[key] = { total:0, regs:0, cats:new Set(), conceptos:new Set(), prods:new Set(), detalles:{} };
    porProveedor[key].total += parseFloat(i.importe)||0;
    porProveedor[key].regs++;
    porProveedor[key].cats.add(i.categoria);
    porProveedor[key].conceptos.add((i.insumo||"").trim());
    porProveedor[key].prods.add(i.productorId);
    const cat = i.categoria;
    if(!porProveedor[key].detalles[cat]) porProveedor[key].detalles[cat]={total:0,regs:0};
    porProveedor[key].detalles[cat].total += parseFloat(i.importe)||0;
    porProveedor[key].detalles[cat].regs++;
  });
  const totalInsumosGlobal = Object.values(porProveedor).reduce((s,v)=>s+v.total,0);
  const proveedoresOrdenados = Object.entries(porProveedor)
    .sort((a,b)=>b[1].total-a[1].total)
    .map(([nombre,d])=>({
      nombre, total:d.total, regs:d.regs,
      cats:[...d.cats], conceptos:d.conceptos.size,
      prods:d.prods.size,
      detalles:d.detalles,
      pct: totalInsumosGlobal>0?(d.total/totalInsumosGlobal*100):0,
    }));
  // Opciones para FiltroSelect de proveedores
  const opcionesProveedores = proveedoresOrdenados.map(p=>({
    valor: p.nombre,
    label: p.nombre,
    sub: `${p.regs} ped · ${[...new Set(p.cats)].join(", ").slice(0,40)}`,
    monto: p.total,
    count: p.regs,
  }));
  // Opciones para FiltroSelect de conceptos
  const opcionesConceptos = conceptosOrdenados.map(c=>({
    valor: c.nombre,
    label: c.nombre,
    sub: `${CAT_ICONS[c.cat]||""} ${c.cat} · ${c.prods} prod · ${c.regs} reg`,
    monto: c.total,
    count: c.regs,
    color: CAT_COLORS[c.cat]||"#888",
  }));

  // ── Totales globales ──────────────────────────────────────────────────────────
  const [filtroCancelados, setFiltroCancelados] = useState("activos");
  const insumosFiltradosCancel = insumos.filter(i => filtroCancelados==="todos" ? true : filtroCancelados==="cancelados" ? i.cancelado : !i.cancelado);
  const totalGeneral = insumos.filter(i=>!i.cancelado).reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
  const porCategoria = {};
  CAT_INSUMO.forEach(c => {
    porCategoria[c] = insumos.filter(i=>i.categoria===c).reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
  });

  // ── Guardar nuevo insumo ──────────────────────────────────────────────────────
  const guardarInsumo = () => {
    const cantidad = parseFloat(form.cantidad)||0;
    const precio   = parseFloat(form.precioUnitario)||0;
    const importe  = parseFloat(form.importe)||(cantidad*precio);
    if (!form.insumo || !importe) return;
    dispatch({ type:"ADD_INSUMO", payload:{
      ...form, id: Date.now(),
      cantidad, precioUnitario: precio, importe,
      productorId: form.productorId ? parseInt(form.productorId)||form.productorId : null,
    }});
    setForm(emptyForm);
    setVista("tabla");
  };

  // ── Guardar recepción ────────────────────────────────────────────────────────
  const guardarRecepcion = () => {
    if (!formRecep.cantidad || !recibirModal) return;
    const cantRec = parseFloat(formRecep.cantidad)||0;
    // Buscar o crear producto en catálogo de inventario
    const invItems = state.inventario?.items||[];
    const nomInsumo = (recibirModal.insumo||"").trim().toUpperCase();
    let itemId = null;
    const existing = invItems.find(i=>(i.nombre||"").trim().toUpperCase()===nomInsumo);
    if (existing) {
      itemId = existing.id;
    } else {
      // Crear automáticamente en catálogo
      itemId = Date.now();
      dispatch({ type:"ADD_INV_ITEM", payload:{
        id: itemId,
        nombre:    recibirModal.insumo,
        categoria: recibirModal.categoria||"Otro",
        unidad:    recibirModal.unidad||"kg",
        ubicacion: formRecep.ubicacion||"Bodega",
        descripcion: `Creado automáticamente desde insumos`,
      }});
    }
    dispatch({ type:"RECIBIR_INSUMO", payload:{
      insumoId:  recibirModal.id,
      invItemId: itemId,
      cantidad:  cantRec,
      fecha:     formRecep.fecha,
      ubicacion: formRecep.ubicacion,
      notas:     formRecep.notas,
    }});
    setRecibirModal(null);
    setFormRecep(emptyRecep);
  };

  // ── Importar Excel ────────────────────────────────────────────────────────────
  const cargarXLSX = () => new Promise((resolve, reject) => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error("No se pudo cargar XLSX"));
    document.head.appendChild(script);
  });

  const importarExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportando(true);
    setImportLog(["⏳ Cargando..."]);
    try {
      const XLSX = await cargarXLSX();
      const ab   = await file.arrayBuffer();
      const wb   = XLSX.read(new Uint8Array(ab), { type:"array", cellDates:true });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval:"", raw:false });

      const logs = [];
      const catMapImp = {
        'SEMILLA DE MAIZ':'Semilla','FERTILIZANTES':'Fertilizante',
        'HERBICIDAS':'Herbicida','FUNGICIDAS':'Fungicida',
        'INSECTICIDAS':'Insecticida','FOLIARES':'Foliar','ADHERENTE':'Adherente',
      };
      const getCol = (row,...keys) => {
        for (const k of keys){
          if (row[k]!==undefined&&row[k]!=="") return String(row[k]).trim();
          const fnd=Object.keys(row).find(c=>c.toUpperCase().replace(/[^A-Z0-9]/g,"").includes(k.toUpperCase().replace(/[^A-Z0-9]/g,"")));
          if(fnd&&row[fnd]!=="") return String(row[fnd]).trim();
        }
        return "";
      };

      logs.push(`📋 Columnas: ${Object.keys(rows[0]||{}).join(" | ")}`);
      const nuevos = [];
      rows.forEach((row,i)=>{
        const insumoNom = getCol(row,"INSUMO","PRODUCTO","DESCRIPCION");
        if (!insumoNom) return;
        const catEx  = getCol(row,"CATEGORIA").toUpperCase();
        const cat    = catMapImp[catEx] || "Otro";
        const prodNom= getCol(row,"PRODUCTOR");
        const _pNom = prodNom.toUpperCase().trim();
        // 1. Coincidencia exacta del nombre completo
        let prodMatch = productores.find(p=>{
          const nom = `${p.apPat||""} ${p.apMat||""} ${p.nombres||""}`.toUpperCase().trim();
          return nom === _pNom;
        });
        // 2. Alias exacto
        if(!prodMatch) prodMatch = productores.find(p=>(p.alias||"").toUpperCase().trim()===_pNom);
        // 3. El nombre del Excel contiene el nombre completo del productor
        if(!prodMatch) prodMatch = productores.find(p=>{
          const nom = `${p.apPat||""} ${p.apMat||""} ${p.nombres||""}`.toUpperCase().trim();
          return nom.length > 5 && _pNom.includes(nom);
        });
        // 4. Coincidencia por apPat+apMat+primer nombre (evita falsos positivos entre hermanos)
        if(!prodMatch) prodMatch = productores.find(p=>{
          if(!p.apPat||!p.apMat) return false;
          const base = `${p.apPat} ${p.apMat}`.toUpperCase();
          const primerNom = (p.nombres||"").toUpperCase().split(" ")[0];
          return _pNom.includes(base) && primerNom.length>2 && _pNom.includes(primerNom);
        });
        // 5. Alias contenido en el nombre Excel (solo si alias es específico, no genérico)
        if(!prodMatch) prodMatch = productores.find(p=>{
          const alias = (p.alias||"").toUpperCase().trim();
          return alias.length > 4 && _pNom.includes(alias) && !["SANTA","GRUPO"].includes(alias);
        });
        const cantidad = parseFloat(getCol(row,"CANTIDAD").replace(/,/g,""))||0;
        const precio   = parseFloat(getCol(row,"PRECIO FINAL","PRECIO").replace(/[,$]/g,""))||0;
        const importe  = parseFloat(getCol(row,"IMPORTE","TOTAL").replace(/[,$]/g,""))||cantidad*precio;
        nuevos.push({
          id: Date.now()+i,
          numSolicitud: getCol(row,"# SOLICITUD","SOLICITUD"),
          numOrden:     getCol(row,"# ORDEN","ORDEN"),
          fechaSolicitud: getCol(row,"FECHA SOLICITUD","FECHA"),
          fechaOrden:   getCol(row,"FECHA ORDEN"),
          productorId:  prodMatch?.id||null,
          productorNombre: prodNom,
          proveedor:    getCol(row,"EMPRESA","PROVEEDOR"),
          categoria: cat, insumo: insumoNom,
          cantidad, unidad: getCol(row,"UNIDAD"), precioUnitario: precio, importe,
        });
      });
      dispatch({ type:"IMPORT_INSUMOS", payload: nuevos });
      const sinMatch = nuevos.filter(n=>!n.productorId).length;
      logs.push(`✅ ${nuevos.length} registros importados`);
      if (sinMatch>0) logs.push(`⚠️ ${sinMatch} sin productor identificado`);
      setImportLog(logs);
    } catch(err) {
      setImportLog([`❌ Error: ${err.message}`]);
    }
    setImportando(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // VISTA RESUMEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (vista==="resumen") return (
    <div>
      {/* Stat cards — clickeables para filtrar */}
      <AIInsight modulo="Insumos" contexto={{
        totalInsumos: state.insumos?.length || 0,
        categorias: [...new Set((state.insumos||[]).map(i => i.categoria).filter(Boolean))],
        totalDispersado: (state.dispersiones||[]).reduce((s,d) => s + (parseFloat(d.monto)||0), 0),
      }} />
      <div className="stat-grid" style={{gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",marginBottom:20}}>
        <div className="stat-card gold" style={{cursor:"pointer"}} onClick={()=>{setFiltroCat("todas");setVista("tabla");}} title="Ver todos">
          <div className="stat-icon">💰</div>
          <div className="stat-label">Total Insumos</div>
          <div className="stat-value" style={{fontSize:18}}>{mxnFmt(totalGeneral)}</div>
          <div className="stat-sub">{insumos.filter(i=>!i.cancelado).length} registros <span style={{fontSize:9,opacity:0.6}}>→ Ver tabla</span></div>
        </div>
        <div className="stat-card green" style={{cursor:"pointer"}} onClick={()=>{setFiltroCat("Semilla");setVista("tabla");}} title="Ver semilla">
          <div className="stat-icon">🌽</div>
          <div className="stat-label">Semilla</div>
          <div className="stat-value" style={{fontSize:18}}>{mxnFmt(porCategoria["Semilla"]||0)}</div>
          <div className="stat-sub">{insumos.filter(i=>i.categoria==="Semilla").length} registros <span style={{fontSize:9,opacity:0.6}}>→ Filtrar</span></div>
        </div>
        <div className="stat-card sky" style={{cursor:"pointer"}} onClick={()=>{setFiltroCat("Fertilizante");setVista("tabla");}} title="Ver fertilizante">
          <div className="stat-icon">🌿</div>
          <div className="stat-label">Fertilizante</div>
          <div className="stat-value" style={{fontSize:18}}>{mxnFmt(porCategoria["Fertilizante"]||0)}</div>
          <div className="stat-sub">{insumos.filter(i=>i.categoria==="Fertilizante").length} registros <span style={{fontSize:9,opacity:0.6}}>→ Filtrar</span></div>
        </div>
        <div className="stat-card rust" style={{cursor:"pointer"}} onClick={()=>{setFiltroCat("Herbicida");setVista("tabla");}} title="Ver agroquímicos">
          <div className="stat-icon">🧴</div>
          <div className="stat-label">Agroquímicos</div>
          <div className="stat-value" style={{fontSize:18}}>{mxnFmt((porCategoria["Herbicida"]||0)+(porCategoria["Fungicida"]||0)+(porCategoria["Insecticida"]||0)+(porCategoria["Foliar"]||0)+(porCategoria["Adherente"]||0))}</div>
          <div className="stat-sub">Herb+Fung+Insect+Foliar <span style={{fontSize:9,opacity:0.6}}>→ Filtrar</span></div>
        </div>
      </div>

      {/* Accesos */}
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <button className="btn btn-primary" onClick={()=>setVista("nuevo")}>＋ Registrar Insumo</button>
        <button className="btn btn-secondary" onClick={()=>setVista("import")}>📥 Importar Excel</button>
        <button className="btn btn-secondary" onClick={()=>{setFiltroCat("todas");setVista("tabla");}}>📋 Ver todos ({insumos.filter(i=>!i.cancelado).length})</button>
      </div>

      {/* Desglose por categoría — clickeable */}
      <div className="card" style={{marginBottom:16}}>
        <div className="card-header">
          <div className="card-title">Desglose por Categoría</div>
          <span style={{fontSize:11,color:"#8a8070"}}>clic para filtrar</span>
        </div>
        <div className="card-body">
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:10}}>
            {CAT_INSUMO.filter(c=>porCategoria[c]>0).map(c=>(
              <div key={c}
                onClick={()=>{setFiltroCat(c);setVista("tabla");}}
                style={{padding:"10px 14px",borderRadius:8,border:`2px solid ${CAT_COLORS[c]}33`,
                  background:`${CAT_COLORS[c]}10`,cursor:"pointer",transition:"all 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 4px 12px ${CAT_COLORS[c]}33`;}}
                onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";}}
                title={`Ver todos los ${c}`}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                  <span style={{fontSize:12,fontWeight:700,color:CAT_COLORS[c]}}>{CAT_ICONS[c]} {c}</span>
                  <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:"#c0392b"}}>{mxnFmt(porCategoria[c])}</span>
                </div>
                <div style={{height:4,borderRadius:2,background:"#e8e0d0"}}>
                  <div style={{height:"100%",borderRadius:2,background:CAT_COLORS[c],width:`${totalGeneral>0?Math.min(100,porCategoria[c]/totalGeneral*100):0}%`}}/>
                </div>
                <div style={{fontSize:10,color:"#8a8070",marginTop:3,display:"flex",justifyContent:"space-between"}}>
                  <span>{totalGeneral>0?Math.round(porCategoria[c]/totalGeneral*100):0}% · {insumos.filter(i=>i.categoria===c&&!i.cancelado).length} reg.</span>
                  <span style={{color:CAT_COLORS[c],opacity:0.7}}>→ ver</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Análisis por Concepto ── */}
      {conceptosOrdenados.length > 0 && (
        <div className="card" style={{marginBottom:16}}>
          <div className="card-header">
            <div className="card-title">
              📊 Por Concepto{filtroCat!=="todas" ? ` — ${filtroCat}` : ""}
            </div>
            <FiltroSelect
              valor={filtroConcepto}
              onChange={v=>{setFiltroConcepto(v); if(v) setVista("tabla");}}
              opciones={opcionesConceptos}
              placeholder="Buscar concepto..."
              width={220}
              mxnFmt={mxnFmt}
            />
          </div>
          <div className="card-body" style={{padding:0}}>
            {/* Mini gráfica de barras horizontales */}
            <div style={{padding:"12px 16px 8px",borderBottom:`1px solid ${T.line}`}}>
              {conceptosOrdenados
                .filter(c=>!filtroConcepto||c.nombre.toLowerCase().includes(filtroConcepto.toLowerCase()))
                .slice(0,10)
                .map((c,i)=>{
                  const pct = totalGeneral>0?Math.min(100,c.total/totalGeneral*100):0;
                  const color = CAT_COLORS[c.cat]||"#7f8c8d";
                  return (
                    <div key={c.nombre} style={{marginBottom:8,cursor:"pointer"}}
                      onClick={()=>{setFiltroConcepto(c.nombre);setVista("tabla");}}
                      onMouseEnter={e=>e.currentTarget.style.opacity="0.75"}
                      onMouseLeave={e=>e.currentTarget.style.opacity="1"}
                      title={`Ver registros de ${c.nombre}`}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,alignItems:"baseline"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}>
                          <span style={{width:8,height:8,borderRadius:"50%",background:color,display:"inline-block",flexShrink:0}}/>
                          <span style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200}}>{c.nombre}</span>
                          <span style={{fontSize:10,color:T.fog,flexShrink:0}}>{CAT_ICONS[c.cat]||""} {c.cat}</span>
                        </div>
                        <div style={{display:"flex",gap:12,alignItems:"baseline",flexShrink:0}}>
                          <span style={{fontSize:10,color:T.fog}}>{c.prods} prod · {c.regs} reg</span>
                          <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:"#c0392b"}}>{mxnFmt(c.total)}</span>
                          <span style={{fontSize:10,color:T.fog,minWidth:32,textAlign:"right"}}>{pct.toFixed(1)}%</span>
                          <span style={{fontSize:10,color:color,opacity:0.7}}>→</span>
                        </div>
                      </div>
                      <div style={{height:6,borderRadius:3,background:"#eee",overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:3,background:color,width:`${pct}%`,transition:"width 0.4s ease"}}/>
                      </div>
                    </div>
                  );
                })}
              {conceptosOrdenados.filter(c=>!filtroConcepto||c.nombre.toLowerCase().includes(filtroConcepto.toLowerCase())).length > 10 && (
                <div style={{fontSize:11,color:T.fog,textAlign:"center",paddingTop:6,cursor:"pointer"}}
                  onClick={()=>{setVista("tabla");}}>
                  +{conceptosOrdenados.filter(c=>!filtroConcepto||c.nombre.toLowerCase().includes(filtroConcepto.toLowerCase())).length-10} conceptos más → Ver todos
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Proveedores */}
      {proveedoresOrdenados.length > 0 && (
        <div className="card" style={{marginBottom:16}}>
          <div className="card-header">
            <div className="card-title">🏢 Por Proveedor</div>
            <FiltroSelect
              valor={filtroProveedor}
              onChange={v=>{setFiltroProveedor(v); if(v) setVista("tabla");}}
              opciones={opcionesProveedores}
              placeholder="Filtrar proveedor..."
              width={230}
              mxnFmt={mxnFmt}
            />
          </div>
          <div className="card-body" style={{padding:"12px 16px"}}>
            {proveedoresOrdenados.slice(0,8).map((p,i)=>{
              const col = ["#2d5a1b","#1a6ea8","#c8a84b","#c0392b","#8e44ad","#e67e22","#27ae60","#7f8c8d"][i%8];
              return (
                <div key={p.nombre} style={{marginBottom:10,cursor:"pointer"}}
                  onClick={()=>{setFiltroProveedor(p.nombre);setVista("tabla");}}
                  onMouseEnter={e=>e.currentTarget.style.opacity="0.75"}
                  onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:3}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:col,flexShrink:0}}/>
                      <span style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:220}}>{p.nombre}</span>
                    </div>
                    <div style={{display:"flex",gap:10,alignItems:"baseline",flexShrink:0}}>
                      <span style={{fontSize:10,color:T.fog}}>{p.regs} ped</span>
                      <span style={{fontSize:10,color:T.fog}}>{p.pct.toFixed(1)}%</span>
                      <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:"#c0392b"}}>{mxnFmt(p.total)}</span>
                      <span style={{fontSize:10,color:col,opacity:0.7}}>→</span>
                    </div>
                  </div>
                  <div style={{height:5,borderRadius:3,background:"#eee",overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:3,background:col,width:`${Math.min(100,p.pct*2)}%`,transition:"width 0.4s"}}/>
                  </div>
                  <div style={{fontSize:10,color:T.fog,marginTop:2}}>{p.cats.join(" · ")}</div>
                </div>
              );
            })}
            {proveedoresOrdenados.length > 8 && (
              <div style={{fontSize:11,color:T.fog,textAlign:"center",paddingTop:4,cursor:"pointer"}}
                onClick={()=>setVista("tabla")}>
                +{proveedoresOrdenados.length-8} más → Ver todos
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resumen por productor */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Por Productor</div>
          <span style={{fontSize:11,color:T.fog}}>clic para filtrar</span>
        </div>
        <div className="table-wrap-scroll">
          <table style={{minWidth:700}}>
            <thead><tr>
              <th>Productor</th>
              <th style={{textAlign:"right"}}>Semilla</th>
              <th style={{textAlign:"right"}}>Fertilizante</th>
              <th style={{textAlign:"right"}}>Agroquímicos</th>
              <th style={{textAlign:"right"}}>Total</th>
              <th>Registros</th>
            </tr></thead>
            <tbody>
              {productores.map((p,i)=>{
                const ins = insumos.filter(x=>String(x.productorId)===String(p.id)&&!x.cancelado);
                if (ins.length===0) return null;
                const sem  = ins.filter(x=>x.categoria==="Semilla").reduce((s,x)=>s+(parseFloat(x.importe)||0),0);
                const fer  = ins.filter(x=>x.categoria==="Fertilizante").reduce((s,x)=>s+(parseFloat(x.importe)||0),0);
                const agro = ins.filter(x=>!["Semilla","Fertilizante"].includes(x.categoria)).reduce((s,x)=>s+(parseFloat(x.importe)||0),0);
                const tot  = sem+fer+agro;
                const bg   = i%2===0?"white":"#faf8f3";
                return (
                  <tr key={p.id} style={{cursor:"pointer",transition:"filter 0.12s"}}
                    onClick={()=>setFiltroProd(String(p.id))}
                    onMouseEnter={e=>e.currentTarget.style.filter="brightness(0.92)"}
                    onMouseLeave={e=>e.currentTarget.style.filter=""}>
                    <td style={{background:bg}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:p.color}}/>
                        <span style={{fontWeight:600,fontSize:13}}>{p.alias||p.apPat}</span>
                        {String(filtroProd)===String(p.id) && <span style={{fontSize:9,background:p.color+"22",color:p.color,padding:"1px 6px",borderRadius:8,border:`1px solid ${p.color}44`}}>activo</span>}
                      </div>
                    </td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,color:"#c8a84b"}}>{sem>0?mxnFmt(sem):"—"}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,color:"#2d5a1b"}}>{fer>0?mxnFmt(fer):"—"}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,color:"#8e44ad"}}>{agro>0?mxnFmt(agro):"—"}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#c0392b"}}>{mxnFmt(tot)}</td>
                    <td style={{background:bg,fontSize:12,color:"#5a7a3a"}}>{ins.length} reg.</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtroProd!=="todos" && (
          <div style={{padding:"8px 16px",background:"#f0f4e8",borderTop:`1px solid ${T.line}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:12,color:"#2d5a1b",fontWeight:600}}>
              Filtrando por: {productores.find(p=>String(p.id)===String(filtroProd))?.alias||"Productor"}
            </span>
            <button className="btn btn-sm btn-secondary" style={{fontSize:11}} onClick={()=>setFiltroProd("todos")}>✕ Quitar filtro</button>
          </div>
        )}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // VISTA TABLA
  // ─────────────────────────────────────────────────────────────────────────────
  if (vista==="tabla") return (
    <>
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <button className="btn btn-secondary" onClick={()=>setVista("resumen")}>← Volver</button>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,flex:1}}>Todos los Registros</div>
        <BtnExport onClick={()=>exportarExcel("Insumos_"+state.cicloActual,[{
          nombre:"Insumos",
          headers:["# Sol","# Orden","Fecha Sol","Productor","Categoría","Insumo","Cantidad","Unidad","Importe","Estatus"],
          rows:insumosFiltrados.map(i=>[
            i.numSolicitud,i.numOrden,i.fechaSolicitud,
            (state.productores||[]).find(p=>String(p.id)===String(i.productorId))?.alias||"",
            i.categoria,i.insumo,i.cantidad,i.unidad,parseFloat(i.importe)||0,i.estatus
          ])
        }])}/>
        <button className="btn btn-primary" onClick={()=>setVista("nuevo")}>＋ Nuevo Registro</button>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <select className="form-select" style={{width:180}} value={filtroCat} onChange={e=>{setFiltroCat(e.target.value);setFiltroConcepto("");}}>
          <option value="todas">Todas las categorías</option>
          {CAT_INSUMO.map(c=><option key={c} value={c}>{CAT_ICONS[c]||"📌"} {c}</option>)}
        </select>
        <select className="form-select" style={{width:190}} value={filtroProd} onChange={e=>setFiltroProd(e.target.value)}>
          <option value="todos">Todos los productores</option>
          {productores.map(p=><option key={p.id} value={p.id}>{p.alias||p.apPat}</option>)}
        </select>
        {/* Filtros inteligentes con dropdown */}
        <FiltroSelect
          valor={filtroConcepto}
          onChange={setFiltroConcepto}
          opciones={opcionesConceptos}
          placeholder="🔍 Concepto..."
          width={200}
          mxnFmt={mxnFmt}
        />
        <FiltroSelect
          valor={filtroProveedor}
          onChange={setFiltroProveedor}
          opciones={opcionesProveedores}
          placeholder="🏢 Proveedor..."
          width={200}
          mxnFmt={mxnFmt}
        />
        <select className="form-select" style={{width:150}} value={filtroCancelados} onChange={e=>setFiltroCancelados(e.target.value)}>
          <option value="activos">✅ Activos</option>
          <option value="cancelados">🚫 Cancelados</option>
          <option value="todos">Todos</option>
        </select>
        {(filtroCat!=="todas"||filtroProd!=="todos"||filtroConcepto||filtroProveedor) && (
          <button className="btn btn-sm btn-secondary" onClick={()=>{setFiltroCat("todas");setFiltroProd("todos");setFiltroConcepto("");setFiltroProveedor("");}}
            style={{fontSize:11,padding:"4px 10px",background:"#fff3cd",border:"1px solid #c8a84b",color:"#856404"}}>
            ✕ Limpiar filtros
          </button>
        )}
        {filtroCat!=="todas" && (
          <span style={{padding:"3px 10px",borderRadius:12,background:`${CAT_COLORS[filtroCat]||"#888"}22`,
            color:CAT_COLORS[filtroCat]||"#888",fontSize:11,fontWeight:700,border:`1px solid ${CAT_COLORS[filtroCat]||"#888"}44`}}>
            {CAT_ICONS[filtroCat]||"📌"} {filtroCat}
          </span>
        )}
        {filtroConcepto && (
          <span style={{padding:"3px 10px",borderRadius:12,background:"#e8f4e8",color:"#2d5a1b",fontSize:11,fontWeight:700,border:"1px solid #4a8c2a44",cursor:"pointer"}}
            onClick={()=>setFiltroConcepto("")} title="Quitar filtro de concepto">
            🔍 {filtroConcepto} ✕
          </span>
        )}
        {filtroProveedor && (
          <span style={{padding:"3px 10px",borderRadius:12,background:"#e8f0fb",color:"#1a6ea8",fontSize:11,fontWeight:700,border:"1px solid #1a6ea844",cursor:"pointer"}}
            onClick={()=>setFiltroProveedor("")} title="Quitar filtro de proveedor">
            🏢 {filtroProveedor.length>20?filtroProveedor.slice(0,20)+"…":filtroProveedor} ✕
          </span>
        )}
        <div style={{fontFamily:"monospace",fontSize:12,marginLeft:"auto",color:"#5a7a3a",fontWeight:700}}>
          {insumosFiltrados.filter(i=>filtroCancelados==="todos"?true:filtroCancelados==="cancelados"?i.cancelado:!i.cancelado).length} reg.
          {verPrecios && <> · {mxnFmt(insumosFiltrados.filter(i=>!i.cancelado).reduce((s,i)=>s+(parseFloat(i.importe)||0),0))}</>}
        </div>
      </div>

      {/* ── Panel de resumen cuando hay filtro activo ── */}
      {(()=>{
        const activos = insumosFiltrados.filter(i=>!i.cancelado);
        const totalCantidad = activos.reduce((s,i)=>s+(parseFloat(i.cantidad)||0),0);
        const totalImporte  = activos.reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
        const unidades      = [...new Set(activos.map(i=>i.unidad||"").filter(Boolean))];
        const preciosProm   = activos.filter(i=>parseFloat(i.precioUnitario)>0);
        const precioProm    = preciosProm.length > 0
          ? preciosProm.reduce((s,i)=>s+(parseFloat(i.precioUnitario)||0),0)/preciosProm.length : 0;
        const porProd = {};
        activos.forEach(i=>{
          const nom = productores.find(p=>String(p.id)===String(i.productorId))?.alias || `#${i.productorId}`;
          if(!porProd[nom]) porProd[nom]={cant:0,importe:0,regs:0};
          porProd[nom].cant    += parseFloat(i.cantidad)||0;
          porProd[nom].importe += parseFloat(i.importe)||0;
          porProd[nom].regs++;
        });
        const provData = filtroProveedor ? proveedoresOrdenados.find(p=>p.nombre===filtroProveedor) : null;
        const hasCiclo = (state.ciclos||[]).find(c=>c.id===state.cicloActivoId);
        const haTotales= (hasCiclo?.asignaciones||[]).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
        const color = filtroProveedor ? "#1a6ea8" : (CAT_COLORS[filtroCat]||"#2d5a1b");
        const titulo = filtroProveedor
          ? `🏢 ${filtroProveedor}`
          : `${CAT_ICONS[filtroCat]||"📌"} ${filtroConcepto || filtroCat}`;
        return (
          <div style={{marginBottom:14,borderRadius:10,overflow:"hidden",border:`2px solid ${color}33`,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
            <div style={{background:`${color}15`,padding:"12px 16px",borderBottom:`1px solid ${color}22`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color}}>{titulo}</div>
                <div style={{fontSize:11,color:T.fog,marginTop:2}}>
                  {activos.length} registros · {Object.keys(porProd).length} productores
                  {provData && ` · ${provData.conceptos} conceptos`}
                </div>
              </div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:800,color:"#c0392b"}}>{mxnFmt(totalImporte)}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",background:"white"}}>
              {[
                {icon:"📦", label:"Total Cantidad", valor:`${totalCantidad.toLocaleString("es-MX",{maximumFractionDigits:2})} ${unidades.join("/")||""}`, sub:"suma pedidos"},
                {icon:"💰", label:"Importe Total",  valor:mxnFmt(totalImporte), sub:`${activos.length} pedidos`, clr:"#c0392b"},
                {icon:"💲", label:"Precio Prom.",   valor:precioProm>0?`$${precioProm.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})}`:"—", sub:precioProm>0?`${preciosProm.length} refs`:"—"},
                {icon:"🌾", label:"Costo / Ha",     valor:haTotales>0?mxnFmt(totalImporte/haTotales):"—", sub:haTotales>0?`${haTotales.toFixed(1)} ha`:"—"},
                ...(provData ? [{icon:"📊",label:"% Gasto Total",valor:`${provData.pct.toFixed(1)}%`,sub:"del total insumos"}] : []),
              ].map(({icon,label,valor,sub,clr})=>(
                <div key={label} style={{padding:"12px 14px",borderRight:`1px solid ${T.line}`,borderBottom:`1px solid ${T.line}`}}>
                  <div style={{fontSize:10,color:T.fog,marginBottom:3}}>{icon} {label}</div>
                  <div style={{fontFamily:"monospace",fontWeight:700,fontSize:14,color:clr||color}}>{valor}</div>
                  <div style={{fontSize:10,color:T.fog,marginTop:2}}>{sub}</div>
                </div>
              ))}
            </div>
            {/* Si proveedor: desglose por categoría clickeable */}
            {provData && Object.keys(provData.detalles).length > 0 && (
              <div style={{background:"white",borderTop:`1px solid ${T.line}`,padding:"10px 14px"}}>
                <div style={{fontSize:10,fontWeight:700,color:T.fog,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Categorías del Proveedor</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {Object.entries(provData.detalles).sort((a,b)=>b[1].total-a[1].total).map(([cat,d])=>(
                    <div key={cat} onClick={()=>setFiltroCat(cat)}
                      style={{padding:"5px 12px",borderRadius:20,background:`${CAT_COLORS[cat]||"#888"}15`,border:`1px solid ${CAT_COLORS[cat]||"#888"}33`,fontSize:11,cursor:"pointer"}}>
                      <span style={{fontWeight:600,color:CAT_COLORS[cat]||"#888"}}>{CAT_ICONS[cat]||"📌"} {cat}</span>
                      <span style={{color:T.fog,marginLeft:6}}>{d.regs} ped</span>
                      <span style={{fontFamily:"monospace",fontWeight:700,color:"#c0392b",marginLeft:8}}>{mxnFmt(d.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Desglose por productor */}
            {Object.keys(porProd).length > 0 && (
              <div style={{background:"white",borderTop:`1px solid ${T.line}`,padding:"10px 14px"}}>
                <div style={{fontSize:10,fontWeight:700,color:T.fog,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Por Productor</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {Object.entries(porProd).sort((a,b)=>b[1].importe-a[1].importe).map(([nom,d])=>(
                    <div key={nom} style={{padding:"5px 12px",borderRadius:20,background:`${color}10`,border:`1px solid ${color}33`,fontSize:11}}>
                      <span style={{fontWeight:600,color}}>{nom}</span>
                      {unidades[0] && <span style={{color:T.fog,marginLeft:6}}>{d.cant.toLocaleString("es-MX",{maximumFractionDigits:1})} {unidades[0]}</span>}
                      <span style={{fontFamily:"monospace",fontWeight:700,color:"#c0392b",marginLeft:8}}>{mxnFmt(d.importe)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {isMobile ? (
        <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:16}}>
          {(()=>{
            const sortedIns = [...insumosFiltrados].sort((a,b)=>String(b.fechaSolicitud).localeCompare(String(a.fechaSolicitud)));
            const grupos = {};
            sortedIns.forEach(x=>{
              const cat = x.categoria||"Otros";
              (grupos[cat] = grupos[cat]||[]).push(x);
            });
            const categorias = Object.keys(grupos);
            if (categorias.length===0) {
              return <div style={{textAlign:"center",padding:32,color:"#8a8070",fontSize:14}}>Sin insumos</div>;
            }
            return categorias.map(cat=>{
              const color = CAT_COLORS[cat]||"#6b7280";
              const icon = CAT_ICONS[cat]||"📦";
              return (
                <div key={cat}>
                  <div style={{
                    fontSize:11,fontWeight:700,color,
                    textTransform:"uppercase",letterSpacing:1,
                    marginBottom:8,paddingLeft:4,
                  }}>{icon} {cat} · {grupos[cat].length}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {grupos[cat].map(ins=>{
                      const opaco = ins.cancelado?{opacity:0.55}:{};
                      return (
                        <div key={ins.id} style={{
                          background:"#ffffff",
                          border:"1px solid #e5e7eb",
                          borderLeft:`4px solid ${color}`,
                          borderRadius:12,
                          padding:14,
                          boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
                          ...opaco,
                        }}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:6}}>
                            <div style={{fontSize:16,fontWeight:700,color:"#14532D",lineHeight:1.2,flex:1,minWidth:0}}>
                              {ins.insumo||"Sin nombre"}
                            </div>
                            {badgeEstatus(ins)}
                          </div>
                          <div style={{fontSize:13,color:"#374151",marginBottom:4}}>
                            👤 {nomProd(ins.productorId)}
                          </div>
                          <div style={{fontSize:14,fontWeight:600,color}}>
                            {ins.cantidad} {ins.unidad}
                          </div>
                          {ins.proveedor && (
                            <div style={{fontSize:12,color:"#6b7280",marginTop:4}}>🏪 {ins.proveedor}</div>
                          )}
                          {ins.cancelado && <div style={{marginTop:6,fontSize:11,color:"#991b1b",fontWeight:600}}>🚫 Cancelado</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      ) : (
      <div className="card">
        <div className="table-wrap-scroll">
          <table style={{minWidth:900}}>
            <thead><tr>
              <th>Solicitud</th><th>Orden</th><th>Fecha Sol.</th>
              <th>Productor</th><th>Categoría</th><th>Insumo</th>
              <th style={{textAlign:"right"}}>Pedido</th><th>Unidad</th>
              <th style={{textAlign:"right"}}>Recibido</th>
              <th>Estatus</th>
              {verPrecios && <th style={{textAlign:"right"}}>Precio Unit.</th>}
              {verPrecios && <th style={{textAlign:"right"}}>Importe</th>}
              <th>Proveedor</th><th></th>
            </tr></thead>
            <tbody>
              {insumosFiltrados.sort((a,b)=>String(b.fechaSolicitud).localeCompare(String(a.fechaSolicitud))).map((ins,i)=>{
                const bg = ins.cancelado ? "#fff0f0" : i%2===0?"white":"#faf8f3";
                const rowStyle = ins.cancelado ? {opacity:0.6, textDecoration:"line-through"} : {};
                return (
                  <tr key={ins.id}>
                    <td style={{background:bg,fontFamily:"monospace",fontWeight:700,fontSize:12,...rowStyle}}>{ins.numSolicitud||"—"}</td>
                    <td style={{background:bg,fontFamily:"monospace",fontSize:12}}>{ins.numOrden||"—"}</td>
                    <td style={{background:bg,fontSize:11}}>{ins.fechaSolicitud||"—"}</td>
                    <td style={{background:bg,fontWeight:600,fontSize:12}}>{nomProd(ins.productorId)}</td>
                    <td style={{background:bg}}>
                      <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:10,background:`${CAT_COLORS[ins.categoria]||"#999"}22`,color:CAT_COLORS[ins.categoria]||"#666"}}>
                        {CAT_ICONS[ins.categoria]||"📦"} {ins.categoria}
                      </span>
                    </td>
                    <td style={{background:bg,fontWeight:500,fontSize:12}}>{ins.insumo}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{ins.cantidad}</td>
                    <td style={{background:bg,fontSize:11}}>{ins.unidad}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,color:"#2d5a1b"}}>{parseFloat(ins.cantidadRecibida)||0 > 0 ? `${ins.cantidadRecibida} ${ins.unidad}` : "—"}</td>
                    <td style={{background:bg}}>{badgeEstatus(ins)}</td>
                    {verPrecios && <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{ins.precioUnitario>0?mxnFmt(ins.precioUnitario):"—"}</td>}
                    {verPrecios && <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#c0392b"}}>{mxnFmt(ins.importe)}</td>}
                    <td style={{background:bg,fontSize:11,color:"#7a7060",maxWidth:150}}>{ins.proveedor}</td>
                    <td style={{background:bg}}>
                      <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                        {!ins.cancelado&&ins.estatus!=="recibido"&&puedeEditar&&(
                          <button className="btn btn-sm" style={{fontSize:10,background:"#d4edda",color:"#155724",border:"1px solid #c3e6cb"}}
                            onClick={()=>{setRecibirModal(ins);setFormRecep({...emptyRecep,cantidad:String((parseFloat(ins.cantidad)||0)-(parseFloat(ins.cantidadRecibida)||0))});}}>
                            📥 Recibir
                          </button>
                        )}
                        {ins.cancelado&&<BadgeCancelado registro={ins}/>}
                        {ins.cancelado?(puedeEditar&&<button className="btn btn-sm btn-secondary" style={{fontSize:11}} onClick={()=>setCancelModal({action:"reactivar",tabla:"insumos",rec:ins})}>↺</button>):(puedeEditar&&<button className="btn btn-sm" style={{fontSize:11,background:"#fff3cd",color:"#856404",border:"1px solid #ffc107"}} onClick={()=>setCancelModal({action:"cancelar",tabla:"insumos",rec:ins})}>🚫</button>)}
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
    </div>

      {recibirModal&&(
        <Modal title={`📥 Recibir: ${recibirModal.insumo}`} onClose={()=>setRecibirModal(null)}
          footer={<><button className="btn btn-secondary" onClick={()=>setRecibirModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={guardarRecepcion}>💾 Confirmar recepción</button></>}>
          <div style={{padding:"8px 12px",background:"#f0f8e8",borderRadius:6,marginBottom:12,fontSize:12}}>
            <div>Pedido total: <strong>{recibirModal.cantidad} {recibirModal.unidad}</strong></div>
            <div>Ya recibido: <strong>{parseFloat(recibirModal.cantidadRecibida)||0} {recibirModal.unidad}</strong></div>
            <div>Pendiente: <strong style={{color:"#c0392b"}}>{(parseFloat(recibirModal.cantidad)||0)-(parseFloat(recibirModal.cantidadRecibida)||0)} {recibirModal.unidad}</strong></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Cantidad recibida ahora *</label>
              <input className="form-input" type="number" step="0.01" value={formRecep.cantidad} onChange={e=>setFormRecep(f=>({...f,cantidad:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Fecha de recepción</label>
              <input className="form-input" type="date" value={formRecep.fecha} onChange={e=>setFormRecep(f=>({...f,fecha:e.target.value}))}/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Ubicación en bodega</label>
              <input className="form-input" value={formRecep.ubicacion} onChange={e=>setFormRecep(f=>({...f,ubicacion:e.target.value}))} placeholder="Ej. Bodega 1"/></div>
            <div className="form-group"><label className="form-label">Notas (opcional)</label>
              <input className="form-input" value={formRecep.notas} onChange={e=>setFormRecep(f=>({...f,notas:e.target.value}))}/></div>
          </div>
          {(recibirModal.recepciones||[]).length>0&&(
            <div style={{marginTop:8}}>
              <div style={{fontSize:11,fontWeight:600,color:"#6a6050",marginBottom:6}}>Recepciones anteriores:</div>
              {recibirModal.recepciones.map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"4px 8px",background:"#faf8f3",borderRadius:4,marginBottom:3}}>
                  <span>{r.fecha} — {r.ubicacion}</span>
                  <span style={{fontFamily:"monospace",fontWeight:600,color:"#2d5a1b"}}>{r.cantidad} {recibirModal.unidad}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // VISTA NUEVO REGISTRO
  // ─────────────────────────────────────────────────────────────────────────────
  if (vista==="nuevo") return (
    <div style={{maxWidth:660}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <button className="btn btn-secondary" onClick={()=>setVista("tabla")}>← Volver</button>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700}}>Registrar Insumo / Semilla</div>
      </div>
      <div className="card">
        <div className="card-body" style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* Solicitud y Orden */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label"># Solicitud</label>
              <input className="form-input" value={form.numSolicitud} onChange={e=>setForm(f=>({...f,numSolicitud:e.target.value}))} placeholder="Ej. 7988"/>
            </div>
            <div className="form-group">
              <label className="form-label"># Orden</label>
              <input className="form-input" value={form.numOrden} onChange={e=>setForm(f=>({...f,numOrden:e.target.value}))} placeholder="Ej. 1210"/>
            </div>
          </div>
          {/* Fechas */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fecha Solicitud</label>
              <input className="form-input" type="date" value={form.fechaSolicitud} onChange={e=>setForm(f=>({...f,fechaSolicitud:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Fecha Orden</label>
              <input className="form-input" type="date" value={form.fechaOrden} onChange={e=>setForm(f=>({...f,fechaOrden:e.target.value}))}/>
            </div>
          </div>
          {/* Productor y Categoría */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Productor</label>
              <select className="form-select" value={form.productorId} onChange={e=>setForm(f=>({...f,productorId:e.target.value}))}>
                <option value="">— Seleccionar —</option>
                {productores.map(p=><option key={p.id} value={p.id}>{p.alias||p.apPat}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Categoría *</label>
              <select className="form-select" value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))}>
                {CAT_INSUMO.map(c=><option key={c} value={c}>{CAT_ICONS[c]} {c}</option>)}
              </select>
            </div>
          </div>
          {/* Insumo y Proveedor */}
          <div className="form-group">
            <label className="form-label">Insumo / Producto *</label>
            <input className="form-input" value={form.insumo} onChange={e=>setForm(f=>({...f,insumo:e.target.value}))} placeholder="Ej. SEMILLA DK-4050, FERTILIZANTE UREA..."/>
          </div>
          <div className="form-group">
            <label className="form-label">Proveedor / Empresa</label>
            <input className="form-input" value={form.proveedor} onChange={e=>setForm(f=>({...f,proveedor:e.target.value}))} placeholder="Nombre de la empresa proveedora"/>
          </div>
          {/* Cantidad, Unidad, Precio */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cantidad *</label>
              <input className="form-input" type="number" value={form.cantidad} onChange={e=>{
                const cant=parseFloat(e.target.value)||0;
                const imp=cant*(parseFloat(form.precioUnitario)||0);
                setForm(f=>({...f,cantidad:e.target.value,importe:imp>0?imp.toFixed(2):f.importe}));
              }} placeholder="0"/>
            </div>
            <div className="form-group">
              <label className="form-label">Unidad</label>
              <select className="form-select" value={form.unidad} onChange={e=>setForm(f=>({...f,unidad:e.target.value}))}>
                {UNIDADES.map(u=><option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Precio Unitario $</label>
              <input className="form-input" type="number" value={form.precioUnitario} onChange={e=>{
                const precio=parseFloat(e.target.value)||0;
                const imp=(parseFloat(form.cantidad)||0)*precio;
                setForm(f=>({...f,precioUnitario:e.target.value,importe:imp>0?imp.toFixed(2):f.importe}));
              }} placeholder="0"/>
            </div>
          </div>
          {/* Importe (calculado o manual) */}
          <div className="form-group">
            <label className="form-label">Importe Total $ * <span style={{fontSize:10,color:"#8a8070"}}>(se calcula automático, puedes ajustar)</span></label>
            <input className="form-input" type="number" value={form.importe}
              style={{fontFamily:"monospace",fontWeight:700,color:"#c0392b"}}
              onChange={e=>setForm(f=>({...f,importe:e.target.value}))} placeholder="0.00"/>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button className="btn btn-secondary" onClick={()=>setVista("tabla")}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardarInsumo}>💾 Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // VISTA IMPORTAR EXCEL
  // ─────────────────────────────────────────────────────────────────────────────
  if (vista==="import") return (
    <div style={{maxWidth:680}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <button className="btn btn-secondary" onClick={()=>setVista("tabla")}>← Volver</button>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700}}>Importar Excel de Insumos</div>
      </div>
      <div className="card" style={{marginBottom:16,borderLeft:"4px solid #2d5a1b"}}>
        <div className="card-body">
          <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:"#2d5a1b"}}>📋 Estructura requerida del archivo Excel</div>
          <div style={{padding:"8px 12px",background:"#f0f4e8",borderRadius:6,fontFamily:"monospace",fontSize:11,marginBottom:10}}>
            # SOLICITUD &nbsp;|&nbsp; # ORDEN &nbsp;|&nbsp; FECHA SOLICITUD &nbsp;|&nbsp; GRUPO &nbsp;|&nbsp; CODIGO CTE &nbsp;|&nbsp; PRODUCTOR &nbsp;|&nbsp; CULTIVO &nbsp;|&nbsp; EMPRESA &nbsp;|&nbsp; CATEGORIA &nbsp;|&nbsp; INSUMO &nbsp;|&nbsp; CANTIDAD &nbsp;|&nbsp; UNIDAD &nbsp;|&nbsp; PRECIO FINAL &nbsp;|&nbsp; IMPORTE &nbsp;|&nbsp; FECHA ORDEN
          </div>
          <div style={{fontSize:11,color:"#5a6a5a",lineHeight:1.8}}>
            <b>Categorías reconocidas:</b> SEMILLA DE MAIZ · FERTILIZANTES · HERBICIDAS · FUNGICIDAS · INSECTICIDAS · FOLIARES · ADHERENTE<br/>
            <b>Unidades:</b> BOLSA · KG · TON · LT · PIEZA<br/>
            Solo se procesa la primera hoja del archivo.
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-body" style={{textAlign:"center",padding:32}}>
          <div style={{fontSize:40,marginBottom:12}}>🌱</div>
          <div style={{fontWeight:600,marginBottom:8}}>Selecciona el archivo .xlsx de insumos</div>
          <input type="file" accept=".xlsx,.xls" ref={fileInputRef} style={{display:"none"}} onChange={importarExcel}/>
          <button className="btn btn-primary" onClick={()=>fileInputRef.current?.click()} disabled={importando}>
            {importando?"⏳ Procesando...":"📂 Seleccionar archivo"}
          </button>
          {importLog.length>0&&(
            <div style={{marginTop:16,textAlign:"left",padding:"12px 16px",background:"#f5f4f0",borderRadius:8}}>
              {importLog.map((l,i)=><div key={i} style={{fontSize:12,marginBottom:4,color:l.startsWith("❌")?"#c0392b":l.startsWith("⚠️")?"#e67e22":"#2d5a1b"}}>{l}</div>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return null;

  {cancelModal && (
    cancelModal.action === "cancelar"
    ? <ModalCancelacion
        titulo={cancelModal.rec?.insumo || cancelModal.rec?.numSolicitud || cancelModal.rec?.concepto || cancelModal.rec?.nombre || "registro"}
        onCerrar={()=>setCancelModal(null)}
        onConfirmar={({motivo,comentario})=>{
          dispatch({type:"CANCELAR_REGISTRO",payload:{
            tabla:cancelModal.tabla, id:cancelModal.rec.id,
            motivo, comentario,
            canceladoPor: "admin",
            fecha: new Date().toISOString().split("T")[0]
          }});
          setCancelModal(null);
        }}/>
    : <ModalReactivacion
        titulo={cancelModal.rec?.insumo || cancelModal.rec?.numSolicitud || cancelModal.rec?.concepto || cancelModal.rec?.nombre || "registro"}
        onCerrar={()=>setCancelModal(null)}
        onConfirmar={({motivo,comentario})=>{
          dispatch({type:"REACTIVAR_REGISTRO",payload:{
            tabla:cancelModal.tabla, id:cancelModal.rec.id,
            motivo, comentario,
            reactivadoPor: "admin",
            fecha: new Date().toISOString().split("T")[0]
          }});
          setCancelModal(null);
        }}/>
  )}

}
