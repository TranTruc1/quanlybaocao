import React,{useRef,useState,useLayoutEffect} from 'react';
import {createPortal} from 'react-dom';
export default function StickyTableHead({children}){
 const ref=useRef(null),[geometry,setGeometry]=useState(null);
 useLayoutEffect(()=>{const head=ref.current,table=head?.closest('table'),scroller=table?.closest('.table-scroll');if(!table||!scroller)return;
 function measure(){const box=table.getBoundingClientRect(),header=head.getBoundingClientRect(),view=scroller.getBoundingClientRect(),controls=document.querySelector('.report-sticky-controls'),bar=controls?.getBoundingClientRect();const top=bar&&bar.bottom>0?bar.bottom:0;
 if(header.top>=top||box.bottom<=top+header.height){setGeometry(null);return;}
 const widths=[...head.querySelectorAll('th')].map(cell=>cell.getBoundingClientRect().width);const next={top,left:Math.max(0,view.left),width:Math.min(scroller.clientWidth,window.innerWidth-Math.max(0,view.left)),tableWidth:box.width,height:header.height,offset:scroller.scrollLeft+Math.max(0,-view.left),widths};setGeometry(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);}
 measure();window.addEventListener('scroll',measure,true);window.addEventListener('resize',measure);const observer=new ResizeObserver(measure);observer.observe(table);const controls=document.querySelector('.report-sticky-controls');if(controls)observer.observe(controls);return()=>{window.removeEventListener('scroll',measure,true);window.removeEventListener('resize',measure);observer.disconnect();};
 },[children]);
 return <><thead ref={ref}>{children}</thead>{geometry&&createPortal(<div className="floating-product-header product-summary inline-report-editor" style={{top:geometry.top,left:geometry.left,width:geometry.width,height:geometry.height}}><table style={{width:geometry.tableWidth,minWidth:geometry.tableWidth,tableLayout:'fixed',transform:`translateX(-${geometry.offset}px)`}}><colgroup>{geometry.widths.map((width,i)=><col key={i} style={{width}}/>)}</colgroup><thead>{children}</thead></table></div>,document.body)}</>;
}
