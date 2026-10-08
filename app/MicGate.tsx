"use client";
import { useEffect, useState } from "react";

export default function MicGate(){
  const[open,setOpen]=useState(false);const[error,setError]=useState(false);
  useEffect(()=>{setOpen(localStorage.getItem("gg-mic-ready")!=="yes")},[]);
  const enable=async()=>{try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(t=>t.stop());localStorage.setItem("gg-mic-ready","yes");setOpen(false)}catch{setError(true)}};
  if(!open)return null;
  return <div className="mic-gate"><section><div className="gate-icon">◉</div><p className="eyebrow">FÖRBERED SPELLÄGET</p><h2>Aktivera mikrofonen</h2><p>Några quests använder bara mobilens ljudnivå för att kontrollera tystnad. Inget ljud spelas in eller sparas.</p>{error&&<p className="gate-error">Mikrofonåtkomst krävs för att fortsätta. Tillåt åtkomst i webbläsaren.</p>}<button className="primary full" onClick={enable}>AKTIVERA & ÖPPNA SPELET</button></section></div>
}
