export function parseNumberText(text,decimals=0){
 let raw=String(text).trim();if(raw.includes('-'))return null;
 let fraction='';
 if(decimals){
  let parts=raw.split(',');
  if(parts.length>1){raw=parts.shift();fraction='.'+parts.join('').replace(/\D/g,'').slice(0,decimals);}
  else if(/^\d+\.\d{0,2}$/.test(raw)&&raw.split('.')[1].length<=decimals){const i=raw.indexOf('.');fraction=raw.slice(i);raw=raw.slice(0,i);}
 }
 let integer=raw.replace(/\D/g,'').replace(/^0+(?=\d)/,'');
 if(!integer&&!fraction)return '';
 return (integer||'0')+fraction;
}
export function groupedNumberText(normalized){
 if(normalized===''||normalized==null)return '';
 const [integer,fraction]=String(normalized).split('.');
 return integer.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(fraction!==undefined?','+fraction:'');
}
