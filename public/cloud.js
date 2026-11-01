// Public course: no accounts. Saved work belongs to this browser.
if(!localStorage.getItem('benPublicCourseV1')){
 localStorage.removeItem('benScienceSessionId');
 localStorage.removeItem('benSciencePageStartedAt');
 localStorage.setItem('benPublicCourseV1','1');
}
const status=document.getElementById('copy-status');
if(status)status.textContent='No sign-in needed. Progress is saved for this browser.';
const footer=document.querySelector('body > footer');
if(footer)footer.textContent='Public online course. Your attempts are saved for this browser. Earlier Mac records remain separate.';
