// ─── modules/Asiste.jsx ───────────────────────────────────────────

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


export default function AsisteModule() {
  const { state, dispatch } = useData();

  // ── Motor IA: "gemini" (gratis) | "claude" (premium) ─────────────────────────
  const [motor, setMotor]           = useState(state.iaMotor || "gemini");
  const [showConfig, setShowConfig] = useState(false);
  const [keyClaude,  setKeyClaude]  = useState(state.iaKeyClaude || "");
  const [keyGuardada, setKeyGuardada] = useState(false);

  // Gemini usa key embebida; Claude requiere key manual
  const keyActiva   = motor === "gemini" ? _gk() : (state.iaKeyClaude || keyClaude).trim();
  const keyFaltante = motor === "claude" && !keyActiva;

  const guardarKeys = () => {
    dispatch({ type:"SET_IA_CONFIG", payload:{ motor, keyGemini: "", keyClaude: keyClaude.trim() } });
    setKeyGuardada(true);
    setTimeout(()=>{ setKeyGuardada(false); setShowConfig(false); }, 1500);
  };

  const cambiarMotor = (m) => {
    setMotor(m);
    dispatch({ type:"SET_IA_CONFIG", payload:{ motor: m, keyGemini: "", keyClaude: (state.iaKeyClaude || keyClaude).trim() } });
  };

  const mensajeInicial = [{ role:"assistant", text:"¡Hola! Soy tu asistente de AgroSistema Charay. Puedo ayudarte de dos formas:\n\n📸 Sube una foto de ticket, factura o recibo y extraigo los datos automáticamente.\n💬 Dime en lenguaje natural cualquier gasto, actividad o evento y lo registro.\n🌱 También respondo preguntas agronómicas sobre tus cultivos.\n\n¿Por dónde empezamos?" }];
  const [messages, setMessages]   = useState(
    (state.iaHistorial && state.iaHistorial.length > 0) ? state.iaHistorial : mensajeInicial
  );
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [adjunto, setAdjunto]     = useState(null); // { tipo:"image"|"pdf", base64, mimeType, nombre }
  const fileRef                   = React.useRef();
  const chatRef                   = React.useRef();

  // Scroll to bottom + persist historial on new message
  React.useEffect(()=>{
    if(chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
    // Guardar en state global para persistir entre navegaciones
    // Solo mensajes de texto (sin base64 de imágenes para no saturar el state)
    const historialLimpio = messages.map(m => ({
      role: m.role,
      text: m.text,
      capturas: m.capturas || null,
      // Omitir base64 del adjunto para no saturar memoria
    }));
    dispatch({ type:"SET_IA_HISTORIAL", payload: historialLimpio });
  },[messages]);

  // File picker handler
  const handleFile = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(",")[1];
      const mimeType = file.type;
      const tipo = mimeType === "application/pdf" ? "pdf" : "image";
      setAdjunto({ tipo, base64, mimeType, nombre:file.name });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removeAdjunto = () => setAdjunto(null);

  // Build API message content with optional attachment
  const buildContent = (texto, adj) => {
    if(!adj) return texto || "Analiza este documento.";
    if(adj.tipo === "image") {
      return [
        { type:"image", source:{ type:"base64", media_type:adj.mimeType, data:adj.base64 } },
        { type:"text",  text: texto || "Extrae y registra los datos de esta imagen." }
      ];
    }
    // PDF
    return [
      { type:"document", source:{ type:"base64", media_type:"application/pdf", data:adj.base64 } },
      { type:"text",     text: texto || "Extrae y registra los datos de este documento." }
    ];
  };

  // Dispatch a confirmed capture to the correct reducer action
  const guardarCaptura = (captura) => {
    const hoy = new Date().toISOString().split("T")[0];
    switch(captura.modulo) {
      case "gasto":
        dispatch({ type:"ADD_GASTO", payload:{
          fecha:     captura.fecha||hoy,
          concepto:  captura.concepto||"",
          monto:     parseFloat(captura.monto)||0,
          categoria: captura.categoria||"Otro",
          formaPago: captura.formaPago||"contado",
          proveedor: captura.proveedor||"",
          notas:     captura.notas||"",
        }});
        break;
      case "diesel":
        dispatch({ type:"ADD_DIESEL", payload:{
          fecha:       captura.fecha||hoy,
          litros:      parseFloat(captura.litros)||0,
          precioLitro: parseFloat(captura.precioLitro)||0,
          concepto:    captura.concepto||"Carga diesel",
          unidad:      captura.unidad||"",
          formaPago:   captura.formaPago||"contado",
          notas:       captura.notas||"",
        }});
        break;
      case "insumo":
        dispatch({ type:"ADD_INSUMO", payload:{
          nombre:       captura.nombre||"",
          categoria:    captura.categoria||"Fertilizante",
          unidad:       captura.unidad||"kg",
          stockInicial: parseFloat(captura.stockInicial)||0,
          stockActual:  parseFloat(captura.stockActual||captura.stockInicial)||0,
          costoUnitario:parseFloat(captura.costoUnitario)||0,
          proveedor:    captura.proveedor||"",
          loteDestino:  captura.loteDestino||"General",
          fechaEntrada: captura.fechaEntrada||hoy,
        }});
        break;
      case "trabajo":
        const loteEncontrado = state.lotes.find(l=>
          (l.apodo||l.lote||"").toLowerCase().includes((captura.loteNombre||"").toLowerCase())
        );
        dispatch({ type:"ADD_TRABAJO", payload:{
          fecha:         captura.fecha||hoy,
          tipo:          captura.tipo||"Otro",
          loteId:        loteEncontrado?.id||state.lotes[0]?.id||null,
          operador:      captura.operador||"",
          horas:         parseFloat(captura.horas)||0,
          maquinaria:    captura.maquinaria||"",
          observaciones: captura.observaciones||"",
        }});
        break;
      case "aportacion":
        dispatch({ type:"ADD_APORTACION", payload:{
          fecha:    captura.fecha||hoy,
          monto:    parseFloat(captura.monto)||0,
          concepto: captura.concepto||"",
          socio:    captura.socio||"",
          notas:    captura.notas||"",
        }});
        break;
      case "ministracion":
        dispatch({ type:"ADD_MINISTRACION", payload:{
          fecha:    captura.fecha||hoy,
          monto:    parseFloat(captura.monto)||0,
          concepto: captura.concepto||"Ministración",
          origen:   "manual",
          estatus:  "aplicado",
        }});
        break;
      default: break;
    }
  };

  const sendMsg = async () => {
    if((!input.trim() && !adjunto) || loading) return;
    if(keyFaltante) { setShowConfig(true); return; }

    const userText = input.trim();
    setInput("");
    const adjCopy = adjunto;
    setAdjunto(null);

    // Add user message bubble
    setMessages(m => [...m, {
      role:"user",
      text: userText || `📎 ${adjCopy?.nombre}`,
      adjunto: adjCopy ? { tipo:adjCopy.tipo, nombre:adjCopy.nombre, mimeType:adjCopy.mimeType, base64:adjCopy.base64 } : null
    }]);
    setLoading(true);

    try {
      let raw = "";

      if (motor === "gemini") {
        // ── MODO ESTÁNDAR (Claude Haiku — rápido y económico) ────────────────
        // Nota: Gemini no está disponible desde el sandbox de Claude Artifacts por CORS.
        // Se usa Claude Haiku como motor estándar vía API de Anthropic.
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": keyActiva,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true"
          },
          body: JSON.stringify({
            model:      "claude-haiku-4-5-20251001",
            max_tokens: 1500,
            system:     CAPTURE_SYSTEM(state),
            messages: [
              ...messages.slice(-6).map(m=>({
                role: m.role==="assistant"?"assistant":"user",
                content: typeof m.text==="string" ? m.text : ""
              })),
              { role:"user", content: buildContent(userText, adjCopy) }
            ]
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        raw = data.content?.[0]?.text || "";

      } else {
        // ── CLAUDE (premium) ─────────────────────────────────────────────────
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": keyActiva,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true"
          },
          body: JSON.stringify({
            model:      "claude-sonnet-4-6",
            max_tokens: 1500,
            system:     CAPTURE_SYSTEM(state),
            messages: [
              ...messages.slice(-6).map(m=>({
                role: m.role==="assistant"?"assistant":"user",
                content: typeof m.text==="string" ? m.text : ""
              })),
              { role:"user", content: buildContent(userText, adjCopy) }
            ]
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        raw = data.content?.[0]?.text || "";
      }

      // Try to parse JSON response
      let capturas = [];
      let textoRespuesta = raw;

      try {
        // Clean: remove possible markdown fences
        const clean = raw.replace(/```json|```/g,"").trim();
        // Find JSON object
        const jsonStart = clean.indexOf("{");
        const jsonEnd   = clean.lastIndexOf("}");
        if(jsonStart !== -1 && jsonEnd !== -1) {
          const parsed = JSON.parse(clean.slice(jsonStart, jsonEnd+1));
          capturas       = parsed.capturas || [];
          textoRespuesta = parsed.texto || "";
        }
      } catch(_) {
        // Not JSON → pure text response
        capturas = [];
        textoRespuesta = raw;
      }

      setMessages(m => [...m, {
        role:"assistant",
        text: textoRespuesta,
        capturas: capturas.length > 0 ? capturas : null,
      }]);

    } catch(e) {
      setMessages(m => [...m, { role:"assistant", text:"Error de conexión. Verifica tu internet." }]);
    }
    setLoading(false);
  };

  // Handle confirmation of a capture card
  const confirmarCaptura = (msgIdx, captIdx, captura) => {
    guardarCaptura(captura);
    setMessages(msgs => msgs.map((m,mi) => {
      if(mi !== msgIdx) return m;
      const nuevasCapturas = (m.capturas||[]).map((c,ci) =>
        ci===captIdx ? { ...c, _guardado:true } : c
      );
      return { ...m, capturas:nuevasCapturas };
    }));
  };

  const descartarCaptura = (msgIdx, captIdx) => {
    setMessages(msgs => msgs.map((m,mi) => {
      if(mi !== msgIdx) return m;
      const nuevasCapturas = (m.capturas||[]).map((c,ci) =>
        ci===captIdx ? { ...c, _descartado:true } : c
      );
      return { ...m, capturas:nuevasCapturas };
    }));
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 120px)"}}>
      <div className="card" style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* Header */}
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span style={{fontSize:22}}>🌱</span>
            <div>
              <div className="card-title">Asistente Inteligente</div>
              <div style={{fontSize:11,color:T.fog}}>Captura automática · Preguntas agronómicas · Análisis de documentos</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {/* Toggle motor */}
            <div style={{display:"flex",borderRadius:8,border:"1px solid #d0e0d0",overflow:"hidden",fontSize:11,fontWeight:700}}>
              <div onClick={()=>cambiarMotor("gemini")}
                style={{padding:"5px 12px",cursor:"pointer",transition:"all .15s",
                  background: motor==="gemini" ? T.field : "white",
                  color:       motor==="gemini" ? "white"  : "#5a7a5a"}}>
                ⚡ Estándar <span style={{fontWeight:400,opacity:.8}}>(Haiku)</span>
              </div>
              <div onClick={()=>cambiarMotor("claude")}
                style={{padding:"5px 12px",cursor:"pointer",transition:"all .15s",
                  background: motor==="claude" ? "#2d5a9b" : "white",
                  color:       motor==="claude" ? "white"   : "#5a7a5a"}}>
                🚀 Premium <span style={{fontWeight:400,opacity:.8}}>(Sonnet)</span>
              </div>
            </div>
            {motor === "claude" && (
              <button onClick={()=>setShowConfig(v=>!v)}
                style={{background:"none",border:`1px solid ${keyFaltante?"#e74c3c":"#d0e0d0"}`,borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:12,color:keyFaltante?"#c0392b":"#5a7a5a"}}
                title="Configurar API Key Premium">
                {keyFaltante ? "⚠️ Ingresar Key" : "🔑 API Key"}
              </button>
            )}
            {messages.length > 1 && (
              <button
                onClick={()=>{ setMessages(mensajeInicial); dispatch({type:"SET_IA_HISTORIAL",payload:mensajeInicial}); }}
                style={{background:"none",border:"1px solid #ddd5c0",borderRadius:6,padding:"4px 9px",fontSize:11,color:"#8a8070",cursor:"pointer"}}
                title="Limpiar conversación">
                🗑️ Nueva
              </button>
            )}
          </div>
        </div>

        {/* Panel configuración API Keys */}
        {showConfig && (
          <div style={{padding:"14px 16px",background:"#f0f7ff",borderBottom:"1px solid #b8d4f0"}}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:12,color:"#1a3d6e"}}>🔑 API Key — Modo Premium (Claude Sonnet)</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
              {/* Gemini — key embebida, no se muestra */}
              <div style={{background:"white",borderRadius:8,padding:"10px 14px",border:"1px solid #d0e0f0"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                  <span style={{fontSize:14}}>✨</span>
                  <span style={{fontWeight:700,fontSize:12,color:"#1a73e8"}}>Google Gemini</span>
                  <span style={{fontSize:10,padding:"2px 6px",borderRadius:10,background:"#e8f5e9",color:"#2d7a3a",fontWeight:600}}>GRATIS</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"#e8f5e9",borderRadius:7,border:"1px solid #b2dfdb"}}>
                  <span style={{fontSize:16}}>✅</span>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:"#2d7a3a"}}>Configurado y listo</div>
                    <div style={{fontSize:10,color:"#5a9a7a"}}>Gemini 2.0 Flash · Sin costo · 1,500 req/día</div>
                  </div>
                </div>
              </div>
              {/* Claude */}
              <div style={{background:"white",borderRadius:8,padding:"10px 14px",border:"1px solid #d0e0f0"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <span style={{fontSize:14}}>🤖</span>
                  <span style={{fontWeight:700,fontSize:12,color:T.field}}>Anthropic Claude</span>
                  <span style={{fontSize:10,padding:"2px 6px",borderRadius:10,background:"#fff3cd",color:"#856404",fontWeight:600}}>PREMIUM</span>
                </div>
                <input
                  className="form-input"
                  style={{fontSize:11,padding:"6px 10px"}}
                  placeholder="sk-ant-... (console.anthropic.com)"
                  value={keyClaude}
                  onChange={e=>setKeyClaude(e.target.value)}
                  type="password"
                />
                <div style={{fontSize:10,color:"#5a7a9a",marginTop:4}}>
                  Obtén tu key en <strong>console.anthropic.com</strong> → API Keys
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button className="btn btn-primary btn-sm" onClick={guardarKeys}>
                {keyGuardada ? "✅ Guardado" : "💾 Guardar Keys"}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={()=>setShowConfig(false)}>Cerrar</button>
              <span style={{fontSize:10,color:"#5a7a9a"}}>Las keys se guardan en la sesión actual del sistema.</span>
            </div>
          </div>
        )}

        {/* Alerta si no hay key configurada */}
        {keyFaltante && !showConfig && (
          <div style={{padding:"10px 16px",background:"#fff3cd",borderBottom:"1px solid #ffc107",fontSize:12,color:"#856404",display:"flex",alignItems:"center",gap:8}}>
            ⚠️ Necesitas configurar tu API Key de <strong>{motor==="gemini"?"Google Gemini (gratis)":"Anthropic Claude"}</strong> para usar el asistente.
            <button onClick={()=>setShowConfig(true)} style={{background:"#ffc107",border:"none",borderRadius:5,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer",color:"#333"}}>Configurar ahora</button>
          </div>
        )}

        {/* Quick prompts */}
        <div style={{padding:"10px 16px",borderBottom:`1px solid ${T.line}`,display:"flex",gap:6,flexWrap:"wrap"}}>
          {QUICK_PROMPTS.map(p=>(
            <button key={p.label} className="btn btn-sm btn-secondary"
              style={{fontSize:11}}
              onClick={()=>setInput(p.text)}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div ref={chatRef} style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
          {messages.map((m,mi)=>(
            <div key={mi}>
              {/* Bubble */}
              <div style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                <div style={{
                  maxWidth:"80%",
                  padding:"11px 15px",
                  borderRadius: m.role==="user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: m.role==="user" ? T.field : T.paper,
                  color: m.role==="user" ? "white" : T.ink,
                  fontSize:13.5, lineHeight:1.65,
                  border: m.role==="assistant" ? `1px solid ${T.line}` : "none",
                  whiteSpace:"pre-wrap"
                }}>
                  {m.role==="assistant" && (
                    <div style={{fontSize:10,fontWeight:700,color:T.fieldLt,marginBottom:4,letterSpacing:"0.05em"}}>🌾 ASISTENTE CHARAY</div>
                  )}
                  {/* Show image thumbnail for user */}
                  {m.adjunto?.tipo==="image" && (
                    <img
                      src={`data:${m.adjunto.mimeType};base64,${m.adjunto.base64}`}
                      alt={m.adjunto.nombre}
                      style={{maxWidth:200,maxHeight:140,borderRadius:8,display:"block",marginBottom:8,objectFit:"cover"}}
                    />
                  )}
                  {m.adjunto?.tipo==="pdf" && (
                    <div style={{background:"rgba(255,255,255,0.2)",borderRadius:8,padding:"6px 10px",fontSize:11,marginBottom:6,display:"flex",gap:6,alignItems:"center"}}>
                      📄 {m.adjunto.nombre}
                    </div>
                  )}
                  {m.text}
                </div>
              </div>

              {/* Capture cards below assistant message */}
              {m.role==="assistant" && m.capturas && m.capturas.length>0 && (
                <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:10,paddingLeft:8}}>
                  <div style={{fontSize:11,fontWeight:700,color:T.fog,letterSpacing:"0.08em"}}>
                    📋 {m.capturas.length} REGISTRO{m.capturas.length>1?"S":""} DETECTADO{m.capturas.length>1?"S":""}
                  </div>
                  {m.capturas.map((cap,ci)=>{
                    if(cap._guardado) return (
                      <div key={ci} style={{padding:"8px 14px",background:"#eafaf1",border:`1px solid ${T.field}`,borderRadius:10,fontSize:12,color:T.field,fontWeight:600}}>
                        ✅ {MODULO_INFO[cap.modulo]?.icon} Guardado en {MODULO_INFO[cap.modulo]?.label}
                      </div>
                    );
                    if(cap._descartado) return (
                      <div key={ci} style={{padding:"8px 14px",background:T.mist,border:`1px solid ${T.line}`,borderRadius:10,fontSize:12,color:T.fog}}>
                        ✕ Descartado
                      </div>
                    );
                    return (
                      <TarjetaConfirmacion
                        key={ci}
                        captura={cap}
                        lotes={state.lotes}
                        onConfirm={c => confirmarCaptura(mi,ci,c)}
                        onDiscard={()  => descartarCaptura(mi,ci)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{display:"flex",justifyContent:"flex-start"}}>
              <div style={{background:T.paper,border:`1px solid ${T.line}`,borderRadius:"14px 14px 14px 4px",padding:"12px 16px"}}>
                <div style={{color:T.fog,fontSize:13}}>🌱 Analizando{adjunto?" documento":""}...</div>
              </div>
            </div>
          )}
        </div>

        {/* Attachment preview */}
        {adjunto && (
          <div style={{padding:"8px 16px",borderTop:`1px solid ${T.line}`,background:T.mist,display:"flex",alignItems:"center",gap:10}}>
            {adjunto.tipo==="image"
              ? <img src={`data:${adjunto.mimeType};base64,${adjunto.base64}`} alt="" style={{height:44,width:60,objectFit:"cover",borderRadius:6,border:`1px solid ${T.line}`}}/>
              : <div style={{fontSize:24}}>📄</div>
            }
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{adjunto.nombre}</div>
              <div style={{fontSize:10,color:T.fog}}>{adjunto.tipo==="pdf"?"PDF":"Imagen"} adjunta — lista para analizar</div>
            </div>
            <button onClick={removeAdjunto} style={{background:"none",border:"none",fontSize:18,color:T.fog,cursor:"pointer"}}>✕</button>
          </div>
        )}

        {/* Input row */}
        <div style={{padding:"12px 16px",borderTop:`1px solid ${T.line}`,display:"flex",gap:8,alignItems:"flex-end"}}>
          {/* File attach button */}
          <input ref={fileRef} type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={handleFile}/>
          <button
            onClick={()=>fileRef.current?.click()}
            style={{
              padding:"9px 12px",
              background:adjunto?T.field:T.mist,
              color:adjunto?"white":T.fog,
              border:`1px solid ${adjunto?T.field:T.line}`,
              borderRadius:9,
              fontSize:16,
              cursor:"pointer",
              flexShrink:0,
              transition:"all .2s"
            }}
            title="Adjuntar foto o PDF"
          >📎</button>

          <textarea
            className="form-input"
            style={{flex:1,resize:"none",minHeight:42,maxHeight:120,lineHeight:1.5,padding:"10px 12px"}}
            placeholder={adjunto?"Describe qué contiene o agrega contexto... (opcional)":"Escribe un gasto, actividad o pregunta agronómica..."}
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{
              if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendMsg(); }
            }}
            rows={1}
          />
          <button
            className="btn btn-primary"
            style={{flexShrink:0,padding:"10px 18px"}}
            onClick={sendMsg}
            disabled={loading || (!input.trim() && !adjunto)}
          >
            {loading?"⏳":"Enviar →"}
          </button>
        </div>

        {/* Footer hint */}
        <div style={{padding:"6px 16px 8px",fontSize:10,color:T.fog,borderTop:`1px solid ${T.line}`,background:T.mist,display:"flex",gap:16}}>
          <span>📎 Fotos de tickets, facturas o PDFs</span>
          <span>💬 Lenguaje natural: "Pagué $8,000 de diesel hoy"</span>
          <span>↵ Enter para enviar · Shift+Enter nueva línea</span>
        </div>
      </div>
    </div>
  );
}
