// A fresh palette per page load; colors remain stable while filtering/navigating.
const start=Math.random()*360;
const colors=new Map();
export function productTone(id){
 if(!colors.has(id)){const hue=(start+colors.size*137.508)%360;colors.set(id,{color:`hsl(${hue} 62% 25%)`,background:`hsl(${hue} 65% 95%)`,border:`hsl(${hue} 45% 80%)`,text:'#172f35'});}
 return colors.get(id);
}
