import{T as o}from"./vendor-firebase-Ckoi0oR6.js";/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */function e(t){if(!t)return null;if(typeof t.toDate=="function")return t.toDate();if(typeof t.seconds=="number")return new o(t.seconds,t.nanoseconds||0).toDate();if(t instanceof Date)return t;if(typeof t=="string"){const n=new Date(t);return isNaN(n.getTime())?null:n}return typeof t=="number"?new Date(t):null}function f(t,n){const r=e(t);return r?r.toLocaleDateString("ar-SA",n):"---"}function a(t){const n=e(t);return n?n.toLocaleString("ar-SA"):"---"}export{a,f,e as t};
