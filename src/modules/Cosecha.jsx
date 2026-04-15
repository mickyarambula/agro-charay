// ─── modules/Cosecha.jsx ───────────────────────────────────────────

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


export default function CosechaModule({ userRol, puedeEditar }) {
  const { state, dispatch } = useData();
  const isMobile = useIsMobile();
  const hoy = new Date().toISOString().split("T")[0];
  const productores  = state.productores || [];
  const cicloPred    = (state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.predeterminado)||(state.ciclos||[])[0];
  const asigsCiclo   = cicloPred?.asignaciones || [];

  const [vista, setVista]             = useState("resumen");
  const [importLog, setImportLog]     = useState([]);
  const [importando, setImportando]   = useState(false);
  const fileRef = useRef(null);
  // Modales costos cosecha
  const [modalCuad, setModalCuad] = useState(false);
  const [modalFlete, setModalFlete] = useState(false);
  const [modalMaquila, setModalMaquila] = useState(false);
  const [modalSecado, setModalSecado] = useState(false);
  const emptyCuad    = { fecha:hoy, ha:0, precioHa:0, concepto:"Cuadrilla cosecha", notas:"" };
  const emptyFlete   = { fecha:hoy, toneladas:0, precioTon:0, concepto:"Flete", notas:"" };
  const emptyMaquila = { fecha:hoy, ha:0, precioHa:0, concepto:"Maquila", notas:"" };
  const emptySecado  = { fecha:hoy, toneladas:0, costoTon:0, concepto:"Secado/Almacén", notas:"" };
  const [formCuad,    setFormCuad]    = useState(emptyCuad);
  const [formFlete,   setFormFlete]   = useState(emptyFlete);
  const [formMaquila, setFormMaquila] = useState(emptyMaquila);
  const [formSecado,  setFormSecado]  = useState(emptySecado);

  const mxnFmt = n => (parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2});
  const numFmt = (n,dec=2) => (parseFloat(n)||0).toLocaleString("es-MX",{minimumFractionDigits:dec,maximumFractionDigits:dec});

  const boletas    = state.cosecha?.boletas    || [];
  const cuadrillas = state.cosecha?.cuadrillas || [];
  const fletes     = state.cosecha?.fletes     || [];
  const maquila    = state.cosecha?.maquila    || [];
  const secado     = state.cosecha?.secado     || [];

  const haProd = id => asigsCiclo.filter(a=>String(a.productorId)===String(id)).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
  const nomProd = id => {
    if (!id) return "—";
    const p = productores.find(x=>x.id===parseInt(id)||x.id===id);
    return p ? (p.alias||p.apPat) : String(id);
  };

  const boletasActivas = boletas.filter(b=>!b.cancelado);
  const totalKgBruto   = boletasActivas.reduce((s,b)=>s+(parseFloat(b.bruto)||0),0);
  const totalKgPNA     = boletasActivas.reduce((s,b)=>s+(parseFloat(b.pna)||0),0);
  const totalTonPNA    = totalKgPNA / 1000;
  const humProm        = boletasActivas.length>0 ? boletasActivas.reduce((s,b)=>s+(parseFloat(b.hum)||0),0)/boletasActivas.length : 0;
  const precioVenta    = getParamsCultivo(state).precio;
  const ingresoEst     = totalTonPNA * precioVenta;
  const haTotales      = asigsCiclo.reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
  const rendReal       = haTotales>0 ? totalTonPNA/haTotales : 0;

  // Costos de cosecha
  const costoCuad    = cuadrillas.reduce((s,c)=>s+(parseFloat(c.ha)||0)*(parseFloat(c.precioHa)||0),0);
  const costoFletes  = fletes.reduce((s,f)=>s+(parseFloat(f.toneladas)||0)*(parseFloat(f.precioTon)||0),0);
  const costoMaquila = maquila.reduce((s,m)=>s+(parseFloat(m.ha)||0)*(parseFloat(m.precioHa)||0),0);
  const costoSecado  = secado.reduce((s,s2)=>s+(parseFloat(s2.toneladas)||0)*(parseFloat(s2.costoTon)||0),0);
  const costoCosechaTotal = costoCuad + costoFletes + costoMaquila + costoSecado;

  const resumenProd = productores.map(p=>{
    const bols = boletasActivas.filter(b=>String(b.productorId)===String(p.id));
    const kgPNA = bols.reduce((s,b)=>s+(parseFloat(b.pna)||0),0);
    const tonPNA= kgPNA/1000;
    const ha    = haProd(p.id);
    return { ...p, bols:bols.length, kgPNA, tonPNA, ha, rend:ha>0?tonPNA/ha:0, ingreso:tonPNA*precioVenta };
  }).filter(p=>p.bols>0||haProd(p.id)>0);

  const cargarXLSX = () => new Promise((res,rej)=>{
    if(window.XLSX){res(window.XLSX);return;}
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload=()=>res(window.XLSX); s.onerror=()=>rej(new Error("No se pudo cargar XLSX"));
    document.head.appendChild(s);
  });

  const importarExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportando(true);
    setImportLog(["⏳ Procesando..."]);
    try {
      const XLSX = await cargarXLSX();
      const ab   = await file.arrayBuffer();
      const wb   = XLSX.read(new Uint8Array(ab),{type:"array",cellDates:true});
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const allRows = XLSX.utils.sheet_to_json(ws,{defval:"",raw:false,header:1});

      // Detectar fila de encabezados
      let headerIdx = allRows.findIndex(r=>r.some(c=>String(c).toUpperCase().trim()==="BOLETA"));
      if(headerIdx===-1) headerIdx=0;
      const headers = allRows[headerIdx].map(h=>String(h||"").trim().toUpperCase());
      const dataRows = allRows.slice(headerIdx+1).map(row=>{
        const obj={};
        headers.forEach((h,i)=>{obj[h]=row[i]!==undefined?String(row[i]).trim():"";});
        return obj;
      }).filter(r=>r["BOLETA"]&&r["BOLETA"]!=="");

      const logs = [`📋 Columnas: ${headers.filter(h=>h).join(" | ")}`];
      const nuevas = [];
      let sinProd = 0;

      dataRows.forEach((row,i)=>{
        const boleta   = row["BOLETA"]||"";
        const fecha    = row["FECHA"]||"";
        const codigo   = row["CODIGO"]||"";
        const prodNom  = row["PRODUCTOR"]||"";
        // Limpiar comas de miles antes de parsear (ej: "35,760" → 35760)
        const limpiarNum = v => parseFloat(String(v||"").replace(/,/g,""))||0;
        const bruto    = limpiarNum(row["BRUTO"]);
        const tara     = limpiarNum(row["TARA"]);
        const pnsa     = limpiarNum(row["PNSA"]);
        const pna      = limpiarNum(row["PNA"]);
        const chofer   = row["CHOFER"]||"";
        const camion   = row["CAMION"]||"";
        const placas   = row["PLACAS"]||"";
        const hum      = limpiarNum(row["HUM"]);

        // Buscar productor
        const prodMatch = productores.find(p=>{
          const nom   = `${p.apPat||""} ${p.apMat||""} ${p.nombres||""}`.toUpperCase().trim();
          const alias = (p.alias||"").toUpperCase().trim();
          const pNom  = prodNom.toUpperCase().trim();
          return nom===pNom || alias===pNom ||
            (p.apPat && pNom.startsWith(p.apPat.toUpperCase())) ||
            nom.split(" ").some(w=>w.length>3&&pNom.includes(w));
        });
        if(!prodMatch) sinProd++;

        nuevas.push({
          id: Date.now()+i,
          boleta, fecha, codigo,
          productorId:   prodMatch?.id||null,
          productorNombre: prodNom,
          cultivo:       row["CULTIVO"]||"MAIZ",
          bruto, tara, pnsa, pna,
          chofer, camion, placas, hum,
          cancelado: false,
        });
      });

      dispatch({type:"IMPORT_BOLETAS", payload: nuevas});
      logs.push(`✅ ${nuevas.length} boletas importadas`);
      logs.push(`🌽 ${(nuevas.reduce((s,b)=>s+(b.pna||0),0)/1000).toFixed(2)} toneladas (PNA)`);
      if(sinProd>0) logs.push(`⚠️ ${sinProd} boletas sin productor identificado`);
      setImportLog(logs);
    } catch(err) {
      setImportLog([`❌ Error: ${err.message}`]);
    }
    setImportando(false);
  };

  // ─── VISTA RESUMEN ──────────────────────────────────────────────────────────
  if (vista==="resumen") return (
    <div>
      <div className="stat-grid" style={{gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",marginBottom:20}}>
        <div className="stat-card green">
          <div className="stat-icon">🌽</div>
          <div className="stat-label">Producción Total (PNA)</div>
          <div className="stat-value">{numFmt(totalTonPNA,2)}<span className="stat-unit"> ton</span></div>
          <div className="stat-sub">{boletas.length} boletas · {numFmt(totalKgPNA,0)} kg</div>
        </div>
        <div className="stat-card gold">
          <div className="stat-icon">📊</div>
          <div className="stat-label">Rendimiento Real</div>
          <div className="stat-value">{numFmt(rendReal,2)}<span className="stat-unit"> t/ha</span></div>
          <div className="stat-sub">Sobre {numFmt(haTotales,2)} ha</div>
        </div>
        <div className="stat-card sky">
          <div className="stat-icon">💧</div>
          <div className="stat-label">Humedad Promedio</div>
          <div className="stat-value">{numFmt(humProm,1)}<span className="stat-unit">%</span></div>
          <div className="stat-sub">Prom. ponderado</div>
        </div>
        <div className="stat-card rust">
          <div className="stat-icon">💵</div>
          <div className="stat-label">Ingreso Estimado</div>
          <div className="stat-value" style={{fontSize:16}}>{mxnFmt(ingresoEst)}</div>
          <div className="stat-sub">{mxnFmt(precioVenta)}/ton</div>
        </div>
      </div>

      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <button className="btn btn-primary"   onClick={()=>setVista("import")}>📥 Importar Excel Boletas</button>
        <button className="btn btn-secondary" onClick={()=>setVista("boletas")}>📋 Ver Boletas ({boletas.length})</button>
      </div>

      {/* Resumen por productor */}
      {boletas.length > 0 && (
        <div className="card">
          <div className="card-header"><div className="card-title">Producción por Productor</div></div>
          <div className="table-wrap-scroll">
            <table style={{minWidth:700}}>
              <thead><tr>
                <th>Productor</th>
                <th style={{textAlign:"right"}}>Ha</th>
                <th style={{textAlign:"right"}}>Boletas</th>
                <th style={{textAlign:"right"}}>Ton (PNA)</th>
                <th style={{textAlign:"right"}}>Rend. (t/ha)</th>
                <th style={{textAlign:"right"}}>Hum. Prom.</th>
                <th style={{textAlign:"right"}}>Ingreso Est.</th>
              </tr></thead>
              <tbody>
                {resumenProd.map((p,i)=>{
                  const humP = boletasActivas.filter(b=>String(b.productorId)===String(p.id)).length>0
                    ? boletasActivas.filter(b=>String(b.productorId)===String(p.id)).reduce((s,b)=>s+(parseFloat(b.hum)||0),0)/boletasActivas.filter(b=>String(b.productorId)===String(p.id)).length
                    : 0;
                  const bg = i%2===0?"white":"#faf8f3";
                  return (
                    <tr key={p.id}>
                      <td style={{background:bg}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:p.color}}/>
                          <span style={{fontWeight:600,fontSize:13}}>{p.alias||p.apPat}</span>
                        </div>
                      </td>
                      <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{p.ha>0?numFmt(p.ha,2):"—"}</td>
                      <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{p.bols>0?p.bols:"—"}</td>
                      <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,fontSize:12,color:"#2d5a1b"}}>{p.tonPNA>0?numFmt(p.tonPNA,3):"—"}</td>
                      <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,color:p.rend>=(state.rendimientoEsperado||9.1)?T.field:T.straw}}>{p.ha>0&&p.tonPNA>0?numFmt(p.rend,2):"—"}</td>
                      <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,color:humP>14?"#c0392b":"#2d5a1b"}}>{humP>0?numFmt(humP,1)+"%":"—"}</td>
                      <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,fontSize:12,color:"#c0392b"}}>{p.tonPNA>0?mxnFmt(p.ingreso):"—"}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{background:"#f0f4e8",fontWeight:700}}>
                  <td>TOTAL</td>
                  <td style={{textAlign:"right",fontFamily:"monospace"}}>{numFmt(haTotales,2)}</td>
                  <td style={{textAlign:"right",fontFamily:"monospace"}}>{boletas.length}</td>
                  <td style={{textAlign:"right",fontFamily:"monospace",color:"#2d5a1b"}}>{numFmt(totalTonPNA,3)}</td>
                  <td style={{textAlign:"right",fontFamily:"monospace"}}>{numFmt(rendReal,2)}</td>
                  <td style={{textAlign:"right",fontFamily:"monospace"}}>{numFmt(humProm,1)}%</td>
                  <td style={{textAlign:"right",fontFamily:"monospace",color:"#c0392b"}}>{mxnFmt(ingresoEst)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {boletas.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🌽</div>
          <div className="empty-title">Sin boletas registradas</div>
          <div className="empty-sub">Importa el archivo Excel de boletas cuando inicie la cosecha</div>
          <button className="btn btn-primary" style={{marginTop:12}} onClick={()=>setVista("import")}>📥 Importar Excel</button>
        </div>
      )}

      {/* ── Costos de cosecha ── */}
      <div className="card" style={{marginTop:16}}>
        <div className="card-header">
          <div className="card-title">💸 Costos de Cosecha</div>
          <div style={{fontSize:12,fontFamily:"monospace",fontWeight:700,color:"#c0392b"}}>{mxnFmt(costoCosechaTotal)}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:0}}>
          {[
            {label:"🚜 Cuadrillas",  items:cuadrillas, costo:costoCuad,    unit:"ha", onClick:()=>setModalCuad(true),    type:"cuad"},
            {label:"🚛 Fletes",      items:fletes,     costo:costoFletes,  unit:"ton",onClick:()=>setModalFlete(true),   type:"flete"},
            {label:"⚙️ Maquila",    items:maquila,    costo:costoMaquila, unit:"ha", onClick:()=>setModalMaquila(true), type:"maquila"},
            {label:"🌡 Secado",      items:secado,     costo:costoSecado,  unit:"ton",onClick:()=>setModalSecado(true),  type:"secado"},
          ].map(({label,items,costo,unit,onClick,type},idx)=>(
            <div key={type} style={{padding:"14px 16px",borderRight:idx%2===0?`1px solid ${T.line}`:"none",
              borderBottom:`1px solid ${T.line}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontWeight:600,fontSize:13}}>{label}</span>
                {puedeEditar&&<button className="btn btn-sm btn-secondary" onClick={onClick}>＋ Agregar</button>}
              </div>
              <div style={{fontFamily:"monospace",fontWeight:700,fontSize:16,color:"#c0392b"}}>{mxnFmt(costo)}</div>
              <div style={{fontSize:11,color:T.fog,marginTop:2}}>{items.length} registro{items.length!==1?"s":""}</div>
              {items.length>0&&(
                <div style={{marginTop:8}}>
                  {items.slice(0,3).map((item,i)=>(
                    <div key={item.id||i} style={{display:"flex",justifyContent:"space-between",
                      fontSize:11,color:T.fog,padding:"2px 0",borderTop:`1px solid ${T.line}`}}>
                      <span>{item.concepto||item.fecha}</span>
                      <span style={{fontFamily:"monospace",color:"#c0392b"}}>
                        {mxnFmt(unit==="ha"?(parseFloat(item.ha)||0)*(parseFloat(item.precioHa)||0):(parseFloat(item.toneladas)||0)*(parseFloat(item.precioTon||item.costoTon)||0))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modales costos cosecha */}
      {modalCuad&&<Modal title="🚜 Agregar Cuadrilla" onClose={()=>setModalCuad(false)}
        footer={<><button className="btn btn-secondary" onClick={()=>setModalCuad(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={()=>{
            if(!formCuad.ha||!formCuad.precioHa) return;
            dispatch({type:"ADD_CUADRILLA",payload:{...formCuad,ha:parseFloat(formCuad.ha),precioHa:parseFloat(formCuad.precioHa)}});
            setModalCuad(false); setFormCuad(emptyCuad);
          }}>💾 Guardar</button></>}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Fecha</label>
            <input className="form-input" type="date" value={formCuad.fecha} onChange={e=>setFormCuad(f=>({...f,fecha:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Concepto</label>
            <input className="form-input" value={formCuad.concepto} onChange={e=>setFormCuad(f=>({...f,concepto:e.target.value}))}/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Hectáreas</label>
            <input className="form-input" type="number" value={formCuad.ha} onChange={e=>setFormCuad(f=>({...f,ha:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Precio por ha ($)</label>
            <input className="form-input" type="number" value={formCuad.precioHa} onChange={e=>setFormCuad(f=>({...f,precioHa:e.target.value}))}/></div>
        </div>
        <div style={{padding:"8px 12px",background:"#f0f7ec",borderRadius:6,fontSize:12,color:"#2d5a1b",fontWeight:700}}>
          Total: {mxnFmt((parseFloat(formCuad.ha)||0)*(parseFloat(formCuad.precioHa)||0))}
        </div>
      </Modal>}

      {modalFlete&&<Modal title="🚛 Agregar Flete" onClose={()=>setModalFlete(false)}
        footer={<><button className="btn btn-secondary" onClick={()=>setModalFlete(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={()=>{
            if(!formFlete.toneladas||!formFlete.precioTon) return;
            dispatch({type:"ADD_FLETE",payload:{...formFlete,toneladas:parseFloat(formFlete.toneladas),precioTon:parseFloat(formFlete.precioTon)}});
            setModalFlete(false); setFormFlete(emptyFlete);
          }}>💾 Guardar</button></>}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Fecha</label>
            <input className="form-input" type="date" value={formFlete.fecha} onChange={e=>setFormFlete(f=>({...f,fecha:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Concepto</label>
            <input className="form-input" value={formFlete.concepto} onChange={e=>setFormFlete(f=>({...f,concepto:e.target.value}))}/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Toneladas</label>
            <input className="form-input" type="number" value={formFlete.toneladas} onChange={e=>setFormFlete(f=>({...f,toneladas:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Precio por ton ($)</label>
            <input className="form-input" type="number" value={formFlete.precioTon} onChange={e=>setFormFlete(f=>({...f,precioTon:e.target.value}))}/></div>
        </div>
        <div style={{padding:"8px 12px",background:"#f0f7ec",borderRadius:6,fontSize:12,color:"#2d5a1b",fontWeight:700}}>
          Total: {mxnFmt((parseFloat(formFlete.toneladas)||0)*(parseFloat(formFlete.precioTon)||0))}
        </div>
      </Modal>}

      {modalMaquila&&<Modal title="⚙️ Agregar Maquila" onClose={()=>setModalMaquila(false)}
        footer={<><button className="btn btn-secondary" onClick={()=>setModalMaquila(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={()=>{
            if(!formMaquila.ha||!formMaquila.precioHa) return;
            dispatch({type:"ADD_MAQUILA",payload:{...formMaquila,ha:parseFloat(formMaquila.ha),precioHa:parseFloat(formMaquila.precioHa)}});
            setModalMaquila(false); setFormMaquila(emptyMaquila);
          }}>💾 Guardar</button></>}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Fecha</label>
            <input className="form-input" type="date" value={formMaquila.fecha} onChange={e=>setFormMaquila(f=>({...f,fecha:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Concepto</label>
            <input className="form-input" value={formMaquila.concepto} onChange={e=>setFormMaquila(f=>({...f,concepto:e.target.value}))}/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Hectáreas</label>
            <input className="form-input" type="number" value={formMaquila.ha} onChange={e=>setFormMaquila(f=>({...f,ha:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Precio por ha ($)</label>
            <input className="form-input" type="number" value={formMaquila.precioHa} onChange={e=>setFormMaquila(f=>({...f,precioHa:e.target.value}))}/></div>
        </div>
        <div style={{padding:"8px 12px",background:"#f0f7ec",borderRadius:6,fontSize:12,color:"#2d5a1b",fontWeight:700}}>
          Total: {mxnFmt((parseFloat(formMaquila.ha)||0)*(parseFloat(formMaquila.precioHa)||0))}
        </div>
      </Modal>}

      {modalSecado&&<Modal title="🌡 Agregar Secado/Almacén" onClose={()=>setModalSecado(false)}
        footer={<><button className="btn btn-secondary" onClick={()=>setModalSecado(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={()=>{
            if(!formSecado.toneladas||!formSecado.costoTon) return;
            dispatch({type:"ADD_SECADO",payload:{...formSecado,toneladas:parseFloat(formSecado.toneladas),costoTon:parseFloat(formSecado.costoTon)}});
            setModalSecado(false); setFormSecado(emptySecado);
          }}>💾 Guardar</button></>}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Fecha</label>
            <input className="form-input" type="date" value={formSecado.fecha} onChange={e=>setFormSecado(f=>({...f,fecha:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Concepto</label>
            <input className="form-input" value={formSecado.concepto} onChange={e=>setFormSecado(f=>({...f,concepto:e.target.value}))}/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Toneladas</label>
            <input className="form-input" type="number" value={formSecado.toneladas} onChange={e=>setFormSecado(f=>({...f,toneladas:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Costo por ton ($)</label>
            <input className="form-input" type="number" value={formSecado.costoTon} onChange={e=>setFormSecado(f=>({...f,costoTon:e.target.value}))}/></div>
        </div>
        <div style={{padding:"8px 12px",background:"#f0f7ec",borderRadius:6,fontSize:12,color:"#2d5a1b",fontWeight:700}}>
          Total: {mxnFmt((parseFloat(formSecado.toneladas)||0)*(parseFloat(formSecado.costoTon)||0))}
        </div>
      </Modal>}
    </div>
  );

  // ─── VISTA BOLETAS ──────────────────────────────────────────────────────────
  if (vista==="boletas") return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <button className="btn btn-secondary" onClick={()=>setVista("resumen")}>← Volver</button>
        <div style={{fontFamily:"Georgia, serif",fontSize:18,fontWeight:700,flex:1}}>
          Boletas de Cosecha ({boletas.length})
        </div>
        <button className="btn btn-primary" onClick={()=>setVista("import")}>📥 Importar más</button>
      </div>
      {isMobile ? (
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
          {[...boletas].sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))).map(b=>{
            const opaco = b.cancelado?{opacity:0.55}:{};
            const ton = (parseFloat(b.pna)||0)/1000;
            return (
              <div key={b.id} style={{
                background:"#ffffff",
                border:"1px solid #e5e7eb",
                borderLeft:"4px solid #15803D",
                borderRadius:12,
                padding:14,
                boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
                ...opaco,
              }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:6}}>
                  <div style={{fontSize:18,fontWeight:700,color:"#14532D",fontFamily:"monospace"}}>#{b.boleta}</div>
                  <div style={{fontSize:12,color:"#6b7280"}}>{b.fecha}</div>
                </div>
                <div style={{fontSize:13,color:"#374151",marginBottom:6}}>
                  👤 <strong>{nomProd(b.productorId)||b.productorNombre||"—"}</strong>
                </div>
                <div style={{fontSize:20,fontWeight:700,color:"#15803D",marginBottom:4}}>
                  {ton.toFixed(3)} <span style={{fontSize:13,fontWeight:500,color:"#6b7280"}}>ton</span>
                </div>
                <div style={{display:"flex",gap:14,flexWrap:"wrap",fontSize:12,color:"#6b7280"}}>
                  <span>Hum: <strong style={{color:parseFloat(b.hum)>14?"#c0392b":"#14532D"}}>{b.hum}%</strong></span>
                  {b.chofer && <span>🚚 {b.chofer}</span>}
                </div>
                {b.cancelado && <div style={{marginTop:6,fontSize:11,color:"#991b1b",fontWeight:600}}>🚫 Cancelada</div>}
              </div>
            );
          })}
          {boletas.length===0 && (
            <div style={{textAlign:"center",padding:32,color:"#8a8070",fontSize:14}}>Sin boletas</div>
          )}
        </div>
      ) : (
      <div className="card">
        <div className="table-wrap-scroll">
          <table style={{minWidth:900}}>
            <thead><tr>
              <th>Boleta</th><th>Fecha</th><th>Cód.</th><th>Productor</th>
              <th style={{textAlign:"right"}}>Bruto kg</th>
              <th style={{textAlign:"right"}}>Tara kg</th>
              <th style={{textAlign:"right"}}>PNSA kg</th>
              <th style={{textAlign:"right",fontWeight:700}}>PNA kg</th>
              <th style={{textAlign:"right"}}>PNA ton</th>
              <th style={{textAlign:"right"}}>Hum%</th>
              <th>Chofer</th><th>Camión</th><th>Placas</th>
              <th></th>
            </tr></thead>
            <tbody>
              {[...boletas].sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))).map((b,i)=>{
                const bg = b.cancelado?"#fff0f0":i%2===0?"white":"#faf8f3";
                const st = b.cancelado?{opacity:0.55,textDecoration:"line-through"}:{};
                return (
                  <tr key={b.id}>
                    <td style={{background:bg,fontFamily:"monospace",fontWeight:700,fontSize:12,...st}}>{b.boleta}</td>
                    <td style={{background:bg,fontSize:11,...st}}>{b.fecha}</td>
                    <td style={{background:bg,fontFamily:"monospace",fontSize:11,...st}}>{b.codigo}</td>
                    <td style={{background:bg,fontWeight:600,fontSize:12,...st}}>{nomProd(b.productorId)||b.productorNombre}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,...st}}>{numFmt(b.bruto,0)}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,...st}}>{numFmt(b.tara,0)}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,...st}}>{numFmt(b.pnsa,0)}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,fontSize:12,color:"#2d5a1b",...st}}>{numFmt(b.pna,0)}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#2d5a1b",...st}}>{(b.pna/1000).toFixed(3)}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,color:parseFloat(b.hum)>14?"#c0392b":"#2d5a1b",...st}}>{b.hum}</td>
                    <td style={{background:bg,fontSize:11,...st}}>{b.chofer}</td>
                    <td style={{background:bg,fontSize:11,...st}}>{b.camion}</td>
                    <td style={{background:bg,fontSize:11,...st}}>{b.placas}</td>
                    <td style={{background:bg}}>
                      {b.cancelado
                        ? (puedeEditar&&<button className="btn btn-sm btn-secondary" style={{fontSize:10}} onClick={()=>dispatch({type:"REACTIVAR_BOLETA",payload:b.id})}>↺</button>)
                        : (puedeEditar&&<button className="btn btn-sm" style={{fontSize:10,background:"#fff3cd",color:"#856404",border:"1px solid #ffc107"}} onClick={()=>confirmarEliminar("¿Cancelar esta boleta?",()=>dispatch({type:"CANCELAR_BOLETA",payload:b.id}))}>🚫</button>)
                      }
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
  );

  // ─── VISTA IMPORTAR ─────────────────────────────────────────────────────────
  if (vista==="import") return (
    <div style={{maxWidth:680}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <button className="btn btn-secondary" onClick={()=>setVista("resumen")}>← Volver</button>
        <div style={{fontFamily:"Georgia, serif",fontSize:18,fontWeight:700}}>Importar Excel de Boletas</div>
      </div>
      <div className="card" style={{marginBottom:16,borderLeft:"4px solid #2d5a1b"}}>
        <div className="card-body">
          <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:"#2d5a1b"}}>📋 Estructura requerida del archivo Excel</div>
          <div style={{padding:"8px 12px",background:"#f0f4e8",borderRadius:6,fontFamily:"monospace",fontSize:11,marginBottom:10}}>
            BOLETA &nbsp;|&nbsp; FECHA &nbsp;|&nbsp; CODIGO &nbsp;|&nbsp; PRODUCTOR &nbsp;|&nbsp; CULTIVO &nbsp;|&nbsp; BRUTO &nbsp;|&nbsp; TARA &nbsp;|&nbsp; PNSA &nbsp;|&nbsp; PNA &nbsp;|&nbsp; CHOFER &nbsp;|&nbsp; CAMION &nbsp;|&nbsp; PLACAS &nbsp;|&nbsp; ENTRADA &nbsp;|&nbsp; SALIDA &nbsp;|&nbsp; HUM
          </div>
          <div style={{fontSize:11,color:"#5a6a5a",lineHeight:1.8}}>
            <b>PNA</b> (Peso Neto Ajustado) — es el campo definitivo para calcular toneladas.<br/>
            <b>ENTRADA y SALIDA</b> — se importan pero no se muestran ni afectan cálculos.<br/>
            <b>HUM</b> — humedad en %. Se resalta en rojo si supera 14%.<br/>
            El productor se identifica automáticamente por nombre.
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-body" style={{textAlign:"center",padding:32}}>
          <div style={{fontSize:40,marginBottom:12}}>🌽</div>
          <div style={{fontWeight:600,marginBottom:4}}>Selecciona el archivo .xlsx de boletas</div>
          <div style={{fontSize:12,color:"#8a8070",marginBottom:20}}>Formato generado por el sistema de la parafinanciera</div>
          <input type="file" accept=".xlsx,.xls" ref={fileRef} style={{display:"none"}} onChange={importarExcel}/>
          <button className="btn btn-primary" onClick={()=>fileRef.current?.click()} disabled={importando}>
            {importando?"⏳ Procesando...":"📂 Seleccionar archivo"}
          </button>
          {importLog.length>0&&(
            <div style={{marginTop:16,textAlign:"left",padding:"12px 16px",background:"#f5f4f0",borderRadius:8}}>
              {importLog.map((l,i)=>(
                <div key={i} style={{fontSize:12,marginBottom:4,
                  color:l.startsWith("❌")?"#c0392b":l.startsWith("⚠️")?"#e67e22":"#2d5a1b"}}>{l}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return null;
}
