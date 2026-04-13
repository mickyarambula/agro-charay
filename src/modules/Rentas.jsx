// ─── modules/Rentas.jsx ───────────────────────────────────────────

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


export default function RentasModule({ userRol }) {
  const { state } = useData();
  const mxnFmt = n => (parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2});
  const productores  = state.productores || [];
  const egresos      = (state.egresosManual||[]).filter(e=>(e.cicloId||1)===(state.cicloActivoId||1)).filter(e=>!e.cancelado&&e.categoria==="renta_tierra");
  const cicloPred    = (state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.predeterminado)||(state.ciclos||[])[0];
  const asigsCiclo   = cicloPred?.asignaciones||[];

  const totalRentas  = (egresos||[]).reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
  const haTotales    = (asigsCiclo||[]).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
  const rentaXha     = haTotales>0?totalRentas/haTotales:0;

  const porProductor = productores.map(p=>{
    const regs = egresos.filter(e=>String(e.productorId)===String(p.id));
    const total = regs.reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
    const ha    = asigsCiclo.filter(a=>String(a.productorId)===String(p.id)).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
    return {...p, regs:regs.length, total, ha, xha:ha>0?total/ha:0};
  }).filter(p=>p.total>0||p.ha>0);

  return (
    <div>
      <div style={{padding:"10px 14px",background:"#fff9e6",borderRadius:8,border:"1px solid #f0c060",marginBottom:16,fontSize:12,color:"#856404"}}>
        ℹ️ Este módulo muestra los pagos de renta registrados en <strong>Egresos del Ciclo</strong>. Para el detalle de contratos y predios rentados por lote, captura esa información cuando esté disponible.
      </div>
      <div className="stat-grid" style={{gridTemplateColumns:"repeat(3,1fr)",marginBottom:20}}>
        <div className="stat-card rust"><div className="stat-icon">🏡</div><div className="stat-label">Total Rentas Pagadas</div><div className="stat-value" style={{fontSize:18}}>{mxnFmt(totalRentas)}</div><div className="stat-sub">{egresos.length} pagos registrados</div></div>
        <div className="stat-card gold"><div className="stat-icon">🌾</div><div className="stat-label">Renta promedio/ha</div><div className="stat-value" style={{fontSize:18}}>{mxnFmt(rentaXha)}</div><div className="stat-sub">{haTotales.toFixed(2)} ha ciclo activo</div></div>
        <div className="stat-card sky"><div className="stat-icon">👥</div><div className="stat-label">Productores con renta</div><div className="stat-value">{porProductor.filter(p=>p.total>0).length}</div></div>
      </div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Rentas por Productor — {state.cicloActual}</div>
          <BtnExport onClick={()=>exportarExcel("Rentas_"+state.cicloActual,[{
            nombre:"Rentas",
            headers:["Productor","Ha","Registros","Total Rentas","$/ha"],
            rows:porProductor.map(p=>[p.alias||p.apPat,p.ha.toFixed(2),p.regs,p.total,p.xha.toFixed(2)])
          }])}/>
        </div>
        <div className="table-wrap-scroll">
          <table style={{minWidth:600}}>
            <thead><tr><th>Productor</th><th style={{textAlign:"right"}}>Ha</th><th style={{textAlign:"right"}}>Pagos</th><th style={{textAlign:"right"}}>Total Rentas</th><th style={{textAlign:"right"}}>$/ha</th></tr></thead>
            <tbody>
              {porProductor.map((p,i)=>{
                const bg=i%2===0?"white":"#faf8f3";
                return(<tr key={p.id}>
                  <td style={{background:bg}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:p.color}}/>
                      <span style={{fontWeight:600,fontSize:13}}>{p.alias||p.apPat}</span>
                    </div>
                  </td>
                  <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{p.ha>0?p.ha.toFixed(2):"—"}</td>
                  <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{p.regs}</td>
                  <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#c0392b"}}>{mxnFmt(p.total)}</td>
                  <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{p.ha>0?mxnFmt(p.xha):"—"}</td>
                </tr>);
              })}
            </tbody>
            <tfoot><tr style={{background:"#f0f4e8",fontWeight:700}}>
              <td>TOTAL</td><td style={{textAlign:"right",fontFamily:"monospace"}}>{haTotales.toFixed(2)}</td>
              <td style={{textAlign:"right",fontFamily:"monospace"}}>{egresos.length}</td>
              <td style={{textAlign:"right",fontFamily:"monospace",color:"#c0392b"}}>{mxnFmt(totalRentas)}</td>
              <td style={{textAlign:"right",fontFamily:"monospace"}}>{mxnFmt(rentaXha)}</td>
            </tr></tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
