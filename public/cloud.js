// Cloud-specific presentation only; permissions are enforced by the Worker.
fetch('/api/me').then(r=>{if(!r.ok)throw Error('Sign-in required');return r.json();}).then(me=>{
 document.querySelectorAll('[data-view="instructor"]').forEach(b=>{b.hidden=me.role!=='teacher';});
 const p=document.getElementById('copy-status');if(p)p.textContent='Signed in as '+me.email+'. Use your approved email on other devices.';
}).catch(()=>{const p=document.getElementById('copy-status');if(p)p.textContent='Please sign in with your approved email.';});
