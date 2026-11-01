const state = {
  catalogue: null,
  progress: { pages: {} },
  sessionId: localStorage.getItem("benScienceSessionId") || null,
  currentPage: null,
  selectedTopicId: null,
  selectedLevel: null,
  pageStartedAt: Number(localStorage.getItem("benSciencePageStartedAt")) || null,
  usedHints: new Set(),
  timer: null,
  helpSave: Promise.resolve(),
};

const views = ["home", "course", "instructor"];

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed");
  return payload;
}

function showView(name) {
  views.forEach((view) => document.getElementById(`${view}-view`).classList.toggle("active", view === name));
  document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
  if (name === "instructor" && state.catalogue) loadTeacher();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function levelShortLabel(level) {
  if (level === "test") return "Sample Test";
  return level === "hard" ? "Stretch" : level === "medium" ? "Core" : "Foundation";
}

function levelDescription(level) {
  if (level === "test") return "A cumulative, timed check using integrated competition-style reasoning.";
  if (level === "hard") return "Coupled models, hidden constraints and unfamiliar Olympiad transfer.";
  if (level === "medium") return "Junior Science Olympiad and IPC reasoning after the Foundation route is secure.";
  return "Targeted consolidation that still requires linked competition reasoning.";
}

function recommendedRoute() {
  for (const level of ["easy", "medium", "hard", "test"]) {
    for (const topic of state.catalogue.topics) {
      if (!topic.enabled) continue;
      for (const page of topic.course_pages?.[level] || []) {
        if (!state.progress.pages[page.id]?.complete) {
          return { topicId: topic.id, topicTitle: topic.title, level, page };
        }
      }
    }
  }
  return null;
}

function renderMap() {
  document.getElementById("topic-count").textContent = state.catalogue.topics.filter((t) => t.enabled).length;
  const map = document.getElementById("knowledge-map");
  map.innerHTML = "";
  const nextRoute = recommendedRoute();
  state.catalogue.topics.forEach((topic) => {
    ["test", "hard", "medium", "easy"].forEach((level) => {
      const pages = topic.course_pages?.[level] || [];
      const active = Boolean(topic.enabled && pages.length);
      const exemption = topic.level_exemptions?.[level];
      const completed = pages.filter((page) => state.progress.pages[page.id]?.complete).length;
      const started = pages.some((page) => (state.progress.pages[page.id]?.rounds || 0) > 0);
      const recommended = nextRoute?.topicId === topic.id && nextRoute?.level === level;
      const node = document.createElement("button");
      node.type = "button";
      node.disabled = !active;
      node.className = `map-cell ${level} ${active ? "available" : exemption ? "exempt" : "planned"}${active && completed === pages.length ? " complete" : ""}${started && completed < pages.length ? " started" : ""}${recommended ? " recommended" : ""}`;
      const icon = exemption ? "✓" : completed === pages.length && pages.length ? "✓" : recommended ? "★" : started ? "↻" : active ? "→" : "·";
      const pageWord = pages.length === 1 ? "page" : "pages";
      const progressText = active ? `${completed}/${pages.length} ${pageWord} complete` : exemption || "Planned";
      node.innerHTML = `<span class="map-state-icon">${icon}</span><strong>${levelShortLabel(level)}</strong><small>${recommended ? "Recommended next · " : ""}${progressText}</small>`;
      node.title = active
        ? `${topic.title} — ${state.catalogue.level_labels[level]}: ${completed}/${pages.length} course pages complete`
        : exemption ? `${topic.title}: ${exemption}` : `${topic.title}: planned`;
      if (active) node.addEventListener("click", () => openCourseCell(topic.id, level));
      map.appendChild(node);
    });
    const label = document.createElement("div");
    label.className = "map-topic";
    label.innerHTML = `<small>${String(topic.week).startsWith("B") ? "Extension " : "Week "}${topic.week}</small>${topic.short_title}`;
    label.title = `${topic.title}\n${topic.knowledge_points.join(" • ")}`;
    map.appendChild(label);
  });
}

function renderFormula(formula) {
  return formula.mathml || `<span>${formula.expression}</span>`;
}

function displayFind(text) {
  return String(text || "").replace(/^find\s*:?[\s]*/i, "");
}

function renderQuestionBrief(item, sourceKey, taskKey) {
  const hasStructuredBrief = Boolean(item.given || item.find);
  const given = item.given || "";
  const find = displayFind(item.find || item[taskKey] || "");
  if (!hasStructuredBrief) {
    return `<div class="question-brief"><div class="question-statement"><strong>Question</strong><p>${item[sourceKey] || item[taskKey] || ""}</p></div></div>`;
  }
  return `<div class="question-brief">
    ${given ? `<div class="question-statement"><strong>Given</strong><p>${given}</p></div>` : ""}
    <div class="question-statement"><strong>Find</strong><p>${find}</p></div>
  </div>`;
}

// Keep diagrams at a readable printed-note scale instead of stretching to the card.
function renderTeachingFigure(figure) {
  const source = figure.src || "";
  let size = "standard";
  if (/boyle-law-.*\.svg$/.test(source)) size = "wide";
  else if (/boyle-law-apparatus\.png$/.test(source)) size = "apparatus";
  else if (/atoms-.*-r4\.svg$/.test(source) || /-r5\.svg$/.test(source)) size = "compact";
  return `<figure class="teaching-figure teaching-figure--${size}"><a class="teaching-image-link" href="${figure.src}" target="_blank" rel="noopener" aria-label="Open larger diagram: ${figure.title}"><img src="${figure.src}" alt="${figure.alt}"></a><figcaption><strong>${figure.title}</strong>${figure.caption}<span class="figure-enlarge-note">Click image to enlarge.</span></figcaption></figure>`;
}

function renderApplicationBrief(brief) {
  if (!brief) return "";
  const formulas = [...(brief.formulas || (brief.formula ? [brief.formula] : []))];
  if (!formulas.length && brief.formula) formulas.push(brief.formula);
  return `<section class="application-brief">
    <div class="application-brief-heading"><p class="eyebrow">APPLICATION INFORMATION</p><h3>${brief.title}</h3><p>${brief.background}</p></div>
    ${formulas.map((formula) => `<div class="application-formula"><div aria-label="${formula.expression}">${renderFormula(formula)}</div>${formula.meaning ? `<p>${formula.meaning}</p>` : ""}</div>`).join("")}
    ${brief.figures?.length ? `<div class="application-figures">${brief.figures.map((figure) => `${renderTeachingFigure(figure)}`).join("")}</div>` : ""}
    <div class="application-information-grid">
      ${brief.conditions?.length ? `<div><strong>Conditions</strong><ul>${brief.conditions.map((condition) => `<li>${condition}</li>`).join("")}</ul></div>` : ""}
      ${brief.variables?.length ? `<div><strong>Variables</strong><dl>${brief.variables.map((variable) => `<div><dt>${variable.symbol}</dt><dd>${variable.meaning}${variable.unit ? ` <span>Unit: ${variable.unit}</span>` : ""}</dd></div>`).join("")}</dl></div>` : ""}
    </div>
  </section>`;
}

function renderPageKnowledge(page) {
  const host = document.getElementById("page-knowledge");
  const brief = page?.knowledge_brief;
  if (!brief?.items?.length) {
    host.innerHTML = "";
    host.classList.add("hidden");
    return;
  }
  host.classList.remove("hidden");
  host.innerHTML = `
    <div class="page-knowledge-heading">
      <p class="eyebrow">${brief.label || "NEW KNOWLEDGE FOR THIS PAGE"}</p>
      <h3>${brief.title}</h3>
      <p>${brief.introduction}</p>
    </div>
    ${brief.previous?.length ? `<div class="previous-knowledge"><strong>Already introduced</strong><span>${brief.previous.join(" · ")}</span></div>` : ""}
    <div class="page-knowledge-items">${brief.items.map((item) => `
      <article class="page-knowledge-item">
        <div class="page-knowledge-item-heading"><span>${item.first_question || "Use on this page"}</span><h4>${item.title}</h4><p>${item.background}</p></div>
        ${(item.formulas?.length || item.formula) ? `<div class="page-formula-list">${(item.formulas || [item.formula]).map((formula) => `<div class="application-formula"><div aria-label="${formula.expression}">${renderFormula(formula)}</div><p>${formula.meaning}</p></div>`).join("")}</div>` : ""}
        ${item.figures?.length ? `<div class="application-figures">${item.figures.map((figure) => `${renderTeachingFigure(figure)}`).join("")}</div>` : ""}
        ${(item.conditions?.length || item.variables?.length) ? `<div class="application-information-grid">
          ${item.conditions?.length ? `<div><strong>Conditions</strong><ul>${item.conditions.map((condition) => `<li>${condition}</li>`).join("")}</ul></div>` : ""}
          ${item.variables?.length ? `<div><strong>Variables</strong><dl>${item.variables.map((variable) => `<div><dt>${variable.symbol}</dt><dd>${variable.meaning}${variable.unit ? ` <span>Unit: ${variable.unit}</span>` : ""}</dd></div>`).join("")}</dl></div>` : ""}
        </div>` : ""}
      </article>`).join("")}</div>`;
}

function renderLesson(topic) {
  const host = document.getElementById("topic-lesson");
  if (!topic?.lesson) {
    host.classList.add("hidden");
    return;
  }
  if (topic.lesson.learning_map && typeof renderLayeredLesson === "function") {
    renderLayeredLesson(topic);
    return;
  }
  const lesson = topic.lesson;
  const workedExamples = lesson.worked_examples || (lesson.worked_example ? [lesson.worked_example] : []);
  const formulaCards = lesson.formula_cards || [];
  const keyEquations = lesson.key_equations || [];
  const masteryTargets = lesson.mastery_targets || [];
  const introduction = lesson.introduction || [];
  const symbolGroups = lesson.symbol_groups || [];
  const conceptContent = formulaCards.length ? `
    ${introduction.length ? `<section class="concept-introduction">
      <div class="concept-section-title"><p class="eyebrow">START HERE</p><h3>${lesson.introduction_heading || "The physical story before the formulas"}</h3></div>
      <div class="concept-intro-grid">${introduction.map((item) => `
        <article><h4>${item.title}</h4><p>${item.body}</p></article>`).join("")}</div>
    </section>` : ""}
    ${symbolGroups.length ? `<section class="symbol-guide">
      <div class="concept-section-title"><p class="eyebrow">SYMBOL AND UNIT GUIDE</p><h3>${lesson.symbol_heading || "Read every symbol before using an equation"}</h3></div>
      <div class="symbol-group-grid">${symbolGroups.map((group) => `
        <article class="symbol-group"><h4>${group.title}</h4><div class="symbol-list">${group.items.map((item) => `
          <div class="symbol-item">
            <div class="symbol-mark" aria-label="${item.expression}">${renderFormula(item)}</div>
            <div><strong>${item.name}</strong><p>${item.meaning}</p><span>Unit: ${item.unit}</span></div>
          </div>`).join("")}</div></article>`).join("")}</div>
    </section>` : ""}
    ${keyEquations.length ? `<section class="equation-dashboard">
      <div class="concept-section-title"><p class="eyebrow">CORE FORMULAS</p><h3>Find the model first, then choose the equation</h3></div>
      <div class="key-equation-grid">${keyEquations.map((formula) => `
        <article class="key-equation">
          <p>${formula.label}</p>
          <div class="key-equation-math" aria-label="${formula.expression}">${renderFormula(formula)}</div>
          <span>${formula.application}</span>
        </article>`).join("")}</div>
    </section>` : ""}
    ${masteryTargets.length ? `<section class="mastery-panel">
      <div class="concept-section-title"><p class="eyebrow">WHAT YOU NEED TO KNOW</p><h3>${lesson.mastery_heading || "Core knowledge for this topic"}</h3></div>
      <div class="mastery-grid">${masteryTargets.map((target) => `
        <article><span aria-hidden="true"></span><div><strong>${target.title}</strong><p>${target.body}</p></div></article>`).join("")}</div>
    </section>` : ""}
    <div class="formula-card-grid">${formulaCards.map((card, index) => `
      <article class="formula-card">
        <div class="formula-card-heading"><span>${String(index + 1).padStart(2, "0")}</span><div><p>${card.focus}</p><h3>${card.title}</h3></div></div>
        ${card.background?.length ? `<div class="formula-background">${card.background.map((paragraph) => `<p>${paragraph}</p>`).join("")}</div>` : ""}
        ${card.terms?.length ? `<dl class="term-list">${card.terms.map((item) => `<div><dt>${item.term}</dt><dd>${item.definition}</dd></div>`).join("")}</dl>` : ""}
        <div class="formula-list">${card.formulas.map((formula) => `
          <div class="formula-row">
            <div class="formula-expression" aria-label="${formula.expression}">${renderFormula(formula)}</div>
            <div class="formula-copy"><p>${formula.meaning}</p>${formula.application ? `<span><strong>Use it when:</strong> ${formula.application}</span>` : ""}${formula.symbols?.length ? `<ul class="formula-symbols">${formula.symbols.map((symbol) => `<li>${symbol}</li>`).join("")}</ul>` : ""}</div>
          </div>`).join("")}</div>
        ${card.figures?.length ? `<div class="concept-figures">${card.figures.map((figure) => `${renderTeachingFigure(figure)}`).join("")}</div>` : ""}
        ${card.logic?.length ? `<div class="logic-grid">${card.logic.map((item) => `
          <div class="logic-chain"><strong>${item.trigger}</strong><div class="logic-steps">${item.steps.map((step) => `<span>${step}</span>`).join("")}</div></div>`).join("")}</div>` : ""}
        <div class="example-pair">
          <section class="example-step simple-example"><p class="example-label">FIRST CHECK</p><h4>${card.simple.title}</h4>${renderQuestionBrief(card.simple, "problem", "problem")}<div class="example-solution"><strong>Solution</strong><ol>${card.simple.steps.map((step) => `<li>${step}</li>`).join("")}</ol><p class="example-result"><strong>Answer</strong><span>${card.simple.answer}</span></p></div></section>
          <section class="example-step challenge-example"><p class="example-label">TYPICAL CHALLENGE</p><h4>${card.challenge.title}</h4>${renderQuestionBrief(card.challenge, "problem", "problem")}<div class="example-solution"><strong>Solution</strong><ol>${card.challenge.steps.map((step) => `<li>${step}</li>`).join("")}</ol><p class="example-result"><strong>Answer</strong><span>${card.challenge.answer}</span></p></div></section>
        </div>
        <p class="common-trap"><strong>Watch:</strong> ${card.watch}</p>
      </article>`).join("")}</div>
    ${lesson.model_routine ? `<aside class="model-routine"><p class="eyebrow">MODEL SELECTION ROUTINE</p><h3>${lesson.model_routine.title}</h3><ol>${lesson.model_routine.steps.map((step) => `<li>${step}</li>`).join("")}</ol></aside>` : ""}` : `
    <div class="lesson-grid">${lesson.sections.map((section) => `<section><h3>${section.heading}</h3><p>${section.body}</p></section>`).join("")}</div>
    <div class="worked-example-list">${workedExamples.map((example, index) => `
      <section class="worked-example">
        <p class="eyebrow">WORKED EXAMPLE ${workedExamples.length > 1 ? index + 1 : ""}</p><h3>${example.title}</h3>
        <p>${example.problem}</p>
        <ol>${example.steps.map((step) => `<li>${step}</li>`).join("")}</ol>
        <p class="worked-answer"><strong>Result:</strong> ${example.answer}</p>
      </section>`).join("")}</div>`;
  host.classList.remove("hidden");
  host.innerHTML = `
    <div class="lesson-heading">
      <div><p class="eyebrow">CONCEPT BRIEF · ABOUT ${lesson.estimated_minutes} MINUTES</p><h2>${topic.title}</h2></div>
      <div class="lesson-goal"><strong>Olympiad goal</strong><span>${lesson.goal}</span></div>
    </div>
    <div class="prerequisite-strip"><strong>Prerequisites</strong>${lesson.prerequisites.map((item) => `<span>${item}</span>`).join("")}</div>
    ${conceptContent}`;
}

function renderCoursePicker(topic, level) {
  const pages = topic.course_pages?.[level] || [];
  const nextRoute = recommendedRoute();
  document.getElementById("picker-level").textContent = state.catalogue.level_labels[level];
  document.getElementById("picker-title").textContent = topic.title;
  document.getElementById("picker-description").textContent = levelDescription(level);
  const host = document.getElementById("course-options");
  host.innerHTML = "";
  pages.forEach((page, index) => {
    const progress = state.progress.pages[page.id] || {};
    const complete = Boolean(progress.complete);
    const started = !complete && Boolean(progress.session_id);
    const recommended = nextRoute?.page?.id === page.id;
    const card = document.createElement("article");
    card.className = `course-card${complete ? " complete" : ""}${started ? " started" : ""}${recommended ? " recommended" : ""}`;
    const status = complete ? `✓ Submitted · ${progress.mastered}/${progress.total} answers correct in latest submitted attempt` : recommended ? "★ Recommended next" : started ? `↻ In progress · ${progress.mastered}/${progress.total} correct` : "Ready";
    card.innerHTML = `
      <div class="course-card-number">${index + 1}</div>
      <div class="course-card-copy"><p class="course-status">${status}</p><h3>${page.title}</h3><p>${page.description}</p>${page.coverage?.length ? `<p class="coverage-line"><strong>Knowledge coverage:</strong> ${page.coverage.join(" · ")}</p>` : ""}<small>${page.question_ids.length} questions · about ${page.target_minutes} minutes</small></div>`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = complete ? "secondary-button" : "primary-button";
    button.textContent = progress.session_id ? "Resume / review attempt" : "Start this page";
    button.addEventListener("click", () => progress.session_id ? resumeSession(progress.session_id) : startSession(topic.id, level, page.id));
    const controls = document.createElement("div");
    controls.className = "result-actions";
    controls.appendChild(button);
    if (progress.session_id) {
      const fresh = document.createElement("button");
      fresh.className = "secondary-button";
      fresh.textContent = "Start a fresh attempt";
      fresh.addEventListener("click", () => startSession(topic.id, level, page.id));
      controls.appendChild(fresh);
    }
    card.appendChild(controls);
    host.appendChild(card);
  });
}

function openCourseCell(topicId, level) {
  const topic = state.catalogue.topics.find((item) => item.id === topicId);
  if (!topic || !(topic.course_pages?.[level] || []).length) return;
  state.selectedTopicId = topicId;
  state.selectedLevel = level;
  document.getElementById("course-hub").classList.remove("hidden");
  document.getElementById("question-page").classList.add("hidden");
  document.getElementById("set-result").classList.add("hidden");
  if ((level === "easy" || (topicId === "mechanics-review" && level === "medium")) && topic.lesson?.show_in_hub !== false) {
    renderLesson(topic);
  } else {
    const lessonHost = document.getElementById("topic-lesson");
    lessonHost.innerHTML = "";
    lessonHost.classList.add("hidden");
  }
  renderCoursePicker(topic, level);
  showView("course");
}

async function refreshProgress() {
  state.progress = await api("/api/map-progress");
  renderMap();
}

async function initialise() {
  const [catalogue, network, progress] = await Promise.all([
    api("/api/catalogue"), api("/api/network"), api("/api/map-progress"),
  ]);
  state.catalogue = catalogue;
  state.progress = progress;
  document.getElementById("local-course-link").href = network.local_url;
  document.getElementById("local-course-url").textContent = network.local_url;
  document.getElementById("wifi-course-url").textContent = network.wifi_url;
  document.getElementById("copy-wifi-link").dataset.url = network.wifi_url;
  document.getElementById("course-title").textContent = "Benjamin";
  document.getElementById("course-subtitle").textContent = state.catalogue.course_subtitle || "Choose any active cell. Build knowledge horizontally or change challenge vertically.";
  renderMap();
  if (state.sessionId) {
    showView("course");
    await loadPage();
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const topicId = params.get("topic");
  const level = params.get("level");
  const topic = state.catalogue.topics.find((item) => item.id === topicId);
  if (topic && ["easy", "medium", "hard", "test"].includes(level) && (topic.course_pages?.[level] || []).length) {
    openCourseCell(topicId, level);
  } else {
    showView("home");
  }
}

async function copyWifiLink() {
  const button = document.getElementById("copy-wifi-link");
  const url = button.dataset.url;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    document.getElementById("copy-status").textContent = "Copied. Paste this link into the other device's browser.";
    button.textContent = "Copied";
  } catch (_error) {
    window.prompt("Copy the other-device link:", url);
  }
}

function resetPageClock() {
  state.pageStartedAt = Date.now();
  localStorage.setItem("benSciencePageStartedAt", String(state.pageStartedAt));
  updateClock();
}

function elapsedSeconds() {
  return state.pageStartedAt ? Math.max(0, Math.round((Date.now() - state.pageStartedAt) / 1000)) : 0;
}

function updateClock() {
  const total = elapsedSeconds();
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  document.getElementById("page-time").textContent = `${minutes}:${seconds}`;
}

function startClock() {
  clearInterval(state.timer);
  updateClock();
  state.timer = setInterval(updateClock, 1000);
}

async function startSession(topicId, level, pageId) {
  try {
    const result = await api("/api/session/start", {
      method: "POST",
      body: JSON.stringify({ topic_id: topicId, level, page_id: pageId }),
    });
    state.usedHints.clear();
    state.sessionId = result.session_id;
    localStorage.setItem("benScienceSessionId", state.sessionId);
    resetPageClock();
    document.getElementById("course-hub").classList.add("hidden");
    await loadPage();
  } catch (error) {
    alert(error.message);
  }
}

async function resumeSession(sessionId) {
  state.sessionId = sessionId;
  state.usedHints.clear();
  localStorage.setItem("benScienceSessionId", sessionId);
  document.getElementById("course-hub").classList.add("hidden");
  await loadPage();
}

function answerControl(question, locked) {
  const host = document.createElement("div");
  host.className = "answer-control";
  if (locked) {
    host.innerHTML = '<p class="mastered-message">✓ Correct — retained for this page</p>';
    return host;
  }
  if (question.type === "multiple_choice") {
    question.options.forEach((option, index) => {
      const label = document.createElement("label");
      label.className = "choice";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `answer-${question.id}`;
      input.value = String(index);
      input.required = true;
      const text = document.createElement("span");
      text.textContent = option;
      label.append(input, text);
      host.appendChild(label);
    });
  } else if (question.type === "numeric") {
    const wrap = document.createElement("div");
    wrap.className = "numeric-wrap";
    const input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.required = true;
    input.dataset.questionId = question.id;
    input.setAttribute("aria-label", `Answer for question ${question.id}`);
    const unit = document.createElement("span");
    unit.textContent = question.unit || "";
    wrap.append(input, unit);
    host.appendChild(wrap);
  } else {
    const textarea = document.createElement("textarea");
    textarea.required = true;
    textarea.dataset.questionId = question.id;
    textarea.setAttribute("aria-label", `Answer for question ${question.id}`);
    textarea.placeholder = "Explain your reasoning in complete sentences.";
    host.appendChild(textarea);
  }
  return host;
}

function updateHelpStatus(message) {
  let note = document.getElementById("help-record-status");
  if (!note) {
    note = document.createElement("p");
    note.id = "help-record-status";
    note.className = "muted";
    note.setAttribute("role", "status");
    document.querySelector(".page-instruction").after(note);
  }
  note.textContent = message;
}

function flushHelp(sessionId = state.sessionId) {
  if (!sessionId) return Promise.resolve();
  const entries = JSON.parse(localStorage.getItem(`benScienceHelp:${sessionId}`) || "[]");
  if (!entries.length) return Promise.resolve();
  const save = state.helpSave.catch(() => {}).then(() => api(`/api/session/${sessionId}/help`, {
    method: "POST", body: JSON.stringify({ entries }),
  }));
  state.helpSave = save;
  return save.then(() => {
    if (state.sessionId === sessionId) updateHelpStatus("Help accesses saved. GPT entries record requests prepared here; confirm any help received with the teacher.");
  }).catch((error) => {
    if (state.sessionId === sessionId) updateHelpStatus("Help record is waiting to save on this browser. Keep this browser data and reconnect, then reload or submit to retry.");
    throw error;
  });
}

function recordHelp(kind, questionId) {
  state.usedHints.add(`${kind}:${questionId}`);
  localStorage.setItem(`benScienceHelp:${state.sessionId}`, JSON.stringify([...state.usedHints]));
  flushHelp().catch(() => {});
}

function showHint(question, hintBox, button) {
  recordHelp("hint", question.id);
  hintBox.classList.remove("hidden");
  button.classList.add("hidden");
}

function currentAnswerFor(question) {
  if (question.type === "multiple_choice") {
    const checked = document.querySelector(`input[name="answer-${question.id}"]:checked`);
    return checked ? question.options[Number(checked.value)] : "No answer entered yet";
  }
  const control = document.querySelector(`input[data-question-id="${question.id}"], textarea[data-question-id="${question.id}"]`);
  return control?.value?.trim() || "No answer entered yet";
}

function tutorRequestText(mode, question) {
  const attempt = currentAnswerFor(question);
  const request = mode === "hint"
    ? "Give me one targeted hint only. Do not reveal the final answer. Ask me to try the next step."
    : "Give a complete step-by-step solution. Explain the model choice, equations, calculation, units and a reasonableness check.";
  const shortAttempt = attempt.length > 70 ? `${attempt.slice(0, 67)}…` : attempt;
  return `Respond in English. ${request} My current answer: ${shortAttempt}`.slice(0, 240);
}

function fallbackTutorPrompt(mode, question, data) {
  const request = mode === "hint"
    ? "Give one targeted hint only. Do not reveal the final answer. Ask me to attempt the next step."
    : "Give a complete step-by-step solution. Explain the physical model, equations, calculation, units, common trap and a final reasonableness check.";
  const options = question.options?.length ? `\nOptions:\n${question.options.map((option, index) => `${index + 1}. ${option}`).join("\n")}` : "";
  return [
    "Act as a Physics Olympiad tutor for a strong Year 9–10 student. Respond in English throughout.",
    `Course: ${data.topic.title}`,
    `Level: ${data.level_label}`,
    `Page: ${data.course_page?.title || "Course page"}`,
    `Question ID: ${question.id}`,
    question.context ? `Context: ${question.context}` : "",
    `Question: ${question.prompt}${options}`,
    `My current answer: ${currentAnswerFor(question)}`,
    `Request: ${request}`,
  ].filter(Boolean).join("\n\n");
}

function showFallbackTutorPrompt(prompt, card, status) {
  card.querySelector(".gpt-fallback-panel")?.remove();
  const panel = document.createElement("div");
  panel.className = "gpt-fallback-panel";
  const label = document.createElement("strong");
  label.textContent = "Prepared GPT prompt";
  const note = document.createElement("p");
  note.textContent = "Direct hand-off is unavailable in this browser. Copy this prompt into ChatGPT or Codex.";
  const textarea = document.createElement("textarea");
  textarea.readOnly = true;
  textarea.value = prompt;
  textarea.setAttribute("aria-label", `Prepared GPT prompt for ${card.dataset.questionId}`);
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "secondary-button";
  copy.textContent = "Copy prompt";
  copy.addEventListener("click", async () => {
    let copied = false;
    try {
      await navigator.clipboard.writeText(prompt);
      copied = true;
    } catch (_error) {
      textarea.focus();
      textarea.select();
      copied = document.execCommand("copy");
    }
    copy.textContent = copied ? "Copied" : "Select and copy the text";
  });
  panel.append(label, note, textarea, copy);
  card.appendChild(panel);
  status.textContent = "Prepared prompt shown below.";
}

function requestTutorHelp(mode, question, card, menu, status, data) {
  recordHelp(`gpt-${mode}`, question.id);
  const annotation = document.oai?.annotation;
  if (typeof annotation?.request === "function") {
    const result = annotation.request(card, {
      initialComment: tutorRequestText(mode, question),
      metadata: {
        "question_id": question.id,
        "topic": data.topic.short_title,
        "level": data.level_label,
        "page": data.course_page?.title || "Course page",
        "help_type": mode,
      },
    });
    if (result?.accepted) {
      status.textContent = "Help request ready — review it and press Send.";
    } else {
      showFallbackTutorPrompt(fallbackTutorPrompt(mode, question, data), card, status);
    }
  } else {
    showFallbackTutorPrompt(fallbackTutorPrompt(mode, question, data), card, status);
  }
  menu.classList.add("hidden");
  menu.previousElementSibling?.setAttribute("aria-expanded", "false");
}

function gptHelpControl(question, card, data) {
  const host = document.createElement("div");
  host.className = "gpt-help-control";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "gpt-help-button";
  button.textContent = "Ask GPT";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", `Ask GPT for help with question ${question.id}`);

  const menu = document.createElement("div");
  menu.className = "gpt-help-menu hidden";
  const menuLabel = document.createElement("strong");
  menuLabel.textContent = "What help do you want?";
  const hint = document.createElement("button");
  hint.type = "button";
  hint.textContent = "Hint only";
  const solution = document.createElement("button");
  solution.type = "button";
  solution.textContent = "Full solution";
  const status = document.createElement("small");
  status.className = "gpt-help-status";
  status.setAttribute("aria-live", "polite");
  menu.append(menuLabel, hint, solution);

  button.addEventListener("click", () => {
    document.querySelectorAll(".gpt-help-menu").forEach((other) => {
      if (other !== menu) other.classList.add("hidden");
    });
    const willOpen = menu.classList.contains("hidden");
    menu.classList.toggle("hidden", !willOpen);
    button.setAttribute("aria-expanded", String(willOpen));
  });
  hint.addEventListener("click", () => requestTutorHelp("hint", question, card, menu, status, data));
  solution.addEventListener("click", () => requestTutorHelp("solution", question, card, menu, status, data));
  host.append(button, menu, status);
  return host;
}

function workedSolutionControl(question) {
  const solution = question.worked_solution;
  if (!solution) return null;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "worked-solution-button";
  button.textContent = "Detailed solution";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", `Show detailed solution for ${question.id}`);

  const panel = document.createElement("section");
  panel.className = "worked-solution-panel hidden";
  panel.setAttribute("aria-label", `Detailed solution for ${question.id}`);
  panel.innerHTML = `
    <div class="worked-solution-heading">
      <div><p class="eyebrow">WORKED SOLUTION · ${question.id}</p><h4>${solution.tested_idea}</h4></div>
      <span>Offline reference</span>
    </div>
    <div class="solution-model"><strong>Model selection</strong><p>${solution.model}</p></div>
    ${solution.formulas?.length ? `<div class="solution-formulas">${solution.formulas.map((formula) => `
      <div class="solution-formula" aria-label="${formula.expression}">${renderFormula(formula)}</div>`).join("")}</div>` : ""}
    <div class="solution-working"><strong>Working</strong><ol>${solution.steps.map((step) => `<li>${step}</li>`).join("")}</ol></div>
    <div class="solution-answer"><strong>Final answer</strong><span>${solution.final_answer}</span></div>
    <div class="solution-review-grid">
      <div><strong>Check</strong><p>${solution.check}</p></div>
      <div><strong>Common error</strong><p>${solution.common_error}</p></div>
    </div>`;

  button.addEventListener("click", () => {
    const willOpen = panel.classList.contains("hidden");
    if (willOpen) recordHelp("solution", question.id);
    panel.classList.toggle("hidden", !willOpen);
    button.textContent = willOpen ? "Hide solution" : "Detailed solution";
    button.setAttribute("aria-expanded", String(willOpen));
  });
  return {button, panel};
}

function renderConceptDiscussion(items = []) {
  const section = document.getElementById("concept-discussion");
  section.innerHTML = "";
  section.classList.toggle("hidden", items.length === 0);
  if (!items.length) return;

  const heading = document.createElement("div");
  heading.className = "concept-discussion-heading";
  heading.innerHTML = `
    <p class="eyebrow">ORAL REVIEW · NOT SCORED</p>
    <h3>Concept discussion</h3>
    <p>Explain each answer aloud or discuss it with your teacher. These prompts do not affect page completion.</p>`;
  section.appendChild(heading);

  items.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "concept-discussion-card";
    const label = document.createElement("strong");
    label.textContent = `Discussion ${index + 1}`;
    const given = document.createElement("p");
    given.innerHTML = "<b>Given</b> ";
    given.append(document.createTextNode(item.given));
    const prompt = document.createElement("p");
    prompt.innerHTML = "<b>Discuss</b> ";
    prompt.append(document.createTextNode(item.prompt));
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-button discussion-points-button";
    button.textContent = "Show discussion points";
    button.setAttribute("aria-expanded", "false");
    const points = document.createElement("p");
    points.className = "discussion-points hidden";
    points.textContent = item.discussion_points;
    button.addEventListener("click", () => {
      const willOpen = points.classList.contains("hidden");
      points.classList.toggle("hidden", !willOpen);
      button.textContent = willOpen ? "Hide discussion points" : "Show discussion points";
      button.setAttribute("aria-expanded", String(willOpen));
    });
    card.append(label, given, prompt, button, points);
    section.appendChild(card);
  });
}

function renderQuestionPage(data) {
  document.getElementById("course-hub").classList.add("hidden");
  state.currentPage = data;
  const mastered = new Set(data.mastered_question_ids);
  const latest = data.latest_results || {};
  const pageTitle = data.course_page?.title || "Course page";
  document.getElementById("question-level").textContent = `${data.level_label} · ${pageTitle} · ${data.questions.length} questions`;
  document.getElementById("question-topic").textContent = data.topic.title;
  document.getElementById("page-target").textContent = `Target: ${data.target_minutes} min`;
  renderPageKnowledge(data.course_page);
  const independentFirstAttempt = data.course_page?.assessment_mode === "independent_transfer" && !data.summary.rounds;
  const instruction = document.querySelector(".page-instruction");
  instruction.textContent = independentFirstAttempt
    ? `Complete all ${data.questions.length} questions independently, without notes or AI. Write your reasoning on paper and submit the whole page once. Detailed solutions, Ask GPT and discussion points become available for correction after the first submission. Only this first unaided attempt is a benchmark.`
    : `Complete all ${data.questions.length} scored questions before submitting. Correct answers lock after submission; hints support revision of unfinished questions. Concept discussions are oral practice and are not scored. Use Detailed solution or Ask GPT for help during practice and correction.`;
  const list = document.getElementById("question-list");
  list.innerHTML = "";
  data.questions.forEach((question, index) => {
    const locked = mastered.has(question.id);
    const previous = latest[question.id];
    const card = document.createElement("section");
    card.className = `page-question-card${locked ? " mastered" : ""}${previous && !locked ? " needs-revision" : ""}`;
    card.dataset.questionId = question.id;
    card.setAttribute("oai-annotation-container", "");
    card.setAttribute("oai-annotatable", `${data.topic.short_title} ${data.level_label} question ${index + 1}`);
    const heading = document.createElement("div");
    heading.className = "question-number";
    heading.textContent = `Question ${index + 1}`;
    const toolbar = document.createElement("div");
    toolbar.className = "question-toolbar";
    const actions = document.createElement("div");
    actions.className = "question-toolbar-actions";
    const workedSolution = independentFirstAttempt ? null : workedSolutionControl(question);
    if (workedSolution) actions.appendChild(workedSolution.button);
    if (!independentFirstAttempt) actions.appendChild(gptHelpControl(question, card, data));
    toolbar.append(heading, actions);
    const brief = document.createElement("div");
    brief.className = "question-brief";
    const given = question.given || question.context || "";
    if (given) {
      const givenRow = document.createElement("div");
      givenRow.className = "question-statement";
      givenRow.innerHTML = `<strong>Given</strong><p></p>`;
      givenRow.querySelector("p").textContent = given;
      brief.appendChild(givenRow);
    }
    const findRow = document.createElement("div");
    findRow.className = "question-statement";
    findRow.innerHTML = `<strong>Find</strong><p></p>`;
    findRow.querySelector("p").textContent = displayFind(question.find || question.prompt);
    brief.appendChild(findRow);
    card.appendChild(toolbar);
    if (question.application_brief) {
      const applicationHost = document.createElement("div");
      applicationHost.innerHTML = renderApplicationBrief(question.application_brief);
      card.appendChild(applicationHost.firstElementChild);
    }
    card.append(brief, answerControl(question, locked));
    if (workedSolution) card.appendChild(workedSolution.panel);
    if (previous && !locked) {
      const feedback = document.createElement("div");
      feedback.className = "inline-feedback";
      feedback.textContent = previous.feedback;
      const hintBox = document.createElement("p");
      hintBox.className = "hint hidden";
      hintBox.textContent = question.hint || "Review the concept and try again.";
      const hintButton = document.createElement("button");
      hintButton.type = "button";
      hintButton.className = "text-button inline-hint-button";
      hintButton.textContent = "Show a hint";
      hintButton.addEventListener("click", () => showHint(question, hintBox, hintButton));
      card.append(feedback, hintButton, hintBox);
    }
    list.appendChild(card);
  });
  renderConceptDiscussion(independentFirstAttempt ? [] : (data.course_page?.concept_discussion || []));
  document.getElementById("page-progress").textContent = data.summary.rounds
    ? `${mastered.size}/${data.questions.length} correct · revision round ${data.summary.rounds + 1}`
    : data.course_page?.assessment_mode === "independent_transfer"
      ? `First unaided attempt · no notes or AI · target ${data.target_minutes} minutes`
      : `First attempt · target ${data.target_minutes} minutes`;
  document.getElementById("page-submit").textContent = data.summary.rounds ? "Submit revised answers" : "Submit page";
  document.getElementById("question-page").classList.remove("hidden");
  document.getElementById("set-result").classList.add("hidden");
  updateHelpStatus(state.usedHints.size ? "Previously recorded help is retained for this attempt." : "Site help is recorded separately from first-submission accuracy.");
  startClock();
}

async function loadPage() {
  try {
    await flushHelp().catch(() => {});
    const data = await api(`/api/session/${state.sessionId}/page`);
    state.selectedTopicId = data.topic.id;
    state.selectedLevel = data.level;
    const savedHelp = JSON.parse(localStorage.getItem(`benScienceHelp:${state.sessionId}`) || "[]");
    state.usedHints = new Set([...savedHelp, ...(data.summary.recorded_help || [])]);
    localStorage.setItem(`benScienceHelp:${state.sessionId}`, JSON.stringify([...state.usedHints]));
    // Anchor the clock to this attempt, including refresh, correction and breaks.
    state.pageStartedAt = Date.parse(data.started_at) || Date.now() - data.summary.elapsed_seconds * 1000;
    localStorage.setItem("benSciencePageStartedAt", String(state.pageStartedAt));
    if (data.summary.complete) {
      state.currentPage = data;
      renderPageResult(data.summary, null, data.level_label, data.topic.title);
      return;
    }
    renderQuestionPage(data);
  } catch (error) {
    clearSessionState();
    showView("home");
    alert(error.message);
  }
}

function collectAnswers() {
  const answers = {};
  state.currentPage.questions.forEach((question) => {
    if (state.currentPage.mastered_question_ids.includes(question.id)) return;
    if (question.type === "multiple_choice") {
      const checked = document.querySelector(`input[name="answer-${question.id}"]:checked`);
      answers[question.id] = checked ? checked.value : "";
    } else {
      const control = document.querySelector(`input[data-question-id="${question.id}"], textarea[data-question-id="${question.id}"]`);
      answers[question.id] = control ? control.value : "";
    }
  });
  return answers;
}

async function submitPage(event) {
  event.preventDefault();
  try {
    await flushHelp().catch(() => {}); // Submission also carries any pending help.
    const result = await api(`/api/session/${state.sessionId}/page-submit`, {
      method: "POST",
      body: JSON.stringify({
        answers: collectAnswers(), elapsed_seconds: elapsedSeconds(), used_hints: ["tracking:v1", "tracking:v2", ...state.usedHints],
      }),
    });
    if (result.page_complete) {
      await refreshProgress();
      renderPageResult(result.summary, result.recommendation, state.currentPage.level_label, state.currentPage.topic.title);
    } else {
      await loadPage();
      document.getElementById("question-page").scrollIntoView({ behavior: "smooth" });
    }
  } catch (error) {
    alert(error.message);
  }
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m ${remainder}s`;
}

function clearSessionState() {
  clearInterval(state.timer);
  state.sessionId = null;
  state.currentPage = null;
  state.pageStartedAt = null;
  state.usedHints.clear();
  localStorage.removeItem("benScienceSessionId");
  localStorage.removeItem("benSciencePageStartedAt");
}

async function finishToMap() {
  clearSessionState();
  await refreshProgress();
  document.getElementById("question-page").classList.add("hidden");
  document.getElementById("set-result").classList.add("hidden");
  showView("home");
}

function renderPageResult(summary, recommendation, levelLabel, topicTitle) {
  clearInterval(state.timer);
  document.getElementById("course-hub").classList.add("hidden");
  document.getElementById("question-page").classList.add("hidden");
  const panel = document.getElementById("set-result");
  panel.classList.remove("hidden");
  const firstPass = Math.round(summary.first_pass_fraction * 100);
  const nextRoute = recommendedRoute();
  const performanceNote = recommendation
    ? `<p class="muted"><strong>Performance note:</strong> ${recommendation.label}. ${recommendation.reason}</p>`
    : "";
  const nextHeading = nextRoute
    ? `${state.catalogue.level_labels[nextRoute.level]} · ${nextRoute.page.title}`
    : "All currently active pages are complete";
  const nextReason = nextRoute
    ? "The star follows the full-bank order. For the 40-hour selection or later breadth stages, follow Study guide and choose the matching map cell."
    : "Return to the course map. The next topic can be activated when its reviewed pages are ready.";
  panel.innerHTML = `
    <p class="eyebrow">${levelLabel} page submitted · complete</p><h2>${topicTitle}</h2>
    <div class="evidence-grid">
      <div><strong>${firstPass}%</strong><span>first-submission accuracy</span></div>
      <div><strong>${Math.round(summary.final_fraction * 100)}%</strong><span>answers now correct</span></div>
      <div><strong>${formatDuration(summary.elapsed_seconds)}</strong><span>${summary.support_tracking ? "total elapsed to latest submission · includes breaks" : "recorded elapsed · older timing incomplete"}</span></div>
      <div><strong>${summary.rounds}</strong><span>submission rounds</span></div>
      <div><strong>${formatDuration(summary.first_elapsed_seconds || 0)}</strong><span>${summary.support_tracking ? "elapsed to first submission" : "recorded first elapsed"}</span></div>
      <div><strong>${summary.first_pass_help_count ?? "—"}</strong><span>questions with site help before first submission</span></div>
      <div><strong>${summary.support_used ?? `≥${summary.recorded_support_used || 0}`}</strong><span>questions with site help across this attempt${summary.support_tracking ? "" : " · tracking incomplete"}</span></div>
    </div>
    <p class="muted">${helpBreakdown(summary)}</p>
    <p class="muted">${summary.support_note || "Help use was not fully recorded in older attempts."} Elapsed times include breaks. Corrected answers do not establish delayed independent mastery. Discuss your written method with your teacher.</p>
    <div class="next-step-card"><p class="eyebrow">RECOMMENDED NEXT COURSE</p><h3>${nextHeading}</h3><p>${nextReason}</p>${performanceNote}</div>
    <div class="result-actions"></div>`;
  const actions = panel.querySelector(".result-actions");
  if (state.sessionId) {
    const reviewButton = document.createElement("button");
    reviewButton.className = "secondary-button";
    reviewButton.textContent = summary.mastery_complete ? "Review questions and solutions" : "Review missed questions";
    reviewButton.addEventListener("click", reviewMissedQuestions);
    actions.appendChild(reviewButton);
  }
  if (nextRoute) {
    const nextButton = document.createElement("button");
    nextButton.className = "primary-button";
    nextButton.textContent = `Continue: ${nextRoute.page.title}`;
    nextButton.addEventListener("click", () => startSession(nextRoute.topicId, nextRoute.level, nextRoute.page.id));
    actions.appendChild(nextButton);
  }
  const mapButton = document.createElement("button");
  mapButton.className = "secondary-button";
  mapButton.textContent = "Return to course map";
  mapButton.addEventListener("click", finishToMap);
  actions.appendChild(mapButton);
}

async function reviewMissedQuestions() {
  try {
    const data = await api(`/api/session/${state.sessionId}/page`);
    state.currentPage = data;
    renderQuestionPage(data);
    document.getElementById("question-page").scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    alert(error.message);
  }
}

function helpBreakdown(summary) {
  const counts = summary.help_counts || {};
  const labels = { hint: "hint", solution: "solution", "gpt-hint": "GPT hint request", "gpt-solution": "GPT solution request" };
  const detail = Object.entries(labels).map(([kind, label]) => {
    const ids = summary.help_question_ids?.[kind] || [];
    const positions = summary.help_question_numbers?.[kind]?.map((n) => `Q${n}`) || ids.map((id) => {
      const index = state.currentPage?.questions.findIndex((q) => q.id === id) ?? -1;
      return index >= 0 ? `Q${index + 1}` : id;
    });
    return `${label}: ${counts[kind] || 0}${positions.length ? ` (${positions.join(", ")})` : ""}`;
  }).join(" · ");
  return `${detail}. Counts are distinct questions per help type, not click counts. GPT requests do not prove an answer was received.`;
}

function formatPageSummary(summary) {
  if (!summary?.rounds) return summary?.recorded_support_used ? `Not submitted · ${summary.recorded_support_used} questions with recorded site help` : "Not submitted";
  const help = summary.support_tracking ? `${summary.support_used} questions with site help` : `help tracking incomplete (at least ${summary.recorded_support_used || 0} recorded)`;
  const firstHelp = summary.first_pass_help_count == null ? "first help unknown" : `${summary.first_pass_help_count} helped before first submission`;
  return `Submitted · first ${Math.round(summary.first_pass_fraction * 100)}% → now ${Math.round(summary.final_fraction * 100)}% correct · first ${formatDuration(summary.first_elapsed_seconds || 0)}, ${summary.support_tracking ? "total" : "recorded max"} ${formatDuration(summary.elapsed_seconds)} elapsed (${summary.support_tracking ? "breaks included" : "older timing incomplete"}) · ${firstHelp} · ${help}`;
}

async function loadTeacher() {
  const message = document.getElementById("teacher-message");
  try {
    message.textContent = "Loading learning results…";
    const data = await api("/api/instructor/summary");
    const table = document.getElementById("progress-table");
    const body = table.querySelector("tbody");
    body.innerHTML = "";
    data.sessions.forEach((session) => {
      const topic = state.catalogue.topics.find((item) => item.id === session.topic_id);
      const row = document.createElement("tr");
      const headings = ["Topic", "Course page", "Level", "Result", "Last activity"];
      [topic ? topic.short_title : session.topic_id, session.page_title,
        state.catalogue.level_labels[session.active_level], formatPageSummary(session.active_summary),
        new Date(session.updated_at).toLocaleString()].forEach((value, index) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        cell.dataset.label = headings[index];
        row.appendChild(cell);
      });
      const detail = document.createElement("details");
      const label = document.createElement("summary");
      label.textContent = "Help record";
      const explanation = document.createElement("p");
      explanation.textContent = `${session.active_summary.support_note || ""} ${helpBreakdown(session.active_summary)}`;
      detail.append(label, explanation);
      row.querySelectorAll("td")[3].appendChild(detail);
      body.appendChild(row);
    });
    table.classList.remove("hidden");
    message.textContent = data.sessions.length
      ? `${data.sessions.length} most recent page attempt(s), each shown separately. Submitted pages count as complete. Map cards show the latest submitted attempt, not the highest score. Corrected answers do not establish independent mastery.`
      : "No learning pages have been started yet.";
  } catch (error) {
    document.getElementById("progress-table").classList.add("hidden");
    message.textContent = error.message;
  }
}

document.querySelectorAll(".nav-button").forEach((button) => button.addEventListener("click", async () => {
  if (button.dataset.view === "home") await refreshProgress();
  showView(button.dataset.view);
}));
document.querySelector(".brand").addEventListener("click", async (event) => {
  event.preventDefault();
  await refreshProgress();
  showView("home");
});
document.getElementById("back-to-map").addEventListener("click", finishToMap);
document.getElementById("answer-form").addEventListener("submit", submitPage);
document.getElementById("refresh-results").addEventListener("click", loadTeacher);
document.getElementById("copy-wifi-link").addEventListener("click", copyWifiLink);

initialise().catch((error) => {
  document.body.innerHTML = `<main><section class="panel narrow-panel"><h1>Course could not load</h1><p>${error.message}</p></section></main>`;
});
