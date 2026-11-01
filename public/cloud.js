// Cloud-specific presentation only; permissions are enforced by the Worker.
fetch('/api/me').then(r=>{if(!r.ok)throw Error('Sign-in required');return r.json();}).then(me=>{
 document.querySelectorAll('[data-view="instructor"]').forEach(b=>{b.hidden=me.role!=='teacher';});
 const p=document.getElementById('copy-status');if(p){p.textContent='Signed in as '+me.email+'. ';const exit=document.createElement('button');exit.type='button';exit.textContent='Sign out';exit.addEventListener('click',async()=>{exit.disabled=true;try{const response=await fetch('/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!response.ok)throw Error('Sign out failed');localStorage.removeItem('benScienceSessionId');location.replace('/login');}catch{exit.disabled=false;exit.textContent='Retry sign out';}});p.append(exit);}
}).catch(()=>{const p=document.getElementById('copy-status');if(p)p.textContent='Please sign in with your approved email.';});
