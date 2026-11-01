"""Prepare a checked cloud snapshot without touching the portable course or Data."""
from pathlib import Path
import hashlib,json,sys,shutil,ast,importlib.util,sqlite3
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
SOURCE=HERE.parent/'course-site'
sys.path.insert(0,str(ROOT/'UOW code/Tools'))
from path_check import check

def prepare():
    files={HERE/'course.json':(SOURCE/'course_data/course.json').read_bytes()}
    origins={str(SOURCE/'course_data/course.json'):hashlib.sha256(files[HERE/'course.json']).hexdigest()}
    for f in (SOURCE/'static').rglob('*'):
        if f.is_file() and '__pycache__' not in f.parts:
            data=f.read_bytes();origins[str(f)]=hashlib.sha256(data).hexdigest()
            files[HERE/'public'/f.relative_to(SOURCE/'static')]=data
    index=HERE/'public/index.html';s=files[index].decode()
    s=s.replace('Use this computer or the same Wi-Fi','Learn on any of your devices')
    s=s.replace('On iPad, enter answers, submit for marking and correct missed questions. Learning progress is saved on the host computer. Course materials are read-only. Keep the host running and use the same Wi-Fi.','Enter answers, submit for marking and correct missed questions. Online progress is saved securely across your devices. Earlier work on the Mac remains separate and has not been imported.')
    s=s.replace('http://127.0.0.1:8876','/').replace('This computer','Online course').replace('Another device on the same Wi-Fi','Open on another device').replace('Finding the local address…','Loading course address…').replace("Enter this address in the other device's browser.","Open this address directly. No sign-in is needed.")
    s=s.replace('Online progress is saved securely across your devices.','Progress is saved for this browser. Use the same browser to resume your work.')
    s=s.replace('</body>','<script src="/cloud.js"></script></body>');files[index]=s.encode()
    mapping={
      'jso-2025-paper.pdf':'2025-JSOE_Years-9-and-10.pdf',
      'jso-2025-answers.pdf':'2025-JSOE_Years-9-and-10_answers.pdf',
      'jso-2024-paper.pdf':'2024-Junior-Science-Olympiad-Exam-Years-9-10.pdf',
      'jso-2024-answers.pdf':'2024-Junior-Science-Olympiad-Exam-Years-9-10-Answers.pdf'}
    for target,name in mapping.items():
        src=HERE.parent/'Reference/Existing Materials/Junior Sciense Olympiad/AUS'/name
        if not src.is_file():raise FileNotFoundError(src)
        data=src.read_bytes();origins[str(src)]=hashlib.sha256(data).hexdigest();files[HERE/'public/resources'/target]=data
    # Golden comparisons use the original Python grader and an in-memory database.
    sys.path.insert(0,str(SOURCE));spec=importlib.util.spec_from_file_location('ben_original',SOURCE/'server.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
    grading=[]
    for t in mod.COURSE['topics']:
        for level,qs in t.get('question_sets',{}).items():
            for q in qs:
                answers=[q.get('answer',''),'',None]
                if q['type']=='short_text':answers += [' '.join(g[0] for g in q.get('keyword_groups',[]))]
                elif q['type']=='numeric':answers += [str(q['answer'])+'xyz',str(float(q['answer'])+100)]
                for a in answers:grading.append({'q':q,'answer':a,'grade':mod.grade_question(q,a)})
    conn=sqlite3.connect(':memory:');conn.row_factory=sqlite3.Row
    tree=ast.parse((SOURCE/'server.py').read_text());init=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='initialise_database');sql=next(n.args[0].value for n in ast.walk(init) if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and n.func.attr=='executescript');conn.executescript(sql)
    samples=[]
    for i,t in enumerate(mod.COURSE['topics']):
        for level,pages in t.get('course_pages',{}).items():
            if not pages:continue
            page=pages[0];sid=f'golden-{i}-{level}';now='2026-11-02T00:00:00Z';conn.execute('INSERT INTO sessions VALUES(?,?,?,?,?,?,?)',(sid,'Benjamin',t['id'],level,page['id'],now,now));_,qs=mod.questions_for_page(t,level,page['id'])
            state={'id':sid,'owner':'learner@example.test','student_name':'Benjamin','topic_id':t['id'],'active_level':level,'page_id':page['id'],'started_at':now,'updated_at':now,'rounds':{},'help':[],'attempts':{}}
            samples.append({'state':json.loads(json.dumps(state)),'level':level,'summary':mod.page_summary(conn,sid,level)})
            results={q['id']:mod.grade_question(q,q.get('answer','')) for q in qs};answers={q['id']:q.get('answer','') for q in qs};help=['tracking:v2'];elapsed=120
            conn.execute('INSERT INTO page_rounds(session_id,topic_id,level,round_number,answers_json,results_json,elapsed_seconds,used_hints_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)',(sid,t['id'],level,1,json.dumps(answers),json.dumps(results),elapsed,json.dumps(help),now))
            state['rounds'][level]=[{'round':1,'answers':answers,'results':results,'elapsed':elapsed,'help':help,'created_at':now}]
            summary=mod.page_summary(conn,sid,level);samples.append({'state':state,'level':level,'summary':summary,'recommendation':mod.layer_performance_note(level,summary)})
    files[HERE/'golden.json']=json.dumps({'grading':grading,'summaries':samples},ensure_ascii=False).encode()
    for dest in [*files,HERE/'source.json']:
        r=check(dest,ROOT,'file');assert r['ok'],r
    for src,h in origins.items():assert hashlib.sha256(Path(src).read_bytes()).hexdigest()==h,'Source changed during build: '+src
    for dest,data in files.items():dest.parent.mkdir(exist_ok=True,parents=True);dest.write_bytes(data);assert dest.read_bytes()==data
    manifest={'date':'2026-11-02','status':'prepared_not_deployed','sources':origins,'generated':{str(p.relative_to(HERE)):hashlib.sha256(d).hexdigest() for p,d in files.items()},'learning_records_included':False,'grading_cases':len(grading),'summary_cases':len(samples)}
    (HERE/'source.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'files':len(files),'grading_cases':len(grading),'summary_cases':len(samples),'live_data_accessed':False}))
if __name__=='__main__':prepare()
