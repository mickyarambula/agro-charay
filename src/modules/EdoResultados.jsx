// ─── modules/EdoResultados.jsx ───────────────────────────────────────────

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
import { mxn } from "../App.jsx";


export default function EdoResultadosModule({ userRol, onNavigate }) {
  const { state } = useData();
  const F = calcularFinancieros(state);
  const ciclo = state.cicloActual;
  const nav = (page, pid, filtros) => onNavigate && onNavigate(page, pid, filtros);

  const rows = [
    { tipo:"header",  label:"INGRESOS" },
    { tipo:"item",    label:"Venta de grano estimada", valor:F.ingresoEst, color:T.field, mod:"cosecha" },
    { tipo:"subtotal",label:"TOTAL INGRESOS", valor:F.ingresoEst, color:T.field },
    { tipo:"spacer" },
    { tipo:"header",  label:"COSTOS DE PRODUCCIÓN" },
    { tipo:"item",    label:"Semilla certificada",       valor:F.costoSemilla,    mod:"insumos", filtro:{categoria:"Semilla",vista:"tabla"} },
    { tipo:"item",    label:"Insumos aplicados (sin semilla)", valor:(F.costoInsumos||0)-(F.costoSemilla||0), mod:"insumos", filtro:{categoria:"Fertilizante",vista:"tabla"} },
    { tipo:"item",    label:"Diesel y combustible",     valor:F.costoDiesel,     mod:"diesel" },
    { tipo:"item",    label:"Renta de tierras (ciclo)", valor:F.costoRenta,      mod:"rentas" },
    { tipo:"item",    label:"Maquinaria propia (h/c)",  valor:F.costoMaquinaria, mod:"maquinaria" },
    { tipo:"item",    label:"Nómina operadores campo",  valor:F.costoNomina,     mod:"operadores" },
    { tipo:"item",    label:"Cuadrillas y maquila",     valor:F.costoCosecha,    mod:"cosecha" },
    { tipo:"item",    label:"Gastos generales",         valor:F.costoGastos,     mod:"gastos" },
    { tipo:"item",    label:"Personal y honorarios",    valor:F.costoPersonal,   mod:"personal" },
    { tipo:"subtotal",label:"TOTAL COSTOS OPERATIVOS",  valor:F.costoTotal - F.costoFinanciero, color:T.rust },
    { tipo:"spacer" },
    { tipo:"header",  label:"COSTOS FINANCIEROS" },
    { tipo:"item",    label:"Interés hab. ministraciones",    valor:F.intHab,          mod:"credito" },
    { tipo:"item",    label:"Interés hab. gastos a crédito",  valor:F.intCargosCred,   mod:"credito" },
    { tipo:"item",    label:"Interés moratorio hab.",         valor:F.intMoraHab,      mod:"credito" },
    { tipo:"item",    label:"Interés refaccionario",          valor:F.intRef,          mod:"creditosref" },
    { tipo:"item",    label:"Comisiones (Fact + FEGA + AT)",  valor:F.costoComisiones, mod:"credito" },
    { tipo:"subtotal",label:"TOTAL COSTOS FINANCIEROS",       valor:F.costoFinanciero, color:"#9b6d3a" },
    { tipo:"spacer" },
    { tipo:"total",   label:"UTILIDAD / PÉRDIDA ESTIMADA DEL CICLO", valor:F.utilidadBruta },
  ];

  return (
    <div>
      {/* Header */}
      <div className="card" style={{marginBottom:20,borderLeft:`4px solid ${F.utilidadBruta>=0?T.field:T.rust}`}}>
        <div className="card-body">
          <div className="flex justify-between items-center">
            <div>
              <div style={{fontFamily:"Georgia, serif",fontSize:20,fontWeight:700}}>Estado de Resultados</div>
              <div style={{fontSize:12,color:T.fog,marginTop:2}}>Agrícola Charay · Ciclo {ciclo} · Estimado al {new Date().toLocaleDateString("es-MX",{day:"numeric",month:"long",year:"numeric"})}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11,color:T.fog}}>Utilidad estimada</div>
              <div style={{fontFamily:"Georgia, serif",fontSize:26,fontWeight:700,color:F.utilidadBruta>=0?T.field:T.rust}}>{mxn(F.utilidadBruta)}</div>
              <div style={{fontSize:11,color:T.fog}}>Margen {fmt(Math.abs(F.margen),1)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs rápidos */}
      <div className="stat-grid" style={{gridTemplateColumns:"repeat(4,1fr)",marginBottom:20}}>
        <div className="stat-card green"><div className="stat-icon">📈</div><div className="stat-label">Ingresos Est.</div><div className="stat-value" style={{fontSize:18}}>{mxn(F.ingresoEst)}</div><div className="stat-sub">{fmt(F.produccionEst,0)} ton × {mxn(F.precio)}</div></div>
        <div className="stat-card rust"><div className="stat-icon">💸</div><div className="stat-label">Costos Totales</div><div className="stat-value" style={{fontSize:18}}>{mxn(F.costoTotal)}</div><div className="stat-sub">{mxn(F.costoTotal/Math.max(F.ha,1))}/ha</div></div>
        <div className="stat-card gold"><div className="stat-icon">💰</div><div className="stat-label">Costo/Tonelada</div><div className="stat-value" style={{fontSize:18}}>{mxn(F.costoTotal/Math.max(F.produccionEst,1))}</div><div className="stat-sub">PE: {fmt(F.peTon,1)} ton</div></div>
        <div className="stat-card sky"><div className="stat-icon">📊</div><div className="stat-label">Margen Neto</div><div className="stat-value" style={{fontSize:18,color:F.margen>=0?T.field:T.rust}}>{fmt(F.margen,1)}%</div><div className="stat-sub">{F.utilidadBruta>=0?"Operación rentable":"Por debajo del PE"}</div></div>
      </div>

      {/* Tabla principal */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th style={{width:"60%"}}>Concepto</th><th style={{textAlign:"right"}}>Monto</th><th style={{textAlign:"right"}}>% Ingreso</th></tr></thead>
            <tbody>
              {rows.map((r,i)=>{
                if(r.tipo==="spacer") return <tr key={i}><td colSpan={3} style={{padding:4}}></td></tr>;
                if(r.tipo==="header") return (
                  <tr key={i} style={{background:T.mist}}>
                    <td colSpan={3} style={{padding:"8px 16px",fontSize:11,fontWeight:700,letterSpacing:"0.1em",color:T.fog,textTransform:"uppercase"}}>{r.label}</td>
                  </tr>
                );
                if(r.tipo==="subtotal") return (
                  <tr key={i} style={{background:T.mist,borderTop:`2px solid ${T.line}`}}>
                    <td style={{padding:"10px 16px",fontWeight:700,fontSize:13}}>{r.label}</td>
                    <td style={{padding:"10px 16px",textAlign:"right",fontWeight:700,fontFamily:"'DM Mono',monospace",fontSize:14,color:r.color||T.inkLt}}>{mxn(r.valor)}</td>
                    <td style={{padding:"10px 16px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:12,color:T.fog}}>{F.ingresoEst>0?fmt(Math.abs(r.valor/F.ingresoEst*100),1):0}%</td>
                  </tr>
                );
                if(r.tipo==="total") return (
                  <tr key={i} style={{background:F.utilidadBruta>=0?"#eafaf1":"#fdf0ef",borderTop:`3px solid ${F.utilidadBruta>=0?T.field:T.rust}`}}>
                    <td style={{padding:"14px 16px",fontWeight:800,fontSize:14}}>{r.label}</td>
                    <td style={{padding:"14px 16px",textAlign:"right",fontWeight:800,fontFamily:"'DM Mono',monospace",fontSize:18,color:F.utilidadBruta>=0?T.field:T.rust}}>{mxn(r.valor)}</td>
                    <td style={{padding:"14px 16px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontWeight:700,color:F.utilidadBruta>=0?T.field:T.rust}}>{fmt(Math.abs(F.margen),1)}%</td>
                  </tr>
                );
                return (
                  <tr key={i} {...(r.mod && r.valor>0 ? navRowProps(()=>nav(r.mod, null, r.filtro)) : {})}
                    style={{...(r.mod && r.valor>0 ? {cursor:"pointer"} : {})}}>
                    <td style={{padding:"9px 16px 9px 28px",fontSize:13,color:T.fog}}>
                      {r.label}
                      {r.mod && r.valor>0 && <span style={{marginLeft:6,fontSize:10,color:T.field,opacity:0.7}}>→</span>}
                    </td>
                    <td style={{padding:"9px 16px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:13}}>{r.valor>0?mxn(r.valor):"—"}</td>
                    <td style={{padding:"9px 16px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:12,color:T.fog}}>{r.valor>0&&F.ingresoEst>0?fmt(r.valor/F.ingresoEst*100,1)+"%":"—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{padding:"12px 20px",fontSize:11,color:T.fog,borderTop:`1px solid ${T.line}`,background:T.mist}}>
          ⚠️ Estado estimado con base en datos capturados. Los ingresos son proyectados al rendimiento y precio de venta esperados. No sustituye estados financieros auditados.
        </div>
      </div>
    </div>
  );
}
