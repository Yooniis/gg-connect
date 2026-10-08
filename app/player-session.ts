"use client";

export type PlayerIdentity={name:string;team:string;token:string};
const KEY="good-game-player";

export function getPlayer():PlayerIdentity|null{
  if(typeof window==="undefined")return null;
  try{return JSON.parse(localStorage.getItem(KEY)||"null") as PlayerIdentity|null}catch{return null}
}

export function savePlayer(player:PlayerIdentity){
  localStorage.setItem(KEY,JSON.stringify(player));
  window.dispatchEvent(new CustomEvent("player-ready",{detail:player}));
}

export async function ensurePlayer(player:PlayerIdentity,pin?:string){
  const r=await fetch("/api/player",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...player,pin})});
  if(!r.ok){const data=await r.json().catch(()=>null);throw new Error(data?.error||"Kunde inte spara spelaren")}
  return r.json();
}
