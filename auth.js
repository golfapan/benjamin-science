// Google ID tokens are signature-verified; only opaque session hashes persist.
const enc=new TextEncoder();
const bytes=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
export const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
const cookies=req=>Object.fromEntries((req.headers.get('Cookie')||'').split(';').map(x=>x.trim().split('=')));
const cookie=(name,value,age)=>`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
const noStore={'Cache-Control':'no-store','Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff'};
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{...noStore,'Content-Type':'application/json'}});
let keyCache={keys:[],expires:0};
async function googleKeys(){if(Date.now()>=keyCache.expires){const r=await fetch('https://www.googleapis.com/oauth2/v3/certs');if(!r.ok)throw Error('Identity provider unavailable');const data=await r.json();keyCache={keys:data.keys,expires:Date.now()+Math.min(21600,Number(/max-age=(\d+)/.exec(r.headers.get('Cache-Control')||'')?.[1]||300))*1000};}return keyCache.keys;}
export async function verifyGoogle(token,client,nonce,keys=null,now=Math.floor(Date.now()/1000)){
 if(!client||typeof token!=='string'||token.length>16384)throw Error('Invalid identity');
 const parts=token.split('.');if(parts.length!==3)throw Error('Invalid identity');
 const header=JSON.parse(new TextDecoder().decode(bytes(parts[0]))),claims=JSON.parse(new TextDecoder().decode(bytes(parts[1])));
 if(header.alg!=='RS256'||typeof header.kid!=='string')throw Error('Invalid identity');
 const jwk=(keys||await googleKeys()).find(k=>k.kid===header.kid&&k.kty==='RSA');if(!jwk)throw Error('Unknown signing key');
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes(parts[2]),enc.encode(parts[0]+'.'+parts[1])))throw Error('Invalid signature');
 if(!['accounts.google.com','https://accounts.google.com'].includes(claims.iss)||claims.aud!==client||!Number.isFinite(claims.exp)||claims.exp<=now||!Number.isFinite(claims.iat)||claims.iat>now+60||claims.iat<now-7200||!claims.sub||claims.email_verified!==true||!nonce||claims.nonce!==nonce)throw Error('Invalid identity claims');
 return claims;
}
export async function sessionIdentity(req,env){const token=cookies(req).__Host_ben_session;if(!token||!/^[a-f0-9]{64}$/.test(token))return null;const row=await env.DB.prepare('SELECT email, subject FROM auth_sessions WHERE token_hash=? AND expires_at>?').bind(await hash(token),Math.floor(Date.now()/1000)).first();return row?{email:row.email,subject:row.subject}:null;}
export async function authRoute(req,env){
 const url=new URL(req.url),path=url.pathname;if(!['/login','/auth/google','/auth/logout'].includes(path))return null;
 if(path==='/login'&&req.method==='GET'){
  if(!env.GOOGLE_CLIENT_ID)return new Response('Private course: Google sign-in is being configured.',{status:503,headers:noStore});
  const nonce=random(),now=Math.floor(Date.now()/1000);await env.DB.prepare('INSERT INTO auth_nonces(nonce_hash,expires_at) VALUES(?,?)').bind(await hash(nonce),now+600).run();
  const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in — Benjamin</title><style>body{font:18px/1.6 system-ui;background:#f5f6f1;color:#173d5f;margin:0;display:grid;place-items:center;min-height:100vh}main{max-width:450px;padding:36px;background:white;border-radius:18px}h1{margin-top:0}#message{color:#a33}</style><main><h1>Benjamin</h1><p>Sign in with your approved Google account to continue learning.</p><div id="google"></div><p id="message"></p><small>Private family course. Earlier Mac records have not been imported.</small></main><script src="https://accounts.google.com/gsi/client" async defer></script><script>window.onload=()=>{google.accounts.id.initialize({client_id:${JSON.stringify(env.GOOGLE_CLIENT_ID)},nonce:${JSON.stringify(nonce)},auto_select:false,callback:async response=>{const r=await fetch('/auth/google',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential:response.credential})});if(r.ok)location.replace('/');else document.getElementById('message').textContent='Unable to sign in. Use an approved account, or reload and try again.'}});google.accounts.id.renderButton(document.getElementById('google'),{theme:'outline',size:'large'});};</script></html>`;
  return new Response(html,{headers:{...noStore,'Content-Type':'text/html; charset=utf-8','Set-Cookie':cookie('__Host_ben_nonce',nonce,600),'Cross-Origin-Opener-Policy':'same-origin-allow-popups'}});
 }
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 if(req.headers.get('Origin')!==url.origin||req.headers.get('Sec-Fetch-Site')==='cross-site'||!req.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Same-origin JSON required'},403);
 const token=cookies(req).__Host_ben_session;
 if(path==='/auth/logout'){if(token)await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await hash(token)).run();return new Response('{}',{headers:{...noStore,'Set-Cookie':cookie('__Host_ben_session','',0)}});}
 try{
  const nonce=cookies(req).__Host_ben_nonce;if(!nonce||!/^[a-f0-9]{64}$/.test(nonce))return json({error:'Reload the sign-in page'},403);
  const text=await req.text();if(text.length>20000)return json({error:'Invalid identity'},400);
  const claims=await verifyGoogle(JSON.parse(text).credential,env.GOOGLE_CLIENT_ID,nonce),email=String(claims.email||'').toLowerCase();
  if(!String(env.ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).includes(email))return json({error:'This account is not approved'},403);
  const now=Math.floor(Date.now()/1000),used=await env.DB.prepare('DELETE FROM auth_nonces WHERE nonce_hash=? AND expires_at>?').bind(await hash(nonce),now).run();if(used.meta.changes!==1)return json({error:'Reload the sign-in page'},403);
  const session=random();await env.DB.prepare('INSERT INTO auth_sessions(token_hash,email,subject,expires_at) VALUES(?,?,?,?)').bind(await hash(session),email,claims.sub,now+604800).run();
  const headers=new Headers({...noStore,'Content-Type':'application/json'});headers.append('Set-Cookie',cookie('__Host_ben_session',session,604800));headers.append('Set-Cookie',cookie('__Host_ben_nonce','',0));return new Response('{}',{headers});
 }catch{return json({error:'Unable to verify sign-in. Reload and try again.'},403);}
}
