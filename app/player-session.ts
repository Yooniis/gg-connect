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

/** Firebase Hosting only forwards the `__session` cookie, so player calls also send the token as a header. */
function installPlayerFetch(){
  if(typeof window==="undefined")return;
  const w=window as Window&{__ggFetchPatched?:boolean};
  if(w.__ggFetchPatched)return;
  const orig=window.fetch.bind(window);
  window.fetch=(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=typeof input==="string"?input:input instanceof URL?input.href:input.url;
    const same=url.startsWith("/")||url.startsWith(location.origin);
    const player=same?getPlayer():null;
    if(!player?.token)return orig(input,init);
    const headers=new Headers(init?.headers);
    if(!headers.has("x-gg-token"))headers.set("x-gg-token",player.token);
    return orig(input,{...init,headers});
  };
  w.__ggFetchPatched=true;
}
installPlayerFetch();

export async function ensurePlayer(player:PlayerIdentity,pin?:string){
  const r=await fetch("/api/player",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...player,pin})});
  if(!r.ok){const data=await r.json().catch(()=>null);throw new Error(data?.error||"Kunde inte spara spelaren")}
  return r.json();
}
