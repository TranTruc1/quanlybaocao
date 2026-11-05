import React,{useState} from 'react';
import {money,pct,countFormat} from './domain.js';
import {productTone} from './palette.js';
const metrics=[['revenue','Doanh thu bán hàng','đ'],['care','Doanh thu chăm','đ'],['spend','Chi thực tế','đ'],['data','Tổng data','data'],['success','Đơn TC','đơn']];
export default function OverviewPie({products,detail}){
 const [metric,setMetric]=useState('revenue'),[selected,setSelected]=useState(null);
 const [,label,unit]=metrics.find(m=>m[0]===metric);
 const rows=products.map(p=>({...p,value:detail.filter(r=>r.productId===p.id).reduce((s,r)=>s+Number(r[metric]||0),0),tone:productTone(p.id)}));
 const total=rows.reduce((s,r)=>s+r.value,0),active=rows.find(r=>r.id===selected);
 const fmt=value=>metric==='success'?countFormat(value):money(value);
 let offset=0;
 return <article className="panel overview-pie"><div className="panel-heading"><div><h2>Tỷ trọng theo sản phẩm</h2><p>Theo bộ lọc đang chọn</p></div><label className="pie-select"><span className="sr-only">Chỉ tiêu biểu đồ tròn</span><select value={metric} onChange={e=>{setMetric(e.target.value);setSelected(null);}}>{metrics.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label></div>
 <div className="pie-visual"><svg viewBox="0 0 240 240" role="img" aria-label={`${label}: ${fmt(total)} ${unit}. ${rows.map(r=>`${r.name}: ${fmt(r.value)}`).join('; ')}`}><circle cx="120" cy="120" r="87" fill="none" stroke="#edf0ed" strokeWidth="32"/>{total>0&&rows.filter(r=>r.value>0).map(r=>{const share=r.value/total,length=share*100,begin=offset;offset+=length;return <circle key={r.id} cx="120" cy="120" r="87" pathLength="100" fill="none" stroke={r.tone.color} strokeWidth={selected===r.id?38:32} strokeDasharray={`${length} ${100-length}`} strokeDashoffset={-begin} transform="rotate(-90 120 120)" opacity={selected&&selected!==r.id?0.4:1} onMouseEnter={()=>setSelected(r.id)} onMouseLeave={()=>setSelected(null)}><title>{r.name}: {fmt(r.value)} {unit} ({pct(share)})</title></circle>})}</svg><div className="pie-center"><small>{active?.name||'Tổng cộng'}</small><b>{fmt(active?.value??total)}</b><span>{unit}{active&&total>0?' · '+pct(active.value/total):''}</span></div></div>
 {!total&&<p className="pie-empty">Chưa có số liệu cho chỉ tiêu này trong kỳ đã chọn.</p>}
 <div className="pie-legend">{rows.map(r=><button type="button" key={r.id} className={selected===r.id?'active':''} style={{'--row-tint':r.tone.background}} onClick={()=>setSelected(selected===r.id?null:r.id)} aria-pressed={selected===r.id}><i style={{background:r.tone.color}}/><span>{r.name}<small>{fmt(r.value)} {unit}</small></span><b>{pct(total?r.value/total:0)}</b></button>)}</div>
 </article>;
}
