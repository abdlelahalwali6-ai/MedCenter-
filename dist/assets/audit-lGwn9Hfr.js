import{J as c,n as d,a as i,i as m}from"./index-CNQvTdPW.js";/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */async function l(a,t,e,r,s,o={}){try{if(!a)return;await c(d(i,"audit_logs"),{userId:a.uid||a.id,userName:a.displayName||a.name||"Unknown",userRole:a.role||"user",action:t,entityType:e,entityId:r,details:s,metadata:o||{},createdAt:m()})}catch(n){console.error("Failed to log activity:",n)}}export{l};
