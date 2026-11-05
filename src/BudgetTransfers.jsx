import React,{useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowRightLeft,Plus,Trash2,X} from 'lucide-react';
import {ActionButton} from './Operations.jsx';
import NumberField from './NumberField.jsx';
import {carryoverBefore,money} from './domain.js';
import {previewTransferBudget} from './budget-transfers.js';
export default function BudgetTransfers({db,accountId,date,entries,value=[],onChange,disabled=false,sourceProductId}){
 const [open,setOpen]=useState(false),[draft,setDraft]=useState([]);
 const products=db.products.filter(p=>p.active&&entries.some(e=>e.productId===p.id&&e.received!==undefined)&&db.assignments.some(a=>a.active&&a.accountId===accountId&&a.productId===p.id));
 const name=id=>db.products.find(p=>p.id===id)?.name||id;
 const opening=id=>carryoverBefore(db.reports,accountId,id,date).amount;
 const available=(id,index)=>Math.max(0,opening(id)-draft.reduce((n,t,i)=>n+(i!==index&&t.fromProductId===id?Number(t.amount||0):0),0));
 const otherTransfers=value.filter(t=>sourceProductId&&t.fromProductId!==sourceProductId);
 const row=(used=draft)=>({fromProductId:sourceProductId||products[0]?.id||'',toProductId:products.find(p=>p.id!==(sourceProductId||products[0]?.id)&&!used.some(t=>t.toProductId===p.id))?.id||'',amount:0});
 let error='';try{previewTransferBudget(db.reports,accountId,date,entries,[...otherTransfers,...draft]);}catch(e){error=e.message;}
 return <>{(!sourceProductId||opening(sourceProductId)>0)&&<ActionButton type="button" className="icon-btn carry-transfer-button" title={'Chuyển số dư từ '+name(sourceProductId)} aria-label={'Chuyển ngân sách từ '+name(sourceProductId)} disabled={disabled||products.length<2} onClick={()=>{const own=value.filter(t=>!sourceProductId||t.fromProductId===sourceProductId);setDraft(own.length?structuredClone(own):[row([])]);setOpen(true);}}><ArrowRightLeft size={17}/></ActionButton>}
 {open&&typeof document!=='undefined'&&createPortal(<div className="modal-backdrop"><section className="modal transfer-modal" role="dialog" aria-modal="true" aria-label="Chuyển ngân sách"><div className="modal-heading"><h2>Chuyển ngân sách ngày {date.split('-').reverse().join('/')}</h2><ActionButton type="button" className="icon-btn" aria-label="Đóng" onClick={()=>setOpen(false)}><X/></ActionButton></div><p>MKT tự chuyển, không cần duyệt. Tổng tiền chuyển từ mỗi sản phẩm không được vượt số dư từ ngày trước. Bấm Áp dụng, sau đó Lưu / Gửi báo cáo để ghi các khoản chuyển.</p>
 {draft.map((t,i)=><div className="transfer-row" key={i}><label>Sản phẩm nguồn<select disabled={!!sourceProductId} value={t.fromProductId} onChange={e=>setDraft(draft.map((r,j)=>j===i?{...r,fromProductId:e.target.value}:r))}>{products.map(p=><option key={p.id} value={p.id}>{p.name} · có {money(opening(p.id))} đ</option>)}</select><small>Còn có thể chuyển: {money(available(t.fromProductId,i))} đ</small></label><label>Sản phẩm nhận<select value={t.toProductId} onChange={e=>setDraft(draft.map((r,j)=>j===i?{...r,toProductId:e.target.value}:r))}>{products.filter(p=>p.id!==t.fromProductId).map(p=><option key={p.id} value={p.id} disabled={draft.some((r,j)=>j!==i&&r.fromProductId===t.fromProductId&&r.toProductId===p.id)}>{p.name}</option>)}</select></label><label>Số tiền<NumberField min={1} max={available(t.fromProductId,i)} step={1} value={t.amount} onChange={e=>setDraft(draft.map((r,j)=>j===i?{...r,amount:Number(e.target.value)}:r))}/></label><ActionButton type="button" className="icon-btn" aria-label="Xóa khoản chuyển" onClick={()=>setDraft(draft.filter((_,j)=>j!==i))}><Trash2 size={16}/></ActionButton></div>)}
 {error&&<p className="error-text" role="alert">{error}</p>}<ActionButton type="button" className="btn" disabled={draft.length>=products.length-1} onClick={()=>setDraft([...draft,row()])}><Plus size={16}/> Thêm sản phẩm nhận</ActionButton><div className="modal-actions"><ActionButton type="button" className="btn" onClick={()=>setOpen(false)}>Hủy</ActionButton><ActionButton type="button" className="btn primary" disabled={!!error} onClick={()=>{if(!error){onChange([...otherTransfers,...draft]);setOpen(false);}}}>Áp dụng vào báo cáo</ActionButton></div></section></div>,document.body)}
 </>;
}
