/* Unscored paper evidence only: no session, Progress or database writes. */
const mathsState = new Map();

function questionBrief(item) {
  return `<div class="question-brief"><div class="question-statement"><strong>Given</strong><p>${item.given}</p></div>${item.model_mathml ? `<div class="diagnostic-model">${item.model_mathml}</div>` : ""}<div class="question-statement"><strong>Find</strong><p>${item.find}</p></div></div>`;
}

function showFirstOutcome(card, evidence) {
  const first = card.querySelector('.first-outcome');
  first.hidden = !evidence.first;
  if (!evidence.first) return;
  const values = evidence.first.answers.join(', ');
  first.textContent = `First check retained: ${values} · ${evidence.first.correct ? 'correct' : 'needs repair'}. ${evidence.first.methodOpened ? 'Method was opened before this check; record it as assisted.' : 'Method was not opened here before this check; confirm any outside help on paper.'}`;
}

function renderMathsCheck(item) {
  const card = document.createElement('article');
  card.className = 'maths-check';
  card.id = `maths-${item.id}`;
  card.innerHTML = `<h3>${item.id}. ${item.title}</h3>${questionBrief(item)}<div class="maths-inputs"></div><button type="button" class="secondary-button">Check</button><p class="feedback" role="status"></p><p class="first-outcome" hidden></p><details class="maths-method"><summary>Method · use after the first try</summary><ol class="method-steps">${item.steps.map(s => `<li>${s}</li>`).join('')}</ol><p><strong>Check:</strong> ${item.check}</p><p><strong>Targeted repair:</strong> ${item.repair}</p></details><p class="muted"><strong>Used in:</strong> ${item.where}</p>`;
  const evidence = {first: null, methodOpened: false};
  mathsState.set(item.id, evidence);
  const controls = card.querySelector('.maths-inputs');
  item.fields.forEach(field => {
    const label = document.createElement('label');
    label.textContent = `${field.name} (${field.unit})`;
    const input = document.createElement('input');
    input.type = 'number';
    input.step = 'any';
    input.setAttribute('aria-label', `${item.id} ${field.name} answer`);
    label.appendChild(input);
    controls.appendChild(label);
  });
  card.querySelector('button').addEventListener('click', () => {
    const values = [...card.querySelectorAll('input')].map(input => input.value.trim());
    const feedback = card.querySelector('.feedback');
    if (values.some(value => !value || !Number.isFinite(Number(value)))) {
      feedback.textContent = 'Enter every requested number. No check has been recorded for this incomplete response.';
      return;
    }
    const correct = values.every((value, index) => Math.abs(Number(value) - item.fields[index].answer) <= item.fields[index].tolerance);
    if (!evidence.first) evidence.first = {answers: values.slice(), correct, methodOpened: evidence.methodOpened || card.querySelector('.maths-method').open};
    feedback.textContent = correct
      ? 'Correct now. Keep the written method and unit check. Later corrections do not replace the first check below.'
      : 'Needs repair. Keep this first response, then identify the missing tool before looking at Method.';
    showFirstOutcome(card, evidence);
  });
  card.querySelector('.maths-method').addEventListener('toggle', event => {
    if (event.target.open) evidence.methodOpened = true;
  });
  document.getElementById('bridge-items').appendChild(card);
}

function renderTopicReview(item) {
  const card = document.createElement('article');
  card.className = 'topic-review-card';
  card.dataset.topicId = item.topic_id;
  card.innerHTML = `<h4>${item.topic}</h4><p><strong>Ask:</strong> ${item.prompt}</p><p><strong>Listen for:</strong> ${item.listen}</p><p><strong>Possible fresh change:</strong> ${item.change}</p><p class="muted"><strong>Related teaching:</strong> ${item.core_pages.join(' · ')}</p>`;
  document.getElementById('topic-review').appendChild(card);
}

function renderRetentionExample(item) {
  const card = document.createElement('article');
  card.className = 'retention-example';
  card.id = `review-${item.id}`;
  card.innerHTML = `<h4>${item.id}. ${item.topic}</h4><p><strong>Prerequisite:</strong> ${item.basis}</p><p><strong>What changed:</strong> ${item.change}</p>${questionBrief(item)}<details><summary>Teacher hint · record use on paper</summary><p>${item.hint}</p></details><details class="review-solution"><summary>Teacher solution · open after the first attempt</summary><ol class="method-steps">${item.steps.map(s => `<li>${s}</li>`).join('')}</ol><p class="review-final">Answer: ${item.answer} ${item.unit}</p><p><strong>Check:</strong> ${item.check}</p><p><strong>Listen for:</strong> ${item.listen}</p></details>`;
  document.getElementById('retention-examples').appendChild(card);
}

async function initialiseStudyTools() {
  const response = await fetch('/study-review.json', {cache: 'no-store'});
  if (!response.ok) throw new Error('Study support data could not load. Reload after checking the local course server.');
  const data = await response.json();
  data.maths_checks.forEach(renderMathsCheck);
  data.topic_review.forEach(renderTopicReview);
  data.retention_examples.forEach(renderRetentionExample);
  document.getElementById('bridge-items').dataset.revision = data.revision;
}

initialiseStudyTools().catch(error => {
  document.getElementById('bridge-items').textContent = error.message;
});
