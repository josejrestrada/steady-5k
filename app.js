// Steady 5K — front end. Plain JavaScript, no build step.
// Data stays in this browser (localStorage). Prototype: use made-up data only.
(() => {
  'use strict';

  // ---------- Plan ladder (written for this project) ----------
  const STEPS = [
    null,
    { run: 1, walk: 1.5, reps: 8 }, { run: 1.5, walk: 1.5, reps: 7 }, { run: 2, walk: 1.5, reps: 6 },
    { run: 3, walk: 1.5, reps: 5 }, { run: 4, walk: 1.5, reps: 4 }, { run: 5, walk: 1, reps: 4 },
    { run: 7, walk: 1, reps: 3 }, { run: 9, walk: 1, reps: 3 }, { run: 12, walk: 1, reps: 2 },
    { run: 15, walk: 1, reps: 2 }, { nonstop: '20 min' }, { nonstop: '25 min' }, { nonstop: '5 km' },
  ];
  const LAST = 13;
  const SESSIONS_PER_STEP = 2;
  const stepText = (n) => {
    const s = STEPS[n];
    if (s.nonstop) return n === LAST ? 'Run 5 km without stopping 🏁' : `Run ${s.nonstop} without stopping`;
    return `Run ${s.run} min · walk ${s.walk} min × ${s.reps}`;
  };

  // ---------- Red-flag safety net (runs even if the AI fails) ----------
  const RED = /(chest\s*(pain|tight|hurt|dard)|tight\s*chest|seene\s*(me|mein)\s*dard|faint|fainted|passed out|black(ed)?\s*out|behosh|dizz|chakkar|light.?headed|can'?t\s*breathe|breathless|palpitation|heart\s*(racing|pounding)|blood|khoon)/i;

  // Distance like 7km, 7 km, 7kms, 7k, 7 kilometres, 7.5 KM (but not '7k steps')
  const PLAN_RE = /\?|tomorrow|want to|planning|should i|will run|kal\b|goal/i;
  const KM_RE = /(\d+(?:\.\d+)?)\s*(?:km'?s?|kilomet(?:er|re)s?|k)\b(?!\s*steps)/i;

  // ---------- Storage ----------
  const KEY = 'steady5k:v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
  let S = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);
  const dayKey = (d = new Date()) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let demo = false;

  function toast(msg, ms = 3500) {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), ms);
  }

  // ---------- AI call, with demo fallback ----------
  async function ai(mode, text, context) {
    try {
      const r = await fetch('/api/coach', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, text, context }),
      });
      if (!r.ok) throw new Error('status ' + r.status);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setDemo(false);
      return j;
    } catch (e) {
      console.warn('AI unavailable, demo mode:', e.message);
      setDemo(true);
      return demoAI(mode, text, context);
    }
  }
  function setDemo(on) { demo = on; $('demoBanner').hidden = !on; }

  // Very small rule-based stand-in so the app still works when the AI is offline.
  function demoAI(mode, text = '', ctx = {}) {
    const t = text.toLowerCase();
    if (mode === 'onboard') {
      const km = parseFloat((t.match(KM_RE) || [])[1] || '1');
      const step = km >= 5 ? 12 : km >= 3 ? 9 : km >= 2 ? 6 : km >= 1 ? 4 : 2;
      const rpw = parseInt((t.match(/(\d)\s*(days|times|din)/) || [])[1] || '3', 10);
      return { start_step: step, runs_per_week: Math.min(5, Math.max(2, rpw)), ramadan: /roza|ramadan|fasting/.test(t), reply: 'Plan ready. Your first session is below.' };
    }
    if (mode === 'morning') {
      return { message: ctx.ramadan_mode ? `Today: ${ctx.next_session}, after iftar. Sip water steadily between iftar and sehri.` : `Today: ${ctx.next_session}. Keep a bottle of water with you.`, focus: 'run' };
    }
    const km = PLAN_RE.test(t) ? null : (t.match(KM_RE) || [])[1];
    const bottles = (t.match(/(\d+(\.\d+)?)\s*(bottle|litre|liter|l\b)/) || [])[1];
    const glasses = (t.match(/(\d+)\s*glass/) || [])[1];
    const sleep = (t.match(/slept\s*(\d+(\.\d+)?)/) || t.match(/(\d+(\.\d+)?)\s*(hours|hrs|h)\s*(sleep|of sleep)/) || [])[1];
    const st = t.match(/(\d+(\.\d+)?)\s*(k)?\s*steps/);
    const stepsN = st ? Math.round(+st[1] * (st[3] ? 1000 : 1)) : null;
    const red = RED.test(text);
    const pain = /pain|hurt|dard|sore/.test(t);
    const vague = t.trim().length < 6;
    return {
      log: {
        run_km: km ? +km : null, run_min: null, walk_breaks: null, ran_nonstop: /non.?stop|bina ruke|without stopping/.test(t) || null, steps: stepsN,
        water_l: bottles ? +bottles : glasses ? glasses * 0.25 : null, sleep_h: sleep ? +sleep : null, meals: [],
        fasting: /roza|fast|sehri|iftar/.test(t) || null, symptoms: pain ? ['pain mentioned'] : [],
      },
      red_flag: red, ramadan_detected: /roza|sehri|iftar/.test(t),
      plan_action: red ? 'rest' : pain ? 'down' : km ? 'up' : 'repeat', nudge: 'water', needs_question: vague,
      reply: red ? 'Please stop training today and see a doctor, urgently if it was chest pain or fainting.'
        : vague ? 'How did today go: did you run, and how much water did you drink?'
        : 'Logged. The AI is offline, so this is a basic reply. Your plan is updated.',
    };
  }

  // ---------- Derived data ----------
  const logsFor = (k) => S.logs.filter((l) => l.date === k);
  function dayTotals(k) {
    const T = { steps: 0, hasSteps: false, run_km: 0, run: false, water_l: 0, water: false, sleep_h: null, kLow: 0, kHigh: 0, food: false, fasting: false };
    for (const l of logsFor(k)) {
      const g = l.parsed?.log; if (!g) continue;
      if (g.run_km != null) { T.run_km += +g.run_km || 0; T.run = true; }
      if (g.run_min != null) T.run = true;
      if (g.water_l != null) { T.water_l += +g.water_l || 0; T.water = true; }
      if (g.sleep_h != null) T.sleep_h = +g.sleep_h;
      for (const m of g.meals || []) { T.kLow += +m.kcal_low || 0; T.kHigh += +m.kcal_high || 0; T.food = true; }
      if (g.fasting) T.fasting = true;
      if (g.steps != null) { T.steps = Math.max(T.steps, +g.steps || 0); T.hasSteps = true; }
    }
    return T;
  }
  function daysSinceRun() {
    const runs = S.logs.filter((l) => l.parsed?.log && (l.parsed.log.run_km != null || l.parsed.log.run_min != null));
    if (!runs.length) return null;
    const last = runs[runs.length - 1].date;
    return Math.round((new Date(dayKey()) - new Date(last)) / 86400000);
  }
  function targetDate() {
    const remaining = Math.max(0, (LAST - S.step) * SESSIONS_PER_STEP + (S.step === LAST ? 1 : 0) - S.atStep);
    const days = Math.ceil((remaining / S.runsPerWeek) * 7);
    return addDays(new Date(), Math.max(days, S.step === LAST ? 0 : 2));
  }
  function context() {
    const recent = S.logs.slice(-4).map((l) => ({ date: l.date, said: l.text.slice(0, 200), action: l.parsed?.plan_action, red_flag: l.parsed?.red_flag }));
    return {
      today: dayKey(), time: new Date().toTimeString().slice(0, 5),
      next_session: S.nextRest ? 'Rest day' : stepText(S.step), plan_step: `${S.step}/13`, sessions_done_at_step: `${S.atStep}/${SESSIONS_PER_STEP}`,
      ramadan_mode: S.ramadan, days_since_last_run: daysSinceRun(), runs_per_week: S.runsPerWeek,
      paused_for_red_flag: !!S.redFlag, recent_checkins: recent,
    };
  }

  // ---------- Plan engine: the AI decides, the code enforces limits ----------
  function applyAction(p) {
    const before = { step: S.step, target: dayKey(targetDate()) };
    let action = p.plan_action || 'repeat';
    const hasSymptoms = (p.log?.symptoms || []).length > 0;
    if (p.red_flag || RED.test(p._text || '')) { action = 'rest'; S.redFlag = { date: dayKey(), why: p.log?.symptoms?.join(', ') || 'warning sign' }; }
    if (action === 'up' && hasSymptoms) action = 'repeat'; // never progress through pain
    if (S.lastChangeDay === dayKey() && (action === 'up' || action === 'down')) action = 'repeat'; // max one change a day

    let note = '';
    if (action === 'up') {
      S.atStep += 1;
      if (S.atStep >= SESSIONS_PER_STEP && S.step < LAST) { S.step += 1; S.atStep = 0; S.lastChangeDay = dayKey(); note = `Moved up to step ${S.step}.`; }
      else if (S.step === LAST) { note = 'Finish line reached! 🏁'; S.done = true; }
      else note = `${S.atStep} of ${SESSIONS_PER_STEP} sessions done at this step.`;
      S.nextRest = false;
    } else if (action === 'down') {
      if (S.step > 1) { S.step -= 1; S.lastChangeDay = dayKey(); }
      S.atStep = 0; S.nextRest = false; note = `Eased back to step ${S.step}.`;
    } else if (action === 'rest') {
      S.nextRest = true; note = 'Next session is a rest day.';
    } else { S.nextRest = false; }
    S.lastAction = action;
    const after = dayKey(targetDate());
    if (after !== before.target && after > before.target) note += ` Finish line moved to ${fmtDate(after)}.`;
    return note.trim();
  }


  // ---------- Full session breakdown (general guidance, not medical advice) ----------
  function sessionMinutes(n) {
    const s = STEPS[n];
    if (s.nonstop) return n === LAST ? 35 : parseInt(s.nonstop, 10);
    return Math.round(s.reps * (s.run + s.walk) - s.walk);
  }
  function sessionPlan(n, mode) {
    const li = (a) => a.map((x) => `<li>${x}</li>`).join('');
    const block = (title, mins, items) => `<div class="blk"><div class="blk-h"><b>${title}</b><span>${mins}</span></div><ol>${li(items)}</ol></div>`;
    const warm = block('Warm-up', '8 min', [
      'Walk briskly for 4 minutes, swinging your arms.',
      'Leg swings: hold a wall, swing each leg forward and back 10 times, then side to side 10 times.',
      'Walking lunges: 8 slow steps on each leg. Back sore? Skip these.',
      'High knees for 20 seconds, then heel flicks (kick heels toward your bum) for 20 seconds.',
      'Arm circles: 10 forwards, 10 backwards.',
      '1 minute of very easy jogging to finish.',
    ]);
    const cool = block('Cool-down', '8 min', [
      'Walk slowly for 4 minutes until your breathing settles.',
      'Calf stretch against a wall: 30 seconds each leg.',
      'Front-of-thigh stretch: pull one foot toward your bum, 30 seconds each leg.',
      'Back-of-thigh stretch: heel on a low step, lean forward gently, 30 seconds each leg.',
      'Hold each stretch still. No bouncing, and stop if anything feels sharp.',
    ]);
    if (mode === 'rest') {
      return block('Rest day', '20–30 min, optional', [
        'An easy walk at chatting pace, or nothing at all. Rest is when your stamina builds.',
        'Do the cool-down stretches below if your legs feel tight.',
      ]) + cool;
    }
    const s = STEPS[n];
    const main = s.nonstop
      ? [
          n === LAST ? 'Run 5 km at one steady, easy pace. Start slower than you think you need to.' : `Run ${s.nonstop} without stopping, at an easy pace.`,
          'Easy pace = you can still speak in short sentences. If you can only gasp single words, slow down.',
          'If you really must walk, walk 1 minute and then carry on. It still counts.',
        ]
      : [
          `Run ${s.run} min, then walk ${s.walk} min. Repeat ${s.reps} times.`,
          'Run at an easy pace: you should be able to speak in short sentences.',
          'Walk briskly in the walk breaks, don\'t stop and stand.',
          'Finish the last run strong but not sprinting.',
        ];
    const tips = [
      S.ramadan ? 'Ramadan: run 1–2 hours after iftar, once you have had water and a light meal. Never run while fasting.' : 'Drink a glass of water 30–60 minutes before, and take a bottle with you if it is hot.',
      ...(S.ramadan ? ['Football or badminton while fasting counts as training: skip the run that day, keep matches short in the heat, and stop if you feel dizzy.'] : []),
      'Breathe through your nose and mouth together; relax your shoulders.',
      'Stop and walk if you feel chest pain, dizziness or sharp pain, and tell the coach.',
    ];
    return warm + block('Main run', `${sessionMinutes(n)} min`, main) + cool + `<div class="blk tips"><b>Tips</b><ul>${li(tips)}</ul></div>`;
  }

  function stepHTML(n) {
    const st = STEPS[n];
    const fmt = (m) => `${Math.floor(m)}:${String(Math.round((m % 1) * 60)).padStart(2, '0')}`;
    if (st.nonstop) return `<span class="sw"><b>${n === LAST ? '5 km' : st.nonstop}</b><small>without stopping</small></span>`;
    return `<span class="sw"><b>${fmt(st.run)}</b><small>run</small></span><span class="sw walk"><b>${fmt(st.walk)}</b><small>walk</small></span><span class="sw reps"><b>×${st.reps}</b><small>rounds</small></span>`;
  }

  // ---------- Rendering ----------
  function show(view) {
    for (const v of ['onboard', 'today', 'history']) $(v).hidden = v !== view;
    $('dock').hidden = view !== 'today';
    $('ramadanBtn').hidden = view === 'onboard';
  }

  function renderToday() {
    show('today');
    $('ramadanBtn').setAttribute('aria-pressed', String(!!S.ramadan));
    // finish line
    const pct = Math.round(((S.step - 1) + S.atStep / SESSIONS_PER_STEP) / (LAST - 1) * 100);
    $('ringText').textContent = S.step;
    $('marks').innerHTML = Array.from({ length: LAST }, (_, i) => `<i class="${i + 1 < S.step ? 'done' : i + 1 === S.step ? 'now' : ''}" style="left:${(i / (LAST - 1)) * 100}%"></i>`).join('');
    $('runner').style.setProperty('--x', pct + '%');
    $('track').setAttribute('aria-label', `Step ${S.step} of 13 on the way to 5K`);
    $('finishLead').textContent = S.done ? 'You did it:' : '5K non-stop by';
    $('finishDate').textContent = S.done ? '5K non-stop' : fmtDate(targetDate());
    $('finishNote').textContent = S.done ? 'Next goal: 10K. Ask the coach when you are ready.' : `Step ${S.step} of 13. ${S.atStep} of ${SESSIONS_PER_STEP} sessions done at this step, ${S.runsPerWeek} runs a week.`;
    // next session
    const total = (n) => sessionMinutes(n) + 16;
    if (S.redFlag) { $('nextLabel').textContent = 'Paused'; $('nextSession').innerHTML = '<span class="sw-text">No running until you feel OK</span>'; $('nextHint').textContent = 'See a doctor about the warning sign you mentioned.'; $('nextPlan').innerHTML = ''; }
    else if (S.nextRest) { $('nextLabel').textContent = 'Next session'; $('nextSession').innerHTML = '<span class="sw-text">Rest day. An easy walk if you like.</span>'; $('nextHint').textContent = `Then: ${stepText(S.step)}`; $('nextPlan').innerHTML = `<details class="plan"><summary>See the full rest-day plan</summary>${sessionPlan(S.step, 'rest')}</details>`; }
    else { $('nextLabel').textContent = 'Next run'; $('nextSession').innerHTML = stepHTML(S.step); $('nextHint').textContent = `About ${total(S.step)} min with warm-up and cool-down${S.ramadan ? ', after iftar' : ''}`; $('nextPlan').innerHTML = `<details class="plan" ${S.planOpen ? 'open' : ''}><summary>See the full session</summary>${sessionPlan(S.step, 'run')}</details>`; $('nextPlan').querySelector('details').addEventListener('toggle', (e) => { S.planOpen = e.target.open; save(); }); }
    // red flag
    $('flagBanner').hidden = !S.redFlag;
    // chips
    const T = dayTotals(dayKey());
    const waterGoal = S.ramadan ? 'aim ~2.5 L, iftar→sehri' : 'aim ~3 L';
    const chip = (label, val, sub, on) => `<div class="chip ${on ? '' : 'empty'}"><b>${val}</b><span>${label}</span>${sub ? `<span>${sub}</span>` : ''}</div>`;
    $('chips').innerHTML = [
      chip('Run', T.run ? `${+T.run_km.toFixed(1)} km` : '—', '', T.run),
      chip('Steps', T.hasSteps ? T.steps.toLocaleString('en-IN') : '—', 'from phone', T.hasSteps),
      chip('Water', T.water ? `${+T.water_l.toFixed(1)} L` : '—', waterGoal, T.water),
      chip('Sleep', T.sleep_h != null ? `${T.sleep_h} h` : '—', '', T.sleep_h != null),
      chip('Food', T.food ? `${Math.round(T.kLow / 50) * 50}–${Math.round(T.kHigh / 50) * 50}` : '—', 'kcal approx.', T.food),
      S.ramadan || T.fasting ? chip('Fast', T.fasting ? 'Fasting' : '—', S.ramadan ? 'Ramadan' : '', T.fasting) : '',
    ].join('');
    // thread
    $('thread').innerHTML = logsFor(dayKey()).map((l) => `
      <div class="bubble me">${esc(l.text)}</div>
      <div class="bubble ai ${l.parsed?.red_flag ? 'red' : ''}">${esc(l.parsed?.reply || '')}${l.note ? `<span class="meta">${esc(l.note)}</span>` : ''}</div>`).join('');
    // week
    let bars = ''; const vals = [];
    for (let i = 6; i >= 0; i--) { const k = dayKey(addDays(new Date(), -i)); vals.push([k, dayTotals(k).run_km]); }
    const max = Math.max(3, ...vals.map((v) => v[1]));
    for (const [k, v] of vals) bars += `<div class="wb ${k === dayKey() ? 'today' : ''}"><span>${v ? +v.toFixed(1) : ''}</span><i style="height:${(v / max) * 70}%"></i>${new Date(k).toLocaleDateString('en-IN', { weekday: 'narrow' })}</div>`;
    $('weekbars').innerHTML = bars;
  }

  async function morning(force = false) {
    const today = dayKey();
    if (!force && S.morning?.date === today) { $('coachMsg').textContent = S.morning.message; $('coachTime').textContent = 'today'; return; }
    $('coachMsg').textContent = 'Looking at how yesterday went…'; $('coachMsg').classList.add('loading');
    const r = await ai('morning', '', context());
    $('coachMsg').classList.remove('loading');
    S.morning = { date: today, message: r.message || `Today: ${stepText(S.step)}.` }; save();
    $('coachMsg').textContent = S.morning.message; $('coachTime').textContent = 'today';
  }

  function renderHistory() {
    show('history');
    const days = [...new Set(S.logs.map((l) => l.date))].sort().reverse();
    $('histList').innerHTML = days.length ? days.map((k) => {
      const T = dayTotals(k);
      return `<div class="hist-day"><h4>${fmtDate(k)}</h4>
        <p>${T.run ? `Ran ${+T.run_km.toFixed(1)} km` : 'No run'} · Water ${T.water ? +T.water_l.toFixed(1) + ' L' : '—'} · Sleep ${T.sleep_h ?? '—'} h${T.food ? ` · ~${Math.round(T.kLow)}–${Math.round(T.kHigh)} kcal` : ''}</p>
        ${logsFor(k).map((l) => `<p>“${esc(l.text)}” → <em>${esc(l.parsed?.reply || '')}</em></p>`).join('')}</div>`;
    }).join('') : '<p class="muted">Nothing logged yet.</p>';
  }

  // ---------- Actions ----------
  async function onboard() {
    const text = $('onText').value.trim();
    if (!text) { toast('Tell me a little about your running first.'); return; }
    $('onGo').disabled = true; $('onGo').textContent = 'Building your plan…';
    const r = await ai('onboard', text, { today: dayKey() });
    S = { v: 1, created: dayKey(), step: clamp(+r.start_step || 3, 1, LAST), atStep: 0, runsPerWeek: clamp(+r.runs_per_week || 3, 2, 5), ramadan: !!r.ramadan, logs: [], intro: text };
    save();
    $('onGo').disabled = false; $('onGo').textContent = 'Build my plan';
    renderToday();
    S.morning = { date: dayKey(), message: r.reply || `Plan ready. Start with: ${stepText(S.step)}.` }; save();
    $('coachMsg').textContent = S.morning.message; $('coachTime').textContent = 'just now';
  }
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

  async function checkin() {
    const box = $('ciText'); const text = box.value.trim();
    if (!text) return;
    box.value = ''; autoGrow(box); $('ciSend').disabled = true;
    const th = $('thread');
    th.insertAdjacentHTML('beforeend', `<div class="bubble me">${esc(text)}</div><div class="bubble ai typing" id="typing">Reading that…</div>`);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    const p = await ai('checkin', text, context());
    p._text = text;
    // Backfill: if the AI missed a number that is plainly in the message, take it from a simple local parse.
    const local = demoAI('checkin', text, {}).log;
    p.log = p.log || { meals: [], symptoms: [] };
    const planning = PLAN_RE.test(text); // don't log plans or questions as done
    if (!planning) for (const k of ['run_km', 'steps', 'water_l', 'sleep_h']) if (p.log[k] == null && local[k] != null) p.log[k] = local[k];
    if (RED.test(text)) p.red_flag = true; // safety net overrides the AI
    if (p.red_flag && !/doctor/i.test(p.reply || '')) p.reply = 'Please stop training today and see a doctor. If it was chest pain or fainting, get medical help urgently.';
    let note = '';
    if (!p.needs_question) note = applyAction(p);
    if (p.ramadan_detected && !S.ramadan) { S.ramadan = true; toast('Ramadan mode on: runs move to after iftar. Tap 🌙 to turn it off.', 5000); }
    delete p._text;
    S.logs.push({ date: dayKey(), at: Date.now(), text, parsed: p, note });
    save();
    $('ciSend').disabled = false;
    renderToday();
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  function loadSample() {
    const d = (n) => dayKey(addDays(new Date(), -n));
    const L = (n, text, log, reply, action) => ({ date: d(n), at: Date.now() - n * 864e5, text, note: '', parsed: { log: { meals: [], symptoms: [], ...log }, reply, plan_action: action, red_flag: false } });
    S = {
      v: 1, created: d(6), step: 5, atStep: 1, runsPerWeek: 3, ramadan: false, sample: true,
      logs: [
        L(6, 'Ran 2k, walked 3 times. 2 bottles water. Slept 1am to 7am. Rice, dal, fish curry for lunch.', { run_km: 2, walk_breaks: 3, water_l: 2, sleep_h: 6, meals: [{ item: 'rice, dal, fish curry', kcal_low: 550, kcal_high: 800 }] }, 'Solid start. Try to get one more bottle of water in tomorrow.', 'repeat'),
        L(4, 'aaj 2.5k bhaga, 2 baar ruka, paani 3 bottle, 7 ghante soya', { run_km: 2.5, walk_breaks: 2, water_l: 3, sleep_h: 7 }, 'Fewer stops than last time. Good water day too.', 'up'),
        L(3, 'No run, college fest. Had biryani and cold drink. Slept 5 hours', { water_l: 1, sleep_h: 5, meals: [{ item: 'biryani + cold drink', kcal_low: 700, kcal_high: 1200 }] }, 'Rest days count too. Aim for an earlier night tonight.', 'repeat'),
        L(1, 'Ran 2.8k, back felt a bit stiff after. 2.5 L water.', { run_km: 2.8, water_l: 2.5, symptoms: ['back stiffness'] }, 'Good run. Keep tomorrow easy, and see a physio if the back stiffness keeps coming back.', 'repeat'),
      ],
    };
    S.morning = { date: dayKey(), message: 'Back was stiff yesterday, so today is your normal session, nice and easy. Get 3 bottles of water in before evening.' };
    save(); $('menu').hidden = true; renderToday(); morning(true);
  }

  // ---------- Voice input (browser speech recognition, Indian English) ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  document.querySelectorAll('.mic').forEach((btn) => {
    if (!SR) { btn.addEventListener('click', () => toast('Voice is not supported in this browser. Use your keyboard\'s 🎤 button instead.')); return; }
    let rec = null;
    btn.addEventListener('click', () => {
      if (rec) { rec.stop(); return; }
      const box = $(btn.dataset.target); const base = box.value ? box.value + ' ' : '';
      rec = new SR(); rec.lang = 'en-IN'; rec.interimResults = true; rec.continuous = false;
      rec.onresult = (e) => { box.value = base + [...e.results].map((r) => r[0].transcript).join(' '); autoGrow(box); };
      rec.onend = () => { btn.classList.remove('on'); rec = null; };
      rec.onerror = () => { toast('Could not hear you. Check microphone permission.'); };
      btn.classList.add('on'); rec.start();
    });
  });

  function autoGrow(t) { t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight) + 'px'; }

  // ---------- Wire up ----------
  $('onGo').addEventListener('click', onboard);
  $('onSample').addEventListener('click', loadSample);
  $('ciSend').addEventListener('click', checkin);
  $('ciText').addEventListener('input', (e) => autoGrow(e.target));
  $('ciText').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer: coarse)').matches) { e.preventDefault(); checkin(); } });
  $('ramadanBtn').addEventListener('click', () => { S.ramadan = !S.ramadan; save(); renderToday(); toast(S.ramadan ? 'Ramadan mode on: runs after iftar, water between iftar and sehri.' : 'Ramadan mode off.'); });
  $('flagClear').addEventListener('click', () => { S.redFlag = null; S.nextRest = true; save(); renderToday(); toast('OK. Start again gently: a rest day, then your usual session.'); });
  $('menuBtn').addEventListener('click', () => { $('menu').hidden = !$('menu').hidden; });
  $('menu').addEventListener('click', (e) => {
    const a = e.target.dataset.act; if (!a) return; $('menu').hidden = true;
    if (a === 'reset' && confirmReset()) { try { localStorage.removeItem(KEY); } catch {} S = null; start(); }
    if (a === 'sample') loadSample();
    if (a === 'history' && S) renderHistory();
  });
  document.querySelectorAll('[data-go="today"]').forEach((b) => b.addEventListener('click', () => S && renderToday()));
  function confirmReset() {
    const b = document.querySelector('[data-act="reset"]');
    if (b.dataset.armed) return true;
    b.dataset.armed = '1'; b.textContent = 'Tap again to erase everything'; $('menu').hidden = false;
    setTimeout(() => { delete b.dataset.armed; b.textContent = 'Start over'; }, 4000);
    return false;
  }

  function start() {
    if (!S) { show('onboard'); return; }
    renderToday(); morning();
  }
  start();
})();
