// ─── core/AppRouter.jsx ──────────────────────────────────────────
// Routing manual: mapea `page` → componente de módulo.
// Todos los imports de módulos viven aquí para mantener App.jsx delgado.
// VistaOperador queda importado en App.jsx (no está en este switch — lo usa
// el bypass para rol==="campo").

import React from 'react';

import RentasModule from "../modules/Rentas.jsx";
import OrdenDia from "../modules/OrdenDia.jsx";
import CapitalModule from "../modules/Capital.jsx";
import ActivosModule from "../modules/Activos.jsx";
import CreditosRefModule from "../modules/CreditosRef.jsx";
import PersonalModule from "../modules/Personal.jsx";
import EdoResultadosModule from "../modules/EdoResultados.jsx";
import BalanceModule from "../modules/Balance.jsx";
import FlujoCajaModule from "../modules/FlujoCaja.jsx";
import MaquinariaModule from "../modules/Maquinaria.jsx";
import OperadoresModule from "../modules/Operadores.jsx";
import InventarioModule from "../modules/Inventario.jsx";
import CostosModule from "../modules/Costos.jsx";
import ReportesModule from "../modules/Reportes.jsx";
import ProyeccionModule from "../modules/Proyeccion.jsx";
import ConfiguracionModule from "../modules/Configuracion.jsx";
import CosechaModule from "../modules/Cosecha.jsx";
import CajaChicaModule from "../modules/CajaChica.jsx";
import PanelDaniela from "../modules/PanelDaniela.jsx";
import LotesModule from "../modules/Lotes.jsx";
import CiclosModule from "../modules/Ciclos.jsx";
import BitacoraModule from "../modules/Bitacora.jsx";
import AsisteModule from "../modules/Asiste.jsx";
import FlujoModule from "../modules/Flujos.jsx";
import ProductoresModule from "../modules/Productores.jsx";
import Dashboard from "../modules/Dashboard.jsx";
import DashboardCampo from "../modules/DashboardCampo.jsx";
import CreditoModule from "../modules/Credito.jsx";
import EgresosModule from "../modules/Egresos.jsx";
import DieselModule from "../modules/Diesel.jsx";
import InsumosModule from "../modules/Insumos.jsx";

export default function AppRouter({
  page, rol, accesoRol, puedeEditarMod, usuario,
  navTo, navMenu, getNavFiltro,
  WidgetCBOTDashboard,
}) {
  if (!accesoRol.includes(page)) return (
    <div className="empty-state">
      <div className="empty-icon">🔒</div>
      <div className="empty-title">Acceso restringido</div>
      <div className="empty-sub">No tienes permisos para ver esta sección.</div>
    </div>
  );
  const pe = puedeEditarMod(page);
  switch(page) {
    case "dashboard":      return ["campo","encargado","ingeniero"].includes(rol) ? <DashboardCampo userRol={rol} usuario={usuario} onNavigate={navMenu}/> : <Dashboard userRol={rol} onNavigate={navTo} widgetCBOT={<WidgetCBOTDashboard />} />;
    case "flujos":         return <FlujoModule userRol={rol} usuario={usuario} />;
    case "ordenes":        return <OrdenDia userRol={rol} usuario={usuario} />;
    case "productores":    return <ProductoresModule userRol={rol} puedeEditar={pe} onNavigate={navTo} />;
    case "ciclos":         return <CiclosModule userRol={rol} puedeEditar={pe} />;
    case "lotes":          return <LotesModule userRol={rol} puedeEditar={pe} />;
    case "bitacora":       return <BitacoraModule userRol={rol} puedeEditar={pe} />;
    case "asistente":      return <AsisteModule userRol={rol} />;
    case "proyeccion":     return <ProyeccionModule userRol={rol} onNavigate={navTo} />;
    case "maquinaria":     return <MaquinariaModule userRol={rol} puedeEditar={pe} />;
    case "operadores":     return <OperadoresModule userRol={rol} puedeEditar={pe} />;
    case "insumos":        return <InsumosModule userRol={rol} puedeEditar={pe} onNavigate={navTo} navFiltro={getNavFiltro("insumos")} />;
    case "diesel":         return <DieselModule userRol={rol} usuario={usuario} puedeEditar={pe} onNavigate={navTo} navFiltro={getNavFiltro("diesel")} />;
    case "capital":        return <CapitalModule userRol={rol} puedeEditar={pe} />;
    case "creditosref":    return <CreditosRefModule userRol={rol} />;
    case "activos":        return <ActivosModule userRol={rol} puedeEditar={pe} />;
    case "personal":       return <PersonalModule userRol={rol} />;
    case "cosecha":        return <CosechaModule userRol={rol} puedeEditar={pe} />;
    case "cajachica":      return <CajaChicaModule userRol={rol} usuario={usuario} puedeEditar={pe} />;
    case "paneldaniela":  return <PanelDaniela userRol={rol} />;
    case "credito":        return <CreditoModule userRol={rol} puedeEditar={pe} onNavigate={navTo} navFiltro={getNavFiltro("credito")} />;
    case "rentas":         return <RentasModule userRol={rol} onNavigate={navTo} />;
    case "gastos":         return <EgresosModule userRol={rol} puedeEditar={pe} onNavigate={navTo} navFiltro={getNavFiltro("gastos")} />;
    case "inventario":     return <InventarioModule userRol={rol} puedeEditar={pe} />;
    case "costos":         return <CostosModule userRol={rol} puedeEditar={pe} onNavigate={navTo} />;
    case "reportes":       return <ReportesModule userRol={rol} onNavigate={navTo} />;
    case "edo_resultados": return <EdoResultadosModule userRol={rol} onNavigate={navTo} />;
    case "balance":        return <BalanceModule userRol={rol} onNavigate={navTo} />;
    case "flujo_caja":     return <FlujoCajaModule userRol={rol} onNavigate={navTo} />;
    case "configuracion":  return rol==="admin" ? <ConfiguracionModule userRol={rol} /> : <Dashboard userRol={rol} onNavigate={navTo} widgetCBOT={<WidgetCBOTDashboard />} />;
    default: return <Dashboard userRol={rol} onNavigate={navTo} widgetCBOT={<WidgetCBOTDashboard />} />;
  }
}
