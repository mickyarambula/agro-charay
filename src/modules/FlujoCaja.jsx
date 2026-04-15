// ─── modules/FlujoCaja.jsx ───────────────────────────────────────────

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


export default function FlujoCajaModule({ userRol, onNavigate }) {
  const { state } = useData();
  const F = calcularFinancieros(state);
  const nav = (page, pid, filtros) => onNavigate && onNavigate(page, pid, filtros);

  // Entradas de efectivo real
  const entradas = [
    { concepto:"Crédito parafinanciero aplicado", monto:F.capitalAplicadoPara||0, tipo:"Crédito", mod:"credito" },
    { concepto:"Crédito directo aplicado", monto:F.capitalAplicadoDir||0, tipo:"Crédito", mod:"credito" },
    { concepto:"Aportaciones de capital propio", monto:F.totalAport||0, tipo:"Capital", mod:"capital" },
  ].filter(e=>e.monto>0);

  // Salidas de efectivo real
  const salidas = [
    { concepto:"Semilla", monto:F.costoSemilla||0, tipo:"Operación", mod:"insumos", filtro:{categoria:"Semilla",vista:"tabla"} },
    { concepto:"Insumos (sin semilla)", monto:F.costoInsumos||0, tipo:"Operación", mod:"insumos" },
    { concepto:"Diesel y combustible", monto:F.costoDiesel||0, tipo:"Operación", mod:"diesel" },
    { concepto:"Renta de tierras", monto:F.costoRenta||0, tipo:"Operación", mod:"rentas" },
    { concepto:"Agua y riego", monto:F.costoAgua||0, tipo:"Operación", mod:"gastos" },
    { concepto:"Mano de obra", monto:F.costoManoObra||0, tipo:"Operación", mod:"gastos" },
    { concepto:"Seguros", monto:F.costoSeguros||0, tipo:"Operación", mod:"gastos" },
    { concepto:"Trámites y otros", monto:(F.costoTramites||0)+(F.costoOtros||0), tipo:"Operación", mod:"gastos" },
    { concepto:"Personal y honorarios", monto:F.costoPersonal||0, tipo:"Operación", mod:"personal" },
    { concepto:"Nómina operadores", monto:F.costoNomina||0, tipo:"Operación", mod:"operadores" },
    { concepto:"Cosecha y maquila", monto:F.costoCosecha||0, tipo:"Operación", mod:"cosecha" },
    { concepto:"Abonos a crédito habilitación", monto:(state.credito?.pagos||[]).reduce((s,p)=>s+(p.monto||0),0), tipo:"Financiero", mod:"credito" },
    { concepto:"Retiros de capital", monto:F.totalRetiro, tipo:"Capital", mod:"capital" },
  ].filter(s=>s.monto>0);

  const totalEntradas = entradas.reduce((s,e)=>s+e.monto,0);
  const totalSalidas  = salidas.reduce((s,s2)=>s+s2.monto,0);
  const saldoFinal    = totalEntradas - totalSalidas;

  const tipoColor = t => ({Operación:T.field,Crédito:"#5b9fd6",Capital:T.straw,Financiero:T.rust,Proyectado:"#8a7560"})[t]||T.fog;

  return (
    <div>
      <div className="card" style={{marginBottom:20,borderLeft:`4px solid ${saldoFinal>=0?T.field:T.rust}`}}>
        <div className="card-body">
          <div className="flex justify-between items-center">
            <div>
              <div style={{fontFamily:"Georgia, serif",fontSize:20,fontWeight:700}}>Flujo de Efectivo del Ciclo</div>
              <div style={{fontSize:12,color:T.fog,marginTop:2}}>Agrícola Charay · {state.cicloActual} · Real acumulado + Proyectado</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11,color:T.fog}}>Saldo neto estimado</div>
              <div style={{fontFamily:"Georgia, serif",fontSize:26,fontWeight:700,color:saldoFinal>=0?T.field:T.rust}}>{mxn(saldoFinal)}</div>
              <div style={{fontSize:11,color:'#b0a090',marginTop:8,textAlign:'right',maxWidth:360,lineHeight:1.4}}>
                El saldo incluye ingreso de cosecha proyectado (aún no realizado). Saldo real actual = Entradas reales − Salidas reales.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="stat-grid" style={{gridTemplateColumns:"repeat(3,1fr)",marginBottom:20}}>
        <div className="stat-card green"><div className="stat-icon">📥</div><div className="stat-label">Total Entradas</div><div className="stat-value" style={{fontSize:18}}>{mxn(totalEntradas)}</div><div className="stat-sub">{entradas.length} fuentes</div></div>
        <div className="stat-card rust"><div className="stat-icon">📤</div><div className="stat-label">Total Salidas</div><div className="stat-value" style={{fontSize:18}}>{mxn(totalSalidas)}</div><div className="stat-sub">{salidas.length} conceptos</div></div>
        <div className="stat-card" style={{borderTop:`2px solid ${saldoFinal>=0?T.field:T.rust}`}}><div className="stat-icon">{saldoFinal>=0?"💧":"🔴"}</div><div className="stat-label">Saldo Neto</div><div className="stat-value" style={{fontSize:18,color:saldoFinal>=0?T.field:T.rust}}>{mxn(saldoFinal)}</div><div className="stat-sub">{saldoFinal>=0?"Posición positiva":"Déficit de caja"}</div></div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div style={{padding:"12px 16px",borderBottom:`2px solid ${T.field}`,fontWeight:700,fontSize:13,color:T.field}}>📥 ENTRADAS DE EFECTIVO</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Concepto</th><th>Tipo</th><th style={{textAlign:"right"}}>Monto</th><th style={{textAlign:"right"}}>%</th></tr></thead>
              <tbody>
                {entradas.map((e,i)=>(
                  <tr key={i} style={{cursor:"pointer",transition:"filter 0.12s"}}
                    onClick={()=>nav(e.mod)}
                    onMouseEnter={ev=>ev.currentTarget.style.filter="brightness(0.91)"}
                    onMouseLeave={ev=>ev.currentTarget.style.filter=""}>
                    <td style={{fontSize:13}}>{e.concepto} <span style={{fontSize:10,color:T.field,opacity:0.7}}>→</span></td>
                    <td><span className="badge" style={{background:`${tipoColor(e.tipo)}22`,color:tipoColor(e.tipo),fontSize:10,padding:"2px 7px",borderRadius:10}}>{e.tipo}</span></td>
                    <td className="font-mono fw-600" style={{textAlign:"right",color:T.field}}>{mxn(e.monto)}</td>
                    <td className="font-mono" style={{textAlign:"right",color:T.fog,fontSize:11}}>{totalEntradas>0?fmt(e.monto/totalEntradas*100,1):0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{padding:"11px 16px",borderTop:`2px solid ${T.line}`,display:"flex",justifyContent:"space-between",fontWeight:700,background:T.mist}}>
            <span>TOTAL ENTRADAS</span>
            <span className="font-mono" style={{color:T.field,fontSize:15}}>{mxn(totalEntradas)}</span>
          </div>
        </div>

        <div className="card">
          <div style={{padding:"12px 16px",borderBottom:`2px solid ${T.rust}`,fontWeight:700,fontSize:13,color:T.rust}}>📤 SALIDAS DE EFECTIVO</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Concepto</th><th>Tipo</th><th style={{textAlign:"right"}}>Monto</th><th style={{textAlign:"right"}}>%</th></tr></thead>
              <tbody>
                {salidas.map((s,i)=>(
                  <tr key={i} style={{cursor:"pointer",transition:"filter 0.12s"}}
                    onClick={()=>nav(s.mod)}
                    onMouseEnter={ev=>ev.currentTarget.style.filter="brightness(0.91)"}
                    onMouseLeave={ev=>ev.currentTarget.style.filter=""}>
                    <td style={{fontSize:13}}>{s.concepto} <span style={{fontSize:10,color:T.rust,opacity:0.7}}>→</span></td>
                    <td><span className="badge" style={{background:`${tipoColor(s.tipo)}22`,color:tipoColor(s.tipo),fontSize:10,padding:"2px 7px",borderRadius:10}}>{s.tipo}</span></td>
                    <td className="font-mono fw-600" style={{textAlign:"right",color:T.rust}}>{mxn(s.monto)}</td>
                    <td className="font-mono" style={{textAlign:"right",color:T.fog,fontSize:11}}>{totalSalidas>0?fmt(s.monto/totalSalidas*100,1):0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{padding:"11px 16px",borderTop:`2px solid ${T.line}`,display:"flex",justifyContent:"space-between",fontWeight:700,background:T.mist}}>
            <span>TOTAL SALIDAS</span>
            <span className="font-mono" style={{color:T.rust,fontSize:15}}>{mxn(totalSalidas)}</span>
          </div>
        </div>
      </div>

      <div className="card" style={{marginTop:20,borderLeft:`4px solid ${saldoFinal>=0?T.field:T.rust}`}}>
        <div className="card-body">
          <div className="flex justify-between items-center">
            <div>
              <div style={{fontWeight:700,fontSize:15}}>SALDO NETO DE CAJA DEL CICLO</div>
              <div style={{fontSize:12,color:T.fog,marginTop:3}}>Entradas − Salidas. Incluye ingreso de cosecha estimado.</div>
            </div>
            <div style={{fontFamily:"Georgia, serif",fontSize:30,fontWeight:800,color:saldoFinal>=0?T.field:T.rust}}>{mxn(saldoFinal)}</div>
          </div>
        </div>
      </div>
      <div style={{marginTop:10,fontSize:11,color:T.fog,textAlign:"center"}}>⚠️ Flujo estimado. Solo movimientos reales ya ocurridos. Los pendientes se muestran abajo.</div>

      {/* ── Pendiente de liquidar — no ocurrido aún ── */}
      <div style={{marginTop:20, background:'#f8f6f2', border:'1px solid #ede5d8', borderRadius:10, padding:'16px'}}>
        <div style={{fontSize:12, fontWeight:500, color:'#1a2e1a', marginBottom:12}}>
          Pendiente de liquidar — no ocurrido aún
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10}}>
          <div style={{background:'#fff', border:'1px solid #ede5d8', borderRadius:8, padding:'10px 14px'}}>
            <div style={{fontSize:9, color:'#b0a090', textTransform:'uppercase', letterSpacing:1, marginBottom:4}}>Intereses acumulados</div>
            <div style={{fontSize:18, fontFamily:'Georgia, serif', color:'#c84b4b'}}>{mxn(F.costoInteres||0)}</div>
            <div style={{fontSize:9, color:'#b0a090', marginTop:2}}>se pagan al liquidar</div>
          </div>
          <div style={{background:'#fff', border:'1px solid #ede5d8', borderRadius:8, padding:'10px 14px'}}>
            <div style={{fontSize:9, color:'#b0a090', textTransform:'uppercase', letterSpacing:1, marginBottom:4}}>Comisiones</div>
            <div style={{fontSize:18, fontFamily:'Georgia, serif', color:'#c84b4b'}}>{mxn(F.costoComisiones||0)}</div>
            <div style={{fontSize:9, color:'#b0a090', marginTop:2}}>se pagan al liquidar</div>
          </div>
          <div style={{background:'#fff', border:'1px solid #ede5d8', borderRadius:8, padding:'10px 14px'}}>
            <div style={{fontSize:9, color:'#b0a090', textTransform:'uppercase', letterSpacing:1, marginBottom:4}}>Ingreso esperado cosecha</div>
            <div style={{fontSize:18, fontFamily:'Georgia, serif', color:'#2d7a2d'}}>{mxn(isNaN(F.ingresoEst)?0:(F.ingresoEst||0))}</div>
            <div style={{fontSize:9, color:'#b0a090', marginTop:2}}>cuando se venda el grano</div>
          </div>
        </div>
      </div>
    </div>
  );
}
