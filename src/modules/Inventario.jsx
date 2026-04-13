// ─── modules/Inventario.jsx ───────────────────────────────────────────

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


export default function InventarioModule({ userRol, puedeEditar }) {
  const { state, dispatch } = useData();
  const mxnFmt = n => (parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2});
  const numFmt = (n,d=2) => (parseFloat(n)||0).toLocaleString("es-MX",{minimumFractionDigits:d,maximumFractionDigits:d});

  const hoy = new Date().toISOString().split("T")[0];
  const inv  = state.inventario || { items:[], movimientos:[] };
  const items = inv.items || [];
  const movs  = inv.movimientos || [];

  const [vista,     setVista]     = useState("resumen"); // resumen | item | nuevo_item | movimientos
  const [itemSel,   setItemSel]   = useState(null);
  const [modalItem, setModalItem] = useState(false);
  const [modalMov,  setModalMov]  = useState(false);
  const [selItem,   setSelItem]   = useState(null);
  const [filtroCat, setFiltroCat] = useState("todas");

  const CATEGORIAS = ["Semilla","Fertilizante","Herbicida","Fungicida","Insecticida","Foliar","Adherente","Combustible","Bioestimulante","Herramienta","Refacción","Otro"];
  const UNIDADES   = ["kg","L","ton","mL","g","piezas","sacos","tambos","litros"];

  const emptyItem = { nombre:"", categoria:"Fertilizante", unidad:"kg", descripcion:"", ubicacion:"Bodega" };
  const emptyMov  = { itemId:"", tipo:"entrada", cantidad:"", fecha:hoy, concepto:"", ref:"" };
  const [formItem, setFormItem] = useState(emptyItem);
  const [formMov,  setFormMov]  = useState(emptyMov);

  // ── Calcular stock por item ───────────────────────────────────────────────
  const stockItem = (itemId) => {
    // Buscar el item para obtener su nombre y agrupar movimientos por nombre también
    const item = items.find(i=>i.id===itemId);
    const nombre = (item?.nombre||"").trim().toUpperCase();
    // Incluir movimientos del itemId Y de otros items con el mismo nombre
    const idsRelacionados = nombre
      ? items.filter(i=>(i.nombre||"").trim().toUpperCase()===nombre).map(i=>i.id)
      : [itemId];
    const entradas = movs.filter(m=>idsRelacionados.includes(m.itemId)&&m.tipo==="entrada").reduce((s,m)=>s+(parseFloat(m.cantidad)||0),0);
    const salidas  = movs.filter(m=>idsRelacionados.includes(m.itemId)&&m.tipo==="salida").reduce((s,m)=>s+(parseFloat(m.cantidad)||0),0);
    return { entradas, salidas, stock: entradas-salidas };
  };

  // Stock desde insumos comprados (entradas automáticas)
  const stockDesdeInsumos = (itemId) => {
    const item = items.find(i=>i.id===itemId);
    if (!item) return 0;
    // Buscar insumos con mismo nombre
    return (state.insumos||[]).filter(i=>!i.cancelado&&((i.cicloId||1)===(state.cicloActivoId||1))&&(i.nombre||i.insumo||"").toLowerCase()===item.nombre.toLowerCase())
      .reduce((s,i)=>s+(parseFloat(i.cantidad)||0),0);
  };

  // Stock total = entradas manuales + insumos comprados - salidas bitácora - salidas manuales
  const stockTotal = (itemId) => {
    const s = stockItem(itemId);
    const entradasBitacora = (state.bitacora||[])
      .filter(b=>b.tipo==="insumo"&&b.data?.insumoId===String(itemId))
      .reduce((_s,b)=>_s+(parseFloat(b.data?.cantidadTotal)||0),0);
    return s.entradas - s.salidas;
  };

  // Items con stock calculado
  // Deduplicar: si hay items con el mismo nombre, mostrar solo el primero con stock combinado
  const nombresVistos = new Set();
  const itemsConStock = items.map(i=>{
    const s = stockItem(i.id);
    return {...i, entradas:s.entradas, salidas:s.salidas, stock:s.stock};
  }).filter(i=>{
    const nom = (i.nombre||"").trim().toUpperCase();
    if (nombresVistos.has(nom)) return false;
    nombresVistos.add(nom);
    return true;
  });

  const itemsFiltrados = filtroCat==="todas" ? itemsConStock : itemsConStock.filter(i=>i.categoria===filtroCat);
  const totalItems     = items.length;
  const itemsBajoStock = itemsConStock.filter(i=>i.stock<=0).length;

  const saveItem = () => {
    if(!formItem.nombre) return;
    if(selItem) dispatch({type:"UPD_INV_ITEM", payload:{...formItem,id:selItem.id}});
    else        dispatch({type:"ADD_INV_ITEM",  payload:formItem});
    setModalItem(false); setSelItem(null); setFormItem(emptyItem);
  };

  const saveMov = () => {
    if(!formMov.itemId||!formMov.cantidad) return;
    dispatch({type:"ADD_INV_MOV", payload:{
      ...formMov, itemId:parseInt(formMov.itemId),
      cantidad: parseFloat(formMov.cantidad)||0,
    }});
    setModalMov(false); setFormMov(emptyMov);
  };

  // ── Movimientos del item seleccionado ─────────────────────────────────────
  const movsItem = (itemId) => [
    // Manuales
    ...movs.filter(m=>m.itemId===itemId).map(m=>({...m, origen:"manual"})),
    // Desde bitácora
    ...(state.bitacora||[])
      .filter(b=>b.tipo==="insumo"&&parseInt(b.data?.insumoId)===itemId&&b.data?.cantidadTotal>0)
      .map(b=>({
        id:"b-"+b.id, itemId, tipo:"salida",
        cantidad: b.data.cantidadTotal,
        unidad: b.data.unidadBase||"",
        fecha: b.fecha,
        concepto: `Aplicación campo — ${b.data.dosis} ${b.data.unidad} × ${b.data.haAplicadas} ha`,
        ref: "bitácora",
        origen:"bitacora"
      })),
  ].sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));

  const catColor = c => ({
    // Singular
    Semilla:"#c8a84b",Fertilizante:"#2d5a1b",Herbicida:"#e74c3c",
    Fungicida:"#8e44ad",Insecticida:"#e67e22",Foliar:"#27ae60",
    Combustible:"#f39c12",Herramienta:"#7f8c8d",Adherente:"#1a6ea8",
    Refacción:"#34495e",Otro:"#95a5a6",
    // Plural (generados desde insumos)
    Semillas:"#c8a84b",Fertilizantes:"#2d5a1b",Herbicidas:"#e74c3c",
    Fungicidas:"#8e44ad",Insecticidas:"#e67e22",
    Adherentes:"#1a6ea8",Bioestimulantes:"#16a085",Otros:"#95a5a6",
  })[c]||"#888";

  // ── VISTA RESUMEN ─────────────────────────────────────────────────────────
  if (vista==="resumen") return (
    <div>
      <div className="stat-grid" style={{gridTemplateColumns:"repeat(4,1fr)",marginBottom:16}}>
        <div className="stat-card green"><div className="stat-icon">📦</div><div className="stat-label">Productos en catálogo</div><div className="stat-value">{totalItems}</div><div className="stat-sub">{CATEGORIAS.filter(c=>items.some(i=>i.categoria===c)).length} categorías</div></div>
        <div className="stat-card gold"><div className="stat-icon">📥</div><div className="stat-label">Total entradas</div><div className="stat-value">{movs.filter(m=>m.tipo==="entrada").length}</div><div className="stat-sub">movimientos</div></div>
        <div className="stat-card sky"><div className="stat-icon">📤</div><div className="stat-label">Total salidas</div><div className="stat-value">{movs.filter(m=>m.tipo==="salida").length + (state.bitacora||[]).filter(b=>b.tipo==="insumo"&&b.data?.cantidadTotal>0).length}</div><div className="stat-sub">incl. desde bitácora</div></div>
        <div className="stat-card rust"><div className="stat-icon">⚠️</div><div className="stat-label">Sin stock</div><div className="stat-value">{itemsBajoStock}</div><div className="stat-sub">productos agotados</div></div>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {puedeEditar&&<button className="btn btn-primary" onClick={()=>{setSelItem(null);setFormItem(emptyItem);setModalItem(true);}}>＋ Agregar Producto</button>}
        {puedeEditar&&<button className="btn btn-secondary" onClick={()=>{setFormMov(emptyMov);setModalMov(true);}}>📥 Registrar Entrada/Salida</button>}
        <select className="form-select" style={{width:180}} value={filtroCat} onChange={e=>setFiltroCat(e.target.value)}>
          <option value="todas">Todas las categorías</option>
          {CATEGORIAS.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {items.length===0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <div className="empty-title">Sin productos en catálogo</div>
          <div className="empty-sub">Agrega los productos que manejas en bodega para llevar el control de existencias</div>
          {puedeEditar&&<button className="btn btn-primary" style={{marginTop:12}} onClick={()=>{setSelItem(null);setFormItem(emptyItem);setModalItem(true);}}>＋ Agregar primer producto</button>}
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap-scroll">
            <table style={{minWidth:750}}>
              <thead><tr>
                <th>Producto</th><th>Categoría</th><th>Ubicación</th>
                <th style={{textAlign:"right"}}>Entradas</th>
                <th style={{textAlign:"right"}}>Salidas</th>
                <th style={{textAlign:"right",fontWeight:700}}>Stock actual</th>
                <th></th>
              </tr></thead>
              <tbody>
                {itemsFiltrados.map((item,i)=>{
                  const bg    = i%2===0?"white":"#faf8f3";
                  const bajo  = item.stock<=0;
                  const movsI = movsItem(item.id);
                  const salBit= movsI.filter(m=>m.origen==="bitacora").reduce((s,m)=>s+(m.cantidad||0),0);
                  const salMan= movs.filter(m=>m.itemId===item.id&&m.tipo==="salida").reduce((s,m)=>s+(parseFloat(m.cantidad)||0),0);
                  const salTotal= salBit+salMan;
                  return (
                    <tr key={item.id} style={{cursor:"pointer"}} onClick={()=>{setItemSel(item);setVista("item");}}>
                      <td style={{background:bg,fontWeight:600}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:catColor(item.categoria)}}/>
                          {item.nombre}
                        </div>
                      </td>
                      <td style={{background:bg}}><span style={{fontSize:10,padding:"2px 8px",borderRadius:8,fontWeight:600,background:catColor(item.categoria)+"22",color:catColor(item.categoria)}}>{item.categoria}</span></td>
                      <td style={{background:bg,fontSize:11,color:"#8a8070"}}>{item.ubicacion||"—"}</td>
                      <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,color:"#2d5a1b"}}>{numFmt(item.entradas,1)} {item.unidad}</td>
                      <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,color:"#c0392b"}}>{numFmt(salTotal,1)} {item.unidad}</td>
                      <td style={{background:bajo?"#fff0f0":bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,fontSize:13,color:bajo?"#c0392b":"#2d5a1b"}}>
                        {bajo?"⚠️ ":""}{numFmt(item.stock,1)} {item.unidad}
                      </td>
                      <td style={{background:bg}}>
                        <div style={{display:"flex",gap:4}}>
                          {puedeEditar&&<button className="btn btn-sm btn-secondary" onClick={e=>{e.stopPropagation();setSelItem(item);setFormItem({...item});setModalItem(true);}}>✏️</button>}
                          {userRol==="admin"&&<button className="btn btn-sm btn-danger" onClick={e=>{e.stopPropagation();confirmarEliminar("¿Eliminar este producto del inventario?",()=>dispatch({type:"DEL_INV_ITEM",payload:item.id}));}}>🗑</button>}
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

      {/* Modal agregar/editar producto */}
      {modalItem&&<Modal title={selItem?"Editar Producto":"Nuevo Producto"} onClose={()=>setModalItem(false)}
        footer={<><button className="btn btn-secondary" onClick={()=>setModalItem(false)}>Cancelar</button><button className="btn btn-primary" onClick={saveItem}>💾 Guardar</button></>}>
        <div className="form-group"><label className="form-label">Nombre del producto *</label><input className="form-input" value={formItem.nombre} onChange={e=>setFormItem(f=>({...f,nombre:e.target.value}))} placeholder="Ej. Urea 46%, Semilla P4226..."/></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Categoría</label>
            <select className="form-select" value={formItem.categoria} onChange={e=>setFormItem(f=>({...f,categoria:e.target.value}))}>
              {CATEGORIAS.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Unidad de medida</label>
            <select className="form-select" value={formItem.unidad} onChange={e=>setFormItem(f=>({...f,unidad:e.target.value}))}>
              {UNIDADES.map(u=><option key={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Ubicación</label><input className="form-input" value={formItem.ubicacion} onChange={e=>setFormItem(f=>({...f,ubicacion:e.target.value}))} placeholder="Ej. Bodega 1, Tanque..."/></div>
        </div>
        <div className="form-group"><label className="form-label">Descripción (opcional)</label><input className="form-input" value={formItem.descripcion} onChange={e=>setFormItem(f=>({...f,descripcion:e.target.value}))}/></div>
      </Modal>}

      {/* Modal movimiento */}
      {modalMov&&<Modal title="Registrar Entrada / Salida" onClose={()=>setModalMov(false)}
        footer={<><button className="btn btn-secondary" onClick={()=>setModalMov(false)}>Cancelar</button><button className="btn btn-primary" onClick={saveMov}>💾 Guardar</button></>}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Producto *</label>
            <select className="form-select" value={formMov.itemId} onChange={e=>setFormMov(f=>({...f,itemId:e.target.value}))}>
              <option value="">— Seleccionar —</option>
              {items.map(i=>{
                const s=stockItem(i.id);
                return <option key={i.id} value={i.id}>{i.nombre} (stock: {s.stock.toFixed(1)} {i.unidad})</option>;
              })}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Tipo</label>
            <select className="form-select" value={formMov.tipo} onChange={e=>setFormMov(f=>({...f,tipo:e.target.value}))}>
              <option value="entrada">📥 Entrada</option>
              <option value="salida">📤 Salida</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Cantidad *</label><input className="form-input" type="number" step="0.01" value={formMov.cantidad} onChange={e=>setFormMov(f=>({...f,cantidad:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Fecha</label><input className="form-input" type="date" value={formMov.fecha} onChange={e=>setFormMov(f=>({...f,fecha:e.target.value}))}/></div>
        </div>
        <div className="form-group"><label className="form-label">Concepto</label><input className="form-input" value={formMov.concepto} onChange={e=>setFormMov(f=>({...f,concepto:e.target.value}))} placeholder="Ej. Compra proveedor, Aplicación campo..."/></div>
      </Modal>}
    </div>
  );

  // ── VISTA DETALLE DE ITEM ─────────────────────────────────────────────────
  if (vista==="item" && itemSel) {
    const item  = items.find(i=>i.id===itemSel.id)||itemSel;
    const s     = stockItem(item.id);
    const todos = movsItem(item.id);
    const salBit= todos.filter(m=>m.origen==="bitacora").reduce((ss,m)=>ss+(m.cantidad||0),0);
    const salMan= movs.filter(m=>m.itemId===item.id&&m.tipo==="salida").reduce((ss,m)=>ss+(parseFloat(m.cantidad)||0),0);
    const salTotal = salBit+salMan;
    const stockActual = s.entradas - salTotal;

    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <button className="btn btn-secondary" onClick={()=>setVista("resumen")}>← Volver</button>
          <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
            <div style={{width:12,height:12,borderRadius:"50%",background:catColor(item.categoria)}}/>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700}}>{item.nombre}</div>
            <span style={{fontSize:11,padding:"3px 10px",borderRadius:10,background:catColor(item.categoria)+"22",color:catColor(item.categoria),fontWeight:600}}>{item.categoria}</span>
          </div>
          {puedeEditar&&<button className="btn btn-primary" onClick={()=>{setFormMov({...emptyMov,itemId:String(item.id)});setModalMov(true);}}>＋ Movimiento</button>}
        </div>

        <div className="stat-grid" style={{gridTemplateColumns:"repeat(4,1fr)",marginBottom:16}}>
          <div className="stat-card green"><div className="stat-icon">📥</div><div className="stat-label">Total entradas</div><div className="stat-value">{numFmt(s.entradas,1)}<span className="stat-unit"> {item.unidad}</span></div></div>
          <div className="stat-card rust"><div className="stat-icon">📤</div><div className="stat-label">Total salidas</div><div className="stat-value">{numFmt(salTotal,1)}<span className="stat-unit"> {item.unidad}</span></div><div className="stat-sub">{numFmt(salBit,1)} bitácora · {numFmt(salMan,1)} manual</div></div>
          <div className="stat-card" style={{borderLeft:`4px solid ${stockActual<=0?"#c0392b":"#2d5a1b"}`}}>
            <div className="stat-icon">{stockActual<=0?"⚠️":"✅"}</div>
            <div className="stat-label">Stock actual</div>
            <div className="stat-value" style={{color:stockActual<=0?"#c0392b":"#2d5a1b"}}>{numFmt(stockActual,1)}<span className="stat-unit"> {item.unidad}</span></div>
          </div>
          <div className="stat-card sky"><div className="stat-icon">📍</div><div className="stat-label">Ubicación</div><div className="stat-value" style={{fontSize:14}}>{item.ubicacion||"—"}</div></div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Historial de Movimientos</div></div>
          {todos.length===0
            ?<div className="empty-state"><div className="empty-icon">📋</div><div className="empty-title">Sin movimientos</div></div>
            :<div className="table-wrap-scroll">
              <table style={{minWidth:600}}>
                <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Origen</th><th style={{textAlign:"right"}}>Cantidad</th><th/></tr></thead>
                <tbody>
                  {todos.map((m,i)=>{
                    const bg=i%2===0?"white":"#faf8f3";
                    return(
                      <tr key={m.id}>
                        <td style={{background:bg,fontFamily:"monospace",fontSize:12}}>{m.fecha}</td>
                        <td style={{background:bg}}>
                          <span style={{fontSize:11,padding:"2px 8px",borderRadius:8,fontWeight:600,
                            background:m.tipo==="entrada"?"#d4edda":"#f8d7da",
                            color:m.tipo==="entrada"?"#155724":"#721c24"}}>
                            {m.tipo==="entrada"?"📥 Entrada":"📤 Salida"}
                          </span>
                        </td>
                        <td style={{background:bg,fontSize:12}}>{m.concepto||"—"}</td>
                        <td style={{background:bg,fontSize:11,color:"#8a8070"}}>{m.origen==="bitacora"?"🌱 Bitácora":"✍️ Manual"}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,
                          color:m.tipo==="entrada"?"#2d5a1b":"#c0392b"}}>
                          {m.tipo==="entrada"?"+":"-"}{numFmt(m.cantidad,2)} {m.unidad||item.unidad}
                        </td>
                        <td style={{background:bg}}>
                          {userRol==="admin"&&m.origen==="manual"&&
                            <button className="btn btn-sm btn-danger" onClick={()=>confirmarEliminar("¿Eliminar este movimiento?",()=>dispatch({type:"DEL_INV_MOV",payload:m.id}))}>🗑</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>}
        </div>
        {modalMov&&<Modal title="Registrar Movimiento" onClose={()=>setModalMov(false)}
          footer={<><button className="btn btn-secondary" onClick={()=>setModalMov(false)}>Cancelar</button><button className="btn btn-primary" onClick={saveMov}>💾 Guardar</button></>}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Tipo</label>
              <select className="form-select" value={formMov.tipo} onChange={e=>setFormMov(f=>({...f,tipo:e.target.value}))}>
                <option value="entrada">📥 Entrada</option>
                <option value="salida">📤 Salida</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Cantidad ({item.unidad})</label>
              <input className="form-input" type="number" step="0.01" value={formMov.cantidad} onChange={e=>setFormMov(f=>({...f,cantidad:e.target.value}))}/>
            </div>
            <div className="form-group"><label className="form-label">Fecha</label>
              <input className="form-input" type="date" value={formMov.fecha} onChange={e=>setFormMov(f=>({...f,fecha:e.target.value}))}/>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Concepto</label>
            <input className="form-input" value={formMov.concepto} onChange={e=>setFormMov(f=>({...f,concepto:e.target.value}))} placeholder="Ej. Compra, Aplicación, Ajuste..."/>
          </div>
        </Modal>}
      </div>
    );
  }

  return null;
}
