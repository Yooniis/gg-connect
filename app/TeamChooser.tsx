"use client";
import { useEffect,useState } from "react";

type Team={name:string;members:number;xp:number};
export default function TeamChooser({value,onChange}:{value:string;onChange:(team:string)=>void}){
  const[query,setQuery]=useState(value==="Solo"?"":value),[teams,setTeams]=useState<Team[]>([]),[loading,setLoading]=useState(false);
  useEffect(()=>{const timer=setTimeout(async()=>{setLoading(true);try{const r=await fetch(`/api/teams?q=${encodeURIComponent(query)}`,{cache:"no-store"});if(r.ok)setTeams((await r.json()).teams||[])}finally{setLoading(false)}},180);return()=>clearTimeout(timer)},[query]);
  const exact=teams.find(t=>t.name.toLocaleLowerCase("sv-SE")===query.trim().toLocaleLowerCase("sv-SE"));
  return <div className="team-chooser"><label>Sök eller skapa lag<input value={query} onChange={e=>{setQuery(e.target.value);onChange("Solo")}} placeholder="Sök efter lagnamn…" maxLength={30}/></label><div className="team-results">{loading&&<small>SÖKER…</small>}{!loading&&teams.map(team=><button type="button" key={team.name} className={value===team.name?"selected":""} onClick={()=>{onChange(team.name);setQuery(team.name)}}><span><b>{team.name}</b><small>{team.members} {team.members===1?"spelare":"spelare"}</small></span><em>{team.xp.toLocaleString("sv-SE")} XP</em></button>)}{!loading&&query.trim().length>=2&&!exact&&<button type="button" className={value===query.trim()?"selected create-team":"create-team"} onClick={()=>onChange(query.trim())}><span><b>+ Skapa ”{query.trim()}”</b><small>Nytt lag</small></span></button>}{!loading&&!query&&teams.length===0&&<small>Inga lag har skapats ännu.</small>}</div><button type="button" className={value==="Solo"?"solo selected":"solo"} onClick={()=>{onChange("Solo");setQuery("")}}>SPELA SOLO</button>{value!=="Solo"&&<div className="team-selected">VALT LAG <b>{value}</b></div>}</div>;
}

