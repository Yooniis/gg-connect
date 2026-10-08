const encoder=new TextEncoder();
export function validPin(pin:string){return /^\d{4,8}$/.test(pin)}
export function newSalt(){const bytes=crypto.getRandomValues(new Uint8Array(16));return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("")}
export async function hashPin(pin:string,salt:string){const key=await crypto.subtle.importKey("raw",encoder.encode(pin),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:encoder.encode(salt),iterations:100000,hash:"SHA-256"},key,256);return Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,"0")).join("")}
export function cookie(token:string){
  const secure=process.env.NODE_ENV==="production"?"; Secure":"";
  return `gg_player=${encodeURIComponent(token)}; Path=/; Max-Age=2592000; SameSite=Lax; HttpOnly${secure}`;
}
