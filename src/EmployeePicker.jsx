import React from 'react';
import {ActionButton} from './Operations.jsx';
export default function EmployeePicker({accounts=[],value=[],onChange,compact=false,label='Phân phối cho nhân viên'}){
 const people=accounts.filter(a=>a.role==='user'&&a.active&&!a.deletedAt);
 const selected=new Set(value);
 const content=<><div className="employee-picker-actions"><ActionButton type="button" className="text-btn" onClick={()=>onChange(people.map(a=>a.id))}>Chọn tất cả</ActionButton><ActionButton type="button" className="text-btn" onClick={()=>onChange([])}>Bỏ chọn</ActionButton></div><div className="employee-picker-list">{people.map(a=><label key={a.id}><input type="checkbox" checked={selected.has(a.id)} aria-label={label+' — '+a.ownerName} onChange={e=>onChange(e.target.checked?[...value,a.id]:value.filter(id=>id!==a.id))}/><span>{a.ownerName}<small>@{a.username}</small></span></label>)}{!people.length&&<p>Chưa có nhân viên đang hoạt động.</p>}</div></>;
 return compact?<details className="employee-picker compact"><summary>{value.length?value.length+' nhân viên đã chọn':'Chọn nhân viên'}</summary>{content}</details>:<fieldset className="employee-picker"><legend>{label}</legend>{content}</fieldset>;
}
