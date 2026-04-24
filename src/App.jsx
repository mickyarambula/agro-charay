import React, { useState, useReducer, createContext, useContext, useCallback, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { loadStateFromSupabase } from "./supabaseLoader.js";
import { upsertParamsCultivo } from "./core/supabaseWriters.js";
import { ROLES, ACCESO, USUARIOS, getRolPermisos, getRolesDisponibles, getRolInfo, getPermisosUsuario } from "./shared/roles.js";
import {
  T, css, confirmarEliminar, puedeEliminarLote, puedeEliminarProductor,
  puedeEliminarMaquina, puedeEliminarOperador, MOTIVOS_CANCELACION,
  CULTIVOS, ESTADOS_FENOL, TIPOS_TRABAJO, CAT_INSUMO, UNIDADES, CAT_GASTO,
  filtrarPorProductor, PROD_COLORES, ordenarProductores, nomCompleto,
  mxnFmt, fmt, today, fenologiaColor, estadoColor
} from "./shared/utils.js";
import {
  Modal, ModalCancelacion, ModalReactivacion, BadgeCancelado,
  BtnExport, NavBadge
} from "./shared/Modal.jsx";
import {
  SUPABASE_URL, SUPABASE_ANON_KEY, SYNC_CHANNEL, SYNC_KEYS, supabaseClient
} from "./core/supabase.js";
import { initState, reducer, Ctx, useData } from "./core/DataContext.jsx";
import {
  calcularInteresCredito, calcularInteresCargosCredito, calcularFinancieros,
  calcularCreditoProd, calcularVencimiento, getParamsCultivo, calcularAlertas,
  exportarExcel, descargarHTML, exportarExcelProductor, generarHTMLProductor,
  generarHTMLTodos, exportarExcelTodos, exportarResumenCiclo, navRowProps, FiltroSelect, PanelAlertas
} from "./shared/helpers.jsx";
import VistaOperador from "./modules/VistaOperador.jsx";
import useAppNavigation from "./core/useAppNavigation.js";
import AppRouter from "./core/AppRouter.jsx";
import ToastContainer from "./components/mobile/Toast.jsx";

// ─── SUPABASE REALTIME SYNC ───────────────────────────────────────────────────
// Canal único para sincronizar en tiempo real entre sesiones conectadas.
// Usa broadcast channels (sin tablas): los cambios se propagan entre clientes
// online. Si no hay Supabase disponible el resto de la app sigue funcionando
// contra localStorage como siempre.

// ─── ROLES Y USUARIOS ─────────────────────────────────────────────────────────
// ROLES, ACCESO, USUARIOS → movidos a ./shared/roles.js

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
// ─── CONFIRMACIÓN DE ELIMINACIÓN ─────────────────────────────────────────────
// [removed: confirmarEliminar → imported from shared/core]

// ─── HELPERS DE PROTECCIÓN — validación antes de eliminar ─────────────────────

// Verifica si un lote puede eliminarse
// [removed: puedeEliminarLote → imported from shared/core]

// Verifica si un productor puede eliminarse
// [removed: puedeEliminarProductor → imported from shared/core]

// Verifica si una máquina puede eliminarse
// [removed: puedeEliminarMaquina → imported from shared/core]

// Verifica si un operador puede eliminarse
// [removed: puedeEliminarOperador → imported from shared/core]

// ─── MODAL DE CANCELACIÓN ─────────────────────────────────────────────────────
// [removed: MOTIVOS_CANCELACION → imported from shared/core]

// [removed: ModalCancelacion → imported from shared/core]

// ─── MODAL DE REACTIVACIÓN ────────────────────────────────────────────────────
// [removed: ModalReactivacion → imported from shared/core]

// ─── BADGE CANCELADO ──────────────────────────────────────────────────────────
// [removed: BadgeCancelado → imported from shared/core]

function LoginScreen({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const inputUser = user.trim().toLowerCase();
    const baseOvr = window.__agroBaseOverrides || {};
    const todosU = [...USUARIOS.map(u => baseOvr[u.id] ? {...u,...baseOvr[u.id]} : u), ...(window.__agroExtraUsers||[])];

    let passwordValida = false;
    let usuarioEncontrado = null;

    // 1) Verificar directo en Supabase (fuente de verdad para contraseñas actualizadas)
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?usuario=eq.${encodeURIComponent(inputUser)}&select=usuario,password`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const dbUsers = await res.json();
      if (Array.isArray(dbUsers) && dbUsers.length > 0 && dbUsers[0].password === pass) {
        passwordValida = true;
        usuarioEncontrado = todosU.find(x => x.usuario === inputUser) || { ...dbUsers[0], id: Date.now(), rol: dbUsers[0].rol || 'campo' };
      }
    } catch (e) {
      console.warn('Supabase login check failed, using local fallback:', e);
    }

    // 2) Fallback: contraseña hardcoded si Supabase no respondió o no matcheó
    if (!passwordValida) {
      const localMatch = todosU.find(u => u.usuario === inputUser && u.password === pass && u.activo !== false);
      if (localMatch) { passwordValida = true; usuarioEncontrado = localMatch; }
    }

    if (passwordValida && usuarioEncontrado) { setError(''); onLogin(usuarioEncontrado); }
    else { setError('Usuario o contraseña incorrectos'); setLoading(false); }
  };

  return (
    <div style={{
      minHeight:"100vh",
      background:"#1a3a0f",
      display:"flex",
      alignItems:"center",
      justifyContent:"center",
      padding:"20px",
      fontFamily:"system-ui, -apple-system, sans-serif",
    }}>
      <div style={{
        background:"#ffffff",
        borderRadius:16,
        padding:32,
        width:"100%",
        maxWidth:400,
        boxShadow:"0 20px 50px rgba(0,0,0,0.35)",
      }}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:42,marginBottom:6}}>🌽</div>
          <div style={{fontFamily:"Georgia, serif",fontSize:28,fontWeight:400,color:"#1a2e1a",lineHeight:1.1}}>AgroSistema</div>
          <div style={{fontSize:12,color:"#b0a090",marginTop:6,letterSpacing:0.3}}>Almacenes Santa Rosa · Charay</div>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:11,fontWeight:600,color:"#b0a090",display:"block",marginBottom:6,letterSpacing:0.8,textTransform:"uppercase"}}>Usuario</label>
          <input
            value={user} onChange={e=>setUser(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleLogin()}
            placeholder="admin / socio / encargado"
            style={{width:"100%",padding:12,border:"1px solid #ede5d8",borderRadius:8,fontSize:15,outline:"none",boxSizing:"border-box",transition:"border 0.15s",background:"#ffffff",color:"#1a2e1a"}}
            onFocus={e=>e.target.style.borderColor="#1a3a0f"}
            onBlur={e=>e.target.style.borderColor="#ede5d8"}
          />
        </div>
        <div style={{marginBottom:20}}>
          <label style={{fontSize:11,fontWeight:600,color:"#b0a090",display:"block",marginBottom:6,letterSpacing:0.8,textTransform:"uppercase"}}>Contraseña</label>
          <input
            type="password" value={pass} onChange={e=>setPass(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleLogin()}
            placeholder="••••••••"
            style={{width:"100%",padding:12,border:"1px solid #ede5d8",borderRadius:8,fontSize:15,outline:"none",boxSizing:"border-box",background:"#ffffff",color:"#1a2e1a"}}
            onFocus={e=>e.target.style.borderColor="#1a3a0f"}
            onBlur={e=>e.target.style.borderColor="#ede5d8"}
          />
        </div>

        {error && <div style={{background:"#fdf0ef",border:"1px solid #e74c3c",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#c0392b",marginBottom:14}}>{error}</div>}

        <button onClick={handleLogin} disabled={loading}
          onMouseOver={e=>{if(!loading)e.currentTarget.style.background="#2d5a1b";}}
          onMouseOut={e=>{if(!loading)e.currentTarget.style.background="#1a3a0f";}}
          style={{width:"100%",padding:14,background:loading?"#4a7c3f":"#1a3a0f",color:"#ffffff",border:"none",borderRadius:8,fontSize:15,fontFamily:"Georgia, serif",fontWeight:400,cursor:loading?"wait":"pointer",transition:"background 0.15s",minHeight:48}}>
          {loading ? "Verificando..." : "Ingresar →"}
        </button>

        <div style={{marginTop:20,padding:12,background:"#f8f6f2",borderRadius:8,fontSize:12,color:"#b0a090"}}>
          <div style={{fontWeight:600,marginBottom:6,color:"#1a2e1a"}}>Perfiles disponibles:</div>
          {Object.entries(ROLES).map(([k,r])=>(
            <div key={k} style={{marginTop:3}}>{r.icon} <strong style={{color:"#1a2e1a"}}>{k}</strong> — {r.label}</div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ─── FONTS ────────────────────────────────────────────────────────────────────
// [removed: fontLink → imported from shared/core]

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
// [removed: T palette → imported from shared/core]

// [removed: css template → imported from shared/core]

// ─── INJECT STYLES ─────────────────────────────────────────────────────────
// [removed: styleEl → imported from shared/core]

// ─── ERROR BOUNDARY GLOBAL ────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) {
    try {
      fetch(`${SUPABASE_URL}/rest/v1/error_logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          usuario: 'desconocido', dispositivo: navigator.userAgent, pagina: window.location.href,
          error_mensaje: error?.message || String(error),
          error_stack: (errorInfo?.componentStack || '').slice(0, 2000),
          contexto: { timestamp: new Date().toISOString() },
        }),
      }).catch(() => {});
    } catch {}
  }
  render() {
    if (this.state.hasError) return (
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100vh',padding:32,background:'#f8f6f2',textAlign:'center'}}>
        <div style={{fontSize:48,marginBottom:16}}>⚠️</div>
        <div style={{fontSize:20,fontWeight:500,color:'#1a2e1a',marginBottom:8}}>Algo salió mal</div>
        <div style={{fontSize:14,color:'#8a8070',marginBottom:24,maxWidth:400}}>El error fue reportado automáticamente. Por favor recarga la página.</div>
        <button onClick={()=>window.location.reload()} style={{background:'#1a3a0f',color:'#e8f5e2',border:'none',borderRadius:8,padding:'10px 24px',fontSize:14,cursor:'pointer'}}>Recargar página</button>
        <div style={{fontSize:11,color:'#b0a090',marginTop:12}}>Error: {this.state.error?.message}</div>
      </div>
    );
    return this.props.children;
  }
}

// ─── MERCADO GLOBAL — CBOT Maíz precio en tiempo real ────────────────────────
const _mercadoState = {
  cbot:null,tc:null,precioMXN:null,precioUSD:null,usdTon:null,
  fechaCBOT:null,fechaTC:null,ultimaAct:null,fechaCaptura:null,
};
const _mercadoListeners = new Set();
function _setMercado(patch){Object.assign(_mercadoState,patch);_mercadoListeners.forEach(fn=>fn({..._mercadoState}));}
function useMercadoGlobal(){
  const [s,setS]=useState({..._mercadoState});
  useEffect(()=>{_mercadoListeners.add(setS);return()=>_mercadoListeners.delete(setS);},[]);
  return s;
}
function calcPrecioMaiz(cbot,tc,base){
  const c=parseFloat(cbot),t=parseFloat(tc),b=parseFloat(base);
  if(!c||!t)return{};
  const usdTon=(c/100)*39.3683,precioUSD=usdTon+b;
  return{usdTon,precioUSD,precioMXN:precioUSD*t};
}
function aplicarMercado({cbot,tc,base=65,fechaCBOT,fechaTC}){
  const calc=calcPrecioMaiz(cbot??_mercadoState.cbot,tc??_mercadoState.tc,base);
  _setMercado({
    cbot:cbot!=null?parseFloat(cbot):_mercadoState.cbot,
    tc:tc!=null?parseFloat(tc):_mercadoState.tc,
    fechaCBOT:fechaCBOT??_mercadoState.fechaCBOT,
    fechaTC:fechaTC??_mercadoState.fechaTC,
    ultimaAct:new Date().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"}),
    fechaCaptura:new Date().toISOString().split('T')[0],
    ...calc,
  });
}
const BASE_USD=65;

function WidgetCBOTCompact(){
  const m=useMercadoGlobal();
  const ctx = React.useContext(Ctx);
  const fechaPersistente = ctx?.state?.fechaPrecio;
  const fmt=n=>n!=null?parseFloat(n).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:0,maximumFractionDigits:0}):null;
  const precio=fmt(m.precioMXN);
  const fechaRef = m.fechaCaptura || fechaPersistente;
  const diasDesdeCaptura = fechaRef ? Math.floor((new Date() - new Date(fechaRef)) / 86400000) : 999;
  const vigencia = diasDesdeCaptura <= 3
    ? { label:'actualizado', color:'#166534', bg:'#dcfce7' }
    : diasDesdeCaptura <= 7
    ? { label:`hace ${diasDesdeCaptura}d`, color:'#92400e', bg:'#fef3c7' }
    : { label:'desactualizado', color:'#991b1b', bg:'#fee2e2' };
  return(
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"4px 14px",borderRadius:20,
      background:precio?"rgba(45,90,27,0.10)":"rgba(200,168,75,0.12)",
      border:`1px solid ${precio?"rgba(45,90,27,0.22)":"rgba(200,168,75,0.35)"}`,
      cursor:"default",userSelect:"none",fontSize:12}}
      title={precio?`CBOT:${m.cbot} c/bu · TC:${m.tc?.toFixed(4)} · Base:+65 USD/ton · Act:${m.ultimaAct}`:"Captura CBOT y TC en el Dashboard"}>
      <span style={{fontSize:15}}>🌽</span>
      {precio?(
        <>
          <div style={{display:"flex",flexDirection:"column",lineHeight:1.25}}>
            <span style={{fontSize:9,color:"#8a8070",letterSpacing:"0.06em",textTransform:"uppercase"}}>Maíz CBOT</span>
            <span style={{fontFamily:"monospace",fontWeight:700,fontSize:13,color:"#2d5a1b"}}>{precio}<span style={{fontSize:9,fontWeight:400,color:"#8a8070"}}>/ton</span></span>
          </div>
          {fechaRef && (
            <span style={{fontSize:8,padding:'2px 6px',borderRadius:10,background:vigencia.bg,color:vigencia.color,fontWeight:600,letterSpacing:0.3}}>
              {vigencia.label}
            </span>
          )}
          <div style={{width:1,height:26,background:"#ddd5c0"}}/>
          <div style={{display:"flex",flexDirection:"column",lineHeight:1.25}}>
            <span style={{fontSize:9,color:"#8a8070"}}>TC</span>
            <span style={{fontFamily:"monospace",fontSize:11,fontWeight:600,color:"#1e1a14"}}>{m.tc?.toFixed(3)}</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",lineHeight:1.25}}>
            <span style={{fontSize:9,color:"#8a8070"}}>CBOT</span>
            <span style={{fontFamily:"monospace",fontSize:11,fontWeight:600,color:"#e67e22"}}>{m.cbot}<span style={{fontSize:9,color:"#8a8070"}}> c/bu</span></span>
          </div>
        </>
      ):<span style={{fontSize:11,color:"#c8a84b",fontWeight:600}}>Capturar precio →</span>}
    </div>
  );
}

export function WidgetCBOTDashboard(){
  const m=useMercadoGlobal();
  const ctx = React.useContext(Ctx);
  const dispatch = ctx?.dispatch;
  const stateCtx = ctx?.state;
  const [abierto,setAbierto]=useState(!m.precioMXN);
  const [inCBOT,setInCBOT]=useState("");
  const [inTC,setInTC]=useState("");
  const [errCBOT,setErrCBOT]=useState(false);
  const [errTC,setErrTC]=useState(false);
  const mxnFmt=n=>parseFloat(n).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2});
  const persistirPrecio = () => {
    if (!dispatch || !_mercadoState.precioMXN) return;
    const pcp = getParamsCultivo(stateCtx || {});
    const payload = {
      key: pcp.key || '1|global',
      precio: _mercadoState.precioMXN,
      rendimiento: pcp.rendimiento || 10,
      fechaPrecio: new Date().toISOString().split('T')[0],
    };
    dispatch({ type:'UPD_PARAMS_CULTIVO', payload });
    upsertParamsCultivo(payload.key, { precio: payload.precio, rendimiento: payload.rendimiento, fechaPrecio: payload.fechaPrecio });
  };
  const apCBOT=v=>{const n=parseFloat(v);if(!n||n<100||n>2000){setErrCBOT(true);return;}setErrCBOT(false);setInCBOT("");aplicarMercado({cbot:n,base:BASE_USD,fechaCBOT:"Manual"});setTimeout(persistirPrecio,100);};
  const apTC=v=>{const n=parseFloat(v);if(!n||n<5||n>50){setErrTC(true);return;}setErrTC(false);setInTC("");aplicarMercado({tc:n,base:BASE_USD,fechaTC:"Manual"});setTimeout(persistirPrecio,100);if(m.cbot)setAbierto(false);};
  const listo=m.precioMXN!=null;
  const inp=(val,setV,err)=>({value:val,onChange:e=>{setV(e.target.value);err&&setErrCBOT(false)&&setErrTC(false);},style:{flex:1,padding:"6px 10px",border:`1.5px solid ${err?"#c0392b":"#ddd5c0"}`,borderRadius:6,fontFamily:"monospace",fontSize:14,fontWeight:700,outline:"none",background:err?"#fff5f5":"white"}});
  return(
    <div style={{marginBottom:16,borderRadius:10,overflow:"hidden",
      border:`1px solid ${listo?"rgba(45,90,27,0.2)":"rgba(200,168,75,0.45)"}`,
      background:listo?"#f5fbf2":"#fffbf0",boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}>
      <div onClick={()=>setAbierto(a=>!a)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 16px",cursor:"pointer",userSelect:"none",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
          <span style={{fontSize:16,flexShrink:0}}>🌽</span>
          <span style={{fontSize:12,fontWeight:600,color:"#3d3525",whiteSpace:"nowrap"}}>Maíz CBOT</span>
          <span style={{fontSize:10,color:"#8a8070",whiteSpace:"nowrap"}}>Base +{BASE_USD} USD/ton</span>
        </div>
        {listo?(
          <div style={{display:"flex",alignItems:"center",gap:14,flex:1,justifyContent:"center",flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"baseline",gap:4}}>
              <span style={{fontFamily:"Georgia, serif",fontSize:20,fontWeight:700,color:"#2d5a1b",lineHeight:1}}>{mxnFmt(m.precioMXN)}</span>
              <span style={{fontSize:10,color:"#8a8070"}}>/ton</span>
            </div>
            <div style={{display:"flex",gap:12,fontSize:11,color:"#8a8070"}}>
              <span>CBOT <strong style={{color:"#e67e22",fontFamily:"monospace"}}>{m.cbot}</strong> c/bu</span>
              <span>TC <strong style={{color:"#1a6ea8",fontFamily:"monospace"}}>{m.tc?.toFixed(4)}</strong></span>
              {m.ultimaAct&&<span style={{color:"#4a8c2a"}}>✓ {m.ultimaAct}</span>}
            </div>
          </div>
        ):<span style={{fontSize:11,color:"#c8a84b",fontWeight:600,flex:1,textAlign:"center"}}>📋 Captura CBOT y TC para calcular el precio</span>}
        <span style={{fontSize:11,color:"#8a8070",flexShrink:0,transition:"transform 0.2s",transform:abierto?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
      </div>
      {abierto&&(
        <div style={{padding:"12px 16px 14px",borderTop:`1px solid ${listo?"rgba(45,90,27,0.12)":"rgba(200,168,75,0.3)"}`,background:"white"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:listo?10:0}}>
            <div>
              <div style={{fontSize:10,fontWeight:600,color:"#3d3525",marginBottom:5}}>CBOT Julio <span style={{fontWeight:400,color:"#8a8070"}}>(c/bushel)</span>{m.cbot&&<span style={{marginLeft:6,fontFamily:"monospace",color:"#e67e22",fontWeight:700}}>{m.cbot}</span>}</div>
              <div style={{display:"flex",gap:6}}>
                <input {...inp(inCBOT,setInCBOT,errCBOT)} onChange={e=>{setInCBOT(e.target.value);setErrCBOT(false);}} onKeyDown={e=>e.key==="Enter"&&apCBOT(inCBOT)} placeholder={m.cbot?`Actual: ${m.cbot}`:"ej. 465"}/>
                <button onClick={()=>apCBOT(inCBOT)} style={{padding:"6px 12px",background:"#2d5a1b",color:"white",border:"none",borderRadius:6,fontWeight:700,cursor:"pointer",fontSize:13,opacity:inCBOT?1:0.35}}>✓</button>
              </div>
              {errCBOT&&<div style={{fontSize:10,color:"#c0392b",marginTop:3}}>⚠ Valor entre 100–2000</div>}
              <a href="https://www.barchart.com/futures/quotes/ZCN26/overview" target="_blank" rel="noopener"
                style={{fontSize:10,color:'#1a6ea8',display:'block',marginTop:4,textDecoration:'none'}}>
                Ver CBOT en Barchart →
              </a>
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:600,color:"#3d3525",marginBottom:5}}>Tipo de Cambio <span style={{fontWeight:400,color:"#8a8070"}}>(MXN/USD)</span>{m.tc&&<span style={{marginLeft:6,fontFamily:"monospace",color:"#1a6ea8",fontWeight:700}}>{m.tc?.toFixed(4)}</span>}</div>
              <div style={{display:"flex",gap:6}}>
                <input {...inp(inTC,setInTC,errTC)} onChange={e=>{setInTC(e.target.value);setErrTC(false);}} onKeyDown={e=>e.key==="Enter"&&apTC(inTC)} placeholder={m.tc?`Actual: ${m.tc?.toFixed(4)}`:"ej. 17.85"}/>
                <button onClick={()=>apTC(inTC)} style={{padding:"6px 12px",background:"#2d5a1b",color:"white",border:"none",borderRadius:6,fontWeight:700,cursor:"pointer",fontSize:13,opacity:inTC?1:0.35}}>✓</button>
              </div>
              {errTC&&<div style={{fontSize:10,color:"#c0392b",marginTop:3}}>⚠ Valor entre 5–50</div>}
              <a href="https://www.banxico.org.mx/tipcamb/main.do?page=tip&idioma=sp" target="_blank" rel="noopener"
                style={{fontSize:10,color:'#1a6ea8',display:'block',marginTop:4,textDecoration:'none'}}>
                Ver TC en Banxico →
              </a>
            </div>
          </div>
          {listo&&(<div style={{marginTop:8,padding:"6px 12px",background:"#f0f7ec",borderRadius:6,fontFamily:"monospace",fontSize:10,color:"#6a8060"}}>({m.cbot} ÷ 100 × 39.3683 + {BASE_USD}) × {m.tc?.toFixed(4)} = <strong style={{color:"#2d5a1b"}}>{mxnFmt(m.precioMXN)}</strong><span style={{color:"#8a8070"}}> /ton</span></div>)}
        </div>
      )}
    </div>
  );
}

// ─── CONTEXT & REDUCER ────────────────────────────────────────────────────────
// [removed: Ctx → imported from shared/core]

// [removed: CULTIVOS → imported from shared/core]
// [removed: ESTADOS_FENOL → imported from shared/core]
// [removed: TIPOS_TRABAJO → imported from shared/core]

// [removed: CAT_INSUMO → imported from shared/core]
// [removed: UNIDADES → imported from shared/core]
// [removed: CAT_GASTO → imported from shared/core]

// ─── PRODUCTORES REALES (Charay · PV 2024-25) ────────────────────────────────
// [removed: PRODUCTORES_INIT → imported from shared/core]

// [removed: LOTES_INIT → imported from shared/core]


// [removed: initState → imported from shared/core]

// [removed: reducer → imported from shared/core]

// [removed: useData → imported from shared/core]

// getRolPermisos, getRolesDisponibles, getRolInfo, getPermisosUsuario → ./shared/roles.js

// ─── FILTRAR ESTADO POR PRODUCTOR ─────────────────────────────────────────────
// Devuelve una "vista" del estado filtrada por productorActivo (null = todos)
// [removed: filtrarPorProductor → imported from shared/core]


// ─── MÓDULO PRODUCTORES ───────────────────────────────────────────────────────
// [removed: PROD_COLORES → imported from shared/core]

// [removed: ordenarProductores → imported from shared/core]

// [removed: nomCompleto → imported from shared/core]




// ─── HELPERS ──────────────────────────────────────────────────────────────────


// ─── MOTOR DE INTERÉS POR MINISTRACIÓN ───────────────────────────────────────
// Calcula el interés acumulado real: cada ministración desde su propia fecha,
// los abonos reducen el saldo más antiguo primero (FIFO, como FIRA).



// ─── LOTES MODULE ─────────────────────────────────────────────────────────────

// ─── LOTES Y PARCELAS ─────────────────────────────────────────────────────────

const MUNICIPIOS_SINALOA = [
  "AHOME","ANGOSTURA","BADIRAGUATO","CHOIX","CONCORDIA","COSALÁ","CULIACÁN",
  "ELOTA","ESCUINAPA","EL FUERTE","GUASAVE","MAZATLÁN","MOCORITO","NAVOLATO",
  "ROSARIO","SALVADOR ALVARADO","SAN IGNACIO","SINALOA DE LEYVA",
  "CULIACÁN","MAZATLÁN"
];
// Municipios únicos ordenados
export const MUNICIPIOS_SIN = [...new Set(MUNICIPIOS_SINALOA)].sort();

export function useComboDinamico(inicial) {
  const [opciones, setOpciones] = useState(inicial);
  const agregar = (val) => {
    const v = (val||"").trim().toUpperCase();
    if (v && !opciones.includes(v)) setOpciones(prev => [...prev, v].sort());
  };
  return [opciones, agregar];
}

export function calcSupCredito(sc, sm) {
  const a = parseFloat(sc) || 0;
  const b = parseFloat(sm) || 0;
  if (a > 0 && b > 0) return Math.min(a, b);
  if (a > 0) return a;
  if (b > 0) return b;
  return 0;
}

// ─── COMBO AUTOCOMPLETE (componente independiente) ────────────────────────────
export function ComboConNuevo({label, value, opts, onSelect, placeholder}) {
  const [texto, setTexto]     = useState(value||"");
  const [abierto, setAbierto] = useState(false);
  const [destacado, setDest]  = useState(-1);

  // Sincronizar cuando el padre cambia value (al abrir edición)
  useEffect(()=>{ setTexto(value||""); }, [value]);

  const filtradas = texto.trim()===""
    ? opts
    : opts.filter(o => o.toLowerCase().includes(texto.toLowerCase()));

  const seleccionar = (op) => {
    setTexto(op);
    onSelect(op);
    setAbierto(false);
    setDest(-1);
  };

  const onKeyDown = (e) => {
    if (!abierto) { setAbierto(true); return; }
    if (e.key==="ArrowDown") { e.preventDefault(); setDest(d=>Math.min(d+1,filtradas.length-1)); }
    else if (e.key==="ArrowUp") { e.preventDefault(); setDest(d=>Math.max(d-1,0)); }
    else if (e.key==="Enter") {
      e.preventDefault();
      if (destacado>=0 && filtradas[destacado]) seleccionar(filtradas[destacado]);
      else if (texto.trim()) { onSelect(texto.trim().toUpperCase()); setAbierto(false); }
    }
    else if (e.key==="Escape") { setAbierto(false); setDest(-1); }
  };

  return (
    <div className="form-group" style={{position:"relative"}}>
      <label className="form-label">{label}</label>
      <div style={{position:"relative"}}>
        <input
          className="form-input"
          value={texto}
          onChange={e=>{ const v=e.target.value.toUpperCase(); setTexto(v); onSelect(v); setAbierto(true); setDest(-1); }}
          onFocus={()=>setAbierto(true)}
          onBlur={()=>setTimeout(()=>{ setAbierto(false); setDest(-1); },160)}
          onKeyDown={onKeyDown}
          placeholder={placeholder||"Escribir o buscar…"}
          autoComplete="off"
        />
        <div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:"#8a8070",fontSize:11,pointerEvents:"none"}}>▾</div>
      </div>
      {abierto && (
        <div style={{
          position:"absolute",zIndex:999,left:0,right:0,
          background:"white",border:"1.5px solid #2d5a1b",borderRadius:8,
          boxShadow:"0 8px 24px rgba(0,0,0,0.12)",maxHeight:220,overflowY:"auto",marginTop:2,
        }}>
          {filtradas.length===0 ? (
            <div style={{padding:"10px 14px",fontSize:12,color:"#8a8070"}}>
              Sin coincidencias — presiona Enter para guardar "{texto}"
            </div>
          ) : filtradas.map((op,i)=>(
            <div key={op} onMouseDown={()=>seleccionar(op)}
              style={{
                padding:"9px 14px",fontSize:13,cursor:"pointer",
                background: i===destacado ? "#2d5a1b" : "white",
                color: i===destacado ? "white" : "#3d3525",
                fontWeight: op===value ? 600 : 400,
                borderBottom: i<filtradas.length-1 ? "1px solid #ddd5c0" : "none",
              }}>
              {op}
            </div>
          ))}
          {texto.trim() && !opts.map(o=>o.toUpperCase()).includes(texto.trim().toUpperCase()) && (
            <div onMouseDown={()=>seleccionar(texto.trim().toUpperCase())}
              style={{padding:"9px 14px",fontSize:12,color:"#2d5a1b",fontWeight:600,
                borderTop:"1px solid #ddd5c0",background:"#f0f7f0",cursor:"pointer"}}>
              ＋ Guardar "{texto.trim().toUpperCase()}" como nuevo
            </div>
          )}
        </div>
      )}
    </div>
  );
}





// ─── CICLOS MODULE ────────────────────────────────────────────────────────────

// ─── CICLOS MODULE v2 ──────────────────────────────────────────────────────────



// ─── BITÁCORA MODULE ──────────────────────────────────────────────────────────

// ─── AI ASSISTANT MODULE ───────────────────────────────────────────────────────
// ─── ASISTENTE IA INTELIGENTE ─────────────────────────────────────────────────
export const CAPTURE_SYSTEM = (state) => {
  const F = calcularFinancieros(state);
  const vcto = calcularVencimiento(state.credito);
  const haTot = F.ha;
  const costoHa = haTot > 0 ? Math.round(F.costoTotal / haTot) : 0;
  const costoTon = F.produccionEst > 0 ? Math.round(F.costoTotal / F.produccionEst) : 0;
  const precioActual = F.precio;
  const mxn2 = n => `$${(parseFloat(n)||0).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const fmt2 = (n,d=2) => (parseFloat(n)||0).toFixed(d);

  // ── Datos del ciclo activo ───────────────────────────────────────────────────
  const cicloPred = (state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[])[0];
  const asigsCiclo = cicloPred?.asignaciones||[];
  const cid = state.cicloActivoId||1;
  const params = { para_tasaAnual:1.38, para_factibilidad:1.25, para_fega:2.3, para_asistTec:200, dir_tasaAnual:1.8, dir_factibilidad:1.5, dir_fega:2.3, iva:16, ...(state.creditoParams||{}) };

  // ── Productores con ha ───────────────────────────────────────────────────────
  const prodResumen = (state.productores||[]).map(p => {
    const ha = asigsCiclo.filter(a=>String(a.productorId)===String(p.id)).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
    const ins = (state.insumos||[]).filter(i=>!i.cancelado&&String(i.productorId)===String(p.id)&&(i.cicloId||1)===cid).reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
    const die = (state.diesel||[]).filter(d=>!d.cancelado&&String(d.productorId)===String(p.id)&&(d.cicloId||1)===cid).reduce((s,d)=>s+(parseFloat(d.importe)||0),0);
    const efe = (state.egresosManual||[]).filter(e=>!e.cancelado&&String(e.productorId)===String(p.id)&&(e.cicloId||1)===cid).reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
    const gastoOp = ins + die + efe;
    const exp = (state.expedientes||[]).find(e=>e.productorId===p.id);
    const creditoAut = exp?.montoPorHa ? ha * exp.montoPorHa : 0;
    const montoAplP = creditoAut>0 ? Math.min(gastoOp, creditoAut) : 0;
    const disps = (state.dispersiones||[]).filter(d=>!d.cancelado&&String(d.productorId)===String(p.id)&&(d.cicloId||1)===cid);
    const totalDisp = disps.reduce((s,d)=>s+(parseFloat(d.monto)||0),0);
    const hoy = new Date();
    // Interés parafinanciero por movimiento
    const movsAll = [
      ...(state.insumos||[]).filter(i=>!i.cancelado&&String(i.productorId)===String(p.id)&&(i.cicloId||1)===cid).map(i=>({fecha:i.fechaSolicitud||i.fechaOrden||"",monto:parseFloat(i.importe)||0})),
      ...(state.diesel||[]).filter(d=>!d.cancelado&&String(d.productorId)===String(p.id)&&(d.cicloId||1)===cid).map(d=>({fecha:d.fechaSolicitud||d.fechaOrden||"",monto:parseFloat(d.importe)||0})),
      ...(state.egresosManual||[]).filter(e=>!e.cancelado&&String(e.productorId)===String(p.id)&&(e.cicloId||1)===cid).map(e=>({fecha:e.fecha||e.semanaFechaInicio||"",monto:parseFloat(e.monto)||0})),
    ].filter(m=>m.monto>0).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
    const diasDesde = f => f ? Math.max(0,Math.round((hoy-new Date(f))/86400000)) : 0;
    let acumP=0, intP=0, factP=0, fegaP=0;
    movsAll.forEach(m=>{ const md=Math.min(m.monto,Math.max(0,montoAplP-acumP)); acumP+=md; intP+=((md*(params.para_tasaAnual/100))/30)*diasDesde(m.fecha); });
    if(montoAplP>0){ factP=creditoAut*(params.para_factibilidad/100)*(1+params.iva/100); fegaP=montoAplP*(params.para_fega/100)*(1+params.iva/100); }
    let acumD2=0, intD=0, factD=0, fegaD=0;
    movsAll.forEach(m=>{ const yP=Math.min(m.monto,Math.max(0,creditoAut-acumD2)); const enD=m.monto-yP; acumD2+=m.monto; const dias=diasDesde(m.fecha); intD+=((enD*(params.dir_tasaAnual/100))/30)*dias; factD+=enD*(params.dir_factibilidad/100); fegaD+=((enD*dias)/360)*(params.dir_fega/100); });
    factD=(factD+fegaD)*(1+params.iva/100);
    const asistTec = ha * params.para_asistTec;
    const totalInteres = intP + intD;
    const totalComisiones = factP + fegaP + asistTec + factD;
    const totalALiquidar = montoAplP + (gastoOp-montoAplP>0?gastoOp-montoAplP:0) + totalInteres + totalComisiones;
    return { nombre: p.alias||p.apPat||p.nombres, ha: fmt2(ha,2), gastoOp: mxn2(gastoOp), creditoAut: mxn2(creditoAut), montoAplP: mxn2(montoAplP), totalDisp: mxn2(totalDisp), interes: mxn2(totalInteres), comisiones: mxn2(totalComisiones), totalLiquidar: mxn2(totalALiquidar) };
  }).filter(p=>parseFloat(p.ha)>0||parseFloat(p.gastoOp.replace(/[$,]/g,""))>0);

  // ── Últimos egresos ──────────────────────────────────────────────────────────
  const ultEgresos = (state.egresosManual||[]).filter(e=>!e.cancelado&&(e.cicloId||1)===cid).slice(-15).map(e=>"  • "+(e.fecha||"")+" | "+e.categoria+" | "+mxn2(e.monto)+" | "+(e.concepto||"")).join("\n");
  const ultInsumos = (state.insumos||[]).filter(i=>!i.cancelado&&(i.cicloId||1)===cid).slice(-10).map(i=>"  • "+(i.fechaSolicitud||"")+" | "+(i.insumo||i.categoria)+" | "+mxn2(i.importe)+" | Prod:"+((state.productores||[]).find(p=>String(p.id)===String(i.productorId))?.alias||i.productorId)).join("\n");
  const ultDiesel = (state.diesel||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===cid).slice(-10).map(d=>"  • "+(d.fechaSolicitud||"")+" | "+(d.litros||"")+" lts | "+mxn2(d.importe)+" | "+((state.productores||[]).find(p=>String(p.id)===String(d.productorId))?.alias||d.productorId)).join("\n");
  const dispersiones = (state.dispersiones||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===cid);
  const ultDisps = dispersiones.slice(-10).map(d=>"  • "+(d.fecha||"")+" | "+d.lineaCredito+" | "+mxn2(d.monto)+" | "+((state.productores||[]).find(p=>String(p.id)===String(d.productorId))?.alias||d.productorId)).join("\n");
  const totalDispersado = dispersiones.reduce((s,d)=>s+(parseFloat(d.monto)||0),0);

  return `Eres el asistente de AgroSistema Charay. Tu función es DUAL:
1. Responder preguntas agronómicas, financieras y de rentabilidad con datos reales del rancho.
2. Detectar y extraer datos capturables de mensajes, fotos o documentos.

════════════════════════════════════════
DATOS REALES DEL RANCHO — CICLO ${state.cicloActual}  |  Hoy: ${new Date().toLocaleDateString("es-MX")}
════════════════════════════════════════

── PRODUCCIÓN ──────────────────────────
Hectáreas sembradas: ${fmt2(haTot,2)} ha en ${(state.lotes||[]).length} lotes · ${(state.productores||[]).length} productores
Producción estimada: ${fmt2(F.produccionEst,1)} ton (${fmt2(haTot>0?F.produccionEst/haTot:0,2)} t/ha)
Precio venta: ${mxn2(precioActual)}/ton · Ingreso estimado: ${mxn2(F.ingresoEst)}

── COSTOS DESGLOSADOS ──────────────────
Costo total ciclo:   ${mxn2(F.costoTotal)} (${mxn2(costoHa)}/ha · ${mxn2(costoTon)}/ton)
  Semilla:           ${mxn2(F.costoSemilla)}
  Insumos (sin sem): ${mxn2(F.costoInsumos||0)}
  Diesel:            ${mxn2(F.costoDiesel)}
  Renta de tierra:   ${mxn2(F.costoRenta)}
  Mano de obra:      ${mxn2(F.costoManoObra)}
  Agua:              ${mxn2(F.costoAgua)}
  Seguros:           ${mxn2(F.costoSeguros)}
  Trámites/Otros:    ${mxn2((F.costoTramites||0)+(F.costoOtros||0))}
  Intereses:         ${mxn2(F.costoInteres)}
  Comisiones:        ${mxn2(F.costoComisiones)}

── RENTABILIDAD ────────────────────────
Utilidad estimada: ${mxn2(F.utilidadBruta)} (${fmt2(F.margen,1)}% margen)
Punto de equilibrio: ${fmt2(F.peTon,1)} ton · ${fmt2(haTot>0?F.peTon/haTot:0,2)} t/ha mínimo

── CRÉDITO HABILITACIÓN (parámetros) ───
Parafin: tasa ${params.para_tasaAnual}%/mes · Factibilidad ${params.para_factibilidad}% · FEGA ${params.para_fega}% · AT $${params.para_asistTec}/ha
Directo: tasa ${params.dir_tasaAnual}%/mes · Factibilidad ${params.dir_factibilidad}% · FEGA ${params.dir_fega}%
IVA: ${params.iva}%
Total dispersado al ciclo: ${mxn2(totalDispersado)} (${dispersiones.length} movimientos)

── ESTADO POR PRODUCTOR (crédito + gasto) ──────────────────────────────────────
PRODUCTOR         | HA    | GASTO OP     | CRÉD AUT     | APLICADO     | DISPERSADO   | INTERÉS      | COMISIONES   | TOTAL A LIQUIDAR
${prodResumen.map(p=>p.nombre.padEnd(17)+"| "+p.ha.padEnd(6)+"| "+p.gastoOp.padEnd(13)+"| "+p.creditoAut.padEnd(13)+"| "+p.montoAplP.padEnd(13)+"| "+p.totalDisp.padEnd(13)+"| "+p.interes.padEnd(13)+"| "+p.comisiones.padEnd(13)+"| "+p.totalLiquidar).join("\n")}
")}

── ÚLTIMAS DISPERSIONES (${dispersiones.length} total) ─────
${ultDisps||"Sin dispersiones"}

── ÚLTIMOS INSUMOS ─────────────────────
${ultInsumos||"Sin registros"}

── ÚLTIMOS EGRESOS MANUALES ────────────
${ultEgresos||"Sin registros"}

── ÚLTIMO DIESEL ───────────────────────
${ultDiesel||"Sin registros"}

── CRÉDITOS REFACCIONARIOS ─────────────
${(state.creditosRef||[]).length===0 ? "Ninguno" : (state.creditosRef||[]).map(c => { const {saldoCapital,interesTotal} = calcularInteresCredito(c); return "  • "+c.institucion+" · saldo "+mxn2(saldoCapital)+" · interés "+mxn2(interesTotal); }).join("\n")}
")}

── CAPITAL PROPIO ───────────────────────
Aportado: ${mxn2(F.totalAport)} · Retiros: ${mxn2(F.totalRetiro)} · Capital neto: ${mxn2(F.capitalNeto)}

── LOTES DEL CICLO (primeros 20) ───────
${asigsCiclo.slice(0,20).map(a=>{const l=(state.lotes||[]).find(x=>x.id===a.loteId);const p2=(state.productores||[]).find(x=>String(x.id)===String(a.productorId));return"  • "+(l?.apodo||l?.lote||a.loteId)+": "+a.supAsignada+"ha · "+(a.cultivoNombre||"Maíz")+" · "+(p2?.alias||"");}).join("\n")||"Sin asignaciones"}
")||"Sin asignaciones"}

════════════════════════════════════════
INSTRUCCIONES
════════════════════════════════════════
FINANCIERO/RENTABILIDAD: Usa SIEMPRE los datos reales de la tabla de productores y los parámetros de crédito para calcular intereses. La fórmula de interés es: ((monto × tasa%/mes) / 30) × días. Para proyectar al 31-jul u otra fecha, calcula los días desde la fecha del primer movimiento de cada productor hasta esa fecha. Sé concreto y da cifras exactas.

AGRONÓMICO: Especialista en norte de Sinaloa, Valle del Fuerte, Charay. Maíz blanco/amarillo, ejote, papa. Siempre en español, práctico y orientado a la acción.

CAPTURA DE DATOS: Si el mensaje contiene gastos, actividades o documentos capturables, extrae en JSON:
{ "capturas": [ { modulo, ...campos } ], "texto": "respuesta" }

MÓDULOS DISPONIBLES:
- GASTO: { modulo:"gasto", fecha, concepto, monto, categoria, formaPago("contado"|"credito"), proveedor, notas }
- DIESEL: { modulo:"diesel", fecha, litros, precioLitro, concepto, formaPago, notas }
- INSUMO: { modulo:"insumo", nombre, categoria, unidad, stockInicial, stockActual, costoUnitario, proveedor, fechaEntrada }
- TRABAJO: { modulo:"trabajo", fecha, tipo, loteNombre, operador, horas, observaciones }
- APORTACION: { modulo:"aportacion", fecha, monto, concepto, socio, notas }
- MINISTRACION: { modulo:"ministracion", fecha, monto, concepto, estatus("aplicado") }

Si NO hay nada capturable: { "capturas": [], "texto": "tu respuesta" }
Responde siempre en español.`;
};

export const QUICK_PROMPTS = [
  { label:"💊 Registrar fertilizante", text:"Apliqué fertilizante hoy" },
  { label:"⛽ Carga de diesel", text:"Cargué diesel hoy" },
  { label:"🌱 Análisis de suelo", text:"Interpreta mi análisis de suelo" },
  { label:"🐛 Plagas", text:"¿Qué plagas debo vigilar en esta etapa?" },
  { label:"💵 Anotar gasto", text:"Tuve un gasto hoy de " },
  { label:"💧 Registro de riego", text:"Regué el lote " },
];

export const MODULO_INFO = {
  gasto:       { icon:"💸", label:"Gasto del Ciclo",     color:"#b85c2c" },
  diesel:      { icon:"⛽", label:"Diesel / Combustible", color:"#e67e22" },
  insumo:      { icon:"📦", label:"Insumo / Inventario",  color:"#2d5a1b" },
  trabajo:     { icon:"🚜", label:"Bitácora de Trabajo",  color:"#4a8c2a" },
  aportacion:  { icon:"💵", label:"Aportación de Capital",color:"#c8a84b" },
  ministracion:{ icon:"🏦", label:"Ministración Crédito", color:"#5b9fd6" },
};

export function TarjetaConfirmacion({ captura, lotes, onConfirm, onEdit, onDiscard }) {
  const [editado, setEditado] = useState({ ...captura });
  const [modoEdicion, setModoEdicion] = useState(false);
  const info = MODULO_INFO[captura.modulo] || { icon:"📋", label:captura.modulo, color:"#666" };

  const campos = Object.entries(editado).filter(([k]) => k !== "modulo");

  return (
    <div style={{
      border:`2px solid ${info.color}`,
      borderRadius:12,
      overflow:"hidden",
      background:"white",
      maxWidth:420,
      boxShadow:"0 4px 16px rgba(0,0,0,0.10)"
    }}>
      {/* Header */}
      <div style={{ background:info.color, padding:"10px 14px", display:"flex", alignItems:"center", gap:8 }}>
        <span style={{fontSize:18}}>{info.icon}</span>
        <div style={{color:"white",fontWeight:700,fontSize:13}}>{info.label}</div>
        <div style={{marginLeft:"auto",color:"rgba(255,255,255,0.8)",fontSize:11}}>Pendiente de confirmar</div>
      </div>

      {/* Campos */}
      <div style={{padding:"10px 14px"}}>
        {modoEdicion ? (
          campos.map(([k,v])=>(
            <div key={k} style={{marginBottom:8}}>
              <div style={{fontSize:10,fontWeight:700,color:T.fog,textTransform:"uppercase",marginBottom:2}}>{k}</div>
              <input
                style={{width:"100%",padding:"5px 8px",border:`1px solid ${T.line}`,borderRadius:6,fontSize:12,fontFamily:"'DM Mono',monospace"}}
                value={String(v??"")}
                onChange={e=>setEditado(ed=>({...ed,[k]:e.target.value}))}
              />
            </div>
          ))
        ) : (
          <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
            <tbody>
              {campos.map(([k,v])=>(
                <tr key={k} style={{borderBottom:`1px solid ${T.line}`}}>
                  <td style={{padding:"5px 4px",color:T.fog,width:"38%",fontWeight:500,textTransform:"capitalize"}}>{k.replace(/([A-Z])/g," $1")}</td>
                  <td style={{padding:"5px 4px",fontFamily:"'DM Mono',monospace",fontWeight:600,color:T.inkLt}}>
                    {typeof v==="number" && (k==="monto"||k==="costoUnitario"||k==="precioLitro")
                      ? mxn(v)
                      : String(v??"")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Acciones */}
      <div style={{padding:"8px 14px 12px",display:"flex",gap:8,borderTop:`1px solid ${T.line}`}}>
        <button
          onClick={()=>onConfirm(editado)}
          style={{flex:1,padding:"8px 0",background:info.color,color:"white",border:"none",borderRadius:8,fontWeight:700,fontSize:13,cursor:"pointer"}}
        >✓ Guardar</button>
        {modoEdicion
          ? <button onClick={()=>setModoEdicion(false)} style={{padding:"8px 12px",background:T.mist,border:`1px solid ${T.line}`,borderRadius:8,fontSize:12,cursor:"pointer"}}>Listo</button>
          : <button onClick={()=>setModoEdicion(true)} style={{padding:"8px 12px",background:T.mist,border:`1px solid ${T.line}`,borderRadius:8,fontSize:12,cursor:"pointer"}}>✏️ Editar</button>
        }
        <button onClick={onDiscard} style={{padding:"8px 12px",background:"#fdf0ef",border:`1px solid ${T.rust}`,color:T.rust,borderRadius:8,fontSize:12,cursor:"pointer"}}>✕</button>
      </div>
    </div>
  );
}

// ─── IA KEY (ofuscada) ───────────────────────────────────────────────────────
export const _gk = () => atob("QUl6YVN5QXNVbXNYcy1LeV9yZEpaOHpnVDNzX25VQUUxWFRadzJR");


// ─── PLACEHOLDER MODULES ──────────────────────────────────────────────────────
function Placeholder({ icon, title, desc }) {
  return (
    <div className="card">
      <div className="empty-state">
        <div className="empty-icon">{icon}</div>
        <div className="empty-title">{title}</div>
        <div className="empty-sub">{desc}</div>
        <span className="badge badge-gold">Próximamente</span>
      </div>
    </div>
  );
}

// ─── MXN FORMATTER ────────────────────────────────────────────────────────────
export const mxn = n => (typeof n==="number" ? n.toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2}) : "$0.00");

// ─── INSUMOS MODULE ───────────────────────────────────────────────────────────

// ─── DIESEL MODULE ─────────────────────────────────────────────────────────────


// ─── GASTOS MODULE ─────────────────────────────────────────────────────────────
// ─── EGRESOS DEL CICLO MODULE ─────────────────────────────────────────────────


// ─── CRÉDITO HABILITACIÓN MODULE — EXPEDIENTES POR RESICO ─────────────────────
// Helpers locales
export function calcInteresExp(exp) {
  // Interés acumulado por ministración con días exactos
  const hoy = new Date();
  let capital = 0, interes = 0;
  const minisSorted = [...exp.ministraciones].sort((a,b)=>a.fecha.localeCompare(b.fecha));
  minisSorted.forEach(m => {
    const dias = Math.max(0, Math.round((hoy - new Date(m.fecha)) / 86400000));
    interes += m.monto * (exp.tasaAnual/100) * (dias/365);
    capital += m.monto;
  });
  const pagado = (exp.pagos||[]).reduce((s,p)=>s+(p.monto||0), 0);
  const comisiones = (exp.comisionApertura||0)+(exp.comisionFEGA||0)+(exp.comisionAsesoria||0)+(exp.comisionSeguro||0);
  return { capital, interes: Math.round(interes), pagado, comisiones,
    saldo: Math.max(0, capital - pagado), costoTotal: Math.round(interes + comisiones) };
}




// ─── CRÉDITOS REFACCIONARIOS MODULE ───────────────────────────────────────────


// ─── PERSONAL Y HONORARIOS MODULE ────────────────────────────────────────────
export const TIPOS_PERSONAL = ["Empleado Fijo","Honorarios por Ciclo","Consultoría / Servicio","Eventual"];
export const PUESTOS_SUGERIDOS = ["Asesor Agrónomo","Administrador","Contador","Gerente General","Técnico de Campo","Guardián / Velador","Chofer","Otro"];


// ─── COSECHA Y MAQUILA MODULE ─────────────────────────────────────────────────


// ─── ESTADO DE RESULTADOS ─────────────────────────────────────────────────────

// ─── BALANCE GENERAL ──────────────────────────────────────────────────────────

// ─── FLUJO DE CAJA ────────────────────────────────────────────────────────────

// ─── REPORTES DEL CICLO ───────────────────────────────────────────────────────

// ─── BANNER DE ALERTA DE VENCIMIENTO ─────────────────────────────────────────
export function VencimientoAlert({ credito, onIrCredito }) {
  const v = calcularVencimiento(credito);
  if (!v || v.nivel === "ok") return null;
  return (
    <div style={{
      background: v.bg, borderBottom:`2px solid ${v.color}`,
      padding:"9px 32px", display:"flex", alignItems:"center",
      justifyContent:"space-between", flexShrink:0,
    }}>
      <div style={{display:"flex", alignItems:"center", gap:10}}>
        <span style={{fontSize:18}}>{v.icono}</span>
        <div>
          <span style={{fontWeight:700, color:v.color, fontSize:13}}>{v.mensaje}</span>
          <span style={{fontSize:12, color:v.color, marginLeft:12, opacity:0.8}}>
            {v.vencido
              ? `Saldo capital: ${(v.saldoCapital/1000000).toFixed(2)}M`
              : `Saldo a liquidar: ${(v.saldoCapital/1000000).toFixed(2)}M · Vence: ${credito.fechaVencimiento}`}
            {v.vencido && v.interesMoratorio > 0 &&
              ` · Mora est.: $${v.interesMoratorio.toLocaleString("es-MX")}`}
            {v.vencido && v.interesMoratorio === 0 &&
              " · Configura la tasa moratoria en Crédito"}
          </span>
        </div>
      </div>
      <button onClick={onIrCredito} style={{
        background:v.color, color:"white", border:"none",
        borderRadius:6, padding:"5px 14px", fontSize:12,
        fontWeight:600, cursor:"pointer", whiteSpace:"nowrap",
      }}>Ver Crédito →</button>
    </div>
  );
}

// ─── MÓDULO PROYECCIÓN VS REAL ────────────────────────────────────────────────
const ETAPAS_PROY = ["Preparación","Pre-siembra","Siembra","Renta","Cierre","Riego","Operación","Cosecha","Post-cosecha"];
const CATS_PROY   = ["Insumos","Diesel","Mano de Obra","Maquinaria","Renta","Agua / Riego","Cosecha y Maquila","Administración","Financiero","Seguro","Otro"];


// ─── MÓDULO CONFIGURACIÓN (solo Admin) ───────────────────────────────────────
export const TODOS_MODULOS = [
  { id:"dashboard",     label:"Dashboard",            section:"Principal" },
  { id:"flujos",        label:"Solicitudes y Aprobaciones",section:"Principal" },
  { id:"productores",   label:"Productores",          section:"Principal" },
  { id:"ciclos",        label:"Ciclos Agrícolas",     section:"Principal" },
  { id:"lotes",         label:"Lotes y Parcelas",     section:"Campo" },
  { id:"bitacora",      label:"Bitácora de Trabajos", section:"Campo" },
  { id:"maquinaria",    label:"Maquinaria",           section:"Campo" },
  { id:"operadores",    label:"Operadores",           section:"Campo" },
  { id:"insumos",       label:"Insumos y Semilla",    section:"Insumos" },
  { id:"diesel",        label:"Diesel y Combustible", section:"Insumos" },
  { id:"inventario",    label:"Inventario de Insumos",section:"Insumos" },
  { id:"capital",       label:"Capital Propio",       section:"Finanzas" },
  { id:"credito",       label:"Crédito Habilitación", section:"Finanzas" },
  { id:"creditosref",   label:"Créditos Refaccionarios",section:"Finanzas"},
  { id:"rentas",        label:"Rentas de Tierra",     section:"Finanzas" },
  { id:"gastos",        label:"Egresos del Ciclo",    section:"Finanzas" },
  { id:"costos",        label:"Análisis de Costos",  section:"Finanzas" },
  { id:"activos",       label:"Activos",              section:"Empresa" },
  { id:"personal",      label:"Personal y Honorarios",section:"Empresa" },
  { id:"cosecha",       label:"Cosecha y Maquila",    section:"Empresa" },
  { id:"cajachica",     label:"Caja Chica",           section:"Empresa" },
  { id:"paneldaniela", label:"Panel Contable",        section:"Finanzas" },
  { id:"proyeccion",    label:"Proyección vs Real",   section:"Inteligencia" },
  { id:"asistente",     label:"Asistente Agrícola IA",section:"Inteligencia" },
  { id:"edo_resultados",label:"Estado de Resultados", section:"Financiero" },
  { id:"balance",       label:"Balance General",      section:"Financiero" },
  { id:"flujo_caja",    label:"Flujo de Efectivo",    section:"Financiero" },
  { id:"reportes",      label:"Reportes del Ciclo",   section:"Financiero" },
];

const ROLES_EDITABLES = [
  { id:"socio",      label:"Socio / Dirección",    icon:"🤝", color:"#1a6ea8" },
  { id:"encargado",  label:"Encargado de Campo",   icon:"🌾", color:"#c8a84b" },
  { id:"ingeniero",  label:"Ingeniero de Campo",   icon:"🌿", color:"#27ae60" },
  { id:"compras",    label:"Compras / Admin",       icon:"🛒", color:"#8e44ad" },
  { id:"campo",      label:"Operador de Campo",    icon:"👷", color:"#e67e22" },
];


// ─── COSTOS Y EQUILIBRIO MODULE ──────────────────────────────────────────────

// ─── MAQUINARIA MODULE ────────────────────────────────────────────────────────

// ─── OPERADORES MODULE ────────────────────────────────────────────────────────

// ─── CAPITAL PROPIO MODULE ────────────────────────────────────────────────────

// ─── RENTAS MODULE ────────────────────────────────────────────────────────────

// ─── ACTIVOS MODULE ───────────────────────────────────────────────────────────

// ─── INVENTARIO MODULE ────────────────────────────────────────────────────────

const NAV = [
  { section: "Principal" },
  { id:"dashboard",  label:"Dashboard",             icon:"📊" },
  { id:"ordenes",    label:"Órdenes del Día",       icon:"📋" },
  { id:"flujos",     label:"Solicitudes y Aprobaciones", icon:"✅" },
  { id:"productores",label:"Productores",           icon:"👥" },
  { id:"ciclos",      label:"Ciclos Agrícolas", icon:"📅" },
  { section: "Campo" },
  { id:"lotes",    label:"Lotes y Parcelas", icon:"🗺" },
  { id:"bitacora", label:"Bitácora de Trabajos", icon:"📋" },
  { id:"maquinaria", label:"Maquinaria", icon:"🚜" },
  { id:"operadores", label:"Operadores", icon:"👷" },
  { section: "Insumos" },
  { id:"insumos",  label:"Insumos y Semilla", icon:"🌱" },
  { id:"diesel",   label:"Diesel y Combustible", icon:"⛽" },
  { id:"inventario", label:"Inventario", icon:"📦" },
  { section: "Finanzas" },
  { id:"capital",    label:"Capital Propio", icon:"💵" },
  { id:"credito",    label:"Crédito Habilitación", icon:"🏦" },
  { id:"creditosref",label:"Créditos Refaccionarios", icon:"🏗" },
  { id:"rentas",      label:"Rentas de Tierra", icon:"🤝" },
  { id:"gastos",     label:"Egresos del Ciclo", icon:"💸" },
  { id:"costos",     label:"Análisis de Costos", icon:"📈" },
  { section: "Empresa" },
  { id:"activos",    label:"Activos", icon:"🏡" },
  { id:"personal",   label:"Personal y Honorarios", icon:"👔" },
  { id:"cosecha",    label:"Cosecha y Maquila", icon:"✂️" },
  { id:"cajachica",  label:"Caja Chica", icon:"💵" },
  { section: "Finanzas" },
  { id:"paneldaniela", label:"Panel Contable", icon:"📊" },
  { section: "Inteligencia" },
  { id:"proyeccion",       label:"Proyección vs Real", icon:"🎯" },
  { id:"asistente",        label:"Asistente Agrícola IA", icon:"🌾" },
  { section: "Estados Financieros" },
  { id:"edo_resultados",  label:"Estado de Resultados", icon:"📊" },
  { id:"balance",         label:"Balance General", icon:"⚖️" },
  { id:"flujo_caja",      label:"Flujo de Efectivo", icon:"💧" },
  { id:"reportes",        label:"Reportes del Ciclo", icon:"📄" },
  { section: "Sistema" },
  { id:"configuracion",   label:"Configuración", icon:"⚙️" },
];

const PAGE_TITLES = {
  dashboard:"Dashboard de Ciclo", ordenes:"Órdenes del Día", flujos:"Solicitudes y Aprobaciones", productores:"Productores del Ciclo",ciclos:"Ciclos Agrícolas",
  lotes:"Lotes y Parcelas",bitacora:"Bitácora de Trabajos",
  maquinaria:"Control de Maquinaria",operadores:"Operadores",insumos:"Insumos y Semilla",
  diesel:"Diesel y Combustible",inventario:"Inventario de Insumos",
  capital:"Capital Propio",credito:"Crédito Habilitación",creditosref:"Créditos Refaccionarios",
  rentas:"Rentas de Tierra",gastos:"Egresos del Ciclo",costos:"Costos y Punto de Equilibrio",
  activos:"Activos de la Agrícola",personal:"Personal y Honorarios",cosecha:"Cosecha y Maquila",
  proyeccion:"Proyección vs Real",
  asistente:"Asistente Agrícola IA",
  edo_resultados:"Estado de Resultados",
  balance:"Balance General",
  flujo_caja:"Flujo de Efectivo",
  reportes:"Reportes del Ciclo",
  configuracion:"Configuración del Sistema"
};

// ─── SELECTOR DE PRODUCTOR (Topbar) ──────────────────────────────────────────
function ProductorSelector() {
  const { state, dispatch } = useData();
  const activo    = state.productorActivo;
  const prod      = activo ? state.productores.find(p => p.id === activo) : null;
  const ciclos    = state.ciclos || [];
  const cicloId   = state.cicloActivoId || (ciclos.find(c=>c.id===state.cicloActivoId)||ciclos.find(c=>c.predeterminado)||ciclos[0])?.id;
  const cicloSel  = ciclos.find(c=>c.id===cicloId);
  const cultivos  = cicloSel?.cultivosDelCiclo || [];
  const cultAct   = state.cultivoActivo; // { cultivoId, variedad } | null

  // Productores del ciclo activo (con lotes asignados)
  const prodsCiclo = state.productores.filter(p => {
    const enCiclo = (cicloSel?.productores||[]).includes(p.id);
    // Si hay filtro de cultivo, solo productores con lotes de ese cultivo
    if (!cultAct) return enCiclo;
    return enCiclo && (cicloSel?.asignaciones||[]).some(a=>
      String(a.productorId)===String(p.id) &&
      a.cultivoId===cultAct.cultivoId &&
      a.variedad===cultAct.variedad
    );
  });

  const selectorStyle = {border:"none",background:"transparent",fontSize:12,fontWeight:600,
    cursor:"pointer",outline:"none",maxWidth:180,color:T.ink};

  return (
    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>

      {/* ── Selector de Ciclo ── */}
      <div style={{display:"flex",alignItems:"center",gap:6,background:T.mist,borderRadius:8,
        padding:"4px 10px",border:`1px solid ${T.line}`}}>
        <span style={{fontSize:11,color:T.fog,whiteSpace:"nowrap"}}>📅</span>
        <select value={cicloId||""} onChange={e=>{
          const id = parseInt(e.target.value);
          dispatch({type:"SET_CICLO_ACTIVO_ID", payload:id});
          // Limpiar filtro de productor al cambiar ciclo
          dispatch({type:"SET_PRODUCTOR_ACTIVO", payload:null});
        }} style={selectorStyle}>
          {ciclos.map(c=>(
            <option key={c.id} value={c.id}>
              {c.nombre}{c.predeterminado?" ★":""}
            </option>
          ))}
        </select>
      </div>

      {/* ── Selector de Cultivo (solo si hay más de uno en el ciclo) ── */}
      {cultivos.length > 1 && (
        <div style={{display:"flex",alignItems:"center",gap:6,background:T.mist,borderRadius:8,
          padding:"4px 10px",border:`1px solid ${T.line}`}}>
          <span style={{fontSize:11,color:T.fog,whiteSpace:"nowrap"}}>🌾</span>
          <select value={cultAct ? `${cultAct.cultivoId}|${cultAct.variedad}` : ""}
            onChange={e=>{
              if (!e.target.value) {
                dispatch({type:"SET_CULTIVO_ACTIVO", payload:null});
              } else {
                const [cid, vari] = e.target.value.split("|");
                const cv = cultivos.find(c=>String(c.cultivoId)===cid&&c.variedad===vari);
                dispatch({type:"SET_CULTIVO_ACTIVO", payload:cv||null});
              }
              dispatch({type:"SET_PRODUCTOR_ACTIVO", payload:null});
            }} style={selectorStyle}>
            <option value="">Todos los cultivos</option>
            {cultivos.map((cv,i)=>(
              <option key={i} value={`${cv.cultivoId}|${cv.variedad}`}>
                {cv.cultivoNombre} — {cv.variedad}
              </option>
            ))}
          </select>
          {cultAct && (
            <button onClick={()=>dispatch({type:"SET_CULTIVO_ACTIVO",payload:null})}
              style={{border:"none",background:"none",cursor:"pointer",color:T.fog,fontSize:13,padding:"0 2px"}}>✕</button>
          )}
        </div>
      )}

      {/* ── Selector de Productor ── */}
      <div style={{display:"flex",alignItems:"center",gap:6,background:T.mist,borderRadius:8,
        padding:"4px 10px",border:`1px solid ${T.line}`}}>
        <span style={{fontSize:11,color:T.fog,whiteSpace:"nowrap"}}>👤</span>
        <select value={activo||""}
          onChange={e => dispatch({ type:"SET_PRODUCTOR_ACTIVO", payload: e.target.value ? parseInt(e.target.value) : null })}
          style={{...selectorStyle, color:prod?.color||T.field}}>
          <option value="">Todos</option>
          {prodsCiclo.map(p=>(
            <option key={p.id} value={p.id}>{p.alias}</option>
          ))}
        </select>
        {activo && (
          <button onClick={()=>dispatch({type:"SET_PRODUCTOR_ACTIVO",payload:null})}
            style={{border:"none",background:"none",cursor:"pointer",color:T.fog,fontSize:13,padding:"0 2px"}}>✕</button>
        )}
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const savedState = (() => {
    try {
      const s = localStorage.getItem("agroSistemaState");
      if (!s) return {};
      const parsed = JSON.parse(s);

      // Helper: si parsed tiene el key con datos reales úsalo, si no usa initState
      const restore = (key, fallback) => {
        const v = parsed[key];
        if (v === undefined || v === null) return fallback;
        if (Array.isArray(v) && v.length === 0) return fallback; // array vacío → usar initState
        return v;
      };

      // NOTA: Grupo A (Fase 1 + Fase 3) viene por HYDRATE_FROM_SUPABASE — ya no se lee de localStorage:
      // Fase 1: productores, lotes, bitacora, insumos, diesel, dispersiones, egresosManual,
      //   expedientes, ciclos, maquinaria, operadores, ordenesTrabajo, capital, cosecha,
      //   inventario, cicloActivoId. `trabajos` también se quita (valor no confiable).
      // Fase 3: cicloActual, creditosRef, activos, rentas, personal, solicitudesCompra,
      //   ordenesCompra, solicitudesGasto, recomendaciones, notificaciones, delegaciones.
      return {
        // Grupo C (permisos / roles) + config temporal
        // alertaParams: migrado a Supabase (tabla configuracion) — hidrata vía HYDRATE_FROM_SUPABASE
        creditoLimites:  parsed.creditoLimites  || {},
        alertasLeidas:   parsed.alertasLeidas   || [],
        usuariosExtra:   parsed.usuariosExtra   || [],
        usuariosBaseEdit:parsed.usuariosBaseEdit || {},
        permisosUsuario: parsed.permisosUsuario || {},
        permisosGranulares: parsed.permisosGranulares || {},
        rolesPersonalizados: parsed.rolesPersonalizados || {},
        // creditoParams: migrado a Supabase (tabla configuracion) — hidrata vía HYDRATE_FROM_SUPABASE
        // paramsCultivo: migrado a Supabase (tabla params_cultivo) — hidrata vía HYDRATE_FROM_SUPABASE
        // cultivosCatalogo: migrado a Supabase — hidrata vía HYDRATE_FROM_SUPABASE
        // Grupo B (UI local / preferencias)
        cultivoActivo:      parsed.cultivoActivo       || null,
        precioVentaMXN:     parsed.precioVentaMXN      || initState.precioVentaMXN,
        rendimientoEsperado:parsed.rendimientoEsperado || initState.rendimientoEsperado,
        invCampo:           parsed.invCampo            || [],
        colaOffline:        (parsed.colaOffline||[]).filter(x=>!x.sincronizado),
        // Pendientes de migrar a Supabase en futuras fases
        // cosecha: sin tabla Supabase aún — persiste en localStorage hasta migración
        cosecha:         parsed.cosecha         || initState.cosecha,
      };
    } catch(e) {
      console.warn('Error restaurando localStorage:', e);
      return {};
    }
  })();
  const [state, dispatch] = useReducer(reducer, { ...initState, ...savedState });
  const [hydrating, setHydrating] = React.useState(true);
  const stateRef = React.useRef(state);
  React.useEffect(() => { stateRef.current = state; }, [state]);
  // Persist selectivo a localStorage. Solo escribe las claves que la IIFE savedState lee
  // (simetría estricta). Grupo A ya no se persiste — viene por HYDRATE_FROM_SUPABASE.
  React.useEffect(() => {
    try {
      const PERSIST_KEYS = [
        // Grupo B (UI local / preferencias)
        'alertasLeidas', 'cultivoActivo', 'invCampo', 'colaOffline',
        'precioVentaMXN', 'rendimientoEsperado',
        // Grupo C (permisos / roles)
        'permisosUsuario', 'permisosGranulares', 'rolesPersonalizados',
        'usuariosExtra', 'usuariosBaseEdit',
        // Config temporal (pendiente de decisión Fase 2) + pendientes de migrar
        // alertaParams, creditoParams, paramsCultivo, cultivosCatalogo: migrados a Supabase (Fase 3.1-3.3)
        'creditoLimites',
        // cosecha: migrada a Supabase (5 subtablas) — hidrata vía HYDRATE_FROM_SUPABASE, ya no persiste localStorage
      ];
      const toSave = {};
      for (const k of PERSIST_KEYS) {
        if (state[k] !== undefined) toSave[k] = state[k];
      }
      // Filtrar items ya sincronizados de la cola offline antes de persistir
      if (toSave.colaOffline) toSave.colaOffline = toSave.colaOffline.filter(x => !x.sincronizado);
      const json = JSON.stringify(toSave);
      if (json.length > 4 * 1024 * 1024) console.warn('localStorage: >4MB, considera limpiar datos');
      localStorage.setItem("agroSistemaState", json);
    } catch(e) {
      if (e.name === 'QuotaExceededError') console.error('localStorage lleno — considera limpiar datos o fotos');
      else console.error('Error guardando estado:', e);
    }
  }, [state]);

  // Sincronizar usuariosExtra al window para que el LoginScreen pueda accederlos
  useEffect(() => {
    window.__agroExtraUsers = state.usuariosExtra || [];
    window.__agroBaseOverrides = state.usuariosBaseEdit || {};
  }, [state.usuariosExtra, state.usuariosBaseEdit]);

  // Cargar SheetJS para exportación Excel
  useEffect(() => {
    if (typeof XLSX === "undefined") {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      document.head.appendChild(s);
    }
  }, []);
  const { page, setPage, pageStack, setPageStack, navFiltrosRef, navTo, goBack, getNavFiltro } = useAppNavigation(dispatch);

  // Leer ?modulo=X del query string (para abrir desde notificación push)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modulo = params.get('modulo');
    if (modulo) {
      setPage(modulo);
      window.history.replaceState({}, '', '/');
    }
  }, []);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [bellOpen, setBellOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer

  // Cerrar drawer con Escape (debe estar antes del early return de LoginScreen)
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setSidebarOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  // ── Supabase realtime sync ──
  const [connectedUsers, setConnectedUsers] = useState(0);
  const syncChannelRef = useRef(null);
  const syncSenderIdRef = useRef(null);
  const muteBroadcastRef = useRef(false);
  const initialBroadcastSkipRef = useRef(true);

  // Detectar conexión online/offline
  useEffect(() => {
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);
  const [usuario, setUsuario] = useState(null);


  // Restaurar sesión después del reload post-login (handleLogin guarda en sessionStorage)
  // O al volver a abrir la app (incluyendo al tocar una notificación push), leer
  // agro_session persistente de localStorage si no expiró (8 horas).
  React.useEffect(() => {
    if (usuario) return;
    const restore = (u) => {
      setUsuario(u);
      if (u.rol === "campo") setPage("operador");
      else if (["encargado","ingeniero"].includes(u.rol)) setPage("dashboard");
      else if (u.rol === "compras") setPage("flujos");
      else setPage("dashboard");
    };

    // 0) Verificar sesión activa de Supabase Auth (persistente real)
    if (supabaseClient) {
      supabaseClient.auth.getSession().then(({ data }) => {
        if (usuario) return; // ya restaurado por otro camino
        const email = data?.session?.user?.email;
        if (email) {
          const nombre = email.replace('@agro-charay.local', '');
          const u = [...USUARIOS, ...(window.__agroExtraUsers||[])].find(x => x.usuario === nombre);
          if (u) { restore(u); return; }
        }
      }).catch(() => {});
      supabaseClient.auth.onAuthStateChange((event) => {
        // Solo reaccionar a SIGNED_OUT externo (ej: token expirado por Supabase).
        // NO llamar handleLogout aquí: causaría loop porque handleLogout llama signOut.
        if (event === 'SIGNED_OUT') {
          setUsuario(null);
        }
      });
    }

    // 1) Bridge del reload post-login (corto plazo)
    const savedSess = sessionStorage.getItem('agroLoginUser');
    if (savedSess) {
      try {
        const u = JSON.parse(savedSess);
        sessionStorage.removeItem('agroLoginUser');
        restore(u);
        return;
      } catch(e) {}
    }
    // 2) Sesión persistente fallback (8 horas localStorage)
    const savedPers = localStorage.getItem('agro_session');
    if (savedPers) {
      try {
        const sesion = JSON.parse(savedPers);
        const horasTranscurridas = (Date.now() - (sesion.timestamp||0)) / (1000 * 60 * 60);
        if (horasTranscurridas < 8 && sesion.usuario) {
          restore(sesion);
        } else {
          localStorage.removeItem('agro_session');
        }
      } catch(e) { localStorage.removeItem('agro_session'); }
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    loadStateFromSupabase()
      .then((result) => {
        if (cancelled) return;
        if (result && !result.error) {
          dispatch({ type: 'HYDRATE_FROM_SUPABASE', payload: result });
        } else {
          console.warn('[Hydrate] Supabase load failed:', result?.error);
        }
      })
      .catch((err) => {
        console.warn('[Hydrate] Unexpected error:', err);
      })
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });
    return () => { cancelled = true; };
  }, []);

  // ─── Supabase realtime: suscripción al canal al iniciar sesión ──────────────
  useEffect(() => {
    if (!usuario || !supabaseClient) return;
    const senderId = `${usuario.usuario}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    syncSenderIdRef.current = senderId;
    initialBroadcastSkipRef.current = true;

    const channel = supabaseClient.channel(SYNC_CHANNEL, {
      config: {
        broadcast: { self: false },
        presence:  { key: senderId },
      },
    });

    const handleStateSync = ({ payload }) => {
      if (!payload || payload.senderId === senderId) return;
      muteBroadcastRef.current = true;
      dispatch({ type: "SYNC_STATE", payload: payload.state || {} });
    };

    channel
      .on("broadcast", { event: "state-sync" }, handleStateSync)
      .on("presence",  { event: "sync" }, () => {
        try {
          const st = channel.presenceState() || {};
          setConnectedUsers(Object.keys(st).length);
        } catch { setConnectedUsers(0); }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          try {
            await channel.track({
              usuario: usuario.usuario,
              nombre:  usuario.nombre,
              rol:     usuario.rol,
              since:   Date.now(),
            });
          } catch (e) { console.warn("presence track falló:", e); }
        }
      });

    syncChannelRef.current = channel;

    const mapOrdenRow = (r) => {
      const s = stateRef.current || {};
      const op = (s.operadores || []).find(x => x.id === r.operador_id);
      const lo = (s.lotes || []).find(x => x.id === r.lote_id);
      const mq = (s.maquinaria || []).find(x => x.id === r.maquinaria_id);
      const ins = (s.insumos || []).find(x => x.id === r.insumo_id);
      return {
        id: r.id, supabaseId: r.id,
        fecha: r.fecha, tipoTrabajo: r.tipo,
        estatus: r.estatus || 'pendiente',
        operadorId: r.operador_id || null,
        loteId: r.lote_id || null,
        maquinariaId: r.maquinaria_id || null,
        insumoId: r.insumo_id || null,
        operadorNombre: r.operador_nombre || op?.nombre || '',
        loteNombre: r.lote_nombre || lo?.nombre || '',
        maquinariaNombre: r.maquinaria_nombre || mq?.nombre || '',
        insumoNombre: r.insumo_nombre || ins?.nombre || '',
        horaInicio: r.hora_inicio || '',
        horasEstimadas: parseFloat(r.horas_estimadas) || 0,
        notas: r.notas || '',
        creadoPor: r.creado_por || '',
        creadoEn: r.created_at,
        origen: 'supabase',
      };
    };
    const ordenesChannel = supabaseClient
      .channel('ordenes-db-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ordenes_trabajo'
      }, (payload) => {
        try {
          if (payload.eventType === 'INSERT') {
            dispatch({ type: 'ADD_ORDEN_TRABAJO', payload: mapOrdenRow(payload.new) });
          } else if (payload.eventType === 'UPDATE') {
            dispatch({ type: 'UPD_ORDEN_TRABAJO', payload: mapOrdenRow(payload.new) });
          } else if (payload.eventType === 'DELETE') {
            dispatch({ type: 'DEL_ORDEN_TRABAJO', payload: payload.old?.id });
          }
        } catch (e) { console.warn('Postgres Changes ordenes:', e); }
      })
      .subscribe();

    const dieselChannel = supabaseClient
      .channel('diesel-db-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'diesel'
      }, () => {
        fetch(`${SUPABASE_URL}/rest/v1/diesel?select=*&order=fecha.desc&limit=500`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
        })
        .then(r => r.json())
        .then(rows => {
          if (!Array.isArray(rows)) return;
          const mapped = rows.map(r => ({
            id: r.legacy_id || r.id,
            fecha: r.fecha,
            fechaSolicitud: r.fecha_solicitud || r.fecha,
            fechaOrden: r.fecha_orden || r.fecha,
            cantidad: parseFloat(r.cantidad) || 0,
            litros: parseFloat(r.litros_recibidos) || 0,
            precioLitro: parseFloat(r.precio_litro) || 0,
            precioUnitario: parseFloat(r.precio_litro) || 0,
            importe: parseFloat(r.importe) || 0,
            proveedor: r.proveedor || '',
            productorId: r.productor_legacy_id || null,
            productorNombre: r.productor_nombre || '',
            loteId: r.lote_legacy_id || null,
            maquinariaId: r.maquinaria_legacy_id || null,
            concepto: r.concepto || '',
            unidad: r.unidad || 'LT',
            ieps: r.ieps || '',
            numSolicitud: r.num_solicitud || '',
            numOrden: r.num_orden || '',
            esAjuste: r.es_ajuste || false,
            estatus: r.estatus || 'pendiente',
            tipoMovimiento: r.tipo_movimiento || null,
            cancelado: r.cancelado || false,
            notas: r.notas || '',
            bitacoraLegacyId: r.bitacora_legacy_id || null,
            _uuid: r.id,
            origen: 'supabase',
          }));
          dispatch({ type: 'SYNC_STATE', payload: { diesel: mapped } });
        })
        .catch(e => console.warn('Realtime diesel:', e));
      })
      .subscribe();

    const cajaChicaChannel = supabaseClient
      .channel('caja-chica-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'caja_chica_fondos' }, () => {
        fetch(`${SUPABASE_URL}/rest/v1/caja_chica_fondos?estatus=eq.activo&order=created_at.desc&limit=1`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
        })
        .then(r => r.json())
        .then(rows => {
          if (!Array.isArray(rows) || !rows[0]) return;
          const f = rows[0];
          dispatch({ type: 'SET_CAJA_CHICA_FONDO', payload: {
            id: f.id,
            montoAsignado: parseFloat(f.monto_asignado)||0,
            monto_disponible: parseFloat(f.monto_disponible)||0,
            estatus: f.estatus,
            creadoPor: f.creado_por,
            fechaApertura: f.fecha_apertura,
            notas: f.notas,
          }});
        })
        .catch(e => console.warn('Realtime caja_chica_fondos:', e));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'caja_chica_movimientos' }, () => {
        fetch(`${SUPABASE_URL}/rest/v1/caja_chica_movimientos?order=created_at.desc`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
        })
        .then(r => r.json())
        .then(rows => {
          if (!Array.isArray(rows)) return;
          dispatch({ type: 'SET_CAJA_CHICA_MOVIMIENTOS', payload: rows.map(m => ({
            id: m.id,
            fondoId: m.fondo_id,
            tipo: m.tipo,
            concepto: m.concepto || '',
            monto: parseFloat(m.monto)||0,
            foto_url: m.foto_url || '',
            estatus: m.estatus || 'pendiente',
            registradoPor: m.registrado_por || '',
            aprobadoPor: m.aprobado_por || '',
            fecha: m.fecha || '',
            notas: m.notas || '',
            created_at: m.created_at,
          }))});
        })
        .catch(e => console.warn('Realtime caja_chica_movimientos:', e));
      })
      .subscribe();

    return () => {
      try { channel.unsubscribe(); } catch {}
      try { supabaseClient.removeChannel(channel); } catch {}
      try { supabaseClient.removeChannel(ordenesChannel); } catch {}
      try { supabaseClient.removeChannel(dieselChannel); } catch {}
      try { supabaseClient.removeChannel(cajaChicaChannel); } catch {}
      syncChannelRef.current = null;
      syncSenderIdRef.current = null;
      setConnectedUsers(0);
    };
  }, [usuario]);

  // ─── Supabase realtime: broadcast cuando cambian las claves sincronizadas ──
  useEffect(() => {
    // Saltar el primer fire (es el mount inicial con datos locales)
    if (initialBroadcastSkipRef.current) { initialBroadcastSkipRef.current = false; return; }
    // Si venimos de aplicar un cambio remoto, no rebroadcast
    if (muteBroadcastRef.current) { muteBroadcastRef.current = false; return; }
    const ch = syncChannelRef.current;
    if (!ch || !usuario) return;
    try {
      ch.send({
        type: "broadcast",
        event: "state-sync",
        payload: {
          senderId: syncSenderIdRef.current,
          state: {
            solicitudesGasto:  state.solicitudesGasto  || [],
            solicitudesCompra: state.solicitudesCompra || [],
            recomendaciones:   state.recomendaciones   || [],
            ordenesCompra:     state.ordenesCompra     || [],
            notificaciones:    state.notificaciones    || [],
            delegaciones:      state.delegaciones      || [],
            ordenesTrabajo:    state.ordenesTrabajo    || [],
            bitacora:          state.bitacora          || [],
          },
        },
      });
    } catch (e) { console.warn("broadcast falló:", e); }
  }, [state.solicitudesGasto, state.solicitudesCompra, state.recomendaciones, state.ordenesCompra, state.notificaciones, state.delegaciones, state.ordenesTrabajo, state.bitacora, usuario]);

  // Logout unificado — limpia storage + Supabase Auth + estado local
  // Fix: al cambiar de usuario, el rol/estado del usuario anterior quedaba
  // pegado en localStorage y la siguiente sesión cargaba con vista incorrecta.
  const handleLogout = async () => {
    try {
      // 1. Supabase Auth: revocar JWT (no bloquear si falla)
      if (supabaseClient) {
        await supabaseClient.auth.signOut().catch(() => {});
      }
    } catch (e) { console.warn('signOut falló:', e); }

    // 2. localStorage: borrar claves del dominio de la app + token Supabase
    //    (selectivo para no tocar preferencias ajenas si las hubiera)
    try {
      const prefijos = ['agro_', 'agroSistema', 'sb-', 'supabase.auth'];
      const keys = Object.keys(localStorage);
      keys.forEach(k => {
        if (prefijos.some(p => k.startsWith(p) || k.includes(p))) {
          localStorage.removeItem(k);
        }
      });
    } catch (e) { console.warn('localStorage cleanup falló:', e); }

    // 3. sessionStorage: limpieza total (solo usamos agroLoginUser como bridge)
    try {
      sessionStorage.clear();
    } catch (e) { console.warn('sessionStorage cleanup falló:', e); }

    // 4. Estado local: soltar el usuario para forzar render del login
    setUsuario(null);
  };

  const handleLogin = async (u) => {
    sessionStorage.setItem('agroLoginUser', JSON.stringify(u));
    // Persistir sesión 8 horas — sobrevive al cierre/reapertura de la app (PWA)
    localStorage.setItem('agro_session', JSON.stringify({
      ...u,
      timestamp: Date.now(),
    }));
    // Auth real con Supabase para sesión persistente (non-blocking)
    if (supabaseClient) {
      supabaseClient.auth.signInWithPassword({
        email: `${u.usuario}@agro-charay.local`,
        password: u.password,
      }).catch(() => {
        // Si no existe el usuario en Supabase Auth, intentar crear (auto-signup)
        supabaseClient.auth.signUp({
          email: `${u.usuario}@agro-charay.local`,
          password: u.password,
        }).catch(err => console.warn('Supabase auth signup failed (non-critical):', err));
      });
    }
    window.location.reload();
  };

  if (!usuario) return <LoginScreen onLogin={handleLogin} />;

  if (hydrating) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#1a3a0f', color: '#e8f5e9',
      fontFamily: 'system-ui, sans-serif', fontSize: '1.2rem'
    }}>
      Cargando datos…
    </div>
  );

  // ─── Vista minimalista para operadores de campo (bypass total del layout) ─
  if (usuario.rol === "campo") {
    return (
      <ErrorBoundary>
      <Ctx.Provider value={{ state, dispatch }}>
        <VistaOperador usuario={usuario} onLogout={handleLogout} />
      </Ctx.Provider>
      </ErrorBoundary>
    );
  }

  const rol = usuario.rol;
  // Permisos granulares por usuario
  const permisosActual = getPermisosUsuario(state, usuario.id, rol);
  const accesoRol = rol === "admin"
    ? ACCESO.admin
    : [...new Set([
        ...(ACCESO[rol] || []),
        ...Object.keys(permisosActual).filter(m => permisosActual[m] === "ver" || permisosActual[m] === "editar"),
      ])];
  const puedeEditarMod = (modId) => rol === "admin" || permisosActual[modId] === "editar";

  // navTo — navegación programática (KPIs, links internos): guarda historial
  // navMenu — navegación por menú lateral: limpia historial + cierra drawer.
  // Vive en App.jsx porque depende de setSidebarOpen (estado del shell).
  const navMenu = (nextPage) => {
    setPageStack([]);
    navFiltrosRef.current = {};
    dispatch({ type: "SET_PRODUCTOR_ACTIVO", payload: null });
    setPage(nextPage);
    setSidebarOpen(false);
  };

  // NAV filtrado por rol
  const navFiltrado = NAV.filter(item => item.section || accesoRol.includes(item.id));

  // Secciones vacías (todas sus items fueron filtradas) — las eliminamos
  const navLimpio = navFiltrado.filter((item, i) => {
    if (!item.section) return true;
    const next = navFiltrado[i+1];
    return next && !next.section;
  });

  // Alertas para badge en sidebar
  const alertasSidebar = calcularAlertas(state);
  const nCriticas = alertasSidebar.filter(a=>a.nivel==="critico").length;
  const nAlertas  = alertasSidebar.length;
  const modsConAlerta = new Set(alertasSidebar.map(a=>a.mod));

  // Pendientes de aprobación para badge en flujos
  const pendFlujos = [
    ...(state.solicitudesCompra||[]).filter(s=>s.estatus==="pendiente"),
    ...(state.solicitudesGasto||[]).filter(s=>s.estatus==="pendiente"),
    ...(state.recomendaciones||[]).filter(s=>s.estatus==="pendiente"),
  ].length;

  const rolInfo = getRolInfo(state, rol);

  return (
    <ErrorBoundary>
    <Ctx.Provider value={{ state, dispatch }}>
      <div className="app">
        {/* SIDEBAR */}
        <div className={`sidebar-backdrop${sidebarOpen?" open":""}`}
          onClick={()=>setSidebarOpen(false)}/>
        <div className={`sidebar${sidebarOpen?" open":""}`}>
          <div className="sidebar-logo">
            <div className="logo-title">AgroSistema</div>
            <div className="logo-title" style={{color:"rgba(255,255,255,0.5)",fontSize:14}}>Charay</div>
            <div className="logo-sub">Control agrícola integral</div>
          </div>

          {/* Usuario conectado */}
          <div style={{margin:"0 12px 8px",padding:"10px 14px",background:"rgba(255,255,255,0.08)",borderRadius:10,display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:rolInfo.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{rolInfo.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{color:"white",fontWeight:600,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{usuario.nombre}</div>
              <div style={{color:"rgba(255,255,255,0.55)",fontSize:11}}>{rolInfo.label}</div>
            </div>
            {(rol==='admin'||usuario?.usuario==='daniela') && (
              <button onClick={()=>exportarResumenCiclo(state)} title="Respaldo Excel"
                style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:14,padding:2,flexShrink:0}}>📥</button>
            )}
            <button onClick={handleLogout} title="Cerrar sesión"
              style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:16,padding:2,flexShrink:0}} >⏏</button>
          </div>

          <div style={{flex:1,overflowY:"auto",paddingBottom:12}}>
            {navLimpio.map((item, i) =>
              item.section ? (
                <div key={i} className="sidebar-section-label">{item.section}</div>
              ) : (
                <div key={item.id} className={`nav-item ${page===item.id?"active":""}`} onClick={()=>navMenu(item.id)}
                  style={{position:"relative"}}>
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                  {/* Badge de alerta en el item dashboard */}
                  {item.id==="dashboard" && nAlertas>0 && (
                    <span style={{marginLeft:"auto",background:nCriticas>0?"#c0392b":"#e67e22",
                      color:"white",borderRadius:10,fontSize:10,fontWeight:800,
                      padding:"1px 6px",minWidth:18,textAlign:"center"}}>
                      {nAlertas}
                    </span>
                  )}
                  {/* Badge de pendientes en flujos */}
                  {item.id==="flujos" && pendFlujos>0 && (
                    <span style={{marginLeft:"auto",background:"#e67e22",color:"white",
                      borderRadius:10,fontSize:10,fontWeight:800,padding:"1px 6px",minWidth:18,textAlign:"center"}}>
                      {pendFlujos}
                    </span>
                  )}
                  {/* Punto naranja en módulos con alertas (no dashboard, no flujos) */}
                  {item.id!=="dashboard" && item.id!=="flujos" && modsConAlerta.has(item.id) && (
                    <span style={{marginLeft:"auto",width:8,height:8,borderRadius:"50%",
                      background:alertasSidebar.find(a=>a.mod===item.id)?.nivel==="critico"?"#c0392b":"#e67e22",
                      flexShrink:0,boxShadow:"0 0 4px rgba(230,126,34,0.6)"}}/>
                  )}
                </div>
              )
            )}
          </div>

          <div className="sidebar-footer">
            <div>Ciclo activo</div>
            <div className="cycle-badge"
              style={{cursor: rol==="admin" ? "pointer" : "default"}}
              onClick={()=>{ if(rol==="admin") setPage("ciclos"); }}
              title={rol==="admin" ? "Ir a Ciclos Agrícolas" : ""}>
              {state.cicloActual || "OI 2025-2026"}
            </div>
            {state.cultivoActivo && (
              <div style={{marginTop:4,fontSize:10,color:"rgba(255,255,255,0.7)",textAlign:"center",
                background:"rgba(255,255,255,0.1)",borderRadius:6,padding:"2px 8px"}}>
                🌾 {state.cultivoActivo.cultivoNombre} — {state.cultivoActivo.variedad}
              </div>
            )}
            {state.productorActivo && (
              <div style={{marginTop:4,fontSize:10,color:"rgba(255,255,255,0.6)",textAlign:"center"}}>
                📌 {state.productores.find(p=>p.id===state.productorActivo)?.alias}
              </div>
            )}
          </div>
        </div>

        {/* MAIN AREA */}
        <div className="main">
          <div className="topbar">
            <button className="hamburger" aria-label="Abrir menú"
              onClick={()=>setSidebarOpen(o=>!o)}>☰</button>
            <div className="topbar-title">{PAGE_TITLES[page]}</div>
            <div className="topbar-right" style={{gap:12}}>
              <div className="mobile-hide" style={{display:"contents"}}>
                {(rol === "admin" || rol === "socio") && <ProductorSelector />}
                <div onClick={()=>{setPageStack([]);navFiltrosRef.current={};setPage("dashboard");}} style={{cursor:"pointer"}}>
                  <WidgetCBOTCompact />
                </div>
              </div>
              {rol !== "campo" && (()=>{
                const notifs = state.notificaciones || [];
                const misNotifs = notifs.filter(n => n.para===rol || n.para===usuario?.usuario || n.para==="todos" || !n.para);
                const noLeidas = misNotifs.filter(n=>!n.leida);
                const ultimas = misNotifs.slice(0,5);
                const ICONO_TIPO = {
                  aprobacion:"✅", alerta:"⚠️", error:"❌", info:"ℹ️",
                  credito:"💰", gasto:"💸", insumo:"🧪", diesel:"⛽",
                  cosecha:"🌾", sistema:"⚙️", bitacora:"📋"
                };
                const TITULO_TIPO = {
                  aprobacion:"Aprobación", alerta:"Alerta", error:"Error", info:"Información",
                  credito:"Crédito", gasto:"Egreso", insumo:"Insumos", diesel:"Diesel",
                  cosecha:"Cosecha", sistema:"Sistema", bitacora:"Bitácora"
                };
                const tiempoRel = (fecha) => {
                  if (!fecha) return "";
                  const ms = Date.now() - new Date(fecha).getTime();
                  const min = Math.floor(ms/60000);
                  if (min < 1) return "ahora";
                  if (min < 60) return `hace ${min} min`;
                  const h = Math.floor(min/60);
                  if (h < 24) return `hace ${h} h`;
                  const d = Math.floor(h/24);
                  if (d < 7) return `hace ${d} d`;
                  return new Date(fecha).toLocaleDateString("es-MX",{day:"2-digit",month:"short"});
                };
                return (
                  <div style={{position:"relative"}}>
                    <button onClick={()=>setBellOpen(o=>!o)}
                      title="Notificaciones"
                      style={{background:"none",border:"none",cursor:"pointer",
                        padding:"6px 8px",borderRadius:8,position:"relative",
                        display:"flex",alignItems:"center",justifyContent:"center",
                        transition:"background 0.15s"}}
                      onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"}
                      onMouseLeave={e=>e.currentTarget.style.background="none"}>
                      <span style={{fontSize:20,lineHeight:1}}>🔔</span>
                      {noLeidas.length>0 && (
                        <span style={{position:"absolute",top:2,right:2,
                          minWidth:16,height:16,borderRadius:8,padding:"0 4px",
                          background:"#c0392b",color:"white",fontSize:10,fontWeight:700,
                          display:"flex",alignItems:"center",justifyContent:"center",
                          border:"2px solid white",boxSizing:"content-box"}}>
                          {noLeidas.length>99?"99+":noLeidas.length}
                        </span>
                      )}
                    </button>
                    {bellOpen && (
                      <>
                        <div onClick={()=>setBellOpen(false)}
                          style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:999}}/>
                        <div style={{position:"absolute",top:"calc(100% + 8px)",right:0,
                          width:360,maxHeight:480,background:"white",
                          borderRadius:12,boxShadow:"0 12px 32px rgba(0,0,0,0.18)",
                          border:"1px solid #e8e0d0",zIndex:1000,overflow:"hidden",
                          display:"flex",flexDirection:"column"}}>
                          <div style={{padding:"14px 16px",borderBottom:"1px solid #f0ece4",
                            display:"flex",alignItems:"center",justifyContent:"space-between",
                            background:"#faf8f3"}}>
                            <div style={{fontWeight:700,fontSize:14,color:"#3d3525"}}>
                              🔔 Notificaciones
                              {noLeidas.length>0 && (
                                <span style={{marginLeft:8,fontSize:11,padding:"2px 8px",
                                  borderRadius:10,background:"#c0392b22",color:"#c0392b",fontWeight:600}}>
                                  {noLeidas.length} sin leer
                                </span>
                              )}
                            </div>
                            {noLeidas.length>0 && (
                              <button onClick={()=>dispatch({type:"LEER_ALL_NOTIF"})}
                                style={{background:"none",border:"none",cursor:"pointer",
                                  fontSize:11,color:"#1a6ea8",fontWeight:600,padding:"4px 8px",borderRadius:6}}>
                                Marcar todas leídas
                              </button>
                            )}
                          </div>
                          <div style={{flex:1,overflowY:"auto"}}>
                            {ultimas.length===0 ? (
                              <div style={{padding:"40px 20px",textAlign:"center",color:"#8a8070"}}>
                                <div style={{fontSize:32,marginBottom:8}}>📭</div>
                                <div style={{fontSize:13,fontWeight:600}}>Sin notificaciones</div>
                                <div style={{fontSize:11,marginTop:4}}>Todo al día</div>
                              </div>
                            ) : (
                              ultimas.map(n=>{
                                const icono = ICONO_TIPO[n.tipo] || "📌";
                                const titulo = n.titulo || TITULO_TIPO[n.tipo] || "Notificación";
                                return (
                                  <div key={n.id}
                                    onClick={()=>!n.leida && dispatch({type:"LEER_NOTIF",payload:n.id})}
                                    style={{padding:"12px 16px",borderBottom:"1px solid #f5f2e9",
                                      cursor:n.leida?"default":"pointer",
                                      background:n.leida?"white":"#f0f8e8",
                                      display:"flex",gap:10,transition:"background 0.15s"}}
                                    onMouseEnter={e=>{if(!n.leida)e.currentTarget.style.background="#e4f1d4";}}
                                    onMouseLeave={e=>{if(!n.leida)e.currentTarget.style.background="#f0f8e8";}}>
                                    <div style={{fontSize:20,lineHeight:1,flexShrink:0,marginTop:2}}>{icono}</div>
                                    <div style={{flex:1,minWidth:0}}>
                                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                                        <span style={{fontWeight:700,fontSize:13,color:"#3d3525"}}>{titulo}</span>
                                        {!n.leida && <span style={{width:6,height:6,borderRadius:"50%",background:"#c0392b"}}/>}
                                      </div>
                                      <div style={{fontSize:12,color:"#5a5040",lineHeight:1.4,
                                        overflow:"hidden",textOverflow:"ellipsis",
                                        display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>
                                        {n.mensaje||"—"}
                                      </div>
                                      <div style={{fontSize:10,color:"#8a8070",marginTop:4}}>{tiempoRel(n.fecha)}</div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                          {misNotifs.length>5 && (
                            <div style={{padding:"10px 16px",borderTop:"1px solid #f0ece4",
                              textAlign:"center",fontSize:11,color:"#8a8070",background:"#faf8f3"}}>
                              Mostrando 5 de {misNotifs.length}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
              <div className="topbar-date">{today()}</div>
              <span className="badge" style={{background:rolInfo.color+"22",color:rolInfo.color,border:`1px solid ${rolInfo.color}44`,fontSize:11,fontWeight:600}}>
                {rolInfo.icon} {rolInfo.label}
              </span>
              {/* Realtime: usuarios conectados */}
              {supabaseClient && connectedUsers > 0 && (
                <span title={`${connectedUsers} sesión(es) activa(s) sincronizando en tiempo real`}
                  style={{display:"inline-flex",alignItems:"center",gap:6,
                    padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,
                    background:"rgba(46,213,115,0.15)",color:"#1e8449",
                    border:"1px solid rgba(46,213,115,0.4)"}}>
                  <span style={{width:8,height:8,borderRadius:"50%",background:"#2ed573",
                    boxShadow:"0 0 6px rgba(46,213,115,0.8)",animation:"pulse 2s infinite"}}/>
                  {connectedUsers} conectado{connectedUsers===1?"":"s"}
                </span>
              )}
              {/* Offline indicator */}
              {!isOnline && (
                <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,
                  background:"#c0392b22",color:"#c0392b",border:"1px solid #c0392b44"}}>
                  🔴 Sin conexión
                </span>
              )}
              {isOnline && (state.colaOffline||[]).filter(x=>!x.sincronizado).length > 0 && (
                <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,
                  background:"#e67e2222",color:"#e67e22",border:"1px solid #e67e2244"}}>
                  🟡 {(state.colaOffline||[]).filter(x=>!x.sincronizado).length} pendiente(s) sync
                </span>
              )}
              {/* Delegación activa */}
              {(()=>{
                const hoyISO = new Date().toISOString().slice(0,10);
                const delActiva = (state.delegaciones||[]).find(d=>
                  d.activa && d.para===usuario?.usuario && d.desde<=hoyISO && d.hasta>=hoyISO
                );
                if(!delActiva) return null;
                const todosU = [...(USUARIOS||[]),...(state.usuariosExtra||[])];
                const nomDe = todosU.find(u=>u.usuario===delActiva.de)?.nombre || delActiva.de;
                return (
                  <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,
                    background:"#1a6ea822",color:"#1a6ea8",border:"1px solid #1a6ea844"}}
                    title={`Delegado por ${nomDe} hasta ${delActiva.hasta}`}>
                    🔁 Delegado por {nomDe}
                  </span>
                );
              })()}
            </div>
          </div>
          {rol === "admin" && (() => {
            const exps = state.expedientes || [];
            const vencidos = exps.filter(e => {
              const dias = Math.round((new Date(e.fechaVencimiento) - new Date()) / 86400000);
              const saldo = (e.ministraciones||[]).reduce((s,m)=>s+(m.monto||0),0) - (e.pagos||[]).reduce((s,p)=>s+(p.monto||0),0);
              return dias <= 30 && saldo > 0;
            });
            if (!vencidos.length) return null;
            const hayVencidos = vencidos.some(e => new Date(e.fechaVencimiento) < new Date());
            return (
              <div style={{margin:"0 0 12px",padding:"12px 20px",background:hayVencidos?"#fff1f0":"#fff8e6",border:`1.5px solid ${hayVencidos?T.rust:T.straw}`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:22}}>{hayVencidos?"🔴":"⚠️"}</span>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:hayVencidos?T.rust:T.straw}}>
                      {hayVencidos ? `${vencidos.filter(e=>new Date(e.fechaVencimiento)<new Date()).length} expediente(s) vencido(s)` : `${vencidos.length} expediente(s) vencen en menos de 30 días`}
                    </div>
                    <div style={{fontSize:11,color:T.fog}}>{vencidos.map(e=>state.productores.find(p=>p.id===e.productorId)?.alias||"—").join(", ")}</div>
                  </div>
                </div>
                <button onClick={()=>setPage("credito")} className="btn btn-secondary" style={{fontSize:12}}>Ver expedientes →</button>
              </div>
            );
          })()}
          <div className="content">
            {pageStack.length > 0 && (
              <button onClick={goBack} style={{
                display:"inline-flex",alignItems:"center",gap:6,marginBottom:12,
                padding:"6px 14px",background:"white",border:`1px solid ${T.line}`,
                borderRadius:8,cursor:"pointer",fontSize:13,color:T.fog,fontWeight:500,
                boxShadow:"0 1px 3px rgba(0,0,0,0.06)",
              }}
              onMouseOver={e=>{e.currentTarget.style.color=T.ink;e.currentTarget.style.borderColor=T.fog;}}
              onMouseOut={e=>{e.currentTarget.style.color=T.fog;e.currentTarget.style.borderColor=T.line;}}>
                ← Volver
              </button>
            )}
            <AppRouter
              page={page}
              rol={rol}
              accesoRol={accesoRol}
              puedeEditarMod={puedeEditarMod}
              usuario={usuario}
              navTo={navTo}
              navMenu={navMenu}
              getNavFiltro={getNavFiltro}
              WidgetCBOTDashboard={WidgetCBOTDashboard}
            />
          </div>
        </div>
      </div>
    </Ctx.Provider>
    <ToastContainer />
    </ErrorBoundary>
  );
}