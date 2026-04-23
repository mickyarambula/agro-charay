// ─── ROLES Y USUARIOS ─────────────────────────────────────────────────────────
// Constantes base y helpers para resolver permisos por rol / usuario.
// Compartido por ConfiguracionModule, LoginScreen y el App raíz.

export const ROLES = {
  admin:      { label:"Administrador",        icon:"👑", color:"#2d7a3a" },
  socio:      { label:"Socio / Dirección",    icon:"🤝", color:"#1a6ea8" },
  encargado:  { label:"Encargado de Campo",   icon:"🌾", color:"#c8a84b" },
  ingeniero:  { label:"Ingeniero de Campo",   icon:"🌿", color:"#27ae60" },
  compras:    { label:"Compras / Admin",       icon:"🛒", color:"#8e44ad" },
  campo:      { label:"Operador de Campo",    icon:"👷", color:"#e67e22" },
};

// Módulos visibles por rol
export const ACCESO = {
  admin:      ["dashboard","flujos","ordenes","productores","ciclos","lotes","bitacora","maquinaria","operadores","insumos","diesel","inventario","capital","credito","creditosref","rentas","gastos","costos","activos","personal","cosecha","cajachica","paneldaniela","proyeccion","asistente","edo_resultados","balance","flujo_caja","reportes","configuracion"],
  socio:      ["dashboard","flujos","lotes","bitacora","maquinaria","operadores","insumos","diesel","costos","cosecha","cajachica","rentas","proyeccion","asistente","reportes","credito","gastos"],
  encargado:  ["dashboard","flujos","ordenes","bitacora","lotes","maquinaria","operadores","insumos","diesel","cajachica"],
  ingeniero:  ["dashboard","flujos","ordenes","bitacora","lotes","insumos","inventario"],
  compras:    ["dashboard","flujos","insumos","diesel","inventario","gastos","lotes","bitacora"],
  campo:      ["dashboard","ordenes","bitacora","lotes","diesel"],
};

// Usuarios base hardcoded. Complementados por state.usuariosExtra en runtime.
export const USUARIOS = [
  { id:1, nombre:"Miguel",              usuario:"admin",   password:"123123",     rol:"admin" },
  { id:2, nombre:"Agrofraga",           usuario:"socio",   password:"agro2025",   rol:"socio" },
  { id:3, nombre:"Encargado",           usuario:"campo",   password:"campo2025",  rol:"campo" },
  { id:4, nombre:"DANIELA GONZALEZ PEREZ", usuario:"daniela",    password:"871005",    rol:"admin" },
  { id:5, nombre:"Encargado de Campo",     usuario:"encargado",   password:"charay25",  rol:"encargado" },
  { id:6, nombre:"Ingeniero Campo",        usuario:"ingeniero",   password:"ing2025",   rol:"ingeniero" },
  { id:7, nombre:"Compras / Admin",        usuario:"compras",     password:"compras25", rol:"compras" },
];

// Resuelve los permisos efectivos de un rol (considerando rolesPersonalizados).
export function getRolPermisos(state, rolId) {
  if (rolId === "admin") {
    const r = {};
    (ACCESO.admin || []).forEach(m => { r[m] = "editar"; });
    return r;
  }
  const custom = state.rolesPersonalizados?.[rolId];
  if (custom?.permisos) return { ...custom.permisos };
  const modulos = ACCESO[rolId] || [];
  const r = {};
  modulos.forEach(m => { r[m] = "ver"; });
  return r;
}

// Lista de roles base (con overrides) + custom.
export function getRolesDisponibles(state) {
  const baseIds = Object.keys(ROLES);
  const custom = state.rolesPersonalizados || {};
  const baseRoles = baseIds.map(id => {
    const info = ROLES[id];
    const ovr = custom[id];
    return {
      id,
      nombre: ovr?.nombre || info.label,
      icon:   ovr?.icon   || info.icon,
      color:  ovr?.color  || info.color,
      esBase: true,
    };
  });
  const customRoles = Object.values(custom)
    .filter(r => !baseIds.includes(r.id))
    .map(r => ({ id:r.id, nombre:r.nombre, icon:r.icon, color:r.color, esBase:false }));
  return [...baseRoles, ...customRoles];
}

// Info visual de un rol (base o custom). Fallback seguro si no existe.
export function getRolInfo(state, rolId) {
  const disp = getRolesDisponibles(state).find(r => r.id === rolId);
  if (disp) return { label: disp.nombre, icon: disp.icon, color: disp.color, esBase: disp.esBase };
  return { label: rolId, icon: "?", color: "#888", esBase: false };
}

// Permisos efectivos de un usuario específico (granulares → rol → defaults).
export function getPermisosUsuario(state, userId, rol) {
  if (rol === "admin") {
    const r = {};
    (ACCESO.admin || []).forEach(m => { r[m] = "editar"; });
    return r;
  }
  const granulares = state.permisosGranulares?.[userId];
  if (granulares && Object.keys(granulares).length > 0) return granulares;
  return getRolPermisos(state, rol);
}
