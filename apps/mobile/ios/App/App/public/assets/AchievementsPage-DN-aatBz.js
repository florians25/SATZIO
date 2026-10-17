import{j as e}from"./data-CK6Tr_-o.js";import{P as n}from"./PageHeader-BvA86jmw.js";import{S as d,C as l}from"./card-CenbboGl.js";import{c as a,ae as m,K as p,N as h,g as c,H as y}from"./index-DAwc-4fk.js";import{r as x}from"./queries-Bqahk9nh.js";import{T as k}from"./trending-up-DEMxG4oR.js";import{R as f}from"./repeat-DDB2Zkzv.js";import{F as g}from"./flame-DKx2LFnm.js";import{T as u}from"./trophy-IXK-0o_2.js";import{A as N}from"./award-DgK5YsVb.js";import"./react-Bik-GMVl.js";import"./SyncIndicator-CIzQ_h9x.js";import"./index-t2A_5ZNG.js";import"./chevron-left-Beymxz_M.js";import"./charts-ROIOCDrI.js";/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const b=[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}]],j=a("calendar",b);/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=[["path",{d:"M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z",key:"i9b6wo"}],["line",{x1:"4",x2:"4",y1:"22",y2:"15",key:"1cm3nv"}]],w=a("flag",v);/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A=[["rect",{width:"18",height:"11",x:"3",y:"11",rx:"2",ry:"2",key:"1w4ew1"}],["path",{d:"M7 11V7a5 5 0 0 1 10 0v4",key:"fwvmzm"}]],M=a("lock",A);/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _=[["path",{d:"M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15",key:"143lza"}],["path",{d:"M11 12 5.12 2.2",key:"qhuxz6"}],["path",{d:"m13 12 5.88-9.8",key:"hbye0f"}],["path",{d:"M8 7h8",key:"i86dvs"}],["circle",{cx:"12",cy:"17",r:"5",key:"qbz8iq"}],["path",{d:"M12 18v-2h-.5",key:"fawc4q"}]],q=a("medal",_);/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const z=[["circle",{cx:"12",cy:"5",r:"3",key:"rqqgnr"}],["path",{d:"M6.5 8a2 2 0 0 0-1.905 1.46L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.925-2.54L19.4 9.5A2 2 0 0 0 17.48 8Z",key:"56o5sh"}]],L=a("weight",z);/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C=[["path",{d:"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",key:"1xq2db"}]],$=a("zap",C),T={flag:w,dumbbell:p,medal:q,trophy:u,zap:$,flame:g,"calendar-check":m,repeat:f,"trending-up":k,weight:L,calendar:j};function G(){const o=x();return e.jsxs("div",{children:[e.jsx(n,{title:"Erfolge",back:"/profile",subtitle:"Abschaltbar in den Einstellungen"}),e.jsxs("div",{className:"grid grid-cols-2 gap-2 px-4 pb-10",children:[o.isLoading&&e.jsx(d,{className:"col-span-2 h-40"}),o.data?.map((t,r)=>{const i=T[t.icon]??N,s=!!t.unlockedAt;return e.jsx(h.div,{initial:{opacity:0,y:6},animate:{opacity:1,y:0},transition:{delay:r*.03},children:e.jsxs(l,{className:c("h-full p-4",!s&&"opacity-50"),children:[e.jsx("span",{className:c("grid h-11 w-11 place-items-center rounded-2xl",s?"bg-primary text-primary-fg":"bg-surface-2 text-muted"),children:s?e.jsx(i,{className:"h-6 w-6"}):e.jsx(M,{className:"h-5 w-5"})}),e.jsx("p",{className:"mt-3 font-semibold",children:t.title}),e.jsx("p",{className:"text-sm text-muted",children:t.description}),t.unlockedAt&&e.jsx("p",{className:"mt-1 text-xs text-primary",children:y(t.unlockedAt)})]})},t.code)})]})]})}export{G as default};
