import{z as c,w as n,A as i}from"./vendor-firebase-Ckoi0oR6.js";import{d as m}from"./index-4FKKuzO9.js";/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */async function y(a,t,e,r,o,s={}){try{if(!a)return;await c(n(m,"audit_logs"),{userId:a.uid||a.id,userName:a.displayName||a.name||"Unknown",userRole:a.role||"user",action:t,entityType:e,entityId:r,details:o,metadata:s||{},createdAt:i()})}catch(d){console.error("Failed to log activity:",d)}}export{y as l};
