"use client";
import { useEffect } from "react";
import { getPlayer } from "./player-session";

export default function CompletionLock(){
  useEffect(()=>{
    let completed=new Set<string>();
    const block=(event:Event)=>{event.preventDefault();event.stopPropagation();event.stopImmediatePropagation()};
    const apply=()=>document.querySelectorAll<HTMLElement>(".quest").forEach(card=>{
      const title=card.querySelector("h3")?.textContent?.trim()||"";
      const isDone=completed.has(title);
      card.classList.toggle("completed",isDone);
      card.setAttribute("aria-disabled",String(isDone));
      const state=card.querySelector<HTMLElement>("footer span");
      if(isDone&&state&&state.textContent!=="SLUTFÖRT ✓")state.textContent="SLUTFÖRT ✓";
      card.removeEventListener("click",block,true);
      if(isDone)card.addEventListener("click",block,true);
    });
    const load=()=>{const player=getPlayer();if(!player){completed=new Set();apply();return}fetch(`/api/progress?player=${encodeURIComponent(player.name)}`,{cache:"no-store"}).then(r=>r.json()).then(data=>{completed=new Set((data.completions||[]).map((q:{questTitle:string})=>q.questTitle));apply()}).catch(()=>{})};
    load();
    const observer=new MutationObserver(apply);observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener("progress-updated",load);
    window.addEventListener("player-ready",load);
    return()=>{observer.disconnect();window.removeEventListener("progress-updated",load);window.removeEventListener("player-ready",load);document.querySelectorAll<HTMLElement>(".quest").forEach(card=>card.removeEventListener("click",block,true))};
  },[]);
  return null;
}
