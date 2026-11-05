import {dayString} from '../src/domain.js';
export function fixtureDb(){
 const today=dayString();const month=today.slice(0,7);
 const accounts=[{id:'admin',ownerName:'Jenny Tran',username:'admin',role:'admin',active:true},{id:'u1',ownerName:'Linh Nguyễn',username:'linh',role:'user',active:true},{id:'u2',ownerName:'Minh Anh',username:'minhanh',role:'user',active:true},{id:'u3',ownerName:'Hoàng Nam',username:'hoangnam',role:'user',active:true}];
 const products=[{id:'p1',name:'Tĩnh mạch',priceUsd:99,rate:22500,active:true,color:'#0e7861'},{id:'p2',name:'Toma',priceUsd:298,rate:22500,active:true,color:'#6579b9'},{id:'p3',name:'Toma Cổ',priceUsd:189,rate:22500,active:true,color:'#ba9353'},{id:'p4',name:'ĐL',priceUsd:210,rate:22500,active:true,color:'#9c6aa2'},{id:'p5',name:'Luta',priceUsd:129,rate:22500,active:true,color:'#ba6e58'}];
 const assignments=[{id:'a1',accountId:'u1',productId:'p1',active:true},{id:'a2',accountId:'u1',productId:'p2',active:true},{id:'a3',accountId:'u2',productId:'p3',active:true},{id:'a4',accountId:'u2',productId:'p1',active:true},{id:'a5',accountId:'u3',productId:'p4',active:true},{id:'a6',accountId:'u3',productId:'p5',active:true}];
 const reports=[],orders=[],targets=[];
 for(let day=1;day<=Number(today.slice(-2));day++){const date=month+'-'+String(day).padStart(2,'0');for(const [i,a]of accounts.filter(a=>a.role==='user').entries()){
 const entries=assignments.filter(x=>x.accountId===a.id).map((x,j)=>({productId:x.productId,budget:1700000+i*200000+j*150000,remaining:200000+(day%3)*50000,data:68+i*9+day*3+j*6,tt:44+day+i,ktt:24+i,success:5+i+j,upsale:1+j,appointments:3+i,late:2}));
 const status=day===Number(today.slice(-2))&&i===2?'draft':'submitted';reports.push({id:'r'+day+a.id,accountId:a.id,date,status,entries,revision:1,updatedAt:date+'T09:00:00.000Z'});
 if(status==='submitted')for(const [j,e]of entries.entries()){const p=products.find(p=>p.id===e.productId);for(let k=0;k<3+j;k++)orders.push({id:'o'+day+a.id+j+k,accountId:a.id,productId:p.id,date,customerName:['Anna Nguyen','Lisa Tran','David Pham','Susan Le'][k],type:k===2?'care':'sale',amountUsd:p.priceUsd,rate:p.rate,amountVnd:p.priceUsd*p.rate,createdAt:date+'T09:00:00.000Z'});}
 }}
 for(const a of assignments){const p=products.find(p=>p.id===a.productId);targets.push({id:'t'+a.id,month,accountId:a.accountId,productId:a.productId,revenue:p.id==='p1'?100000000:150000000,care:20000000,salary:20000000,priceUsd:p.priceUsd,rate:p.rate});}
 return {accounts,products,assignments,reports,orders,targets,audit:[]};
}
