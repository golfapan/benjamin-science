// Cloud adapter: independent records; the portable Python course remains unchanged.
export const LEVELS=['easy','medium','hard','test'];
const KINDS=['hint','solution','gpt-hint','gpt-solution'];
const MARKERS=['tracking:v1','tracking:v2'];
const round=x=>Math.round((x+Number.EPSILON)*1000)/1000;
const normal=x=>String(x).toLowerCase().replace(/[^a-z0-9.+-]+/g,' ').trim();
export class APIError extends Error{constructor(status,message){super(message);this.status=status;}}
const reject=(code,message)=>{throw new APIError(code,message);};
export function grade(q,a){
 let score=0;
 if(q.type==='multiple_choice')score=String(a)===String(q.answer)?1:0;
 else if(q.type==='numeric'){
  const text=String(a??'').replaceAll(',','').trim();
  // Number('') and Number('0x10') differ from Python float; reject both.
  const valid=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text);
  score=valid&&Number.isFinite(Number(text))&&Math.abs(Number(text)-Number(q.answer))<=Number(q.tolerance||0)?1:0;
 }else if(q.type==='short_text'){
  const groups=q.keyword_groups||[],t=normal(a);score=groups.length?groups.filter(g=>g.some(s=>t.includes(normal(s)))).length/groups.length:0;
 }else reject(500,'Unsupported question type');
 const status=score>=.999?'correct':score>0?'partial':'incorrect';
 return {score:round(score),status,feedback:status==='correct'?(q.feedback_correct??'Correct.'):status==='partial'?(q.feedback_partial??q.feedback_incorrect??'Partly correct.'):(q.feedback_incorrect??'Review the concept and try a related question.'),explanation:q.explanation??''};
}
export function pageFor(course,topic,level,id){
 const pages=topic?.course_pages?.[level]||[],p=id?pages.find(p=>p.id===id):pages[0];if(p)return p;
 const old=course.retired_pages?.[id];return old&&old.topic_id===topic?.id&&old.level===level?{...old.page,title:old.page.title+' (previous version)',retired:true}:null;
}
export function questionsFor(course,s,level=s.active_level){
 const topic=course.topics.find(t=>t.id===s.topic_id),page=pageFor(course,topic,level,s.page_id);
 const old=course.retired_pages?.[s.page_id];
 const all=old&&old.topic_id===s.topic_id&&old.level===level?old.questions:(topic?.question_sets?.[level]||[]);
 return {topic,page,questions:page?page.question_ids.map(id=>all.find(q=>q.id===id)).filter(Boolean):all};
}
export function publicQuestion(q,help=true){const keys=['id','type','prompt','context','given','find','application_brief','options','unit','hint','marks','worked_solution'];return Object.fromEntries(keys.filter(k=>k in q&&(help||!['hint','worked_solution'].includes(k))).map(k=>[k,q[k]]));}
export function mastered(s,level){return [...new Set((s.rounds[level]||[]).flatMap(r=>Object.entries(r.results).filter(([,v])=>v.score>=.999).map(([id])=>id)))];}
export function summary(course,s,level=s.active_level){
 const {questions}=questionsFor(course,s,level),rows=s.rounds[level]||[],first=rows[0],firstResults=first?.results||{},done=mastered(s,level),kinds=Object.fromEntries(KINDS.map(k=>[k,new Set()])),firstSupport=new Set();
 for(const [i,r]of rows.entries())for(const token of r.help){if(MARKERS.includes(token))continue;let[k,...tail]=token.split(':');let id=tail.join(':');if(!KINDS.includes(k)||!id){k='hint';id=token;}kinds[k].add(id);if(i===0)firstSupport.add(id);}
 for(const e of s.help.filter(e=>e.level===level)){kinds[e.kind].add(e.question_id);if(e.before_round===1)firstSupport.add(e.question_id);}
 const support=new Set(Object.values(kinds).flatMap(x=>[...x])),firstTracking=!!first&&MARKERS.some(m=>first.help.includes(m)),tracking=firstTracking&&rows.every(r=>r.help.includes('tracking:v2')),free=firstTracking&&firstSupport.size===0;
 const note=(free?'No site help recorded before the first submission; confirm external help with the teacher.':firstTracking?'Site help was recorded before the first submission; confirm learning with a fresh problem.':'Older attempt: first-submission solution and GPT tracking is incomplete. Independence is unknown.')+(firstTracking&&!tracking?' Earlier recording saved help at submission only; later accesses may be missing. Older elapsed values may reset during correction or stop at four hours; a full total cannot be reconstructed.':'');
 return {total:questions.length,mastered:done.length,first_pass_fraction:questions.length?round(Object.values(firstResults).reduce((s,v)=>s+v.score,0)/questions.length):0,final_fraction:questions.length?round(done.length/questions.length):0,elapsed_seconds:Math.max(0,...rows.map(r=>r.elapsed)),first_elapsed_seconds:first?.elapsed||0,rounds:rows.length,submitted_at:rows.at(-1)?.created_at||null,hints_used:kinds.hint.size,help_counts:Object.fromEntries(KINDS.map(k=>[k,kinds[k].size])),help_question_ids:Object.fromEntries(KINDS.map(k=>[k,[...kinds[k]].sort()])),help_question_numbers:Object.fromEntries(KINDS.map(k=>[k,questions.flatMap((q,i)=>kinds[k].has(q.id)?[i+1]:[])])),recorded_help:KINDS.flatMap(k=>[...kinds[k]].map(id=>k+':'+id)).sort(),recorded_support_used:support.size,support_used:tracking?support.size:null,support_tracking:tracking,first_pass_tracking:firstTracking,first_pass_help_count:firstTracking?firstSupport.size:null,first_pass_support_free:free,support_note:note,complete:rows.length>0,mastery_complete:questions.length>0&&done.length===questions.length};
}
export function recommend(s,level){
 if(!s.first_pass_support_free)return {level:level==='test'?'test':'medium',adjustment:level==='test'?'review':'0',label:level==='test'?'Confirm independent test evidence':'Confirm with a fresh independent problem',reason:level==='test'?'Help was recorded or legacy help tracking is incomplete. Use a fresh unseen task before treating this result as independent transfer.':'Recorded help or incomplete legacy help tracking limits the first-pass evidence. Keep the current level until a fresh written attempt confirms model selection.'};
 const f=s.first_pass_fraction;
 if(level==='test')return f>=.85?{level,adjustment:'secure',label:'Sample Test standard secure',reason:'First-submission answers were accurate with no site help recorded. Confirm the written reasoning and external-help conditions; use a fresh delayed problem before claiming independent transfer.'}:f>=.65?{level,adjustment:'review',label:'Review the test errors',reason:'The overall model is developing, but the missed items should be classified and redone in a changed context before the topic is closed.'}:{level,adjustment:'repair',label:'Return to the relevant course layer',reason:'The first-pass result shows gaps across several linked ideas. Use the question feedback to select the matching Foundation or Core pages before another cumulative test.'};
 if(level==='easy'){const ok=f>=.8&&s.rounds<=2;return{level,adjustment:ok?'secure':'review',label:ok?'Foundation page secure':'Foundation corrections need review',reason:ok?'The underlying ideas are ready to be used in the next course page.':'Final mastery was reached, but the first-pass evidence should be reviewed before relying on these ideas in a harder model.'};}
 if(level==='hard'){const ok=f>=.75&&s.rounds<=2;return{level,adjustment:ok?'secure':'review',label:ok?'Stretch page secure':'Review the Stretch solution paths',reason:ok?'The unfamiliar transfer problems were handled securely.':'The page was completed, but the multi-step model choices should be reviewed before the cumulative Sample Test.'};}
 if(f>=.9&&s.first_elapsed_seconds<=1500&&s.rounds<=2&&s.hints_used===0&&s.recorded_support_used===0&&s.support_tracking)return{level:'hard',adjustment:'+1',label:'Move to Olympiad Stretch',reason:'High first-submission accuracy, short recorded elapsed time and no site help suggest trying a harder page. Confirm the written method and any external help with the teacher.'};
 if(f<.6&&(s.rounds>=2||s.hints_used>=2))return{level:'easy',adjustment:'-1',label:'Consolidate with Olympiad Foundation',reason:'Low first-submission accuracy and repeated correction suggest reducing the number of linked models while retaining reasoning.'};
 if(s.first_elapsed_seconds>2100||s.rounds>=3)return{level:'medium',adjustment:'0',label:'Repeat Olympiad Core for fluency',reason:'Long elapsed time may include breaks; repeated corrections may indicate a gap. Discuss both with the teacher before increasing difficulty.'};
 return{level:'medium',adjustment:'+0.5',label:'Continue Olympiad Core with a small stretch',reason:'Performance is secure enough to continue with less scaffolding or one additional transfer step.'};
}
const hasAnswer=v=>v!==undefined&&v!==null&&(typeof v!=='string'||v.trim()!=='');
function helpEntries(items,ids){if(!Array.isArray(items))reject(400,'Help tracking must be a list.');for(const t of items){if(typeof t!=='string')reject(400,'Invalid help entry.');const[k,...rest]=t.split(':');if(!KINDS.includes(k)||!ids.has(rest.join(':')))reject(400,'Help tracking contains a question outside this page or an unknown help type.');}return [...new Set(items)].sort();}
export function submitPage(course,s,payload,now){
 const level=s.active_level,{page,questions}=questionsFor(course,s),done=new Set(mastered(s,level)),answers=payload.answers??{};
 if(!answers||typeof answers!=='object'||Array.isArray(answers))reject(400,'Answers must be an object keyed by question ID');
 if(questions.some(q=>!done.has(q.id)&&!hasAnswer(answers[q.id])))reject(400,'Answer every unfinished question before submitting the page.');
 const elapsed=payload.elapsed_seconds??0;if(!Number.isSafeInteger(elapsed)||elapsed<0)reject(400,'Elapsed seconds must be a non-negative integer.');
 const help=payload.used_hints??[];if(!Array.isArray(help))reject(400,'Help tracking must be a list.');
 if(MARKERS.some(m=>help.includes(m)))helpEntries(help.filter(x=>!MARKERS.includes(x)),new Set(questions.map(q=>q.id)));
 const rows=s.rounds[level]??=[],results=Object.fromEntries(questions.filter(q=>!done.has(q.id)).map(q=>[q.id,grade(q,answers[q.id])]));
 rows.push({round:rows.length+1,answers:structuredClone(answers),results,elapsed:Math.max(elapsed,...rows.map(r=>r.elapsed)),help:[...new Set(help.map(String))].sort(),created_at:now});s.rounds[level]=rows;s.updated_at=now;
 const result=summary(course,s);return{results,summary:result,page_complete:result.complete,mastered_question_ids:mastered(s,level).sort(),...(result.complete?{recommendation:recommend(result,level)}:{})};
}
export class D1Store{
 constructor(db){this.db=db;}
 async get(id){const r=await this.db.prepare('SELECT state_json, revision FROM learning_sessions WHERE id=?').bind(id).first();return r?{state:JSON.parse(r.state_json),revision:r.revision}:null;}
 async list(owner){const sql=owner?'SELECT state_json, revision FROM learning_sessions WHERE owner=? ORDER BY updated_at DESC':'SELECT state_json, revision FROM learning_sessions ORDER BY updated_at DESC';const r=await(owner?this.db.prepare(sql).bind(owner):this.db.prepare(sql)).all();return r.results.map(r=>({state:JSON.parse(r.state_json),revision:r.revision}));}
 async insert(s){await this.db.prepare('INSERT INTO learning_sessions(id,owner,updated_at,state_json,revision) VALUES(?,?,?,?,0)').bind(s.id,s.owner,s.updated_at,JSON.stringify(s)).run();}
 async save(s,revision){const r=await this.db.prepare('UPDATE learning_sessions SET state_json=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(s),s.updated_at,s.id,revision).run();if(r.meta.changes!==1)reject(409,'This attempt changed in another tab. Reload before submitting again.');}
}
export function service(course,store){
 async function request(path,method,payload,identity,now=new Date().toISOString()){
  const teacher=identity.role==='teacher',email=identity.email;
  if(path==='/api/me')return{email,role:identity.role,progress_origin:'Online records are separate from the earlier Mac records.'};
  if(path==='/api/catalogue')return{...Object.fromEntries(['course_title','course_subtitle','level_labels','adaptive_rules','page_design'].map(k=>[k,course[k]])),topics:course.topics.map(t=>Object.fromEntries(Object.entries(t).filter(([k])=>k!=='question_sets')))};
  if(path==='/api/session/start'&&method==='POST'){
   const topic=course.topics.find(t=>t.id===payload.topic_id),level=payload.level??'medium',page=pageFor(course,topic,level,payload.page_id);
   if(!topic?.enabled)reject(400,'This topic is not yet available.');if(!LEVELS.includes(level)||!page)reject(400,'This course page is not available.');
   const s={id:crypto.randomUUID(),owner:email,student_name:teacher?'Teacher preview':'Benjamin',topic_id:topic.id,active_level:level,page_id:page.id,started_at:now,updated_at:now,rounds:{},help:[],attempts:{}};await store.insert(s);return{session_id:s.id,active_level:level,page_id:page.id};
  }
  if(path==='/api/map-progress'||path==='/api/instructor/summary'){
   if(path.includes('instructor')&&!teacher&&identity.mode!=='public')reject(403,'Teacher access required.');
   const records=(await store.list(teacher?null:email)).map(x=>x.state);
   if(path.includes('instructor'))return{sessions:records.slice(0,100).map(s=>{const{page}=questionsFor(course,s);return{session_id:s.id,student_name:s.student_name,topic_id:s.topic_id,active_level:s.active_level,page_id:page?.id,page_title:page?.title||'Legacy course page',updated_at:s.updated_at,active_summary:summary(course,s),levels:Object.fromEntries(LEVELS.map(l=>[l,summary(course,s,l)]))};})};
   const pages={};for(const t of course.topics)for(const l of LEVELS)for(const p of t.course_pages?.[l]||[]){
    const candidates=records.filter(s=>s.topic_id===t.id&&s.active_level===l&&s.page_id===p.id&&s.student_name==='Benjamin').map(s=>{const x=summary(course,s,l);return{...x,session_id:s.id,updated_at:s.updated_at,_rank:[Number(x.complete),x.submitted_at||s.updated_at,s.started_at]};});
    candidates.sort((a,b)=>{for(let i=0;i<3;i++){if(a._rank[i]!==b._rank[i])return a._rank[i]<b._rank[i]?1:-1;}return 0;});
    if(candidates.length){const{_rank,...x}=candidates[0];pages[p.id]=x;}else pages[p.id]={total:p.question_ids.length,mastered:0,first_pass_fraction:0,final_fraction:0,elapsed_seconds:0,rounds:0,hints_used:0,complete:false,session_id:null,updated_at:null};
   }return{pages,selection:'Latest submitted attempt per page; latest open attempt if none submitted.'};
  }
  const match=/^\/api\/session\/([a-f0-9-]{36})\/(page|help|page-submit|progress|next|answer|branch)$/.exec(path);if(!match)reject(404,'Route not found');
  const row=await store.get(match[1]);if(!row||(!teacher&&row.state.owner!==email))reject(404,'Session not found');
  const s=row.state,action=match[2],{topic,page,questions}=questionsFor(course,s),level=s.active_level,rows=s.rounds[level]||[];
  if(method==='GET'&&action==='page')return{topic:{id:topic.id,title:topic.title},level,started_at:s.started_at,level_label:course.level_labels[level],course_page:page,target_minutes:page?.target_minutes??course.page_design.target_minutes,questions:questions.map(q=>publicQuestion(q,!(page?.assessment_mode==='independent_transfer'&&!rows.length))),mastered_question_ids:mastered(s,level).sort(),summary:summary(course,s),latest_results:rows.at(-1)?.results||{}};
  if(method==='POST'&&action==='help'){
   const entries=helpEntries(payload.entries??[],new Set(questions.map(q=>q.id)));if(entries.length&&page?.assessment_mode==='independent_transfer'&&!rows.length)reject(409,'Site help is unavailable before the first test submission.');
   for(const t of entries){const[k,...id]=t.split(':');const q=id.join(':');if(!s.help.some(e=>e.level===level&&e.kind===k&&e.question_id===q))s.help.push({level,kind:k,question_id:q,before_round:rows.length+1,created_at:now});}s.updated_at=now;await store.save(s,row.revision);return{saved:true};
  }
  if(method==='POST'&&action==='page-submit'){const result=submitPage(course,s,payload,now);await store.save(s,row.revision);return result;}
  // Legacy question-by-question endpoints remain available for compatible clients.
  const score=l=>{const qs=questionsFor(course,s,l).questions,attempts=Object.values(s.attempts).filter(a=>a.level===l),earned=attempts.reduce((x,a)=>x+a.grade.score,0),total=topic.question_sets?.[l]?.length||0;return{answered:attempts.length,total,earned:round(earned),fraction:total?round(earned/total):0};};
  if(method==='GET'&&action==='progress')return{student_name:s.student_name,topic_id:s.topic_id,active_level:level,levels:Object.fromEntries(LEVELS.map(l=>[l,score(l)]))};
  if(method==='GET'&&action==='next'){const index=questions.findIndex(q=>!s.attempts[q.id]);return index>=0?{complete:false,topic:{id:topic.id,title:topic.title},level,level_label:course.level_labels[level],position:index+1,total:questions.length,question:publicQuestion(questions[index],!(page?.assessment_mode==='independent_transfer'&&!rows.length))}:{complete:true,topic:{id:topic.id,title:topic.title},level,level_label:course.level_labels[level],result:score(level),course_complete:level!=='medium'};}
  if(method==='POST'&&action==='answer'){if(page?.assessment_mode==='independent_transfer'&&!rows.length)reject(409,'Submit the full test page before using question-by-question review.');const q=questions.find(q=>q.id===payload.question_id);if(!q)reject(409,'Question is not in the active course page');if(s.attempts[q.id])reject(409,'This question has already been submitted');const g=grade(q,payload.answer??'');s.attempts[q.id]={level,answer:payload.answer??'',grade:g,elapsed:Math.max(0,Math.min(Number(payload.elapsed_seconds)||0,7200)),used_hint:!!payload.used_hint,created_at:now};s.updated_at=now;await store.save(s,row.revision);return g;}
  if(method==='POST'&&action==='branch'){if(!LEVELS.includes(payload.level))reject(400,'Choose Foundation, Core, Stretch or Sample Test');const core=summary(course,s,'medium'),old=score('medium');if(!core.complete&&old.answered<old.total)reject(409,'Complete the Medium Diagnostic page first');s.active_level=payload.level;s.page_id=pageFor(course,topic,payload.level)?.id??null;s.updated_at=now;await store.save(s,row.revision);return{active_level:payload.level};}
  reject(405,'Method not allowed');
 }
 return{request};
}
