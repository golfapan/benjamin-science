"use strict";
// Reading structure only. Opening a lesson never changes a learning record.
function conceptEscape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function renderConceptReference(card,index,topicId){
  let background=(card.background||[]).map(p=>`<p>${p}</p>`).join('');
  if(topicId==='topic-10'&&index===1){
    background=`<div class="application-story"><h5>1. A wave meets a boundary</h5><p>A boundary is where the medium or its constraint changes. Reflection sends a disturbance back; transmission sends one into the next region. A fixed rope end must have zero displacement, so incident and reflected displacements cancel there: the reflected pulse is inverted. An ideal free end reflects without displacement inversion.</p><h5>2. Two waves occupy the same place</h5><p>Overlap means both disturbances are present at one position at one instant. Choose a positive direction and add the signed displacements. A positive displacement is above equilibrium and a negative displacement is below it. Equilibrium is the undisturbed position.</p><h5>3. A stable interference pattern forms</h5><p>Phase describes position within a repeating cycle; one whole cycle is 360 degrees or 2π radians. Coherent sources keep a stable phase relationship. For sources emitted in phase, equal path lengths or differences of whole wavelengths arrive in phase. A half-wavelength extra path reverses that relationship; equal arriving amplitudes can cancel. An initial source phase difference must also be included. The path difference Δx is a length, not a phase angle.</p><h5>4. A wave spreads around an edge</h5><p>Diffraction is spreading at an edge or opening. It becomes prominent when the opening is comparable with the wavelength. This is distinct from reflection back at a boundary or temporary superposition at one location.</p></div>`;
  }
  const example=(e,label)=>`<details class="reference-example"><summary>${label}: ${e.title}</summary>${renderQuestionBrief(e,'problem','problem')}<details class="reference-working"><summary>Show the worked explanation</summary><ol>${e.steps.map(s=>`<li>${s}</li>`).join('')}</ol><p><strong>Answer:</strong> ${e.answer}</p></details></details>`;
  return `<details class="concept-reference" id="reference-${topicId}-${index}"><summary><span class="reference-number">${String(index+1).padStart(2,'0')}</span><strong>${card.title}</strong><span class="disclosure-label">Read this application</span></summary><div class="concept-reference-body">${background}${card.terms?.length?`<dl class="term-list">${card.terms.map(i=>`<div><dt>${i.term}</dt><dd>${i.definition}</dd></div>`).join('')}</dl>`:''}<div class="formula-list">${card.formulas.map(f=>`<div class="formula-row"><div class="formula-expression" aria-label="${conceptEscape(f.expression)}">${renderFormula(f)}</div><div class="formula-copy"><p>${f.meaning}</p>${f.application?`<p><strong>Use when:</strong> ${f.application}</p>`:''}${f.symbols?.length?`<ul class="formula-symbols">${f.symbols.map(s=>`<li>${s}</li>`).join('')}</ul>`:''}</div></div>`).join('')}</div>${card.figures?.length?`<div class="concept-figures">${card.figures.map(renderTeachingFigure).join('')}</div>`:''}${card.logic?.length?`<div class="reference-logic">${card.logic.map(i=>`<p><strong>${i.trigger}</strong> ${i.steps.join(' → ')}</p>`).join('')}</div>`:''}${card.simple?example(card.simple,'First check'):''}${card.challenge?example(card.challenge,'Combined application'):''}<p class="common-trap"><strong>Watch:</strong> ${card.watch}</p></div></details>`;
}

function renderLayeredLesson(topic){
  const lesson=topic.lesson,map=lesson.learning_map,cards=lesson.formula_cards;
  const host=document.getElementById('topic-lesson');host.classList.remove('hidden');host.classList.add('layered-host');
  const bands=['APPLY THE BASICS','COMBINE IDEAS','EXTEND THE MODEL'];
  const basicId=i=>`basic-${topic.id}-${i}`;
  host.innerHTML=`<div class="layered-lesson"><header class="learning-map-heading"><p class="eyebrow">CONCEPT GUIDE · A PATH THROUGH THE IDEAS</p><h2>${conceptEscape(topic.title)}</h2><p class="central-idea">${conceptEscape(map.big_idea)}</p><p class="reading-instruction">Read the basic steps in order. Open an application when a question first needs it. The question supplies any specialised assumptions.</p></header>
  <nav class="concept-local-nav" aria-label="Concept guide sections"><a href="#basics-${topic.id}">Basic model</a><a href="#applications-${topic.id}">Application map</a><a href="#reference-guide-${topic.id}">Symbols and reference</a><a href="#course-options">Practice pages ↓</a></nav>
  <ol class="knowledge-chain" aria-label="Reasoning sequence">${map.chain.map((s,i)=>`<li><span>${i+1}</span>${conceptEscape(s)}</li>`).join('')}</ol>
  <section class="basic-model" id="basics-${topic.id}"><div class="layer-heading"><div><p class="eyebrow">1 · BASIC MODEL</p><h3>Understand what is happening first</h3></div><button class="secondary-button basic-toggle" type="button" aria-expanded="false">Open all basic steps</button></div>
  <div class="basic-steps">${map.basics.map((b,i)=>{
    const formulas=b.formula?[b.formula]:b.formula_refs.map(([c,f])=>cards[c].formulas[f]);
    return `<details class="basic-step" id="${basicId(i)}" ${i===0?'open':''}><summary><span class="step-index">${i+1}</span><strong>${conceptEscape(b.title)}</strong><span class="disclosure-label">Basic idea</span></summary><div class="basic-step-body"><p>${conceptEscape(b.story)}</p>${formulas.length?`<div class="basic-equations">${formulas.map(f=>`<div class="basic-equation" aria-label="${conceptEscape(f.expression)}">${renderFormula(f)}</div>`).join('')}</div>`:''}${b.formula?.meaning?`<p class="local-symbols">${conceptEscape(b.formula.meaning)}</p>`:""}${b.symbols?`<p class="local-symbols"><strong>${formulas.length?"Symbols and units.":"Key terms."}</strong> ${conceptEscape(b.symbols)}</p>`:''}<p class="basic-why"><strong>Why this matters.</strong> ${conceptEscape(b.why)}</p>${b.figure?`<figure class="basic-figure"><a href="${b.figure}" target="_blank" rel="noopener"><img src="${b.figure}" alt="${i===1&&topic.id==='topic-10'?'A position snapshot gives wavelength; a time trace at one point gives period.':'Two signed pulse displacements add at the same point and time.'}" loading="lazy"></a></figure>`:''}</div></details>`;
  }).join('')}</div><p class="retrieval-check"><strong>Before practice:</strong> ${conceptEscape(map.checkpoint)}</p></section>
  <section class="application-map" id="applications-${topic.id}"><div class="layer-heading"><div><p class="eyebrow">2 · APPLICATION MAP</p><h3>Build outward from the same basic ideas</h3></div></div><p class="layer-description">The branches below add a situation or constraint. Read the branch you need; return to the basic model if its reasoning is unclear.</p><div class="application-tree">${map.routes.map((r,i)=>`<details class="application-branch branch-${i}"><summary><span class="branch-band">${bands[i]}</span><strong>${conceptEscape(r.title)}</strong><span class="branch-cue">${conceptEscape(r.cue)}</span></summary><div class="branch-content"><p class="branch-connection"><strong>Connection:</strong> ${conceptEscape(r.connection)}</p>${r.cards.map(j=>renderConceptReference(cards[j],j,topic.id)).join('')}${!r.cards.length?'<p class="special-case-note">Use the information supplied with the first question that introduces this situation.</p>':''}</div></details>`).join('')}</div></section>
  <details class="concept-reference-guide" id="reference-guide-${topic.id}"><summary><span class="branch-band">3 · LOOK UP WHEN NEEDED</span><strong>Full symbol guide and problem-solving checks</strong></summary><div class="reference-guide-body"><p>Symbols below include later applications. Read each definition in its local context; the same letter can represent different quantities.</p>${lesson.symbol_groups?.length?`<div class="symbol-group-grid">${lesson.symbol_groups.map(g=>`<article class="symbol-group"><h4>${g.title}</h4><div class="symbol-list">${g.items.map(x=>`<div class="symbol-item"><div class="symbol-mark">${renderFormula(x)}</div><div><strong>${x.name}</strong><p>${x.meaning}</p><span>Unit: ${x.unit}</span></div></div>`).join('')}</div></article>`).join('')}</div>`:''}<p><strong>Prerequisites:</strong> ${lesson.prerequisites.join(' · ')}</p><p><strong>Topic goal:</strong> ${lesson.goal}</p>${lesson.model_routine?`<h4>${lesson.model_routine.title}</h4><ol>${lesson.model_routine.steps.map(s=>`<li>${s}</li>`).join('')}</ol>`:''}${lesson.mastery_targets?.length?`<h4>Check your understanding</h4><ul>${lesson.mastery_targets.map(x=>`<li><strong>${x.title}:</strong> ${x.body}</li>`).join('')}</ul>`:''}</div></details></div>`;
  const toggle=host.querySelector('.basic-toggle');
  const basics=[...host.querySelectorAll('.basic-step')];
  const sync=()=>{const all=basics.every(d=>d.open);toggle.textContent=all?'Close basic steps':'Open all basic steps';toggle.setAttribute('aria-expanded',String(all));};
  toggle.addEventListener('click',()=>{const open=!basics.every(d=>d.open);basics.forEach(d=>d.open=open);sync();});
  basics.forEach(d=>d.addEventListener('toggle',sync));sync();
  if(!host.dataset.conceptFitBound){
    host.addEventListener('toggle',()=>scheduleConceptFit(host),true);
    window.addEventListener('resize',()=>scheduleConceptFit(host));
    host.dataset.conceptFitBound='true';
  }
  scheduleConceptFit(host);
}

let conceptFitPending=false;
function scheduleConceptFit(host){
  if(conceptFitPending)return;conceptFitPending=true;
  requestAnimationFrame(()=>{conceptFitPending=false;fitConceptEquations(host);});
}
function fitConceptEquations(host){
  const ns='http://www.w3.org/1998/Math/MathML';
  host.querySelectorAll('.basic-equation,.formula-expression,.symbol-mark').forEach(box=>{
    const math=box.querySelector('math');
    if(!math||!box.getBoundingClientRect().width)return;
    if(math._conceptOriginal===undefined)math._conceptOriginal=math.innerHTML;
    else math.innerHTML=math._conceptOriginal;
    math.style.fontSize='1em';
    const style=getComputedStyle(box),base=parseFloat(style.fontSize);
    const available=box.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-2;
    if(available<=0)return;
    const width=()=>Math.max(math.scrollWidth,math.getBoundingClientRect().width);
    if(width()>available+1){
      const ratio=available/width();
      if(ratio<.86){
        // Reflow an equality before reducing its size. Source MathML is retained.
        let parent=math;
        if(math.children.length===1&&math.firstElementChild.localName==='mrow')parent=math.firstElementChild;
        const children=[...parent.children];
        const at=children.findIndex(x=>x.localName==='mo'&&['=','≈','∝'].includes(x.textContent));
        if(at>0){
          const table=document.createElementNS(ns,'mtable');table.setAttribute('columnalign','left');
          [children.slice(0,at),children.slice(at)].forEach(group=>{
            const row=document.createElementNS(ns,'mtr'),cell=document.createElementNS(ns,'mtd');
            group.forEach(x=>cell.append(x));row.append(cell);table.append(row);
          });
          math.replaceChildren(table);
        }
      }
      if(width()>available+1)math.style.fontSize=`${Math.max(15,Math.min(base,base*available/width()))}px`;
    }
  });
}
