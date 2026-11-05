import React from 'react';
import {UserRound,Users} from 'lucide-react';
import {ActionButton} from './Operations.jsx';
import {accountLabel} from './roles.js';
export default function EmployeeTabs({accounts,route,onSelect}){
 const team=route.team==='sale'?'sale':'mkt';
 const items=[{id:'all-mkt',label:'Tất cả MKT',team:'mkt',account:null},{id:'all-sale',label:'Tất cả SALE',team:'sale',account:null},...accounts.filter(a=>a.active&&['user','sale'].includes(a.role)).map(a=>({id:a.id,label:accountLabel(a),team:a.role==='sale'?'sale':'mkt',account:a.id}))];
 return <section className="employee-tabs" aria-label="Chọn nhân viên xem báo cáo">{["mkt","sale"].map(group=><div className="employee-team-row" key={group}>{items.filter(item=>item.team===group).map(item=><ActionButton key={item.id} className={'employee-tab '+(team===item.team&&(route.employee||null)===item.account?'selected':'')} aria-pressed={team===item.team&&(route.employee||null)===item.account} onClick={()=>onSelect({area:'admin',page:'overview',team:item.team,employee:item.account,day:null})}><span className="employee-tab-icon">{item.account?<UserRound size={26}/>:<Users size={26}/>}</span><span>{item.label}</span></ActionButton>)}</div>)}</section>;
}
