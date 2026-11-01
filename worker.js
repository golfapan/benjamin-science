import {authRoute,sessionIdentity} from './auth.js';
import course from './course.json' with {type:'json'};
import {service,D1Store,APIError} from './engine.js';

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});}
export async function authenticatedIdentity(env,ctx,request){
 // Verify the Google session, or use server-attested Access identity when configured.
 // Client-supplied email and Cf-Access-* headers are never identity evidence.
 const identity=env.GOOGLE_CLIENT_ID?await sessionIdentity(request,env):(ctx.access?await ctx.access.getIdentity():null),email=String(identity?.email||'').toLowerCase();
 const allowed=String(env.ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!email||!allowed.includes(email))return null;
 return{email,role:email===String(env.TEACHER_EMAIL||'').toLowerCase()?'teacher':'learner'};
}
export default{
 async fetch(request,env,ctx){
  try{
   const auth=await authRoute(request,env);if(auth)return auth;
   const identity=await authenticatedIdentity(env,ctx,request);
   if(!identity){if(env.GOOGLE_CLIENT_ID&&request.method==='GET'&&!new URL(request.url).pathname.startsWith('/api/'))return new Response(null,{status:303,headers:{Location:'/login','Cache-Control':'no-store'}});return json({error:'Sign in with an approved family email to access Benjamin.'},403);}
   const url=new URL(request.url),path=decodeURIComponent(url.pathname);
   if(!['GET','HEAD','POST'].includes(request.method))return json({error:'Method not allowed'},405);
   if(request.method==='POST'){
    if(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'Same-site submission required'},403);
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON required'},415);
   }
   if(path==='/health')return json({status:'ok',course:'Benjamin',runtime:'cloud',bank_revision:course.bank_revision});
   if(path==='/api/network')return json({local_url:url.origin,wifi_url:url.origin});
   if(path.startsWith('/api/')){
    let payload={};if(request.method==='POST'){const text=await request.text();if(text.length>1_000_000)return json({error:'Request is too large'},413);try{payload=JSON.parse(text);}catch{return json({error:'Invalid JSON'},400);}if(!payload||Array.isArray(payload)||typeof payload!=='object')return json({error:'JSON object required'},400);}
    const result=await service(course,new D1Store(env.DB)).request(path,request.method==='HEAD'?'GET':request.method,payload,identity);
    return request.method==='HEAD'?new Response(null,{status:200,headers:{'Cache-Control':'no-store'}}):json(result,path==='/api/session/start'||path.endsWith('/page-submit')||path.endsWith('/answer')?201:200);
   }
   if(path.startsWith('/resources/')&&!/^\/resources\/jso-202[45]-(paper|answers)\.pdf$/.test(path))return json({error:'Not found'},404);
   if(path.startsWith('/resources/')&&path.includes('answers')&&identity.role!=='teacher')return json({error:'Teacher access required'},403);
   // The static directory deliberately contains neither course.json nor answer keys.
   if(/(?:^|\/)(?:course\.json|engine\.js|worker\.js|schema\.sql|source\.json|\.env|\.git)(?:\/|$)/i.test(path))return json({error:'Not found'},404);
   const asset=new URL(request.url);if(['/learn','/learn/','/learn/index.html'].includes(path))asset.pathname='/index.html';
   const response=await env.ASSETS.fetch(new Request(asset,request));
   const headers=new Headers(response.headers);headers.set('Cache-Control','private, no-store');headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','same-origin');
   return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
  }catch(error){if(error instanceof APIError)return json({error:error.message},error.status);console.error('Course request failed',error?.name||'Error');return json({error:'The request could not be completed. Please reload and try again.'},500);}
 }
};
