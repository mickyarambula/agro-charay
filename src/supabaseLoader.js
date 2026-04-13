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
    // Si ya hay datos locales, no cargar
    const existing = localStorage.getItem('agroSistemaState');
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        if (parsed.productores && parsed.productores.length > 0) {
          console.log('[Supabase] localStorage OK, skip');
          return { skipped: true };
        }
      } catch {}
    }

    console.log('[Supabase] Cargando datos...');
    const [productoresRows, lotesRows, ciclosRows, insumosRows, dispersionesRows, egresosRows, dieselRows, operadoresRows, maquinariaRows] = await Promise.all([
      supaFetch('productores', 'order=legacy_id'),
      supaFetch('lotes', 'order=legacy_id'),
      supaFetch('ciclos', 'order=legacy_id'),
      supaFetch('insumos', 'order=legacy_id'),
      supaFetch('dispersiones', 'order=legacy_id'),
      supaFetch('egresos_manual', 'order=legacy_id'),
      supaFetch('diesel', 'order=legacy_id'),
      supaFetch('operadores', 'order=legacy_id'),
      supaFetch('maquinaria', 'order=legacy_id'),
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
      notas: r.notas||'', asignaciones: [], _uuid: r.id,
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

    const predCiclo = ciclos.find(c => c.predeterminado);
    let estadoExistente = {};
    try { const s = localStorage.getItem('agroSistemaState'); if (s) estadoExistente = JSON.parse(s); } catch {}

    const estadoNuevo = {
      ...estadoExistente,
      productores, lotes, ciclos, operadores, maquinaria,
      insumos, diesel, egresosManual, dispersiones,
      cicloActivoId: predCiclo ? predCiclo.id : (estadoExistente.cicloActivoId || 1),
      cicloActual: predCiclo ? predCiclo.nombre : (estadoExistente.cicloActual || 'OI 2025-2026'),
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
