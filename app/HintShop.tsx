"use client";
import { useEffect,useState } from "react";
import { getPlayer } from "./player-session";
export default function HintShop({questId,cost,text,imageKey}:{questId:number;cost:number;text:string;imageKey?:string|null}){
  const[balance,setBalance]=useState(0),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{const p=getPlayer();if(!p)return;fetch(`/api/hints?token=${encodeURIComponent(p.token)}&questId=${questId}`,{cache:"no-store"}).then(r=>r.json()).then(d=>{setBalance(d.xp||0);setOpen(Boolean(d.purchased))}).catch(()=>{})},[questId]);
  if(!text&&!imageKey)return null;
  const buy=async()=>{const p=getPlayer();if(!p){window.dispatchEvent(new Event("open-player-profile"));return}setBusy(true);setError("");const r=await fetch("/api/hints",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:p.token,questId,cost})}),d=await r.json();if(r.ok){setBalance(d.xp);setOpen(true);window.dispatchEvent(new Event("progress-updated"))}else setError(d.error||"Köpet misslyckades");setBusy(false)};
  return <div className="hint-shop"><div><small>BEHÖVER DU HJÄLP?</small><b>Saldo: {balance} XP</b></div>{open?<div className="hint-reveal">{imageKey&&<img src={`/api/quest-image/${imageKey}`} alt="Bildledtråd för uppdraget"/>}<p>{text}</p><span>Ledtråden är upplåst</span></div>:<button disabled={busy||balance<cost} onClick={buy}>{busy?"KÖPER…":`KÖP LEDTRÅD · ${cost} XP`}</button>}{error&&<small className="error-note">{error}</small>}</div>
}
