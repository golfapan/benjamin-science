import course from './course.json' with {type:'json'};
import {service,D1Store,APIError} from './engine.js';

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});}
export async function browserIdentity(request){
 // Public reading and practice. A browser token separates saved attempts.
 let token=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host_ben_public='))?.slice('__Host_ben_public='.length);
 const fresh=!/^[a-f0-9]{64}$/.test(token||'');
 if(fresh)token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 const owner=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 return {identity:{email:'public:'+owner,role:'learner',mode:'public'},cookie:fresh?'__Host_ben_public='+token+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=31536000':null};
}
export default{
 async fetch(request,env,ctx){
  let visitor;
  const finish=response=>{if(!visitor?.cookie)return response;const headers=new Headers(response.headers);headers.append('Set-Cookie',visitor.cookie);return new Response(response.body,{status:response.status,headers});};
  try{
   const url=new URL(request.url),path=decodeURIComponent(url.pathname);
   if(!['GET','HEAD','POST'].includes(request.method))return json({error:'Method not allowed'},405);
   if(request.method==='POST'){
    if(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'Same-site submission required'},403);
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON required'},415);
   }
   if(path==='/health')return json({status:'ok',course:'Benjamin',runtime:'cloud',access_mode:'public',revision:'2026-11-02-public',bank_revision:course.bank_revision});
   visitor=await browserIdentity(request);const identity=visitor.identity;
   if(path==='/login'||path.startsWith('/auth/'))return finish(new Response(null,{status:303,headers:{Location:'/', 'Cache-Control':'no-store'}}));
   if(path==='/api/network')return finish(json({local_url:url.origin,wifi_url:url.origin}));
   if(path==='/api/me')return finish(json({role:'learner',access_mode:'public',progress_scope:'this browser'}));
   if(path.startsWith('/api/')){
    let payload={};if(request.method==='POST'){const text=await request.text();if(text.length>1_000_000)return json({error:'Request is too large'},413);try{payload=JSON.parse(text);}catch{return json({error:'Invalid JSON'},400);}if(!payload||Array.isArray(payload)||typeof payload!=='object')return json({error:'JSON object required'},400);}
    const result=await service(course,new D1Store(env.DB)).request(path,request.method==='HEAD'?'GET':request.method,payload,identity);
    return finish(request.method==='HEAD'?new Response(null,{status:200,headers:{'Cache-Control':'no-store'}}):json(result,path==='/api/session/start'||path.endsWith('/page-submit')||path.endsWith('/answer')?201:200));
   }
   if(path.startsWith('/resources/')&&!/^\/resources\/jso-202[45]-(paper|answers)\.pdf$/.test(path))return json({error:'Not found'},404);
   if(path.startsWith('/resources/')&&path.includes('answers')&&identity.role!=='teacher')return json({error:'Teacher access required'},403);
   // The static directory deliberately contains neither course.json nor answer keys.
   if(/(?:^|\/)(?:course\.json|engine\.js|worker\.js|schema\.sql|source\.json|\.env|\.git)(?:\/|$)/i.test(path))return json({error:'Not found'},404);
   const asset=new URL(request.url);if(['/learn','/learn/','/learn/index.html'].includes(path))asset.pathname='/index.html';
   const response=await env.ASSETS.fetch(new Request(asset,request));
   const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','same-origin');
   return finish(new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers}));
  }catch(error){if(error instanceof APIError)return finish(json({error:error.message},error.status));console.error('Course request failed',error?.name||'Error');return finish(json({error:'The request could not be completed. Please reload and try again.'},500));}
 }
};
