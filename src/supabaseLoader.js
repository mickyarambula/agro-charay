// supabaseLoader.js
// Hidrata localStorage desde Supabase si los datos locales estan vacios.
// Llamar: await loadStateFromSupabase() en el login screen.

const SUPABASE_URL = "https://oryixvodfqojunnqbkln.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yeWl4dm9kZnFvanVubnFia2xuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODUzMjAsImV4cCI6MjA5MTQ2MTMyMH0.03nXDh5qj7N-RiCqXxGKvhfZSVWDmuV4hFwTOZ66ZCQ";

async function supaFetch(table, filters = '') {
  const url = SUPABASE_URL + '/rest/v1/' + table + '?select=*' + (filters ? '&' + filters : '');
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
    },
  });
  if (!res.ok) throw new Error('Supabase ' + table + ' error: ' + res.status);
  return res.json();
}

function resolveProductorId(row, productoresRows) {
  if (!row.productor_id) return null;
  const prod = productoresRows.find(p => p.id === row.productor_id);
  return prod ? prod.legacy_id : null;
}

export async function loadStateFromSupabase() {
  try {
    // Siempre recargar datos frescos de Supabase al login. Si el fetch falla
    // (sin red, Supabase caído), el try/catch externo devuelve {error} y la
    // app sigue con lo que ya haya en localStorage.
    console.log('[Supabase] Cargando datos frescos...');
    const [productoresRows, lotesRows, ciclosRows, insumosRows, dispersionesRows, egresosRows, dieselRows, operadoresRows, maquinariaRows, ordenesRows, asignacionesRows] = await Promise.all([
      supaFetch('productores', 'order=legacy_id'),
      supaFetch('lotes', 'order=legacy_id'),
      supaFetch('ciclos', 'order=legacy_id'),
      supaFetch('insumos', 'order=legacy_id'),
      supaFetch('dispersiones', 'order=legacy_id'),
      supaFetch('egresos_manual', 'order=legacy_id'),
      supaFetch('diesel', 'order=legacy_id'),
      supaFetch('operadores', 'order=legacy_id'),
      supaFetch('maquinaria', 'order=legacy_id'),
      supaFetch('ordenes_trabajo', 'order=created_at.desc&limit=200').catch(e => {
        console.warn('[Supabase] ordenes_trabajo fetch falló (tabla puede no existir aún):', e.message);
        return [];
      }),
      supaFetch('ciclo_asignaciones', 'order=created_at').catch(e => {
        console.warn('[Supabase] ciclo_asignaciones fetch falló:', e.message);
        return [];
      }),
    ]);

    const productores = productoresRows.map(r => ({
      id: r.legacy_id, tipo: r.tipo, apPat: r.ap_pat||'', apMat: r.ap_mat||'',
      nombres: r.nombres||'', alias: r.apodo||'', rfc: r.rfc||'', curp: r.curp||'',
      telefono: r.telefono||'', correo: r.correo||'', color: r.color||'#2d5a1b',
      notas: r.notas||'', activo: r.activo!==false, _uuid: r.id,
    }));

    const lotes = lotesRows.map(r => ({
      id: r.legacy_id, folioCorto: r.folio_corto||'', docLegal: r.doc_legal||'',
      ran: r.ran||'', loteNum: r.lote_num||'', apodo: r.apodo||'', nombre: r.nombre||'',
      propietario: r.propietario||'', estado: r.estado||'SINALOA',
      municipio: r.municipio||'EL FUERTE', ejido: r.ejido||'',
      supCertificado: r.sup_certificado||0, supModulo: r.sup_modulo||0,
      supCredito: r.sup_credito||0, hectareas: r.hectareas||0,
      fenologia: r.fenologia||'', activo: r.activo!==false, _uuid: r.id,
    }));

    const ciclos = ciclosRows.map(r => ({
      id: r.legacy_id, nombre: r.nombre, fechaInicio: r.fecha_inicio,
      fechaFin: r.fecha_fin, predeterminado: r.es_predeterminado,
      notas: r.notas||'',
      asignaciones: asignacionesRows
        .filter(a => a.ciclo_id === r.id)
        .map(a => ({
          loteId: lotesRows.find(l => l.id === a.lote_id)?.legacy_id || null,
          productorId: productoresRows.find(p => p.id === a.productor_id)?.legacy_id || null,
          cultivoId: 1,
          variedad: a.variedad || 'Blanco',
          supAsignada: parseFloat(a.sup_asignada) || 0,
        })),
      _uuid: r.id,
    }));

    const insumos = insumosRows.map(r => ({
      id: r.legacy_id, productorId: resolveProductorId(r, productoresRows),
      productorNombre: r.productor_nombre||'', numSolicitud: r.num_solicitud||'',
      numOrden: r.num_orden||'', fechaSolicitud: r.fecha_solicitud||'',
      fechaOrden: r.fecha_orden||'', proveedor: r.proveedor||'',
      categoria: r.categoria||'', insumo: r.insumo||'',
      cantidad: r.cantidad||0, cantidadRecibida: r.cantidad_recibida||0,
      unidad: r.unidad||'', precioUnitario: r.precio_unitario||0,
      importe: r.importe||0, estatus: r.estatus||'pedido',
      cancelado: r.cancelado||false, _uuid: r.id,
    }));

    const dispersiones = dispersionesRows.map(r => ({
      id: r.legacy_id, productorId: resolveProductorId(r, productoresRows),
      productorNombreOriginal: r.productor_nombre_original||'',
      numSolicitud: r.num_solicitud||'', numOrden: r.num_orden||'',
      fecha: r.fecha||'', lineaCredito: r.linea_credito||'parafinanciero',
      monto: r.monto||0, cancelado: r.cancelado||false, _uuid: r.id,
    }));

    const egresosManual = egresosRows.map(r => ({
      id: r.legacy_id, productorId: resolveProductorId(r, productoresRows),
      fecha: r.fecha||'', concepto: r.concepto||'', categoria: r.categoria||'',
      subcategoria: r.subcategoria||'', monto: r.monto||0,
      lineaCredito: r.linea_credito||'', esManoObra: r.es_mano_obra||false,
      solicitudes: r.solicitudes||[], _uuid: r.id,
    }));

    const diesel = dieselRows.map(r => ({
      id: r.legacy_id, productorId: resolveProductorId(r, productoresRows),
      fecha: r.fecha||'', proveedor: r.proveedor||'',
      litros: r.litros_recibidos||0, precioLitro: r.precio_litro||0,
      importe: r.importe||0, concepto: r.concepto||'', _uuid: r.id,
    }));

    const operadores = operadoresRows.map(r => ({
      id: r.legacy_id, nombre: r.nombre||'', puesto: r.puesto||'',
      telefono: r.telefono||'', salarioDia: r.salario_dia||0,
      tarifaEspecial: r.tarifa_especial||0, diasTrabajados: r.dias_trabajados||0,
      maquinaAsignada: r.maquina_asignada||'', activo: r.activo!==false, _uuid: r.id,
    }));

    const maquinaria = maquinariaRows.map(r => ({
      id: r.legacy_id, nombre: r.nombre||'', tipo: r.tipo||'', marca: r.marca||'',
      modelo: r.modelo||'', anio: r.anio||0, placas: r.placas||'',
      propietario: r.propietario||'', costoHora: r.costo_hora||0,
      horasCiclo: r.horas_ciclo||0, horasTotales: r.horas_totales||0,
      estado: r.estado||'activo', _uuid: r.id,
    }));

    // Órdenes de trabajo — Supabase es la fuente de verdad. Los IDs son strings
    // (uuid o Date.now() serializado al crear). Se normalizan a la forma local.
    const ordenesTrabajo = (ordenesRows || []).map(r => ({
      id:               r.id,
      supabaseId:       r.id,
      fecha:            r.fecha,
      tipoTrabajo:      r.tipo,
      estatus:          r.estatus || 'pendiente',
      operadorId:       r.operador_id || null,
      operadorNombre:   r.operador_nombre || '',
      loteId:           r.lote_id || null,
      loteNombre:       r.lote_nombre || '',
      maquinariaId:     r.maquinaria_id || null,
      maquinariaNombre: r.maquinaria_nombre || '',
      insumoId:         r.insumo_id || null,
      insumoNombre:     r.insumo_nombre || '',
      horaInicio:       r.hora_inicio || '',
      horasEstimadas:   parseFloat(r.horas_estimadas) || 0,
      notas:            r.notas || '',
      creadoPor:        r.creado_por || '',
      creadoEn:         r.created_at,
      horaFin:          r.hora_fin || null,
      origen:           'supabase',
    }));

    const predCiclo = ciclos.find(c => c.predeterminado);
    let estadoExistente = {};
    try { const s = localStorage.getItem('agroSistemaState'); if (s) estadoExistente = JSON.parse(s); } catch {}

    // ─── Preservar SOLO configuración y UI-state local; NO mezclar arrays
    //     operativos con los de Supabase (evita duplicados).
    const configPreservada = {
      // Parámetros y configuración
      alertaParams:       estadoExistente.alertaParams       || {},
      creditoParams:      estadoExistente.creditoParams      || undefined,
      creditoLimites:     estadoExistente.creditoLimites     || {},
      paramsCultivo:      estadoExistente.paramsCultivo      || {},
      tarifaStd:          estadoExistente.tarifaStd          || undefined,
      // Permisos y roles
      permisosUsuario:    estadoExistente.permisosUsuario    || {},
      permisosGranulares: estadoExistente.permisosGranulares || {},
      rolesPersonalizados:estadoExistente.rolesPersonalizados|| {},
      usuariosExtra:      estadoExistente.usuariosExtra      || [],
      usuariosBaseEdit:   estadoExistente.usuariosBaseEdit   || {},
      // UI local (último productor/cultivo visto, alertas leídas)
      productorActivo:    estadoExistente.productorActivo    || null,
      cultivoActivo:      estadoExistente.cultivoActivo      || null,
      alertasLeidas:      estadoExistente.alertasLeidas      || [],
      // Datos operativos que NO están aún en Supabase — se preservan locales
      bitacora:           estadoExistente.bitacora           || [],
      trabajos:           estadoExistente.trabajos           || [],
      asistencias:        estadoExistente.asistencias        || [],
      pagosSemana:        estadoExistente.pagosSemana        || [],
      horasMaq:           estadoExistente.horasMaq           || [],
      capital:            estadoExistente.capital            || undefined,
      creditosRef:        estadoExistente.creditosRef        || [],
      activos:            estadoExistente.activos            || [],
      rentas:             estadoExistente.rentas             || [],
      personal:           estadoExistente.personal           || [],
      cosecha:            estadoExistente.cosecha            || undefined,
      proyeccion:         estadoExistente.proyeccion         || [],
      inventario:         estadoExistente.inventario         || { items:[], movimientos:[] },
      // Workflow local (solicitudes, órdenes de compra, notificaciones, etc.)
      solicitudesCompra:  estadoExistente.solicitudesCompra  || [],
      solicitudesGasto:   estadoExistente.solicitudesGasto   || [],
      recomendaciones:    estadoExistente.recomendaciones    || [],
      ordenesCompra:      estadoExistente.ordenesCompra      || [],
      // ordenesTrabajo: NO se preserva — siempre viene de Supabase (fresco)
      notificaciones:     estadoExistente.notificaciones     || [],
      delegaciones:       estadoExistente.delegaciones       || [],
      invCampo:           estadoExistente.invCampo           || [],
      colaOffline:        estadoExistente.colaOffline        || [],
      expedientes:        estadoExistente.expedientes        || [],
    };
    // Quitar undefined para que `{ ...initState, ...savedState }` no sobrescriba defaults
    Object.keys(configPreservada).forEach(k => {
      if (configPreservada[k] === undefined) delete configPreservada[k];
    });

    const estadoNuevo = {
      ...configPreservada,
      // ── Datos operativos: SIEMPRE frescos de Supabase (reemplazo total) ──
      productores, lotes, ciclos, operadores, maquinaria,
      insumos, diesel, egresosManual, dispersiones,
      ordenesTrabajo,  // ← fresco de Supabase (tabla ordenes_trabajo)
      cicloActivoId: predCiclo ? predCiclo.id : (estadoExistente.cicloActivoId || 1),
      cicloActual:   predCiclo ? predCiclo.nombre : (estadoExistente.cicloActual || 'OI 2025-2026'),
      _supabaseCargado: Date.now(),
    };

    localStorage.setItem('agroSistemaState', JSON.stringify(estadoNuevo));
    console.log('[Supabase] Cargado:', { productores: productores.length, lotes: lotes.length, insumos: insumos.length, egresos: egresosManual.length });
    return { loaded: true };
  } catch (e) {
    console.error('[Supabase] Error:', e);
    return { error: e.message };
  }
}

export async function syncRecordToSupabase(tabla, legacyId, data) {
  const SUPABASE_URL2 = "https://oryixvodfqojunnqbkln.supabase.co";
  const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yeWl4dm9kZnFvanVubnFia2xuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4ODUzMjAsImV4cCI6MjA5MTQ2MTMyMH0.03nXDh5qj7N-RiCqXxGKvhfZSVWDmuV4hFwTOZ66ZCQ";
  try {
    const method = legacyId ? 'PATCH' : 'POST';
    const url = SUPABASE_URL2 + '/rest/v1/' + tabla + (legacyId ? '?legacy_id=eq.' + legacyId : '');
    await fetch(url, {
      method,
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(data),
    });
  } catch (e) { console.warn('[Supabase] sync falló:', e.message); }
}
