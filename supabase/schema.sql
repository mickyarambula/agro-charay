-- ════════════════════════════════════════════════════════════════════════════
-- AgroSistema Charay — Schema PostgreSQL (VALIDADO CON pglast)
-- ⚠️  LOS DROP TABLE ... CASCADE ELIMINAN TODOS LOS DATOS EXISTENTES.
--     Solo ejecuta este script en staging o en una DB vacía.
-- ════════════════════════════════════════════════════════════════════════════

drop table if exists public.permisos_granulares  cascade;
drop table if exists public.delegaciones         cascade;
drop table if exists public.notificaciones       cascade;
drop table if exists public.ordenes_compra       cascade;
drop table if exists public.recomendaciones      cascade;
drop table if exists public.solicitudes_gasto    cascade;
drop table if exists public.solicitudes_compra   cascade;
drop table if exists public.cosecha_secado       cascade;
drop table if exists public.cosecha_maquila      cascade;
drop table if exists public.cosecha_fletes       cascade;
drop table if exists public.cosecha_cuadrillas   cascade;
drop table if exists public.cosecha_boletas      cascade;
drop table if exists public.pagos_semana         cascade;
drop table if exists public.asistencias          cascade;
drop table if exists public.personal             cascade;
drop table if exists public.horas_maquinaria     cascade;
drop table if exists public.bitacora             cascade;
drop table if exists public.activos              cascade;
drop table if exists public.creditos_refaccionarios cascade;
drop table if exists public.capital_movimientos  cascade;
drop table if exists public.rentas_tierra        cascade;
drop table if exists public.egresos_manual       cascade;
drop table if exists public.dispersiones         cascade;
drop table if exists public.expedientes_credito  cascade;
drop table if exists public.inventario_movimientos cascade;
drop table if exists public.inventario_items     cascade;
drop table if exists public.diesel_recepciones   cascade;
drop table if exists public.diesel               cascade;
drop table if exists public.insumo_recepciones   cascade;
drop table if exists public.insumos              cascade;
drop table if exists public.ciclo_asignaciones   cascade;
drop table if exists public.ciclo_cultivos       cascade;
drop table if exists public.ciclo_productores    cascade;
drop table if exists public.ciclos               cascade;
drop table if exists public.cultivos_catalogo    cascade;
drop table if exists public.maquinaria           cascade;
drop table if exists public.operadores           cascade;
drop table if exists public.lotes                cascade;
drop table if exists public.productores          cascade;
drop table if exists public.roles_personalizados cascade;
drop table if exists public.configuracion        cascade;
drop table if exists public.usuarios             cascade;

drop function if exists public.set_updated_at() cascade;

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.usuarios (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  usuario         text not null unique,
  nombre          text not null,
  password        text not null,
  rol             text not null default 'campo',
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_usuarios_rol on public.usuarios(rol) where activo = true;
create trigger trg_usuarios_updated before update on public.usuarios
  for each row execute function public.set_updated_at();

create table public.productores (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  tipo            text not null default 'resico',
  ap_pat          text default '',
  ap_mat          text default '',
  nombres         text not null,
  apodo           text,
  rfc             text,
  curp            text,
  telefono        text default '',
  correo          text default '',
  color           text default '#2d5a1b',
  notas           text default '',
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_productores_apodo on public.productores(apodo) where activo = true;
create trigger trg_productores_updated before update on public.productores
  for each row execute function public.set_updated_at();

create table public.lotes (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  folio_corto     text,
  doc_legal       text,
  ran             text,
  lote_num        text,
  apodo           text,
  nombre          text,
  propietario     text,
  estado          text default 'SINALOA',
  municipio       text default 'EL FUERTE',
  ejido           text,
  sup_certificado numeric(10,2) default 0,
  sup_modulo      numeric(10,2) default 0,
  sup_credito     numeric(10,2) default 0,
  hectareas       numeric(10,2) default 0,
  fenologia       text,
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_lotes_apodo on public.lotes(apodo) where activo = true;
create trigger trg_lotes_updated before update on public.lotes
  for each row execute function public.set_updated_at();

create table public.operadores (
  id                 uuid primary key default gen_random_uuid(),
  legacy_id          bigint unique,
  nombre             text not null,
  puesto             text,
  telefono           text default '',
  salario_dia        numeric(10,2) default 600,
  tarifa_especial    numeric(10,2) default 750,
  dias_trabajados    integer default 0,
  maquina_asignada   text,
  notas              text default '',
  activo             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger trg_operadores_updated before update on public.operadores
  for each row execute function public.set_updated_at();

create table public.maquinaria (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  nombre          text not null,
  tipo            text not null,
  marca           text,
  modelo          text,
  anio            integer,
  placas          text,
  propietario     text default 'Propio',
  costo_hora      numeric(10,2) default 0,
  horas_totales   numeric(10,2) default 0,
  horas_ciclo     numeric(10,2) default 0,
  estado          text default 'activo',
  notas           text default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_maquinaria_updated before update on public.maquinaria
  for each row execute function public.set_updated_at();

create table public.cultivos_catalogo (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  nombre          text not null unique,
  variedades      text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_cultivos_cat_updated before update on public.cultivos_catalogo
  for each row execute function public.set_updated_at();

create table public.ciclos (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  nombre          text not null,
  fecha_inicio    date not null,
  fecha_fin       date not null,
  es_default      boolean not null default false,
  notas           text default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_ciclos_default on public.ciclos(es_default) where es_default = true;
create trigger trg_ciclos_updated before update on public.ciclos
  for each row execute function public.set_updated_at();

create table public.ciclo_productores (
  ciclo_id        uuid not null references public.ciclos(id) on delete cascade,
  productor_id    uuid not null references public.productores(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (ciclo_id, productor_id)
);

create table public.ciclo_cultivos (
  id              uuid primary key default gen_random_uuid(),
  ciclo_id        uuid not null references public.ciclos(id) on delete cascade,
  cultivo_id      uuid references public.cultivos_catalogo(id) on delete restrict,
  cultivo_nombre  text not null,
  variedad        text not null,
  created_at      timestamptz not null default now(),
  unique (ciclo_id, cultivo_id, variedad)
);
create index idx_ciclo_cultivos_ciclo on public.ciclo_cultivos(ciclo_id);

create table public.ciclo_asignaciones (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint,
  ciclo_id        uuid not null references public.ciclos(id) on delete cascade,
  lote_id         uuid not null references public.lotes(id) on delete restrict,
  productor_id    uuid not null references public.productores(id) on delete restrict,
  cultivo_id      uuid references public.cultivos_catalogo(id) on delete set null,
  variedad        text,
  sup_asignada    numeric(10,2) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_asig_ciclo on public.ciclo_asignaciones(ciclo_id);
create index idx_asig_lote on public.ciclo_asignaciones(lote_id);
create index idx_asig_productor on public.ciclo_asignaciones(productor_id);
create trigger trg_asig_updated before update on public.ciclo_asignaciones
  for each row execute function public.set_updated_at();

create table public.insumos (
  id                    uuid primary key default gen_random_uuid(),
  legacy_id             bigint unique,
  ciclo_id              uuid references public.ciclos(id) on delete restrict,
  productor_id          uuid references public.productores(id) on delete set null,
  productor_nombre      text,
  num_solicitud         text,
  num_orden             text,
  fecha_solicitud       date,
  fecha_orden           date,
  proveedor             text,
  categoria             text,
  insumo                text not null,
  cantidad              numeric(12,3) not null default 0,
  cantidad_recibida     numeric(12,3) not null default 0,
  unidad                text,
  precio_unitario       numeric(12,2) default 0,
  importe               numeric(14,2) default 0,
  estatus               text not null default 'pedido',
  cancelado             boolean not null default false,
  motivo_cancelacion    text,
  comentario_cancelacion text,
  fecha_cancelacion     timestamptz,
  cancelado_por         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index idx_insumos_ciclo on public.insumos(ciclo_id);
create index idx_insumos_productor on public.insumos(productor_id);
create index idx_insumos_estatus on public.insumos(estatus) where cancelado = false;
create trigger trg_insumos_updated before update on public.insumos
  for each row execute function public.set_updated_at();

create table public.insumo_recepciones (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint,
  insumo_id       uuid not null references public.insumos(id) on delete cascade,
  cantidad        numeric(12,3) not null,
  unidad          text,
  fecha           date not null,
  notas           text default '',
  created_at      timestamptz not null default now()
);
create index idx_recep_insumo on public.insumo_recepciones(insumo_id);

create table public.diesel (
  id                    uuid primary key default gen_random_uuid(),
  legacy_id             bigint unique,
  ciclo_id              uuid references public.ciclos(id) on delete restrict,
  productor_id          uuid references public.productores(id) on delete set null,
  productor_nombre      text,
  num_solicitud         text,
  num_orden             text,
  fecha_solicitud       date,
  fecha_orden           date,
  fecha                 date,
  proveedor             text,
  insumo                text default 'TARJETA DIESEL',
  ieps                  text default 'SIN IEPS',
  cantidad              numeric(12,2) not null default 0,
  litros_recibidos      numeric(12,2) not null default 0,
  unidad                text default 'LT',
  precio_litro          numeric(10,2) default 27,
  importe               numeric(14,2) default 0,
  lote_id               uuid references public.lotes(id) on delete set null,
  operador              text,
  concepto              text,
  forma_pago            text default 'credito',
  es_ajuste             boolean not null default false,
  estatus               text not null default 'pedido',
  cancelado             boolean not null default false,
  motivo_cancelacion    text,
  fecha_cancelacion     timestamptz,
  cancelado_por         text,
  notas                 text default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index idx_diesel_ciclo on public.diesel(ciclo_id);
create index idx_diesel_fecha on public.diesel(fecha);
create trigger trg_diesel_updated before update on public.diesel
  for each row execute function public.set_updated_at();

create table public.diesel_recepciones (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint,
  diesel_id       uuid not null references public.diesel(id) on delete cascade,
  litros          numeric(12,2) not null,
  fecha           date not null,
  notas           text default '',
  created_at      timestamptz not null default now()
);
create index idx_diesel_recep on public.diesel_recepciones(diesel_id);

create table public.inventario_items (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  nombre          text not null,
  categoria       text,
  unidad          text not null,
  descripcion     text default '',
  ubicacion       text default 'Bodega',
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_inv_items_nombre on public.inventario_items(nombre) where activo = true;
create trigger trg_inv_items_updated before update on public.inventario_items
  for each row execute function public.set_updated_at();

create table public.inventario_movimientos (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint,
  item_id         uuid not null references public.inventario_items(id) on delete cascade,
  tipo            text not null,
  cantidad        numeric(12,3) not null,
  unidad          text,
  fecha           date not null,
  concepto        text,
  referencia      text,
  ref_id          uuid,
  origen          text,
  created_at      timestamptz not null default now()
);
create index idx_inv_mov_item on public.inventario_movimientos(item_id);
create index idx_inv_mov_fecha on public.inventario_movimientos(fecha desc);

create table public.expedientes_credito (
  id                    uuid primary key default gen_random_uuid(),
  legacy_id             bigint unique,
  ciclo_id              uuid references public.ciclos(id) on delete cascade,
  productor_id          uuid not null references public.productores(id) on delete cascade,
  monto_por_ha          numeric(12,2) default 0,
  limite_para           numeric(14,2) default 0,
  limite_directo        numeric(14,2) default 0,
  notas                 text default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (ciclo_id, productor_id)
);
create trigger trg_exp_credito_updated before update on public.expedientes_credito
  for each row execute function public.set_updated_at();

create table public.dispersiones (
  id                          uuid primary key default gen_random_uuid(),
  legacy_id                   bigint unique,
  ciclo_id                    uuid references public.ciclos(id) on delete restrict,
  productor_id                uuid references public.productores(id) on delete set null,
  productor_nombre_original   text,
  num_solicitud               text,
  num_orden                   text,
  fecha                       date not null,
  linea_credito               text not null,
  monto                       numeric(14,2) not null,
  notas                       text default '',
  cancelado                   boolean not null default false,
  motivo_cancelacion          text,
  fecha_cancelacion           timestamptz,
  cancelado_por               text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index idx_disp_ciclo on public.dispersiones(ciclo_id);
create index idx_disp_productor on public.dispersiones(productor_id);
create index idx_disp_fecha on public.dispersiones(fecha desc);
create trigger trg_disp_updated before update on public.dispersiones
  for each row execute function public.set_updated_at();

create table public.egresos_manual (
  id                  uuid primary key default gen_random_uuid(),
  legacy_id           bigint unique,
  ciclo_id            uuid references public.ciclos(id) on delete restrict,
  productor_id        uuid references public.productores(id) on delete set null,
  lote_id             uuid references public.lotes(id) on delete set null,
  categoria           text not null,
  subcategoria        text default '',
  concepto            text not null,
  monto               numeric(14,2) not null,
  fecha               date not null,
  linea_credito       text default 'directo',
  solicitudes         jsonb default '[]'::jsonb,
  es_mano_obra        boolean not null default false,
  tipo_trabajador     text default '',
  detalle_mo          text default '',
  semana_num          text default '',
  semana_fecha_inicio date,
  semana_fecha_fin    date,
  domingo_fecha       date,
  origen_reembolso_id uuid,
  cancelado           boolean not null default false,
  motivo_cancelacion  text,
  fecha_cancelacion   timestamptz,
  cancelado_por       text,
  notas               text default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_egr_ciclo on public.egresos_manual(ciclo_id);
create index idx_egr_productor on public.egresos_manual(productor_id);
create index idx_egr_fecha on public.egresos_manual(fecha desc);
create index idx_egr_categoria on public.egresos_manual(categoria);
create trigger trg_egresos_updated before update on public.egresos_manual
  for each row execute function public.set_updated_at();

create table public.rentas_tierra (
  id                uuid primary key default gen_random_uuid(),
  legacy_id         bigint unique,
  ciclo_id          uuid references public.ciclos(id) on delete restrict,
  productor_id      uuid references public.productores(id) on delete set null,
  lote_id           uuid references public.lotes(id) on delete set null,
  dueno_nombre      text,
  monto_total       numeric(14,2) not null default 0,
  monto_pagado      numeric(14,2) not null default 0,
  fecha_inicio      date,
  fecha_fin         date,
  pagos_calendario  jsonb default '[]'::jsonb,
  notas             text default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_rentas_ciclo on public.rentas_tierra(ciclo_id);
create trigger trg_rentas_updated before update on public.rentas_tierra
  for each row execute function public.set_updated_at();

create table public.capital_movimientos (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  signo           integer not null check (signo in (-1, 1)),
  monto           numeric(14,2) not null,
  fecha           date not null,
  concepto        text,
  socio           text,
  notas           text default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_capital_fecha on public.capital_movimientos(fecha desc);
create trigger trg_capital_updated before update on public.capital_movimientos
  for each row execute function public.set_updated_at();

create table public.creditos_refaccionarios (
  id                uuid primary key default gen_random_uuid(),
  legacy_id         bigint unique,
  institucion       text,
  monto             numeric(14,2) not null,
  tasa_anual        numeric(5,2),
  plazo_meses       integer,
  fecha_inicio      date,
  fecha_vencimiento date,
  saldo_actual      numeric(14,2),
  notas             text default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger trg_cred_ref_updated before update on public.creditos_refaccionarios
  for each row execute function public.set_updated_at();

create table public.activos (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  nombre          text not null,
  categoria       text,
  valor_adq       numeric(14,2) default 0,
  fecha_adq       date,
  depreciacion    numeric(5,2) default 0,
  ubicacion       text,
  notas           text default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_activos_updated before update on public.activos
  for each row execute function public.set_updated_at();

create table public.bitacora (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  tipo            text not null,
  lote_id         uuid references public.lotes(id) on delete set null,
  lote_ids        jsonb default '[]'::jsonb,
  fecha           date not null,
  operador        text,
  operador_id     uuid references public.operadores(id) on delete set null,
  maquinaria_id   uuid references public.maquinaria(id) on delete set null,
  horas           numeric(6,2) default 0,
  notas           text default '',
  foto            text,
  payload         jsonb default '{}'::jsonb,
  creado_por      uuid references public.usuarios(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_bit_fecha on public.bitacora(fecha desc);
create index idx_bit_tipo on public.bitacora(tipo);
create index idx_bit_lote on public.bitacora(lote_id);
create index idx_bit_operador on public.bitacora(operador_id);
create trigger trg_bit_updated before update on public.bitacora
  for each row execute function public.set_updated_at();

create table public.horas_maquinaria (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  maquinaria_id   uuid references public.maquinaria(id) on delete cascade,
  operador_id     uuid references public.operadores(id) on delete set null,
  lote_id         uuid references public.lotes(id) on delete set null,
  fecha           date not null,
  horas           numeric(6,2) not null,
  concepto        text,
  fuente          text default 'manual',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_horas_maq on public.horas_maquinaria(maquinaria_id);
create index idx_horas_fecha on public.horas_maquinaria(fecha desc);
create trigger trg_horas_updated before update on public.horas_maquinaria
  for each row execute function public.set_updated_at();

create table public.personal (
  id                uuid primary key default gen_random_uuid(),
  legacy_id         bigint unique,
  nombre            text not null,
  puesto            text,
  honorario_mensual numeric(12,2) default 0,
  telefono          text,
  correo            text,
  activo            boolean not null default true,
  notas             text default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger trg_personal_updated before update on public.personal
  for each row execute function public.set_updated_at();

create table public.asistencias (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  operador_id     uuid not null references public.operadores(id) on delete cascade,
  lote_id         uuid references public.lotes(id) on delete set null,
  fecha           date not null,
  tarifa          numeric(10,2) not null,
  tipo_tarifa     text default 'normal',
  trabajo         text,
  notas           text default '',
  created_at      timestamptz not null default now()
);
create index idx_asist_operador on public.asistencias(operador_id);
create index idx_asist_fecha on public.asistencias(fecha desc);

create table public.pagos_semana (
  id                uuid primary key default gen_random_uuid(),
  legacy_id         bigint unique,
  semana_num        text,
  semana_inicio     date not null,
  semana_fin        date not null,
  total             numeric(14,2) not null default 0,
  asistencia_ids    jsonb default '[]'::jsonb,
  fecha_pago        date,
  pagado_por        text,
  notas             text default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger trg_pagos_sem_updated before update on public.pagos_semana
  for each row execute function public.set_updated_at();

create table public.cosecha_boletas (
  id                uuid primary key default gen_random_uuid(),
  legacy_id         bigint unique,
  ciclo_id          uuid references public.ciclos(id) on delete restrict,
  productor_id      uuid references public.productores(id) on delete set null,
  lote_id           uuid references public.lotes(id) on delete set null,
  fecha             date not null,
  num_boleta        text,
  kg_bruto          numeric(12,2) default 0,
  kg_tara           numeric(12,2) default 0,
  kg_neto           numeric(12,2) default 0,
  humedad           numeric(5,2),
  impurezas         numeric(5,2),
  precio_kg         numeric(10,4),
  importe           numeric(14,2) default 0,
  destino           text,
  placas            text,
  chofer            text,
  cancelado         boolean not null default false,
  motivo_cancelacion text,
  fecha_cancelacion timestamptz,
  notas             text default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_cosecha_boletas_ciclo on public.cosecha_boletas(ciclo_id);
create index idx_cosecha_boletas_fecha on public.cosecha_boletas(fecha desc);
create trigger trg_cosecha_boletas_updated before update on public.cosecha_boletas
  for each row execute function public.set_updated_at();

create table public.cosecha_cuadrillas (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  ciclo_id        uuid references public.ciclos(id) on delete restrict,
  nombre          text not null,
  responsable     text,
  integrantes     integer,
  tarifa          numeric(10,2),
  notas           text default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_cosecha_cuadr_updated before update on public.cosecha_cuadrillas
  for each row execute function public.set_updated_at();

create table public.cosecha_fletes (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  ciclo_id        uuid references public.ciclos(id) on delete restrict,
  fecha           date,
  transportista   text,
  placas          text,
  origen          text,
  destino         text,
  kg              numeric(12,2),
  tarifa_ton      numeric(10,2),
  importe         numeric(14,2),
  notas           text default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_cosecha_fletes_updated before update on public.cosecha_fletes
  for each row execute function public.set_updated_at();

create table public.cosecha_maquila (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  ciclo_id        uuid references public.ciclos(id) on delete restrict,
  fecha           date,
  prestador       text,
  concepto        text,
  kg              numeric(12,2),
  tarifa_kg       numeric(10,4),
  importe         numeric(14,2),
  notas           text default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_cosecha_maquila_updated before update on public.cosecha_maquila
  for each row execute function public.set_updated_at();

create table public.cosecha_secado (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  ciclo_id        uuid references public.ciclos(id) on delete restrict,
  fecha           date,
  planta          text,
  kg_humedo       numeric(12,2),
  kg_seco         numeric(12,2),
  humedad_inicial numeric(5,2),
  humedad_final   numeric(5,2),
  tarifa_punto    numeric(10,4),
  importe         numeric(14,2),
  notas           text default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_cosecha_secado_updated before update on public.cosecha_secado
  for each row execute function public.set_updated_at();

create table public.solicitudes_compra (
  id                uuid primary key default gen_random_uuid(),
  legacy_id         bigint unique,
  ciclo_id          uuid references public.ciclos(id) on delete restrict,
  concepto          text not null,
  descripcion       text,
  proveedor         text,
  cantidad          text,
  unidad            text,
  destino           text,
  monto_estimado    numeric(14,2) default 0,
  urgente           boolean default false,
  fecha             date,
  fecha_requerida   date,
  detalle           text,
  estatus           text not null default 'pendiente',
  creado_por        uuid references public.usuarios(id) on delete set null,
  aprobado_por      uuid references public.usuarios(id) on delete set null,
  rechazado_por     uuid references public.usuarios(id) on delete set null,
  historial         jsonb default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_sol_compra_estatus on public.solicitudes_compra(estatus);
create trigger trg_sol_compra_updated before update on public.solicitudes_compra
  for each row execute function public.set_updated_at();

create table public.solicitudes_gasto (
  id                uuid primary key default gen_random_uuid(),
  legacy_id         bigint unique,
  ciclo_id          uuid references public.ciclos(id) on delete restrict,
  concepto          text not null,
  monto             numeric(14,2) not null default 0,
  categoria         text,
  fecha             date not null,
  notas             text default '',
  urgente           boolean default false,
  fecha_requerida   date,
  detalle           text,
  es_reembolso      boolean not null default false,
  estatus           text not null default 'pendiente',
  creado_por        uuid references public.usuarios(id) on delete set null,
  aprobado_por      uuid references public.usuarios(id) on delete set null,
  pagado_por        uuid references public.usuarios(id) on delete set null,
  rechazado_por     uuid references public.usuarios(id) on delete set null,
  fecha_pago        timestamptz,
  historial         jsonb default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_sol_gasto_estatus on public.solicitudes_gasto(estatus);
create index idx_sol_gasto_reembolso on public.solicitudes_gasto(es_reembolso) where es_reembolso = true;
create trigger trg_sol_gasto_updated before update on public.solicitudes_gasto
  for each row execute function public.set_updated_at();

create table public.recomendaciones (
  id                uuid primary key default gen_random_uuid(),
  legacy_id         bigint unique,
  ciclo_id          uuid references public.ciclos(id) on delete restrict,
  descripcion       text not null,
  lotes             text,
  producto          text,
  fecha             date,
  urgente           boolean default false,
  estatus           text not null default 'pendiente',
  creado_por        uuid references public.usuarios(id) on delete set null,
  aprobado_por      uuid references public.usuarios(id) on delete set null,
  historial         jsonb default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger trg_recom_updated before update on public.recomendaciones
  for each row execute function public.set_updated_at();

create table public.ordenes_compra (
  id                uuid primary key default gen_random_uuid(),
  legacy_id         bigint unique,
  ciclo_id          uuid references public.ciclos(id) on delete restrict,
  solicitud_id      uuid references public.solicitudes_compra(id) on delete set null,
  concepto          text,
  proveedor         text,
  monto_estimado    numeric(14,2) default 0,
  estatus           text not null default 'abierta',
  cotizaciones      jsonb default '[]'::jsonb,
  creado_por        uuid references public.usuarios(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_ord_estatus on public.ordenes_compra(estatus);
create trigger trg_ord_updated before update on public.ordenes_compra
  for each row execute function public.set_updated_at();

create table public.notificaciones (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  para            text not null,
  tipo            text,
  titulo          text,
  mensaje         text not null,
  leida           boolean not null default false,
  ref_id          uuid,
  ref_tabla       text,
  fecha           timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index idx_notif_para on public.notificaciones(para, leida);
create index idx_notif_fecha on public.notificaciones(fecha desc);

create table public.delegaciones (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  de_usuario      text not null,
  para_usuario    text not null,
  desde           date not null,
  hasta           date not null,
  activa          boolean not null default true,
  motivo          text,
  creado_por      uuid references public.usuarios(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_deleg_activa on public.delegaciones(activa, desde, hasta);
create trigger trg_deleg_updated before update on public.delegaciones
  for each row execute function public.set_updated_at();

create table public.roles_personalizados (
  id              text primary key,
  nombre          text not null,
  icon            text default '👥',
  color           text default '#1a6ea8',
  permisos        jsonb not null default '{}'::jsonb,
  es_base         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_roles_updated before update on public.roles_personalizados
  for each row execute function public.set_updated_at();

create table public.permisos_granulares (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references public.usuarios(id) on delete cascade,
  modulo_id       text not null,
  nivel           text not null check (nivel in ('ver','editar')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (usuario_id, modulo_id)
);
create index idx_perm_usuario on public.permisos_granulares(usuario_id);
create trigger trg_perm_updated before update on public.permisos_granulares
  for each row execute function public.set_updated_at();

create table public.configuracion (
  clave           text primary key,
  valor           jsonb not null default '{}'::jsonb,
  descripcion     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_config_updated before update on public.configuracion
  for each row execute function public.set_updated_at();

do $$
declare
  t text;
  tables text[] := array[
    'usuarios','productores','lotes','operadores','maquinaria','cultivos_catalogo',
    'ciclos','ciclo_productores','ciclo_cultivos','ciclo_asignaciones',
    'insumos','insumo_recepciones','diesel','diesel_recepciones',
    'inventario_items','inventario_movimientos',
    'expedientes_credito','dispersiones','egresos_manual','rentas_tierra',
    'capital_movimientos','creditos_refaccionarios','activos',
    'bitacora','horas_maquinaria',
    'personal','asistencias','pagos_semana',
    'cosecha_boletas','cosecha_cuadrillas','cosecha_fletes','cosecha_maquila','cosecha_secado',
    'solicitudes_compra','solicitudes_gasto','recomendaciones','ordenes_compra',
    'notificaciones','delegaciones','roles_personalizados','permisos_granulares','configuracion'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_auth_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_auth_all', t
    );
  end loop;
end $$;

insert into public.roles_personalizados (id, nombre, icon, color, permisos, es_base) values
  ('admin',     'Administrador',      '👑', '#2d7a3a', '{}'::jsonb, true),
  ('socio',     'Socio / Dirección',  '🤝', '#1a6ea8', '{}'::jsonb, true),
  ('encargado', 'Encargado de Campo', '🌾', '#c8a84b', '{}'::jsonb, true),
  ('ingeniero', 'Ingeniero de Campo', '🌿', '#27ae60', '{}'::jsonb, true),
  ('compras',   'Compras / Admin',    '🛒', '#8e44ad', '{}'::jsonb, true),
  ('campo',     'Operador de Campo',  '👷', '#e67e22', '{}'::jsonb, true)
on conflict (id) do nothing;
