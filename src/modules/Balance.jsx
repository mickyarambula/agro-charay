// ─── modules/Balance.jsx ───────────────────────────────────────────

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
import { mxn } from "../shared/utils.js";


export default function BalanceModule({ userRol, onNavigate }) {
  const { state } = useData();
  const F = calcularFinancieros(state);
  const nav = (page, pid, filtros) => onNavigate && onNavigate(page, pid, filtros);

  // ACTIVOS
  const activoCirculante = [
    { concepto:"Insumos aplicados al ciclo", valor:F.costoInsumos||0 },
    { concepto:"Cosecha estimada (por cobrar)", valor:isNaN(F.ingresoEst)?0:(F.ingresoEst||0) },
  ];
  const activoFijo = state.activos.filter(a=>a.tipo!=="Tierra Rentada").map(a=>({ concepto:a.nombre, valor:a.valorAdq||0 }));
  const activoTierras = state.activos.filter(a=>a.tipo==="Tierra Propia").map(a=>({ concepto:a.nombre+" (tierra propia)", valor:a.valorAdq||0 }));

  const totalActCirc = activoCirculante.reduce((s,a)=>s+a.valor,0);
  const totalActFijo = [...activoFijo,...activoTierras].reduce((s,a)=>s+a.valor,0);
  const totalActivos = totalActCirc + totalActFijo;

  // PASIVOS
  const pasivoCorto = [
    { concepto:"Saldo crédito habilitación", valor:F.saldoHab },
    { concepto:"Interés hab. acumulado", valor:F.intHab+F.intCargosCred+F.intMoraHab },
  ];
  const pasivoLargo = (state.creditosRef||[]).map(c=>{
    const { saldoCapital, interesTotal } = calcularInteresCredito(c);
    return { concepto:`Refaccionario ${c.institucion}`, valor:saldoCapital+interesTotal };
  });

  const totalPasCorto = pasivoCorto.reduce((s,p)=>s+p.valor,0);
  const totalPasLargo = pasivoLargo.reduce((s,p)=>s+p.valor,0);
  const totalPasivos  = totalPasCorto + totalPasLargo;

  // CAPITAL
  const patrimonioNeto = isNaN(totalActivos - totalPasivos) ? 0 : (totalActivos - totalPasivos);
  const capitalRows = [
    { concepto:"Aportaciones de capital", valor:F.totalAport },
    { concepto:"Retiros", valor:-F.totalRetiro },
    { concepto:"Resultado estimado del ciclo", valor:isNaN(F.utilidadBruta) ? 0 : (F.utilidadBruta||0) },
  ];

  const Seccion = ({titulo,rows,total,colorT}) => (
    <div style={{marginBottom:16}}>
      <div style={{padding:"8px 16px",background:T.mist,fontWeight:700,fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",color:T.fog,borderRadius:"6px 6px 0 0"}}>{titulo}</div>
      {rows.map((r,i)=>(
        <div key={i} className="flex justify-between" style={{padding:"9px 16px 9px 28px",borderBottom:`1px solid ${T.line}`,fontSize:13}}>
          <span style={{color:T.fog}}>{r.concepto}</span>
          <span className="font-mono fw-600" style={{color:r.valor<0?T.rust:T.inkLt}}>{mxn(Math.abs(r.valor))}{r.valor<0?" (−)":""}</span>
        </div>
      ))}
      <div className="flex justify-between" style={{padding:"10px 16px",background:T.mist,borderTop:`2px solid ${T.line}`,fontWeight:700,fontSize:13}}>
        <span>Total {titulo}</span>
        <span className="font-mono fw-600" style={{color:colorT||T.inkLt,fontSize:15}}>{mxn(total)}</span>
      </div>
    </div>
  );

  return (
    <div>
      <div className="card" style={{marginBottom:20,borderLeft:`4px solid ${patrimonioNeto>=0?T.field:T.rust}`}}>
        <div className="card-body">
          <div className="flex justify-between items-center">
            <div>
              <div style={{fontFamily:"Georgia, serif",fontSize:20,fontWeight:700}}>Balance General</div>
              <div style={{fontSize:12,color:T.fog,marginTop:2}}>Agrícola Charay · {new Date().toLocaleDateString("es-MX",{day:"numeric",month:"long",year:"numeric"})} · Estimado</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11,color:T.fog}}>Patrimonio neto estimado</div>
              <div style={{fontFamily:"Georgia, serif",fontSize:26,fontWeight:700,color:patrimonioNeto>=0?T.field:T.rust}}>{mxn(patrimonioNeto)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="stat-grid" style={{gridTemplateColumns:"repeat(3,1fr)",marginBottom:20}}>
        <div className="stat-card green"><div className="stat-icon">🏦</div><div className="stat-label">Total Activos</div><div className="stat-value" style={{fontSize:18}}>{mxn(totalActivos)}</div><div className="stat-sub">Circulante + Fijo</div></div>
        <div className="stat-card rust"><div className="stat-icon">💳</div><div className="stat-label">Total Pasivos</div><div className="stat-value" style={{fontSize:18}}>{mxn(totalPasivos)}</div><div className="stat-sub">Corto + largo plazo</div></div>
        <div className="stat-card sky"><div className="stat-icon">⚖️</div><div className="stat-label">Patrimonio Neto</div><div className="stat-value" style={{fontSize:18,color:patrimonioNeto>=0?T.field:T.rust}}>{mxn(patrimonioNeto)}</div><div className="stat-sub">Activos − Pasivos</div></div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div style={{padding:"14px 16px",borderBottom:`2px solid ${T.field}`,fontFamily:"Georgia, serif",fontSize:16,fontWeight:700,color:T.field}}>ACTIVOS</div>
          <div style={{padding:16}}>
            <Seccion titulo="Activo Circulante" rows={activoCirculante} total={totalActCirc} colorT={T.field}/>
            <Seccion titulo="Activo Fijo" rows={[...activoFijo,...activoTierras]} total={totalActFijo} colorT={T.field}/>
            <div className="flex justify-between" style={{padding:"12px 16px",background:T.field,color:"white",borderRadius:8,fontWeight:800,fontSize:14}}>
              <span>TOTAL ACTIVOS</span>
              <span className="font-mono">{mxn(totalActivos)}</span>
            </div>
          </div>
        </div>
        <div className="card">
          <div style={{padding:"14px 16px",borderBottom:`2px solid ${T.rust}`,fontFamily:"Georgia, serif",fontSize:16,fontWeight:700,color:T.rust}}>PASIVOS Y CAPITAL</div>
          <div style={{padding:16}}>
            <Seccion titulo="Pasivo Circulante (corto plazo)" rows={pasivoCorto} total={totalPasCorto} colorT={T.rust}/>
            {pasivoLargo.length>0&&<Seccion titulo="Pasivo Largo Plazo" rows={pasivoLargo} total={totalPasLargo} colorT={T.rust}/>}
            <Seccion titulo="Capital Contable" rows={capitalRows} total={patrimonioNeto} colorT={T.field}/>
            <div className="flex justify-between" style={{padding:"12px 16px",background:T.rust,color:"white",borderRadius:8,fontWeight:800,fontSize:14}}>
              <span>TOTAL PASIVOS + CAPITAL</span>
              <span className="font-mono">{mxn(totalPasivos + Math.max(patrimonioNeto,0))}</span>
            </div>
          </div>
        </div>
      </div>
      <div style={{marginTop:12,fontSize:11,color:T.fog,textAlign:"center"}}>⚠️ Balance estimado. Las cuentas por cobrar y el resultado del ciclo son proyecciones. No sustituye contabilidad formal.</div>
    </div>
  );
}
