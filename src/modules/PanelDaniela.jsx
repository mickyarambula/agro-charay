// ─── modules/PanelDaniela.jsx ──────────────────────────────────────
// Vista ejecutiva financiera para daniela y admin.
// 3 tabs: Resumen del ciclo, Estado por productor, Movimientos recientes.

import React, { useState } from 'react';
import { useData } from '../core/DataContext.jsx';
import { T, mxnFmt } from '../shared/utils.js';
import {
  calcularFinancieros, calcularCreditoProd, exportarResumenCiclo,
} from '../shared/helpers.jsx';

export default function PanelDaniela({ userRol }) {
  const { state } = useData();
  const [tab, setTab] = useState('resumen');
  const F = calcularFinancieros(state);
  const productores = state.productores || [];
  const liquidaciones = state.liquidaciones || [];
  const hoy = new Date().toISOString().split('T')[0];
  const mxn = n => (parseFloat(n)||0).toLocaleString('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2,maximumFractionDigits:2});
  const fmt = (n,d=2) => (parseFloat(n)||0).toLocaleString('es-MX',{minimumFractionDigits:d,maximumFractionDigits:d});

  const totalLiquidar = (F.capitalAplicadoTotal||0)+(F.costoInteres||0)+(F.costoComisiones||0);
  const flujoNeto = (isNaN(F.ingresoEst)?0:(F.ingresoEst||0)) - totalLiquidar;

  const tabs = [
    { id: 'resumen', label: 'Resumen del ciclo' },
    { id: 'productores', label: 'Estado por productor' },
    { id: 'movimientos', label: 'Movimientos recientes' },
  ];

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div>
          <div style={{fontFamily:'Georgia, serif',fontSize:22,fontWeight:700,color:'#1a2e1a'}}>📊 Panel Contable</div>
          <div style={{fontSize:12,color:'#b0a090',marginTop:2}}>Agrícola Charay · {state.cicloActual||'OI 2025-2026'}</div>
        </div>
        <button className="btn btn-secondary" onClick={()=>exportarResumenCiclo(state)} style={{fontSize:12}}>
          📥 Exportar Excel
        </button>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:0,borderBottom:'2px solid #ede5d8',marginBottom:20}}>
        {tabs.map(t => (
          <button key={t.id}
            onClick={()=>setTab(t.id)}
            style={{
              padding:'10px 18px',
              border:'none',
              borderBottom: tab===t.id ? '2px solid #1a3a0f' : '2px solid transparent',
              marginBottom:'-2px',
              background:'transparent',
              color: tab===t.id ? '#1a2e1a' : '#b0a090',
              fontSize:13,
              fontWeight: tab===t.id ? 600 : 400,
              cursor:'pointer',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: RESUMEN */}
      {tab === 'resumen' && (
        <div>
          <div className="stat-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:20}}>
            <div className="stat-card green">
              <div className="stat-label">Capital total aplicado</div>
              <div className="stat-value" style={{fontSize:18}}>{mxn(F.capitalAplicadoTotal)}</div>
              <div className="stat-sub">Para: {mxn(F.capitalAplicadoPara)} · Dir: {mxn(F.capitalAplicadoDir)}</div>
            </div>
            <div className="stat-card rust">
              <div className="stat-label">Intereses acumulados</div>
              <div className="stat-value" style={{fontSize:18}}>{mxn(F.costoInteres)}</div>
              <div className="stat-sub">al día de hoy</div>
            </div>
            <div className="stat-card gold">
              <div className="stat-label">Comisiones totales</div>
              <div className="stat-value" style={{fontSize:18}}>{mxn(F.costoComisiones)}</div>
              <div className="stat-sub">Fact + FEGA + AT</div>
            </div>
            <div className="stat-card" style={{borderTop:'2px solid #991b1b'}}>
              <div className="stat-label">Total a liquidar</div>
              <div className="stat-value" style={{fontSize:18,color:'#991b1b'}}>{mxn(totalLiquidar)}</div>
              <div className="stat-sub">capital + intereses + comisiones</div>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:20}}>
            <div style={{background:'#fff',border:'1px solid #ede5d8',borderRadius:10,padding:16}}>
              <div style={{fontSize:10,color:'#b0a090',textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Ingreso estimado cosecha</div>
              <div style={{fontSize:22,fontFamily:'Georgia, serif',color:'#2d7a2d'}}>{mxn(F.ingresoEst)}</div>
              <div style={{fontSize:10,color:'#b0a090',marginTop:2}}>{fmt(F.ha)} ha × {mxn(F.precio)}/ton × {fmt(F.produccionEst/Math.max(F.ha,1),1)} ton/ha</div>
            </div>
            <div style={{background: flujoNeto>=0?'#f0fdf4':'#fef2f2',border:`1px solid ${flujoNeto>=0?'#bbf7d0':'#fecaca'}`,borderRadius:10,padding:16}}>
              <div style={{fontSize:10,color:flujoNeto>=0?'#166534':'#991b1b',textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Flujo neto estimado</div>
              <div style={{fontSize:22,fontFamily:'Georgia, serif',color:flujoNeto>=0?'#166534':'#991b1b'}}>{flujoNeto>=0?'+':''}{mxn(flujoNeto)}</div>
              <div style={{fontSize:10,color:flujoNeto>=0?'#166534':'#991b1b',marginTop:2}}>{flujoNeto>=0?'Utilidad tras liquidar':'Déficit tras liquidar'}</div>
            </div>
            <div style={{background:'#fff',border:'1px solid #ede5d8',borderRadius:10,padding:16}}>
              <div style={{fontSize:10,color:'#b0a090',textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Costo por hectárea</div>
              <div style={{fontSize:22,fontFamily:'Georgia, serif',color:'#1a2e1a'}}>{mxn(F.ha>0?F.costoTotal/F.ha:0)}</div>
              <div style={{fontSize:10,color:'#b0a090',marginTop:2}}>{fmt(F.ha)} ha totales · {state.cicloActual}</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ESTADO POR PRODUCTOR */}
      {tab === 'productores' && (
        <div className="card">
          <div className="table-wrap-scroll">
            <table style={{minWidth:900}}>
              <thead><tr>
                <th>Productor</th>
                <th style={{textAlign:'right'}}>Ha</th>
                <th style={{textAlign:'right'}}>Capital para</th>
                <th style={{textAlign:'right'}}>Capital dir</th>
                <th style={{textAlign:'right'}}>Intereses</th>
                <th style={{textAlign:'right'}}>Comisiones</th>
                <th style={{textAlign:'right'}}>Total a liquidar</th>
                <th style={{textAlign:'center'}}>Estatus</th>
              </tr></thead>
              <tbody>
                {productores.map((p,i) => {
                  const cp = calcularCreditoProd(p.id, state);
                  const capP = cp.credAut>0 ? Math.min(cp.tGas,cp.credAut) : 0;
                  const capD = Math.max(0, cp.tGas - (cp.credAut||0));
                  const total = capP + capD + cp.iP + cp.iD + cp.cP + cp.cD;
                  if (total <= 0 && cp.ha <= 0) return null;
                  const liq = liquidaciones.find(l=>String(l.productorId)===String(p.id));
                  const bg = i%2===0?'white':'#faf8f3';
                  const estColor = {liquidado:'#2d7a2d',parcial:'#c8a84b',pendiente:'#b0a090'};
                  const estLabel = {liquidado:'✅',parcial:'⏳',pendiente:'⏸'};
                  const est = liq?.estatus||'pendiente';
                  return (
                    <tr key={p.id}>
                      <td style={{background:bg,fontWeight:600,fontSize:13}}>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <div style={{width:8,height:8,borderRadius:'50%',background:p.color}}/>
                          {p.alias||p.apPat}
                        </div>
                      </td>
                      <td style={{background:bg,textAlign:'right',fontFamily:'monospace',fontSize:12}}>{fmt(cp.ha)}</td>
                      <td style={{background:bg,textAlign:'right',fontFamily:'monospace',fontSize:12,color:'#c84b4b'}}>{mxn(capP)}</td>
                      <td style={{background:bg,textAlign:'right',fontFamily:'monospace',fontSize:12,color:'#c84b4b'}}>{mxn(capD)}</td>
                      <td style={{background:bg,textAlign:'right',fontFamily:'monospace',fontSize:12,color:'#c84b4b'}}>{mxn(cp.iP+cp.iD)}</td>
                      <td style={{background:bg,textAlign:'right',fontFamily:'monospace',fontSize:12,color:'#c84b4b'}}>{mxn(cp.cP+cp.cD)}</td>
                      <td style={{background:bg,textAlign:'right',fontFamily:'monospace',fontSize:12,fontWeight:700,color:'#991b1b'}}>{mxn(total)}</td>
                      <td style={{background:bg,textAlign:'center'}}>
                        <span style={{fontSize:11,color:estColor[est]}}>{estLabel[est]} {est}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MOVIMIENTOS RECIENTES */}
      {tab === 'movimientos' && (
        <div className="card">
          <div className="table-wrap-scroll">
            <table style={{minWidth:700}}>
              <thead><tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Concepto / Categoría</th>
                <th>Productor</th>
                <th style={{textAlign:'right'}}>Monto</th>
              </tr></thead>
              <tbody>
                {(() => {
                  const cid = state.cicloActivoId||1;
                  const nomProd = id => { const p = productores.find(x=>String(x.id)===String(id)); return p?(p.alias||p.apPat):'—'; };
                  const movs = [
                    ...(state.dispersiones||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===cid).map(d=>({
                      fecha:d.fecha, tipo:'Dispersión', concepto:d.lineaCredito||'parafinanciero',
                      productor:nomProd(d.productorId), monto:parseFloat(d.monto)||0, color:'#2980b9',
                    })),
                    ...(state.egresosManual||[]).filter(e=>!e.cancelado&&(e.cicloId||1)===cid).map(e=>({
                      fecha:e.fecha, tipo:'Egreso', concepto:e.categoria||e.concepto||'',
                      productor:nomProd(e.productorId), monto:parseFloat(e.monto)||0, color:'#c84b4b',
                    })),
                    ...(state.insumos||[]).filter(i=>!i.cancelado&&(i.cicloId||1)===cid).map(i=>({
                      fecha:i.fechaSolicitud||i.fechaOrden||'', tipo:'Insumo', concepto:i.categoria||i.insumo||'',
                      productor:nomProd(i.productorId), monto:parseFloat(i.importe)||0, color:'#2d7a2d',
                    })),
                  ].sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))).slice(0,50);
                  return movs.map((m,i) => (
                    <tr key={i}>
                      <td style={{background:i%2===0?'white':'#faf8f3',fontSize:12}}>{m.fecha||'—'}</td>
                      <td style={{background:i%2===0?'white':'#faf8f3'}}>
                        <span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:10,background:`${m.color}18`,color:m.color}}>{m.tipo}</span>
                      </td>
                      <td style={{background:i%2===0?'white':'#faf8f3',fontSize:12}}>{m.concepto}</td>
                      <td style={{background:i%2===0?'white':'#faf8f3',fontSize:12,fontWeight:500}}>{m.productor}</td>
                      <td style={{background:i%2===0?'white':'#faf8f3',textAlign:'right',fontFamily:'monospace',fontSize:12,fontWeight:700,color:m.color}}>{mxn(m.monto)}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
