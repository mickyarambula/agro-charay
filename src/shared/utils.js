// ─── shared/utils.js ────────────────────────────────────────────────────────
// Paleta de colores, estilos globales, helpers de dominio, constantes.
// Importar este módulo inyecta CSS en el <head> (efecto lateral).

export const T = {
  // ── Fondos ──────────────────────────────────────
  bg:      "#f8f6f2",   // fondo principal — crema cálida
  card:    "#ffffff",   // cards y paneles
  mist:    "#f0ede6",   // fondo alternativo suave
  paper:   "#faf8f4",   // inputs, áreas de texto
  warm:    "#f8f6f2",   // alias de bg
  sand:    "#ede5d8",   // bordes/separadores (legacy usaba como sand)
  cream:   "#f8f6f2",   // legacy alias → bg

  // ── Verde principal ─────────────────────────────
  forest:  "#1a3a0f",   // header, sidebar, botones primarios
  field:   "#2d5a1b",   // hover primarios, acentos
  fieldLt: "#2d5a1b",   // legacy alias
  soil:    "#1a3a0f",   // legacy alias → forest
  leaf:    "#7ab87a",   // texto sobre fondo oscuro
  mint:    "#e8f5e2",   // badges claros

  // ── Texto ───────────────────────────────────────
  ink:     "#1a2e1a",   // texto principal
  inkLt:   "#3d5a3d",   // texto secundario oscuro
  fog:     "#b0a090",   // muted, labels
  line:    "#ede5d8",   // bordes y separadores

  // ── Semánticos ──────────────────────────────────
  gold:    "#c8a84b",   // advertencia, costo
  straw:   "#c8a84b",   // legacy alias
  strawLt: "#e0c47a",   // legacy alias
  rust:    "#c84b4b",   // peligro, pérdida
  sky:     "#2980b9",   // información, ingreso
};


export const css = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body {
    font-family: 'DM Sans', sans-serif;
    background: ${T.cream};
    color: ${T.ink};
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: ${T.paper}; }
  ::-webkit-scrollbar-thumb { background: ${T.sand}; border-radius: 3px; }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.6; transform: scale(0.85); }
  }

  .app { display: flex; height: 100vh; overflow: hidden; }

  /* SIDEBAR */
  .sidebar {
    width: 240px; flex-shrink: 0;
    background: #1a3a0f;
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    display: flex; flex-direction: column;
    box-shadow: 4px 0 20px rgba(26,58,15,0.25);
    position: relative; z-index: 10;
  }
  .sidebar-logo {
    padding: 28px 24px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .logo-title {
    font-family: Georgia, serif;
    font-size: 18px; font-weight: 700;
    color: #e8f5e2; letter-spacing: 0.02em;
    line-height: 1.2;
  }
  .logo-sub {
    font-size: 10px; font-weight: 500; letter-spacing: 0.14em;
    text-transform: uppercase; color: #4a7c3f;
    margin-top: 3px;
  }
  .sidebar-section-label {
    font-size: 9px; font-weight: 600; letter-spacing: 0.18em;
    text-transform: uppercase; color: #4a7c3f;
    padding: 18px 24px 6px;
  }
  .nav-item {
    display: flex; align-items: center; gap: 11px;
    padding: 10px 18px; cursor: pointer;
    color: #7ab87a;
    font-size: 13.5px; font-weight: 400;
    transition: all 0.18s; border-left: 3px solid transparent;
    border-radius: 6px; margin: 0 8px;
    user-select: none;
  }
  .nav-item:hover { background: rgba(255,255,255,0.08); color: #e8f5e2; }
  .nav-item.active {
    color: #e8f5e2; background: rgba(255,255,255,0.12);
    border-left-color: #a8d5a2; font-weight: 500;
  }
  .nav-icon { font-size: 16px; width: 20px; text-align: center; }
  .sidebar-footer {
    margin-top: auto; padding: 16px 24px;
    border-top: 1px solid rgba(255,255,255,0.08);
    font-size: 11px; color: rgba(255,255,255,0.25);
  }
  .cycle-badge, .ciclo-badge {
    display: inline-block;
    background: rgba(255,255,255,0.1);
    color: #a8d5a2;
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    padding: 4px 10px;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.15);
    margin-top: 5px;
  }

  /* MAIN */
  .main { flex: 1; overflow-y: auto; display: flex; flex-direction: column; background: ${T.mist}; }
  .topbar {
    background: #1a3a0f; border-bottom: none;
    padding: 0 32px; height: 60px;
    padding-top: max(0px, env(safe-area-inset-top));
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0; position: sticky; top: 0; z-index: 5;
    box-shadow: none;
  }
  .topbar, .topbar-title, .topbar-date, .topbar-right { color: #e8f5e2; }
  .topbar-title { font-family: Georgia, serif; }
  .topbar .btn, .topbar button {
    color: #e8f5e2;
    border-color: rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.08);
  }
  .topbar .btn:hover, .topbar button:hover { background: rgba(255,255,255,0.15); }
  .topbar-title {
    font-family: Georgia, serif;
    font-size: 20px; font-weight: 600; color: ${T.inkLt};
  }
  .topbar-right { display: flex; align-items: center; gap: 12px; }
  .topbar-date {
    font-size: 12px; color: ${T.fog};
    font-family: 'DM Mono', monospace;
  }

  .content {
    padding: 28px 32px;
    padding-bottom: max(28px, env(safe-area-inset-bottom));
    flex: 1;
    background: #f8f6f2;
  }

  /* CARDS */
  .card {
    background: #ffffff; border-radius: 10px;
    border: 1px solid #ede5d8;
    box-shadow: 0 1px 6px rgba(26,58,15,0.04);
  }
  .stat-grid > .stat-card,
  .stat-grid > div {
    background: #ffffff;
    border: 1px solid #ede5d8;
    border-radius: 10px;
    border-top: 2px solid #ede5d8;
  }
  .stat-value { font-family: Georgia, serif; }
  .stat-card .stat-value { font-family: Georgia, serif; }
  .card-header {
    padding: 16px 20px 12px;
    border-bottom: 1px solid ${T.line};
    display: flex; align-items: center; justify-content: space-between;
  }
  .card-title {
    font-family: Georgia, serif;
    font-size: 15px; font-weight: 600; color: ${T.inkLt};
  }
  .card-body { padding: 20px; }

  /* STAT CARDS */
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
  .stat-card {
    background: #ffffff; border-radius: 10px; padding: 20px;
    border: 1px solid ${T.line};
    border-top: 2px solid ${T.line};
    box-shadow: 0 1px 6px rgba(26,58,15,0.04);
    position: relative; overflow: hidden;
  }
  .stat-card.green  { border-top: 2px solid #2d7a2d; border-left: none; }
  .stat-card.gold   { border-top: 2px solid #c8a84b; border-left: none; }
  .stat-card.rust   { border-top: 2px solid #c84b4b; border-left: none; }
  .stat-card.sky    { border-top: 2px solid #2980b9; border-left: none; }
  .stat-card.purple { border-top: 2px solid #8e44ad; border-left: none; }
  .stat-icon { font-size: 22px; margin-bottom: 10px; }
  .stat-label { font-size: 11px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: ${T.fog}; }
  .stat-value { font-family: Georgia, serif; font-size: 28px; font-weight: 400; color: ${T.ink}; margin-top: 4px; line-height: 1; }
  .stat-unit { font-size: 13px; font-weight: 400; color: ${T.fog}; margin-left: 3px; }
  .stat-sub { font-size: 11px; color: ${T.fog}; margin-top: 6px; }

  /* GRID LAYOUTS */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 24px; }

  /* BADGES */
  .badge {
    display: inline-flex; align-items: center;
    padding: 3px 10px; border-radius: 20px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.05em;
  }
  .badge-green { background: #e8f4e1; color: ${T.field}; }
  .badge-gold  { background: #fdf3d4; color: #8a6e10; }
  .badge-rust  { background: #fdeee8; color: ${T.rust}; }
  .badge-gray  { background: #f0ece4; color: ${T.fog}; }
  .badge-blue  { background: #e6f2fb; color: #2a6fa8; }

  /* BUTTONS */
  .btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 18px; border-radius: 7px; border: none;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all 0.16s; text-decoration: none;
  }
  .btn-primary {
    background: #1a3a0f; color: #ffffff; border-color: #1a3a0f;
    font-family: Georgia, serif; border-radius: 8px;
  }
  .btn-primary:hover { background: #2d5a1b; border-color: #2d5a1b; }
  .btn-secondary {
    background: transparent; color: ${T.ink}; border: 1px solid ${T.line};
    border-radius: 8px;
  }
  .btn-secondary:hover { background: #f8f6f2; }
  .btn-danger { background: #fdeee8; color: ${T.rust}; }
  .btn-danger:hover { background: #f9dbd0; }
  .btn-sm { padding: 6px 12px; font-size: 12px; }
  .btn-gold { background: ${T.straw}; color: white; }
  .btn-gold:hover { background: #b89030; }

  /* TABLES */
  .table-wrap { overflow-x: auto; }
  .table-wrap-scroll { overflow-x: auto; overflow-y: auto; max-height: 480px; scrollbar-width: thin; scrollbar-color: ${T.straw} ${T.sand}; }
  .table-wrap-scroll::-webkit-scrollbar { width: 16px; height: 16px; }
  .table-wrap-scroll::-webkit-scrollbar-track { background: ${T.sand}; border-radius: 4px; }
  .table-wrap-scroll::-webkit-scrollbar-thumb { background: ${T.straw}; border-radius: 4px; }
  .table-wrap-scroll::-webkit-scrollbar-corner { background: ${T.sand}; }
  .table-wrap-scroll thead th { position: sticky; top: 0; z-index: 1; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  thead th {
    text-align: left; padding: 10px 14px;
    font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;
    color: ${T.fog}; border-bottom: 1px solid ${T.line};
    background: #f8f6f2;
  }
  tbody tr { border-bottom: 1px solid #f0ede6; transition: background 0.12s; }
  tbody tr:hover { background: #faf8f4; }
  tbody td { padding: 12px 14px; color: ${T.ink}; vertical-align: middle; }
  tbody tr:last-child { border-bottom: none; }

  /* FORMS */
  .form-group { margin-bottom: 16px; }
  .form-label {
    display: block; font-size: 11px; font-weight: 600;
    color: ${T.fog}; margin-bottom: 6px;
    text-transform: uppercase; letter-spacing: 0.8px;
  }
  .form-input, .form-select, .form-textarea {
    width: 100%; padding: 10px 13px; border-radius: 8px;
    border: 1px solid ${T.line}; background: #ffffff;
    font-family: 'DM Sans', sans-serif; font-size: 15px; color: ${T.ink};
    transition: border-color 0.15s, box-shadow 0.15s; outline: none;
  }
  .form-input:focus, .form-select:focus, .form-textarea:focus {
    border-color: #2d5a1b;
    box-shadow: 0 0 0 2px rgba(45,90,27,0.1);
  }
  .form-textarea { resize: vertical; min-height: 80px; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }

  /* MODAL */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(30,26,20,0.5);
    display: flex; align-items: center; justify-content: center;
    z-index: 100; backdrop-filter: blur(3px);
    animation: fadeIn 0.18s ease;
  }
  .modal {
    background: #ffffff; border-radius: 12px; width: 540px; max-width: 95vw;
    max-height: 90vh; overflow-y: auto;
    border: 1px solid ${T.line};
    box-shadow: 0 20px 60px rgba(0,0,0,0.18);
    animation: slideUp 0.22s ease;
  }
  .modal-header {
    padding: 20px 24px 16px;
    border-bottom: 1px solid ${T.line};
    background: #ffffff;
    display: flex; align-items: center; justify-content: space-between;
  }
  .modal-title { font-family: Georgia, serif; font-size: 18px; font-weight: 400; color: ${T.ink}; }
  .modal-close { background: none; border: none; font-size: 20px; cursor: pointer; color: ${T.fog}; padding: 4px; }
  .modal-body { padding: 24px; overflow-y: auto; -webkit-overflow-scrolling: touch; background: #ffffff; }
  .modal-footer { padding: 16px 24px; border-top: 1px solid ${T.line}; background: #f8f6f2; display: flex; justify-content: flex-end; gap: 10px; }

  /* PROGRESS */
  .progress-bar { height: 7px; background: ${T.sand}; border-radius: 4px; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 4px; transition: width 0.4s ease; }
  .progress-green { background: ${T.fieldLt}; }
  .progress-gold  { background: ${T.straw}; }
  .progress-rust  { background: ${T.rust}; }

  /* LOTE CARD */
  .lote-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
  .lote-card {
    background: white; border-radius: 10px; border: 1px solid ${T.line};
    box-shadow: 0 1px 6px rgba(0,0,0,0.04); overflow: hidden;
    transition: box-shadow 0.18s, transform 0.18s; cursor: pointer;
  }
  .lote-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.1); transform: translateY(-2px); }
  .lote-card-top {
    padding: 16px 18px 12px;
    background: linear-gradient(135deg, ${T.field} 0%, ${T.fieldLt} 100%);
    color: white; position: relative;
  }
  .lote-hectareas {
    font-family: Georgia, serif;
    font-size: 32px; font-weight: 700; line-height: 1;
  }
  .lote-ha-label { font-size: 12px; opacity: 0.75; margin-left: 3px; }
  .lote-name { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
  .lote-card-body { padding: 14px 18px; }
  .lote-stat-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .lote-stat-label { font-size: 11px; color: ${T.fog}; }
  .lote-stat-value { font-size: 12.5px; font-weight: 600; color: ${T.inkLt}; font-family: 'DM Mono', monospace; }

  /* BITACORA */
  .bitacora-item {
    display: flex; gap: 14px; padding: 14px 0;
    border-bottom: 1px solid ${T.line};
  }
  .bitacora-item:last-child { border-bottom: none; }
  .bitacora-dot {
    width: 36px; height: 36px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; flex-shrink: 0; margin-top: 2px;
  }
  .bitacora-content { flex: 1; }
  .bitacora-title { font-size: 13.5px; font-weight: 600; color: ${T.inkLt}; }
  .bitacora-meta { font-size: 11.5px; color: ${T.fog}; margin-top: 3px; }
  .bitacora-detail { font-size: 12px; color: ${T.inkLt}; margin-top: 5px; }

  /* TABS */
  .tabs { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 2px solid ${T.line}; padding-bottom: 0; }
  .tab {
    padding: 9px 18px; font-size: 13px; font-weight: 500;
    color: ${T.fog}; cursor: pointer; border-bottom: 2px solid transparent;
    margin-bottom: -2px; transition: all 0.15s; border-radius: 6px 6px 0 0;
  }
  .tab:hover { color: ${T.inkLt}; background: ${T.mist}; }
  .tab.active { color: ${T.field}; border-bottom-color: ${T.field}; font-weight: 600; }

  /* EMPTY STATE */
  .empty-state { text-align: center; padding: 48px 24px; color: ${T.fog}; }
  .empty-icon { font-size: 44px; margin-bottom: 14px; }
  .empty-title { font-family: Georgia, serif; font-size: 17px; color: ${T.inkLt}; margin-bottom: 6px; }
  .empty-sub { font-size: 13px; margin-bottom: 20px; }

  /* CHART BARS (CSS only) */
  .bar-chart { display: flex; align-items: flex-end; gap: 10px; height: 120px; padding: 0 4px; }
  .bar-col { display: flex; flex-direction: column; align-items: center; gap: 5px; flex: 1; }
  .bar { width: 100%; border-radius: 4px 4px 0 0; transition: height 0.5s ease; min-height: 4px; }
  .bar-label { font-size: 10px; color: ${T.fog}; font-family: 'DM Mono', monospace; }

  /* ANIMATIONS */
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
  .animate-pulse { animation: pulse 2s infinite; }

  /* UTILITIES */
  .flex { display: flex; } .flex-col { flex-direction: column; }
  .items-center { align-items: center; } .justify-between { justify-content: space-between; }
  .gap-2 { gap: 8px; } .gap-3 { gap: 12px; }
  .mt-1 { margin-top: 4px; } .mt-2 { margin-top: 8px; } .mt-3 { margin-top: 12px; } .mt-4 { margin-top: 16px; }
  .mb-4 { margin-bottom: 16px; } .mb-3 { margin-bottom: 12px; }
  .text-sm { font-size: 12px; } .text-xs { font-size: 11px; }
  .font-mono { font-family: 'DM Mono', monospace; }
  .text-fog { color: ${T.fog}; } .text-field { color: ${T.field}; }
  .fw-600 { font-weight: 600; }
  .w-full { width: 100%; }
  .divider { height: 1px; background: ${T.line}; margin: 16px 0; }

  /* ─── HAMBURGER (solo móvil) ─── */
  .hamburger {
    display: none;
    background: none; border: none; cursor: pointer;
    padding: 8px 10px; margin-right: 4px;
    border-radius: 8px; transition: background 0.15s;
    font-size: 22px; line-height: 1; color: ${T.inkLt};
  }
  .hamburger:hover { background: ${T.paper}; }
  .hamburger:active { background: ${T.sand}; }

  /* Backdrop para drawer en móvil */
  .sidebar-backdrop {
    display: none;
    position: fixed; inset: 0;
    background: rgba(30,25,20,0.55);
    z-index: 99;
    opacity: 0; pointer-events: none;
    transition: opacity 0.28s ease;
    backdrop-filter: blur(2px);
  }
  .sidebar-backdrop.open { opacity: 1; pointer-events: auto; }

  /* ═════════ MOBILE (<768px) ═════════ */
  @media (max-width: 767px) {
    .hamburger {
      display: inline-flex; align-items: center; justify-content: center;
      color: #ffffff !important;
      background: rgba(255,255,255,0.15) !important;
      border-radius: 6px;
      padding: 4px 6px;
    }
    .hamburger:hover { background: rgba(255,255,255,0.25) !important; }
    .hamburger:active { background: rgba(255,255,255,0.32) !important; }
    .sidebar-backdrop { display: block; }

    .sidebar {
      position: fixed;
      top: 0; left: 0; bottom: 0;
      width: 280px; max-width: 85vw;
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
      transform: translateX(-100%);
      transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 100;
      box-shadow: 6px 0 24px rgba(0,0,0,0.35);
    }
    .sidebar.open { transform: translateX(0); }

    .main { width: 100%; }

    .topbar {
      padding: 0 12px;
      padding-top: max(0px, env(safe-area-inset-top));
      height: 56px;
      gap: 8px;
      background: #1a3a0f;
      border-bottom: none;
    }
    .topbar, .topbar .topbar-title, .topbar .topbar-date { color: #e8f5e2; }
    .topbar .badge { color: #e8f5e2; }
    .topbar-title {
      font-size: 15px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
      flex: 1;
    }
    .topbar-right { gap: 6px; flex-shrink: 0; }
    .topbar-right > .topbar-date,
    .topbar-right > .badge,
    .topbar-right > .mobile-hide { display: none !important; }

    .content {
      padding: 14px 12px;
      padding-bottom: max(16px, env(safe-area-inset-bottom));
      background: #f8f6f2;
    }

    /* Stats: 2 columnas en móvil, luego 1 en muy angosto */
    .stat-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px; margin-bottom: 16px; }
    .stat-card { padding: 14px; }
    .stat-value { font-size: 22px; }
    .stat-icon { font-size: 18px; margin-bottom: 6px; }
    .stat-label { font-size: 10px; }

    /* Grids de 2 y 3 columnas colapsan a 1 */
    .grid-2, .grid-3 { grid-template-columns: 1fr !important; gap: 14px; }

    /* Excepciones: contenedores que deben mantener su grid en móvil */
    .bitacora-tipos,
    .acciones-campo {
      grid-template-columns: 1fr 1fr !important;
      width: 100% !important;
      display: grid !important;
    }

    /* Colapsa también los grids inline style={{display:"grid",gridTemplateColumns:"..."}} */
    [style*="grid-template-columns: 1fr 1fr"]:not(.bitacora-tipos):not(.acciones-campo),
    [style*="grid-template-columns: 1fr 1fr 1fr"]:not(.bitacora-tipos):not(.acciones-campo),
    [style*="grid-template-columns:repeat(2"]:not(.bitacora-tipos):not(.acciones-campo),
    [style*="grid-template-columns: repeat(2"]:not(.bitacora-tipos):not(.acciones-campo),
    [style*="grid-template-columns:repeat(3"]:not(.bitacora-tipos):not(.acciones-campo),
    [style*="grid-template-columns: repeat(3"]:not(.bitacora-tipos):not(.acciones-campo) {
      grid-template-columns: 1fr !important;
    }

    /* Contenedor de 3 tarjetas de Crédito (flex row) → apilar en columna */
    .credito-cards-row {
      flex-direction: column !important;
    }
    .credito-cards-row > * { flex: 1 1 auto !important; width: 100%; }

    .card-header { padding: 12px 14px; flex-wrap: wrap; gap: 8px; }
    .card-title { font-size: 14px; }
    .card-body { padding: 14px; }

    /* Tabs scrolleables horizontalmente */
    .tabs { overflow-x: auto; flex-wrap: nowrap !important; scrollbar-width: none; }
    .tabs::-webkit-scrollbar { display: none; }
    .tab { white-space: nowrap; flex-shrink: 0; }

    /* Tablas scrollean horizontal */
    .table-wrap, .table-wrap-scroll { -webkit-overflow-scrolling: touch; }
    table { font-size: 12px; }
    thead th, tbody td { padding: 8px 10px !important; }

    /* Formularios: filas colapsan */
    .form-row { grid-template-columns: 1fr !important; }

    /* Modal fullscreen-friendly */
    .modal-overlay { align-items: stretch !important; justify-content: stretch !important; padding: 0 !important; }
    .modal {
      position: fixed !important;
      top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
      width: 100vw !important;
      max-width: 100vw !important;
      height: 100vh !important;
      max-height: 100vh !important;
      border-radius: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
    }
    .modal-header { flex: 0 0 auto; }
    .modal-body {
      flex: 1 1 auto !important;
      overflow-y: auto !important;
      -webkit-overflow-scrolling: touch !important;
      padding: 18px !important;
    }
    .modal-footer { flex: 0 0 auto; }

    /* Botones más pequeños en móvil */
    .btn { padding: 8px 14px; font-size: 13px; }
    .btn-sm { padding: 6px 10px; font-size: 11px; }
  }

  /* Muy angosto (<420px): stat-grid a 1 columna */
  @media (max-width: 419px) {
    .stat-grid { grid-template-columns: 1fr !important; }
    .topbar-title { font-size: 14px; }
  }
`;

// ─── Inyección de estilos (side effect al importar) ─────────────────────────
if (typeof document !== 'undefined') {
  if (!document.getElementById('agro-fonts')) {
    const fontLink = document.createElement('link');
    fontLink.id = 'agro-fonts';
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap';
    document.head.appendChild(fontLink);
  }
  if (!document.getElementById('agro-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'agro-styles';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }
}

// ─── Confirmación de eliminación + helpers de protección ───────────────────
export const confirmarEliminar = (mensaje, callback) => {
  if (window.confirm(mensaje || "¿Estás seguro que deseas eliminar este registro? Esta acción no se puede deshacer.")) {
    callback();
  }
};

export const puedeEliminarLote = (loteId, state) => {
  const id = String(loteId);
  const razones = [];

  // En asignaciones de ciclos
  const enCiclo = (state.ciclos||[]).some(c =>
    (c.asignaciones||[]).some(a => String(a.loteId) === id)
  );
  if (enCiclo) razones.push("está asignado en un ciclo agrícola");

  // En insumos
  if ((state.insumos||[]).some(i => String(i.loteId) === id))
    razones.push("tiene registros de insumos asociados");

  // En diesel
  if ((state.diesel||[]).some(d => String(d.loteId) === id))
    razones.push("tiene registros de diesel asociados");

  // En rentas
  if ((state.rentas||[]).some(r => String(r.loteId) === id))
    razones.push("tiene rentas registradas");

  // En egresos
  if ((state.egresosManual||[]).some(e => String(e.loteId) === id))
    razones.push("tiene egresos registrados");

  return razones;
};


export const puedeEliminarProductor = (prodId, state) => {
  const id = String(prodId);
  const razones = [];

  // En ciclos (productores del ciclo + asignaciones)
  const enCiclo = (state.ciclos||[]).some(c =>
    (c.productores||[]).some(p => String(p) === id) ||
    (c.asignaciones||[]).some(a => String(a.productorId) === id)
  );
  if (enCiclo) razones.push("está registrado en ciclos agrícolas");

  // En expedientes de crédito
  if ((state.expedientes||[]).some(e => String(e.productorId) === id))
    razones.push("tiene expedientes de crédito");

  // En insumos
  if ((state.insumos||[]).some(i => String(i.productorId) === id))
    razones.push("tiene registros de insumos");

  // En dispersiones
  if ((state.dispersiones||[]).some(d => String(d.productorId) === id))
    razones.push("tiene dispersiones de crédito");

  // En egresos
  if ((state.egresosManual||[]).some(e => String(e.productorId) === id))
    razones.push("tiene egresos registrados");

  // En rentas
  if ((state.rentas||[]).some(r => String(r.productorId) === id))
    razones.push("tiene rentas registradas");

  return razones;
};


export const puedeEliminarMaquina = (maqId, state) => {
  const razones = [];
  if ((state.horasMaq||[]).some(h => h.maquinariaId === maqId || h.maqId === maqId))
    razones.push("tiene registros de horas de trabajo");
  if ((state.bitacora||[]).some(b => b.maquinariaId === maqId))
    razones.push("aparece en registros de bitácora");
  return razones;
};


export const puedeEliminarOperador = (opId, state) => {
  const razones = [];
  if ((state.bitacora||[]).some(b => String(b.operadorId) === String(opId) || b.operador === opId))
    razones.push("aparece en registros de bitácora");
  if ((state.horasMaq||[]).some(h => String(h.operadorId) === String(opId)))
    razones.push("tiene registros de horas de trabajo");
  return razones;
};


export const MOTIVOS_CANCELACION = [
  "Error en captura",
  "Cancelación de solicitud",
  "Devolución",
  "Duplicado",
  "Otro",
];

// ─── Constantes de dominio ─────────────────────────────────────────────────
export const CAPACIDAD_TANQUE_DIESEL = 10000;

export const CULTIVOS = ["Maíz Blanco","Maíz Dulce","Ejote","Papa","Garbanzo","Trigo","Sorgo"];
export const ESTADOS_FENOL = ["Preparación","Siembra","Emergencia","Vegetativo","Floración","Llenado","Cosecha","Barbecho"];
export const TIPOS_TRABAJO = ["Barbecho","Rastreo","Nivelación","Surcado","Siembra","Fertilización","Riego","Aplicación herbicida","Aplicación fungicida","Aplicación insecticida","Cosecha","Transporte","Mantenimiento","Otro"];
export const CAT_INSUMO = ["Semilla","Fertilizante","Herbicida","Fungicida","Insecticida","Foliar","Adherente","Otro"];
export const UNIDADES   = ["BOLSA","KG","TON","LT","PIEZA","PEIZAS"];
export const CAT_GASTO  = ["Insumos","Diesel","Mano de Obra","Maquinaria Rentada","Fletes","Agua / Riego","Análisis de Suelo","Administración","Otro"];

// ─── Filtro por productor + helpers de ordenamiento ───────────────────────
export function filtrarPorProductor(state) {
  const pid = state.productorActivo;
  if (!pid) return state; // Consolidado — sin filtro
  return {
    ...state,
    lotes:    (((state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.predeterminado))?.asignaciones||[]).filter(a=>String(a.productorId)===String(pid)).map(a=>(state.lotes||[]).find(l=>l.id===a.loteId)).filter(Boolean),
    gastos:   state.gastos.filter(g => !g.productorId || g.productorId === pid),
    diesel:   state.diesel.filter(d => (!d.productorId || d.productorId === pid)&&((d.cicloId||1)===(state.cicloActivoId||1))),
    insumos:  state.insumos,   // insumos son generales
    credito: {
      institucion: state.credito?.institucion||"Almacenes Santa Rosa",
      noContrato: state.credito?.noContrato||"",
      fechaVencimiento: state.credito?.fechaVencimiento||"",
      lineaAutorizada: state.credito?.lineaAutorizada||0,
      tasaAnual: state.credito?.tasaAnual||0,
      ministraciones: (state.dispersiones||[]).filter(d=>String(d.productorId)===String(pid)),
      pagos: state.credito?.pagos||[],
    },
  };
}



export const PROD_COLORES = ["#2d7a3a","#1a6ea8","#c8a84b","#b85c2c","#8e44ad","#16a085","#d35400","#2980b9","#27ae60","#e74c3c","#f39c12","#546e7a","#c0392b","#7f8c8d","#1abc9c","#9b59b6","#e67e22","#34495e"];

export function ordenarProductores(lista) {
  return [...lista].sort((a, b) => {
    if (a.tipo === "moral" && b.tipo !== "moral") return -1;
    if (b.tipo === "moral" && a.tipo !== "moral") return 1;
    const pa = (a.apPat||a.nombres||"").localeCompare(b.apPat||b.nombres||"", "es", {sensitivity:"base"});
    if (pa !== 0) return pa;
    const ma = (a.apMat||"").localeCompare(b.apMat||"", "es", {sensitivity:"base"});
    if (ma !== 0) return ma;
    return (a.nombres||"").localeCompare(b.nombres||"", "es", {sensitivity:"base"});
  });
}

export function nomCompleto(p) {
  if (p.tipo === "moral") return p.nombres || "";
  return [p.apPat, p.apMat, p.nombres].filter(Boolean).join(" ");
}

// ─── Helpers de formato comunes ────────────────────────────────────────────
export const mxnFmt = (n) =>
  (parseFloat(n) || 0).toLocaleString('es-MX', {
    style: 'currency', currency: 'MXN',
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });

export const fmt = (n, dec = 1) =>
  typeof n === 'number'
    ? n.toLocaleString('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec })
    : n;

export const today = () =>
  new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

export const fenologiaColor = (f) => {
  const map = {
    'Preparación': '#8a8070', 'Siembra': '#c8a84b', 'Emergencia': '#5a8a3a',
    'Vegetativo': '#4a8c2a', 'Floración': '#e67e22', 'Llenado': '#c0392b',
    'Cosecha': '#856404', 'Barbecho': '#bbb'
  };
  return map[f] || '#8a8070';
};

export const estadoColor = (e) =>
  ({ activo: 'green', cosechando: 'gold', barbecho: 'gray' }[e] || 'gray');

export const mxn = n => (typeof n==="number" ? n.toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2}) : "$0.00");
