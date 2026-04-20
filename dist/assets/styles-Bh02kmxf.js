import{c as u,r as i,j as E}from"./index-CNQvTdPW.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]],b=u("check",f),S=i.createContext(void 0),_={disableStyleElements:!1};function h(){return i.useContext(S)??_}function C(t,e=Number.MIN_SAFE_INTEGER,n=Number.MAX_SAFE_INTEGER){return Math.max(e,Math.min(t,n))}const l=1;function m(t,e){return Math.max(0,t-e)}function A(t,e){if(e<=0)return 0;const n=C(t,0,e),r=n,c=e-n,o=r<=l,a=c<=l;return o&&a?r<=c?0:e:o?0:a?e:n}const s="base-ui-disable-scrollbar",L={className:s,getElement(t){return E.jsx("style",{nonce:t,href:s,precedence:"base-ui:low",children:`.${s}{scrollbar-width:none}.${s}::-webkit-scrollbar{display:none}`})}};export{b as C,l as S,C as c,m as g,A as n,L as s,h as u};
