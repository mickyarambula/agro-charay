// ─── modules/Configuracion.jsx ───────────────────────────────────────────

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


export default function ConfiguracionModule({ userRol }) {
  const { state, dispatch } = useData();
  const [tabActiva, setTabActiva]   = useState("roles");
  const fileImportRef = useRef(null);
  // Delegaciones — hooks al nivel del componente (regla de hooks)
  const hoyDelStr = new Date().toISOString().split("T")[0];
  const [formDel,   setFormDel]   = useState({ de:"", para:"", desde:hoyDelStr, hasta:"", motivo:"" });
  const [showFormDel, setShowFormDel] = useState(false);
  const [alertaLocal, setAlertaLocal] = useState({
    umbralIntereses:15, diasSinDiesel:7, diasInsumosPendientes:20,
    umbralGastoAcelerado:80, umbralTiempoAcelerado:60,
    diasVencimientoCritico:15, diasVencimientoAdv:30,
    actCredito:true, actIntereses:true, actExcedeCredito:true,
    actInsumosPendientes:true, actDiesel:true, actDispSinGastos:true,
    actLotesSinAsig:true, actGastoAcelerado:true,
    ...(state.alertaParams||{})
  });
  const [savedAlerta, setSavedAlerta] = useState(false);
  const [guardado, setGuardado]     = useState(false);
  const [modalUsuario, setModalUsuario] = useState(false);
  const [editUsuario, setEditUsuario]   = useState(null); // null=nuevo, obj=editar

  // Usuarios: base hardcoded + extras del state
  const usuariosExtra  = state.usuariosExtra || [];
  const baseOverrides  = state.usuariosBaseEdit || {};
  const todosUsuarios  = [
    ...USUARIOS.map(u => baseOverrides[u.id] ? { ...u, ...baseOverrides[u.id] } : u),
    ...usuariosExtra
  ];

  const esUsuarioBase = (uid) => USUARIOS.some(u => u.id === uid);

  // ── Gestión de roles ──
  const rolesDisponibles = getRolesDisponibles(state);
  const [rolSel, setRolSel] = useState("socio");
  const [tempRol, setTempRol] = useState(null); // { id, nombre, icon, color, permisos }
  const [modalNewRol, setModalNewRol] = useState(false);
  const [formNewRol, setFormNewRol] = useState({ nombre:"", icon:"👥", color:"#1a6ea8" });

  const cargarRol = (rolId) => {
    setRolSel(rolId);
    setGuardado(false);
    if (rolId === "admin") { setTempRol(null); return; }
    const info = getRolInfo(state, rolId);
    const perms = getRolPermisos(state, rolId);
    setTempRol({ id: rolId, nombre: info.label, icon: info.icon, color: info.color, permisos: perms });
  };

  // Cargar rol seleccionado al montar / cuando cambia el state
  React.useEffect(() => {
    if (rolSel && rolSel !== "admin" && !tempRol) cargarRol(rolSel);
    // eslint-disable-next-line
  }, [rolSel]);

  const setNivelRolModulo = (modId, nivel) => {
    setGuardado(false);
    setTempRol(prev => {
      if (!prev) return prev;
      const perms = { ...prev.permisos };
      if (nivel === "none") delete perms[modId];
      else perms[modId] = nivel;
      return { ...prev, permisos: perms };
    });
  };

  const guardarRol = () => {
    if (!tempRol || tempRol.id === "admin") return;
    dispatch({ type:"SET_ROL", payload: tempRol });
    setGuardado(true);
    setTimeout(()=>setGuardado(false), 2500);
  };

  const abrirNuevoRol = () => {
    setFormNewRol({ nombre:"", icon:"👥", color:"#1a6ea8" });
    setModalNewRol(true);
  };

  const crearNuevoRol = () => {
    if (!formNewRol.nombre.trim()) return;
    const id = "custom_" + Date.now();
    const payload = { id, nombre: formNewRol.nombre.trim(), icon: formNewRol.icon, color: formNewRol.color, permisos: {} };
    dispatch({ type:"SET_ROL", payload });
    setModalNewRol(false);
    setRolSel(id);
    setTempRol(payload);
  };

  const eliminarRol = () => {
    if (!tempRol || tempRol.id === "admin") return;
    const usuariosConRol = todosUsuarios.filter(u => u.rol === tempRol.id);
    // Rol destino: el rol con menos módulos disponibles (excluyendo admin y el que se borra)
    let fallback = null;
    if (usuariosConRol.length > 0) {
      const candidates = rolesDisponibles
        .filter(r => r.id !== "admin" && r.id !== tempRol.id)
        .map(r => ({ ...r, nMods: Object.keys(getRolPermisos(state, r.id)).length }))
        .sort((a,b) => a.nMods - b.nMods);
      fallback = candidates[0];
      if (!fallback) { alert("No hay otro rol disponible para migrar los usuarios."); return; }
    }
    const msg = usuariosConRol.length > 0
      ? `El rol "${tempRol.nombre}" tiene ${usuariosConRol.length} usuario(s) asignado(s). Serán migrados al rol "${fallback.nombre}". ¿Continuar?`
      : `¿Eliminar el rol "${tempRol.nombre}"?`;
    if (!window.confirm(msg)) return;
    // Migrar usuarios
    usuariosConRol.forEach(u => {
      const payload = { ...u, rol: fallback.id };
      if (esUsuarioBase(u.id)) dispatch({ type:"UPD_USUARIO_BASE", payload });
      else dispatch({ type:"UPD_USUARIO_EXTRA", payload });
      dispatch({ type:"CLEAR_PERMISOS_USUARIO", payload: u.id });
    });
    dispatch({ type:"DEL_ROL", payload: tempRol.id });
    setTempRol(null);
    setRolSel("socio");
  };

  const emptyUser = { nombre:"", usuario:"", password:"", rol:"campo", activo:true };
  const [formUser, setFormUser] = useState(emptyUser);

  const abrirNuevoUsuario = () => {
    setFormUser(emptyUser);
    setEditUsuario(null);
    setModalUsuario(true);
  };

  const abrirEditarUsuario = (u) => {
    setFormUser({ nombre:u.nombre, usuario:u.usuario, password:u.password||"", rol:u.rol, activo:u.activo!==false });
    setEditUsuario(u);
    setModalUsuario(true);
  };

  const guardarUsuario = () => {
    if (!formUser.nombre || !formUser.usuario || !formUser.password) return;
    const existe = todosUsuarios.find(u => u.usuario === formUser.usuario.trim().toLowerCase() && u.id !== editUsuario?.id);
    if (existe) return;
    if (editUsuario) {
      const payload = { ...editUsuario, ...formUser, usuario: formUser.usuario.trim().toLowerCase() };
      // Si cambió el rol, limpiar overrides granulares para que caiga en defaults del nuevo rol
      if (editUsuario.rol !== formUser.rol) {
        dispatch({ type:"CLEAR_PERMISOS_USUARIO", payload: editUsuario.id });
      }
      if (esUsuarioBase(editUsuario.id)) {
        dispatch({ type:"UPD_USUARIO_BASE", payload });
      } else {
        dispatch({ type:"UPD_USUARIO_EXTRA", payload });
      }
    } else {
      dispatch({ type:"ADD_USUARIO_EXTRA", payload:{ ...formUser, id: Date.now(), usuario: formUser.usuario.trim().toLowerCase() } });
    }
    setModalUsuario(false);
  };

  const toggleActivoUsuario = (u) => {
    if (esUsuarioBase(u.id)) {
      dispatch({ type:"UPD_USUARIO_BASE", payload:{ ...u, activo: !u.activo } });
    } else {
      dispatch({ type:"UPD_USUARIO_EXTRA", payload:{ ...u, activo: !u.activo } });
    }
  };

  const eliminarUsuario = (u) => {
    if (u.rol === "admin") { alert("No se puede eliminar un usuario administrador."); return; }
    if (!window.confirm(`¿Eliminar al usuario "${u.nombre}"? Esta acción no se puede deshacer.`)) return;
    if (esUsuarioBase(u.id)) {
      // Los usuarios base no se pueden eliminar del código, solo desactivar permanentemente
      dispatch({ type:"UPD_USUARIO_BASE", payload:{ ...u, activo: false } });
      alert("Usuario base: desactivado (no puede eliminarse permanentemente).");
    } else {
      dispatch({ type:"DEL_USUARIO_EXTRA", payload: u.id });
      dispatch({ type:"CLEAR_PERMISOS_USUARIO", payload: u.id });
    }
  };

  const secciones = [...new Set(TODOS_MODULOS.map(m => m.section))];

  return (
    <div>
      <div className="tabs" style={{marginBottom:20}}>
        <div className={`tab ${tabActiva==="roles"?"active":""}`}     onClick={()=>setTabActiva("roles")}>🛡️ Roles y Permisos</div>
        <div className={`tab ${tabActiva==="usuarios"?"active":""}`}  onClick={()=>setTabActiva("usuarios")}>👥 Usuarios del Sistema</div>
        <div className={`tab ${tabActiva==="alertas"?"active":""}`}   onClick={()=>setTabActiva("alertas")}>🔔 Alertas</div>
        <div className={`tab ${tabActiva==="delegaciones"?"active":""}`} onClick={()=>setTabActiva("delegaciones")}>🔁 Delegaciones</div>
        <div className={`tab ${tabActiva==="backup"?"active":""}`}    onClick={()=>setTabActiva("backup")}>💾 Backup / Restore</div>
      </div>

      {/* ── TAB PERMISOS GRANULARES POR USUARIO ── */}
      {tabActiva==="roles" && (()=>{
        const NIVELES = [
          { id:"none",   label:"Sin acceso",  icon:"🚫", color:"#c0392b", bg:"#fdf0ef" },
          { id:"ver",    label:"Solo ver",    icon:"👁",  color:"#1a6ea8", bg:"#edf4fb" },
          { id:"editar", label:"Ver y editar",icon:"✏️", color:"#2d5a1b", bg:"#f0f8e8" },
        ];
        const usuariosConRolSel = todosUsuarios.filter(u => u.rol === rolSel);
        return (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:20}}>
              {/* Panel izquierdo: lista de roles */}
              <div className="card" style={{alignSelf:"start"}}>
                <div className="card-header">
                  <div className="card-title">Roles</div>
                </div>
                <div className="card-body" style={{padding:0}}>
                  {rolesDisponibles.map(r => {
                    const sel = rolSel === r.id;
                    const nUsers = todosUsuarios.filter(u => u.rol === r.id).length;
                    const nMods = r.id === "admin" ? TODOS_MODULOS.length : Object.keys(getRolPermisos(state, r.id)).length;
                    return (
                      <div key={r.id} onClick={()=>cargarRol(r.id)}
                        style={{padding:"12px 16px",cursor:"pointer",borderBottom:"1px solid #f0ece4",
                          background:sel?`${r.color}15`:"white",transition:"background 0.15s",
                          borderLeft:sel?`4px solid ${r.color}`:"4px solid transparent"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:18}}>{r.icon}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:700,fontSize:13,color:sel?r.color:"#3d3525",
                              display:"flex",alignItems:"center",gap:6}}>
                              {r.nombre}
                              {r.id === "admin" && <span style={{fontSize:12}} title="Rol bloqueado">🔒</span>}
                              {!r.esBase && <span style={{fontSize:9,padding:"1px 6px",borderRadius:8,
                                background:"#e8e0d0",color:"#5a5040",fontWeight:600}}>CUSTOM</span>}
                            </div>
                            <div style={{fontSize:11,color:"#8a8070",marginTop:2}}>
                              {nUsers} usuario{nUsers===1?"":"s"} · {nMods} módulo{nMods===1?"":"s"}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{padding:12,borderTop:"1px solid #f0ece4",background:"#faf8f3"}}>
                  <button className="btn btn-primary btn-sm" onClick={abrirNuevoRol} style={{width:"100%"}}>
                    ＋ Nuevo rol
                  </button>
                </div>
              </div>

              {/* Panel derecho: editor del rol seleccionado */}
              <div>
                {rolSel === "admin" ? (
                  <div className="card">
                    <div className="card-body" style={{padding:"40px 24px"}}>
                      <div style={{textAlign:"center",marginBottom:20}}>
                        <div style={{fontSize:48,marginBottom:12}}>🔒</div>
                        <div style={{fontSize:16,fontWeight:700,color:"#3d3525"}}>Rol Administrador</div>
                        <div style={{fontSize:12,color:"#8a8070",marginTop:4}}>
                          Este rol tiene acceso total a todos los módulos y no puede modificarse ni eliminarse.
                        </div>
                      </div>
                      <div style={{padding:16,background:"#faf8f3",borderRadius:8,border:"1px solid #e8e0d0"}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#8a8070",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>
                          Usuarios con este rol ({usuariosConRolSel.length})
                        </div>
                        {usuariosConRolSel.length === 0 ? (
                          <div style={{fontSize:12,color:"#8a8070",fontStyle:"italic"}}>Ningún usuario asignado</div>
                        ) : (
                          <div style={{display:"flex",flexDirection:"column",gap:4}}>
                            {usuariosConRolSel.map(u => (
                              <div key={u.id} style={{fontSize:12,color:"#3d3525",padding:"4px 0"}}>
                                👑 <strong>{u.nombre}</strong> <span style={{color:"#8a8070"}}>(@{u.usuario})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : !tempRol ? null : (
                  <div>
                    {/* Header: nombre editable y acciones */}
                    <div className="card" style={{marginBottom:16}}>
                      <div className="card-header" style={{flexWrap:"wrap",gap:10}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:200}}>
                          <span style={{fontSize:24}}>{tempRol.icon}</span>
                          <input className="form-input" value={tempRol.nombre}
                            onChange={e=>setTempRol(r=>({...r,nombre:e.target.value}))}
                            placeholder="Nombre del rol"
                            style={{fontSize:15,fontWeight:700,flex:1,minWidth:120}}/>
                        </div>
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          {guardado && (
                            <span style={{fontSize:12,color:"#2d5a1b",fontWeight:600,padding:"4px 12px",background:"#d4edda",borderRadius:8}}>
                              ✅ Guardado
                            </span>
                          )}
                          <button className="btn btn-sm btn-danger" onClick={eliminarRol} title="Eliminar rol">
                            🗑 Eliminar
                          </button>
                          <button className="btn btn-sm btn-primary" onClick={guardarRol}>💾 Guardar</button>
                        </div>
                      </div>
                    </div>

                    {/* Leyenda */}
                    <div style={{display:"flex",gap:16,marginBottom:16,alignItems:"center"}}>
                      <div style={{fontSize:12,fontWeight:700,color:"#5a5040"}}>Nivel de acceso:</div>
                      {NIVELES.map(n=>(
                        <div key={n.id} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:n.color,fontWeight:600}}>
                          <span>{n.icon}</span> {n.label}
                        </div>
                      ))}
                    </div>

                    {/* Permisos por sección */}
                    {secciones.map(sec=>{
                      const mods = TODOS_MODULOS.filter(m=>m.section===sec);
                      return (
                        <div key={sec} style={{marginBottom:20}}>
                          <div style={{fontSize:11,fontWeight:700,color:"#8a8070",textTransform:"uppercase",
                            letterSpacing:1,marginBottom:8,paddingBottom:4,borderBottom:"1px solid #e8e0d0"}}>
                            {sec}
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:8}}>
                            {mods.map(mod=>{
                              const nivel = tempRol.permisos[mod.id] || "none";
                              const nivelInfo = NIVELES.find(n=>n.id===nivel);
                              return (
                                <div key={mod.id}
                                  style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
                                    borderRadius:8,border:`1px solid ${nivelInfo.color}33`,
                                    background:nivelInfo.bg,transition:"all 0.15s"}}>
                                  <span style={{fontWeight:700,fontSize:13,color:"#3d3525",flex:1,minWidth:120}}>
                                    {mod.label}
                                  </span>
                                  <div style={{display:"flex",gap:2}}>
                                    {NIVELES.map(n=>{
                                      const activo = nivel===n.id;
                                      return (
                                        <button key={n.id} onClick={()=>setNivelRolModulo(mod.id, n.id)}
                                          style={{padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:activo?700:400,
                                            cursor:"pointer",transition:"all 0.15s",border:"1px solid",
                                            borderColor:activo?n.color:"#ddd5c0",
                                            background:activo?n.color:"white",
                                            color:activo?"white":n.color}}
                                          title={n.label}>
                                          {n.icon}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* Usuarios con este rol */}
                    <div className="card" style={{marginTop:20}}>
                      <div className="card-header">
                        <div className="card-title">
                          Usuarios con el rol "{tempRol.nombre}" ({usuariosConRolSel.length})
                        </div>
                      </div>
                      <div className="card-body" style={{padding:usuariosConRolSel.length===0?"20px":0}}>
                        {usuariosConRolSel.length === 0 ? (
                          <div style={{fontSize:13,color:"#8a8070",fontStyle:"italic",textAlign:"center"}}>
                            Ningún usuario asignado a este rol
                          </div>
                        ) : (
                          usuariosConRolSel.map(u => (
                            <div key={u.id} style={{padding:"10px 16px",borderBottom:"1px solid #f0ece4",
                              display:"flex",alignItems:"center",gap:10}}>
                              <span style={{fontSize:16}}>{tempRol.icon}</span>
                              <div style={{flex:1}}>
                                <div style={{fontWeight:700,fontSize:13}}>{u.nombre}</div>
                                <div style={{fontSize:11,color:"#8a8070"}}>@{u.usuario}</div>
                              </div>
                              <span style={{fontSize:11,padding:"2px 8px",borderRadius:8,fontWeight:600,
                                background:u.activo!==false?"#d4edda":"#f8d7da",
                                color:u.activo!==false?"#155724":"#721c24"}}>
                                {u.activo!==false?"● Activo":"○ Inactivo"}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{marginTop:16,padding:"10px 14px",background:"#faf3e0",borderRadius:8,
              fontSize:12,color:"#7a6030",border:"1px solid #e0c87040"}}>
              <strong>Niveles:</strong> "Sin acceso" oculta el módulo. "Solo ver" permite consultar datos.
              "Ver y editar" permite agregar, modificar y cancelar registros. La eliminación permanente de datos queda siempre reservada para administradores.
            </div>
          </div>
        );
      })()}

      {/* ── TAB USUARIOS ── */}
      {tabActiva==="usuarios" && (
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
            <button className="btn btn-primary" onClick={abrirNuevoUsuario}>＋ Agregar Usuario</button>
          </div>
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Módulos</th><th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {todosUsuarios.map((u,i)=>{
                    const permsU = getPermisosUsuario(state, u.id, u.rol);
                    const accesos = u.rol==="admin" ? TODOS_MODULOS.length : Object.keys(permsU).length;
                    const nEditar = u.rol==="admin" ? TODOS_MODULOS.length : Object.values(permsU).filter(v=>v==="editar").length;
                    const rolInf  = getRolInfo(state, u.rol);
                    const esBase  = esUsuarioBase(u.id);
                    const activo  = u.activo !== false;
                    const bg      = i%2===0?"white":"#faf8f3";
                    return (
                      <tr key={u.id}>
                        <td style={{background:bg,fontFamily:"monospace",fontWeight:700}}>
                          {u.usuario}
                          {esBase && <span style={{marginLeft:6,fontSize:9,padding:"1px 5px",borderRadius:6,
                            background:"#e8e0d0",color:"#5a5040",fontWeight:600}}>BASE</span>}
                        </td>
                        <td style={{background:bg,fontWeight:600}}>{u.nombre}</td>
                        <td style={{background:bg}}>
                          <span style={{fontSize:11,padding:"3px 10px",borderRadius:10,fontWeight:700,
                            background:`${rolInf.color}22`,color:rolInf.color}}>
                            {rolInf.icon} {rolInf.label}
                          </span>
                        </td>
                        <td style={{background:bg,fontFamily:"monospace",fontSize:12}}>
                          {u.rol==="admin"
                            ? <span style={{color:"#2d5a1b",fontWeight:700}}>Todos ({TODOS_MODULOS.length})</span>
                            : <span>{accesos} módulos <span style={{color:"#2d5a1b",fontWeight:600}}>({nEditar} edición)</span></span>}
                        </td>
                        <td style={{background:bg}}>
                          <span style={{fontSize:11,padding:"2px 8px",borderRadius:8,fontWeight:600,
                            background:activo?"#d4edda":"#f8d7da",
                            color:activo?"#155724":"#721c24"}}>
                            {activo?"● Activo":"○ Inactivo"}
                          </span>
                        </td>
                        <td style={{background:bg}}>
                          <div style={{display:"flex",gap:6}}>
                            <button className="btn btn-sm btn-secondary" onClick={()=>abrirEditarUsuario(u)} title="Editar">✏️</button>
                            <button className="btn btn-sm btn-secondary" onClick={()=>toggleActivoUsuario(u)}
                              title={activo?"Desactivar":"Activar"}>
                              {activo?"🔒":"🔓"}
                            </button>
                            {u.rol !== "admin" && (
                              <button className="btn btn-sm btn-danger" onClick={()=>eliminarUsuario(u)}
                                title={esBase?"Desactivar permanentemente (base)":"Eliminar usuario"}>🗑</button>
                            )}
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
      )}

      {/* ── TAB ALERTAS ── */}
      {tabActiva==="alertas" && (()=>{
        const local   = alertaLocal;
        const setLocal = setAlertaLocal;
        const upd = (k,v) => setAlertaLocal(s=>({...s,[k]:parseFloat(v)||0}));
        const guardar = () => {
          dispatch({type:"SET_ALERTA_PARAMS", payload:{...local}});
          setSavedAlerta(true);
          setTimeout(()=>setSavedAlerta(false), 2500);
        };
        const reset   = () => { setAlertaLocal({
          umbralIntereses:15,diasSinDiesel:7,diasInsumosPendientes:20,
          umbralGastoAcelerado:80,umbralTiempoAcelerado:60,
          diasVencimientoCritico:15,diasVencimientoAdv:30,
          actCredito:true,actIntereses:true,actExcedeCredito:true,
          actInsumosPendientes:true,actDiesel:true,actDispSinGastos:true,
          actLotesSinAsig:true,actGastoAcelerado:true,
        }); };
        const field = (label, key, unit, desc, color="#2d5a1b") => (
          <div key={key} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",
            background:"white",borderRadius:8,border:"1px solid #ddd5c0",marginBottom:8}}>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:"#3d3525"}}>{label}</div>
              <div style={{fontSize:11,color:"#8a8070",marginTop:2}}>{desc}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <input type="number" value={local[key]} onChange={e=>upd(key,e.target.value)}
                style={{width:80,textAlign:"center",fontFamily:"monospace",fontWeight:700,
                  fontSize:16,border:`2px solid ${color}44`,borderRadius:6,padding:"4px 8px",
                  color}}/>
              <span style={{fontSize:12,color:"#8a8070",minWidth:28}}>{unit}</span>
            </div>
          </div>
        );
        return (
          <div>
            <div style={{marginBottom:20}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,marginBottom:4}}>
                🔔 Configuración de Alertas
              </div>
              <div style={{fontSize:12,color:"#8a8070"}}>
                Ajusta los umbrales para que las alertas del Dashboard sean relevantes para tu operación.
              </div>
            </div>

            <div style={{marginBottom:16,padding:"10px 14px",background:"#fff8f0",borderRadius:8,
              border:"1px solid #f0a04b",fontSize:12,color:"#7a4a10"}}>
              ⚡ Los cambios aplican de inmediato al guardar. Las alertas del Dashboard se recalculan automáticamente.
            </div>

            {/* Crédito */}
            <div style={{fontWeight:700,fontSize:12,color:"#8a8070",letterSpacing:"0.08em",
              textTransform:"uppercase",marginBottom:8,marginTop:16}}>📋 Crédito y Vencimiento</div>
            {field("Días para alerta crítica de vencimiento","diasVencimientoCritico","días",
              "Si quedan menos de estos días para el vencimiento del crédito → alerta ROJA","#c0392b")}
            {field("Días para advertencia de vencimiento","diasVencimientoAdv","días",
              "Si quedan menos de estos días para el vencimiento → alerta AMARILLA","#e67e22")}
            {field("Umbral de intereses altos","umbralIntereses","%",
              "Si los intereses acumulados superan este % del crédito total → alerta","#9b6d3a")}

            {/* Operación */}
            <div style={{fontWeight:700,fontSize:12,color:"#8a8070",letterSpacing:"0.08em",
              textTransform:"uppercase",marginBottom:8,marginTop:16}}>⛽ Operación de Campo</div>
            {field("Días sin cargas de diesel","diasSinDiesel","días",
              "Si no hay cargas de diesel en estos días (con dispersiones activas) → alerta","#e67e22")}
            {field("Días sin recibir insumos","diasInsumosPendientes","días",
              "Si hay pedidos de insumos sin confirmar recepción por más de estos días → alerta","#2d7a3a")}

            {/* Presupuesto */}
            <div style={{fontWeight:700,fontSize:12,color:"#8a8070",letterSpacing:"0.08em",
              textTransform:"uppercase",marginBottom:8,marginTop:16}}>📈 Ritmo de Gasto</div>
            {field("% de gasto para alerta acelerada","umbralGastoAcelerado","%",
              "Si se ha gastado más de este % del presupuesto total...","#8e44ad")}
            {field("...con menos de este % del ciclo transcurrido","umbralTiempoAcelerado","%",
              "...y el ciclo ha avanzado menos de este % → alerta de ritmo acelerado","#8e44ad")}

            {/* ── Toggles activar/desactivar ── */}
            <div style={{fontWeight:700,fontSize:12,color:"#8a8070",letterSpacing:"0.08em",
              textTransform:"uppercase",marginBottom:8,marginTop:20}}>🔔 Activar / Desactivar alertas</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:16}}>
              {[
                {k:"actCredito",         l:"Crédito próximo a vencer"},
                {k:"actExcedeCredito",   l:"Productor excede crédito"},
                {k:"actIntereses",       l:"Intereses altos"},
                {k:"actInsumosPendientes",l:"Insumos sin recibir"},
                {k:"actDiesel",          l:"Sin cargas de diesel"},
                {k:"actDispSinGastos",   l:"Dispersión sin gastos"},
                {k:"actLotesSinAsig",    l:"Lotes sin asignar"},
                {k:"actGastoAcelerado",  l:"Ritmo de gasto acelerado"},
              ].map(({k,l})=>{
                const activo = local[k]!==false;
                return (
                  <div key={k} onClick={()=>setLocal(s=>({...s,[k]:!activo}))}
                    style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",
                      borderRadius:8,cursor:"pointer",userSelect:"none",
                      background:activo?"#f0f8e8":"#f5f4f0",
                      border:`1px solid ${activo?"#c8e0b0":"#ddd5c0"}`}}>
                    <div style={{width:34,height:20,borderRadius:10,position:"relative",
                      background:activo?"#2d7a3a":"#ccc",transition:"background 0.2s",flexShrink:0}}>
                      <div style={{position:"absolute",top:3,width:14,height:14,borderRadius:"50%",
                        background:"white",transition:"left 0.2s",boxShadow:"0 1px 3px #0003",
                        left:activo?"17px":"3px"}}/>
                    </div>
                    <span style={{fontSize:11,fontWeight:activo?600:400,
                      color:activo?"#2d5a1b":"#8a8070"}}>{l}</span>
                  </div>
                );
              })}
            </div>

            <div style={{display:"flex",gap:10,marginTop:4}}>
              <button className="btn btn-primary" onClick={guardar} style={{flex:1,
                transition:"background 0.3s",
                background:savedAlerta?"#27ae60":undefined}}>
                {savedAlerta ? "✅ ¡Configuración guardada!" : "💾 Guardar configuración de alertas"}
              </button>
              <button className="btn btn-secondary" onClick={reset} style={{fontSize:12}}>
                ↺ Restablecer valores
              </button>
            </div>

            {/* ── Límites de crédito por productor ── */}
            <div style={{fontWeight:700,fontSize:12,color:"#8a8070",letterSpacing:"0.08em",
              textTransform:"uppercase",marginBottom:8,marginTop:20}}>💳 Límites de crédito por productor</div>
            <div style={{fontSize:11,color:"#8a8070",marginBottom:10,lineHeight:1.5}}>
              Configura el límite de crédito parafinanciero y total para cada productor.<br/>
              La alerta se activa al llegar al 95% del parafinanciero y cuando el total lo supere.
            </div>
            <div style={{border:"1px solid #ddd5c0",borderRadius:10,overflow:"hidden",marginBottom:16}}>
              {(state.productores||[]).filter(p=>p.activo!==false).map((p,idx_p)=>{
                const lim = (state.creditoLimites||{})[p.id] || {};
                const exp = (state.expedientes||[]).find(e=>e.productorId===p.id);
                const defaultPara = exp?.montoAutorizado || 0;
                const haProd = ((state.ciclos||[]).find(c=>c.id===state.cicloActivoId)?.asignaciones||[])
                  .filter(a=>String(a.productorId)===String(p.id))
                  .reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
                return (
                  <div key={p.id} style={{padding:"10px 14px",borderBottom:idx_p<(state.productores||[]).filter(x=>x.activo!==false).length-1?"1px solid #eee":"none",
                    background:idx_p%2===0?"white":"#fafaf8"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                      <div style={{minWidth:140,fontWeight:600,fontSize:12,color:"#3d3525"}}>
                        {p.alias||p.apPat}
                        <div style={{fontSize:10,color:"#8a8070",fontWeight:400}}>{haProd.toFixed(1)} ha</div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:4,flex:1,minWidth:200}}>
                        <span style={{fontSize:10,color:"#8a8070",whiteSpace:"nowrap"}}>Límite parafinanciero:</span>
                        <input type="number" placeholder={defaultPara?String(Math.round(defaultPara)):"Monto $"}
                          value={lim.limitePara||""}
                          onChange={e=>dispatch({type:"SET_CREDITO_LIMITES",payload:{[p.id]:{...lim,limitePara:parseFloat(e.target.value)||0}}})}
                          style={{width:120,textAlign:"right",fontFamily:"monospace",fontSize:12,
                            border:"1px solid #ddd5c0",borderRadius:6,padding:"3px 8px"}}/>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:4,flex:1,minWidth:200}}>
                        <span style={{fontSize:10,color:"#8a8070",whiteSpace:"nowrap"}}>Límite total:</span>
                        <input type="number" placeholder="Sin límite"
                          value={lim.limiteTotal||""}
                          onChange={e=>dispatch({type:"SET_CREDITO_LIMITES",payload:{[p.id]:{...lim,limiteTotal:parseFloat(e.target.value)||0}}})}
                          style={{width:120,textAlign:"right",fontFamily:"monospace",fontSize:12,
                            border:"1px solid #ddd5c0",borderRadius:6,padding:"3px 8px"}}/>
                      </div>
                      {defaultPara>0&&!lim.limitePara&&(
                        <span style={{fontSize:10,color:"#c8a84b",fontStyle:"italic"}}>
                          {"Auto: "+defaultPara.toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:0})}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Preview */}
            <div style={{marginTop:20,padding:"12px 16px",background:"#f5f4f0",borderRadius:8}}>
              <div style={{fontWeight:600,fontSize:12,marginBottom:8,color:"#3d3525"}}>
                Vista previa de umbrales actuales:
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {[
                  {l:"Venc. crítico",v:local.diasVencimientoCritico,u:"días",c:"#c0392b"},
                  {l:"Venc. advertencia",v:local.diasVencimientoAdv,u:"días",c:"#e67e22"},
                  {l:"Intereses altos",v:local.umbralIntereses,u:"%",c:"#9b6d3a"},
                  {l:"Sin diesel",v:local.diasSinDiesel,u:"días",c:"#e67e22"},
                  {l:"Insumos pendientes",v:local.diasInsumosPendientes,u:"días",c:"#2d7a3a"},
                  {l:"Gasto acelerado",v:local.umbralGastoAcelerado,u:"%",c:"#8e44ad"},
                ].map(({l,v,u,c})=>(
                  <div key={l} style={{padding:"4px 12px",background:"white",borderRadius:20,
                    border:`1px solid ${c}44`,fontSize:11}}>
                    <span style={{color:"#8a8070"}}>{l}: </span>
                    <span style={{fontFamily:"monospace",fontWeight:700,color:c}}>{v}{u}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal nuevo/editar usuario */}
      {modalUsuario && (
        <Modal title={editUsuario?"Editar Usuario":"Nuevo Usuario"} onClose={()=>setModalUsuario(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={()=>setModalUsuario(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarUsuario}
                disabled={!formUser.nombre||!formUser.usuario||!formUser.password}>
                💾 Guardar
              </button>
            </>
          }>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div className="form-group">
              <label className="form-label">Nombre completo *</label>
              <input className="form-input" value={formUser.nombre}
                onChange={e=>setFormUser(f=>({...f,nombre:e.target.value}))}
                placeholder="Ej. Juan Pérez"/>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Usuario (login) *</label>
                <input className="form-input" value={formUser.usuario}
                  onChange={e=>setFormUser(f=>({...f,usuario:e.target.value.toLowerCase().replace(/\s/g,"")}))}
                  placeholder="sin espacios, minúsculas"/>
              </div>
              <div className="form-group">
                <label className="form-label">Contraseña *</label>
                <input className="form-input" type="password" value={formUser.password}
                  onChange={e=>setFormUser(f=>({...f,password:e.target.value}))}
                  placeholder="mínimo 6 caracteres"/>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Rol *</label>
              <select className="form-select" value={formUser.rol}
                onChange={e=>setFormUser(f=>({...f,rol:e.target.value}))}>
                {rolesDisponibles.map(r => (
                  <option key={r.id} value={r.id}>{r.icon} {r.nombre}</option>
                ))}
              </select>
              {editUsuario && editUsuario.rol !== formUser.rol && (
                <div style={{fontSize:11,color:"#1a6ea8",marginTop:4,fontStyle:"italic"}}>
                  ℹ️ Al cambiar el rol se aplicarán los permisos por defecto del nuevo rol.
                </div>
              )}
            </div>
            {todosUsuarios.find(u=>u.usuario===formUser.usuario.trim()&&u.id!==editUsuario?.id) && (
              <div style={{padding:"8px 12px",background:"#f8d7da",borderRadius:6,fontSize:12,color:"#721c24"}}>
                ⚠️ Ese nombre de usuario ya existe
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal nuevo rol */}
      {modalNewRol && (
        <Modal title="Nuevo Rol" onClose={()=>setModalNewRol(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={()=>setModalNewRol(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={crearNuevoRol}
                disabled={!formNewRol.nombre.trim()}>
                ＋ Crear rol
              </button>
            </>
          }>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div className="form-group">
              <label className="form-label">Nombre del rol *</label>
              <input className="form-input" value={formNewRol.nombre}
                onChange={e=>setFormNewRol(f=>({...f,nombre:e.target.value}))}
                placeholder="Ej. Contador, Supervisor, Auditor"
                autoFocus/>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Ícono (emoji)</label>
                <input className="form-input" value={formNewRol.icon}
                  onChange={e=>setFormNewRol(f=>({...f,icon:e.target.value}))}
                  placeholder="👥"
                  style={{fontSize:20,textAlign:"center"}}/>
              </div>
              <div className="form-group">
                <label className="form-label">Color</label>
                <input type="color" value={formNewRol.color}
                  onChange={e=>setFormNewRol(f=>({...f,color:e.target.value}))}
                  style={{width:"100%",height:38,padding:2,border:"1px solid #ddd5c0",borderRadius:6,cursor:"pointer"}}/>
              </div>
            </div>
            <div style={{padding:"10px 14px",background:"#edf4fb",borderRadius:8,
              fontSize:12,color:"#1a4a70",border:"1px solid #1a6ea833"}}>
              <strong>Preview:</strong>
              <span style={{marginLeft:8,padding:"4px 12px",borderRadius:10,fontWeight:700,
                background:`${formNewRol.color}22`,color:formNewRol.color}}>
                {formNewRol.icon} {formNewRol.nombre || "Nombre del rol"}
              </span>
            </div>
            <div style={{fontSize:11,color:"#8a8070",fontStyle:"italic"}}>
              El rol se creará sin permisos. Después de crearlo podrás configurar qué módulos puede ver/editar.
            </div>
          </div>
        </Modal>
      )}
      {tabActiva==="backup" && false && (
        <input ref={fileImportRef} type="file" accept=".json" style={{display:"none"}}
          onChange={e=>{
            const file = e.target.files[0]; if(!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
              try {
                const parsed = JSON.parse(ev.target.result);
                if(!parsed.productores || !parsed.ciclos) { alert('Archivo no válido — no parece un backup de AgroSistema Charay'); return; }
                if(!window.confirm('⚠️ Esto reemplazará TODOS los datos actuales del sistema con el backup. ¿Continuar?')) return;
                Object.entries(parsed).forEach(([key, val]) => {
                  dispatch({ type: 'RESTORE_KEY', payload: { key, val } });
                });
                localStorage.setItem('agroSistemaState', JSON.stringify(parsed));
                alert('✅ Backup restaurado correctamente. El sistema se recargará.');
                window.location.reload();
              } catch { alert('❌ Error al leer el archivo. Asegúrate de que sea un backup válido.'); }
            };
            reader.readAsText(file);
            e.target.value = '';
          }}/>
      )}
      {tabActiva==="delegaciones" && (()=>{
        const hoy = new Date().toISOString().split("T")[0];
        const todosUsuarios = [...USUARIOS, ...(state.usuariosExtra||[])];
        const delegaciones  = state.delegaciones || [];
        // formDel y showFormDel vienen del nivel del componente (regla de hooks)

        // Active delegations today
        const hoyDate = new Date().toISOString().slice(0,10);
        const activas = delegaciones.filter(d => d.activa && d.desde <= hoyDate && d.hasta >= hoyDate);

        const nomUser = uid => todosUsuarios.find(u=>u.usuario===uid)?.nombre || uid;
        const rolUser = uid => {
          const u = todosUsuarios.find(u=>u.usuario===uid);
          return u ? getRolInfo(state, u.rol).label : uid;
        };

        return (
          <div>
            {/* Banner si hay delegaciones activas */}
            {activas.length > 0 && (
              <div style={{padding:"12px 16px",background:"#e8f4fd",border:"1px solid #1a6ea844",
                borderRadius:8,marginBottom:16,fontSize:13}}>
                <strong>🔁 {activas.length} delegación(es) activa(s) hoy:</strong>
                {activas.map(d=>(
                  <div key={d.id} style={{marginTop:4,color:T.fog}}>
                    {nomUser(d.de)} → <strong>{nomUser(d.para)}</strong> puede aprobar en su lugar
                    <span style={{marginLeft:8,fontSize:11}}>hasta {d.hasta}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="card" style={{marginBottom:16}}>
              <div className="card-header">
                <div className="card-title">🔁 Delegaciones de Aprobación</div>
                <button className="btn btn-primary btn-sm" onClick={()=>setShowFormDel(s=>!s)}>
                  {showFormDel?"✕ Cancelar":"＋ Nueva Delegación"}
                </button>
              </div>
              <div className="card-body" style={{paddingBottom:0}}>
                <p style={{fontSize:13,color:T.fog,marginBottom:12}}>
                  Permite que otro usuario apruebe solicitudes temporalmente en tu ausencia.
                  La delegación se activa y desactiva automáticamente por fechas.
                </p>

                {showFormDel&&(
                  <div style={{padding:"14px 16px",background:"#faf8f3",borderRadius:8,marginBottom:16,border:`1px solid ${T.line}`}}>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Delegar DE (quien se ausenta)</label>
                        <select className="form-select" value={formDel.de} onChange={e=>setFormDel(f=>({...f,de:e.target.value}))}>
                          <option value="">— Seleccionar usuario —</option>
                          {todosUsuarios.filter(u=>["admin","socio"].includes(u.rol)).map(u=>(
                            <option key={u.usuario} value={u.usuario}>{u.nombre} ({rolUser(u.usuario)})</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Delegar PARA (quien suplirá)</label>
                        <select className="form-select" value={formDel.para} onChange={e=>setFormDel(f=>({...f,para:e.target.value}))}>
                          <option value="">— Seleccionar usuario —</option>
                          {todosUsuarios.filter(u=>u.usuario!==formDel.de).map(u=>(
                            <option key={u.usuario} value={u.usuario}>{u.nombre} ({rolUser(u.usuario)})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Desde</label>
                        <input className="form-input" type="date" value={formDel.desde}
                          onChange={e=>setFormDel(f=>({...f,desde:e.target.value}))}/>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Hasta</label>
                        <input className="form-input" type="date" value={formDel.hasta}
                          onChange={e=>setFormDel(f=>({...f,hasta:e.target.value}))}/>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Motivo (opcional)</label>
                      <input className="form-input" value={formDel.motivo} placeholder="Ej: Viaje a Guadalajara, cosecha en el norte..."
                        onChange={e=>setFormDel(f=>({...f,motivo:e.target.value}))}/>
                    </div>
                    <div style={{display:"flex",gap:8,marginTop:4}}>
                      <button className="btn btn-primary" onClick={()=>{
                        if(!formDel.de||!formDel.para||!formDel.desde||!formDel.hasta) return;
                        if(formDel.hasta < formDel.desde) { alert("La fecha final debe ser mayor a la inicial"); return; }
                        dispatch({type:"ADD_DELEGACION", payload:formDel});
                        setFormDel({de:"",para:"",desde:hoyDelStr,hasta:"",motivo:""});
                        setShowFormDel(false);
                      }}>💾 Guardar Delegación</button>
                    </div>
                  </div>
                )}

                {/* Lista de delegaciones */}
                {delegaciones.length===0 ? (
                  <div style={{padding:"20px",textAlign:"center",color:T.fog,fontSize:13}}>
                    Sin delegaciones registradas
                  </div>
                ) : (
                  <table style={{width:"100%",borderCollapse:"collapse",marginBottom:8}}>
                    <thead>
                      <tr style={{borderBottom:`2px solid ${T.line}`}}>
                        <th style={{padding:"8px 12px",textAlign:"left",fontSize:12,color:T.fog}}>Ausente</th>
                        <th style={{padding:"8px 12px",textAlign:"left",fontSize:12,color:T.fog}}>Suplente</th>
                        <th style={{padding:"8px 12px",textAlign:"left",fontSize:12,color:T.fog}}>Período</th>
                        <th style={{padding:"8px 12px",textAlign:"left",fontSize:12,color:T.fog}}>Motivo</th>
                        <th style={{padding:"8px 12px",textAlign:"left",fontSize:12,color:T.fog}}>Estatus</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...delegaciones].sort((a,b)=>b.creadoEn.localeCompare(a.creadoEn)).map((d,i)=>{
                        const bg = i%2===0?"white":"#faf8f3";
                        const esHoy = d.activa && d.desde<=hoyDate && d.hasta>=hoyDate;
                        const expirada = d.hasta < hoyDate;
                        const futura = d.desde > hoyDate;
                        return (
                          <tr key={d.id}>
                            <td style={{background:bg,padding:"10px 12px",fontWeight:600,fontSize:13}}>{nomUser(d.de)}</td>
                            <td style={{background:bg,padding:"10px 12px",fontSize:13}}>
                              <span style={{fontWeight:600,color:"#1a6ea8"}}>{nomUser(d.para)}</span>
                              <div style={{fontSize:11,color:T.fog}}>{rolUser(d.para)}</div>
                            </td>
                            <td style={{background:bg,padding:"10px 12px",fontSize:12,color:T.fog}}>
                              {d.desde} → {d.hasta}
                            </td>
                            <td style={{background:bg,padding:"10px 12px",fontSize:12,color:T.fog,fontStyle:"italic"}}>
                              {d.motivo||"—"}
                            </td>
                            <td style={{background:bg,padding:"10px 12px"}}>
                              {!d.activa ? (
                                <span style={{padding:"2px 8px",borderRadius:10,fontSize:11,background:"#f0f0f0",color:T.fog}}>Revocada</span>
                              ) : esHoy ? (
                                <span style={{padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:700,background:"#d4edda",color:"#155724"}}>✅ Activa ahora</span>
                              ) : expirada ? (
                                <span style={{padding:"2px 8px",borderRadius:10,fontSize:11,background:"#f0f0f0",color:T.fog}}>Expirada</span>
                              ) : (
                                <span style={{padding:"2px 8px",borderRadius:10,fontSize:11,background:"#fff3cd",color:"#856404"}}>⏳ Futura</span>
                              )}
                            </td>
                            <td style={{background:bg,padding:"10px 12px"}}>
                              {d.activa&&!expirada&&(
                                <button className="btn btn-sm" style={{fontSize:11,background:"#fff3cd",color:"#856404",border:"1px solid #ffc107"}}
                                  onClick={()=>{if(window.confirm("¿Revocar esta delegación?")) dispatch({type:"REV_DELEGACION",payload:d.id});}}>
                                  Revocar
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {tabActiva==="backup" && (
        <div>
          <div className="card" style={{marginBottom:16}}>
            <div className="card-header"><div className="card-title">💾 Exportar Backup</div></div>
            <div className="card-body">
              <p style={{fontSize:13,color:T.fog,marginBottom:16}}>
                Descarga todos los datos del sistema en un archivo JSON. Guárdalo en un lugar seguro como respaldo.
                Incluye productores, ciclos, lotes, insumos, créditos, bitácora, nómina y configuración.
              </p>
              <button className="btn btn-primary" onClick={()=>{
                try {
                  const saved = localStorage.getItem('agroSistemaState');
                  if(!saved) { alert('No hay datos guardados aún'); return; }
                  const blob = new Blob([saved], {type:'application/json'});
                  const url  = URL.createObjectURL(blob);
                  const a    = document.createElement('a');
                  const fecha = new Date().toISOString().slice(0,10).replace(/-/g,'');
                  a.href = url; a.download = `agro-charay-backup-${fecha}.json`;
                  document.body.appendChild(a); a.click();
                  document.body.removeChild(a); URL.revokeObjectURL(url);
                } catch(e) { alert('Error al exportar: ' + e.message); }
              }}>
                📥 Descargar Backup JSON
              </button>
              <div style={{marginTop:10,fontSize:11,color:T.fog}}>
                Tamaño actual en localStorage: {(()=>{ try { const s=localStorage.getItem('agroSistemaState'); return s ? (s.length/1024).toFixed(0)+'KB de ~5120KB disponibles' : 'Sin datos guardados'; } catch { return 'N/D'; } })()}
              </div>
            </div>
          </div>

          <div className="card" style={{marginBottom:16}}>
            <div className="card-header"><div className="card-title">📤 Restaurar Backup</div></div>
            <div className="card-body">
              <p style={{fontSize:13,color:T.fog,marginBottom:12}}>
                Carga un archivo de backup previamente exportado. <strong style={{color:'#c0392b'}}>Atención: reemplaza todos los datos actuales.</strong>
              </p>
              <button className="btn btn-secondary"
                style={{border:'1px solid #c0392b',color:'#c0392b'}}
                onClick={()=>fileImportRef?.current?.click()}>
                📂 Seleccionar archivo de backup (.json)
              </button>
              <input ref={fileImportRef} type="file" accept=".json" style={{display:"none"}}
                onChange={e=>{
                  const file = e.target.files[0]; if(!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => {
                    try {
                      const parsed = JSON.parse(ev.target.result);
                      if(!parsed.productores || !parsed.ciclos) { alert('Archivo no válido'); return; }
                      if(!window.confirm('⚠️ Esto reemplazará TODOS los datos. ¿Continuar?')) return;
                      Object.entries(parsed).forEach(([key, val]) => {
                        dispatch({ type: 'RESTORE_KEY', payload: { key, val } });
                      });
                      localStorage.setItem('agroSistemaState', JSON.stringify(parsed));
                      alert('✅ Backup restaurado. El sistema se recargará.');
                      window.location.reload();
                    } catch { alert('❌ Error al leer el archivo.'); }
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }}/>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">🗑 Limpiar Datos</div></div>
            <div className="card-body">
              <p style={{fontSize:13,color:T.fog,marginBottom:12}}>
                Borra todos los datos del sistema y reinicia con el estado inicial. Úsalo solo si quieres empezar desde cero.
              </p>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <button className="btn btn-secondary"
                  style={{border:"1px solid #e67e22",color:"#e67e22"}}
                  onClick={()=>{
                    if(!window.confirm('¿Limpiar el caché del navegador y recargar con los datos del sistema?')) return;
                    localStorage.removeItem('agroSistemaState');
                    window.location.reload();
                  }}>
                  🔄 Limpiar caché y recargar datos
                </button>
                <button className="btn btn-danger"
                  onClick={()=>{
                    if(!window.confirm('⚠️ PELIGRO: Esto borrará TODOS los datos permanentemente. ¿Estás seguro?')) return;
                    if(!window.confirm('Última oportunidad — ¿realmente deseas borrar todo?')) return;
                    localStorage.removeItem('agroSistemaState');
                    window.location.reload();
                  }}>
                  🗑 Borrar Todo y Reiniciar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
