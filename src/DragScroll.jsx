import React,{useEffect,useRef} from 'react';
export default function DragScroll({children,className='',...props}){
 const node=useRef(null),drag=useRef(null),suppressClick=useRef(false);
 useEffect(()=>{
  const move=e=>{const d=drag.current;if(!d||e.pointerId!==d.id)return;if(e.buttons===0){drag.current=null;node.current?.classList.remove('is-dragging');return;}const dx=e.clientX-d.x,dy=e.clientY-d.y;
   if(!d.active){if(Math.abs(dy)>Math.abs(dx)+6){drag.current=null;return;}if(Math.abs(dx)<6||Math.abs(dx)<=Math.abs(dy))return;d.active=true;node.current?.classList.add('is-dragging');}
   e.preventDefault();window.getSelection()?.removeAllRanges();if(node.current)node.current.scrollLeft=d.left-dx;
  };
  const stop=e=>{if(drag.current&&e.pointerId===drag.current.id){suppressClick.current=drag.current.active;drag.current=null;node.current?.classList.remove('is-dragging');}};
  const blur=()=>{drag.current=null;node.current?.classList.remove('is-dragging');};
  window.addEventListener('blur',blur);window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop);
  return()=>{window.removeEventListener('blur',blur);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop);};
 },[]);
 return <div aria-label="Bảng đơn hàng, giữ chuột trái và kéo để cuộn ngang" {...props} ref={node} tabIndex={0} className={'table-scroll drag-scroll '+className} onPointerDown={e=>{
  suppressClick.current=false;if(e.pointerType!=='mouse'||e.button!==0||e.target.closest('button,a,input,select,textarea,label,[role="button"]')||e.currentTarget.scrollWidth<=e.currentTarget.clientWidth)return;
  drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,left:e.currentTarget.scrollLeft,active:false};
 }} onDragStart={e=>{if(drag.current)e.preventDefault();}} onClickCapture={e=>{if(suppressClick.current){e.preventDefault();e.stopPropagation();suppressClick.current=false;}}}>{children}</div>;
}
