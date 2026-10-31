// Steady 5K — front end. Plain JavaScript, no build step.
// Data stays in this browser (localStorage). Prototype: use made-up data only.
(() => {
  'use strict';

  // ---------- Goals and their plan ladders (written for this project) ----------
  // Rizwan's own words: "run a full 5K at a single, steady pace without stopping… eventually stretch it to 10K."
  const GOALS = {
    '5k': {
      title: 'Run 5K without stopping', short: '5K non-stop', tape: '5K',
      blurb: 'From run–walk intervals to 5 km at one steady pace.',
      steps: [null,
        { run: 1, walk: 1.5, reps: 8 }, { run: 1.5, walk: 1.5, reps: 7 }, { run: 2, walk: 1.5, reps: 6 },
        { run: 3, walk: 1.5, reps: 5 }, { run: 4, walk: 1.5, reps: 4 }, { run: 5, walk: 1, reps: 4 },
        { run: 7, walk: 1, reps: 3 }, { run: 9, walk: 1, reps: 3 }, { run: 12, walk: 1, reps: 2 },
        { run: 15, walk: 1, reps: 2 }, { nonstop: '20 min' }, { nonstop: '25 min' },
        { nonstop: '5 km', final: true, mins: 35, km: 5 }],
    },
    '10k': {
      title: 'Run 10K', short: '10K', tape: '10K',
      blurb: 'For when 5K feels steady: build up to 10 km without stopping.',
      steps: [null,
        { nonstop: '30 min' }, { nonstop: '35 min' }, { nonstop: '40 min' }, { nonstop: '45 min' },
        { nonstop: '50 min' }, { nonstop: '55 min' }, { nonstop: '60 min' },
        { nonstop: '10 km', final: true, mins: 70, km: 10 }],
    },
    cal: {
      title: 'Keep track of my calories', short: 'Calories', tape: 'kcal',
      blurb: 'See roughly what you eat each day. No targets, no diet.',
      steps: null, // monitoring only: no plan ladder
    },
  };
  let GOAL = GOALS['5k'], STEPS = GOAL.steps, LAST = STEPS.length - 1;
  function useGoal(id) { GOAL = GOALS[id] && GOALS[id].steps ? GOALS[id] : GOALS['5k']; STEPS = GOAL.steps; LAST = STEPS.length - 1; }
  const isRun = (id) => !!(GOALS[id] && GOALS[id].steps);
  const SESSIONS_PER_STEP = 2;
  const stepText = (n) => {
    const s = STEPS[n];
    if (s.nonstop) return s.final ? `Run ${s.nonstop} without stopping 🏁` : `Run ${s.nonstop} without stopping`;
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
  // Each saved goal keeps its own place in its plan; check-ins (food, water, sleep) are shared.
  const GOAL_FIELDS = ['step', 'atStep', 'runsPerWeek', 'done', 'nextRest', 'lastChangeDay', 'created', 'intro'];
  // S.goal is the goal in focus; S.runGoal is the running goal whose plan is loaded into S.step etc.
  function stash() { if (!S || !S.runGoal) return; S.goals = S.goals || {}; S.goals[S.runGoal] = { ...S.goals[S.runGoal], ...Object.fromEntries(GOAL_FIELDS.map((k) => [k, S[k]])) }; }
  function loadRun(id) { stash(); if (id && S.goals[id]) { Object.assign(S, Object.fromEntries(GOAL_FIELDS.map((k) => [k, S.goals[id][k]]))); } S.runGoal = id || null; useGoal(id || '5k'); }
  function activate(id) { if (isRun(id)) loadRun(id); S.goal = id; save(); }
  if (S && !S.goal) { S.goal = '5k'; S.runGoal = '5k'; S.goals = S.goals || {}; stash(); } // older saves had one goal
  if (S && S.goal && S.runGoal === undefined) S.runGoal = isRun(S.goal) ? S.goal : null;
  if (S) useGoal(S.runGoal || '5k');
  const hasRun = () => !!(S && S.runGoal);
  const labelOf = (id) => (S?.goals?.[id]?.label) || GOALS[id].title;
  const save = () => { try { stash(); localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };

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
    const recent = S.logs.filter((l) => !['meal', 'water'].includes(l.kind)).slice(-4).map((l) => ({ date: l.date, said: l.text.slice(0, 200), action: l.parsed?.plan_action, red_flag: l.parsed?.red_flag }));
    return {
      today: dayKey(), time: new Date().toTimeString().slice(0, 5),
      goals: Object.keys(S.goals || {}).map(labelOf), own_calorie_goal: S.calGoal || null, goal_in_focus: S.goal ? labelOf(S.goal) : '', running_goal: hasRun() ? GOAL.title : 'none', plan_ladder: STEPS.slice(1).map((_, i) => `${i + 1} ${stepText(i + 1)}`).join('; '),
      next_session: S.nextRest ? 'Rest day' : sessionLine(S.step), plan_step: `${S.step}/${LAST}`, sessions_done_at_step: `${S.atStep}/${SESSIONS_PER_STEP}`,
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
    if (s.nonstop) return s.mins || parseInt(s.nonstop, 10);
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
    const v = mode === 'run' ? variant(n) : null;
    const main = v && v.runs ? [
          `Pyramid: run ${v.runs.join(', ')} minutes, walking ${s.walk} min between each.`,
          'The middle runs are the longest. Keep them easy; the total running time is the same as usual.',
          'Walk briskly in the walk breaks, don\'t stop and stand.',
          `Today's focus: ${v.cue.toLowerCase()}.`,
        ]
      : s.nonstop
      ? [
          s.final ? `Run ${s.nonstop} at one steady, easy pace. Start slower than you think you need to.` : `Run ${s.nonstop} without stopping, at an easy pace.`,
          'Easy pace = you can still speak in short sentences. If you can only gasp single words, slow down.',
          'If you really must walk, walk 1 minute and then carry on. It still counts.',
          ...(v ? [`${v.name}: ${v.note.charAt(0).toLowerCase() + v.note.slice(1)}`, `Today's focus: ${v.cue.toLowerCase()}.`] : []),
        ]
      : [
          `Run ${s.run} min, then walk ${s.walk} min. Repeat ${s.reps} times.`,
          'Run at an easy pace: you should be able to speak in short sentences.',
          'Walk briskly in the walk breaks, don\'t stop and stand.',
          'Finish the last run strong but not sprinting.',
          ...(v ? [`${v.name}: ${v.note.charAt(0).toLowerCase() + v.note.slice(1)}`] : []),
        ];
    const tips = [
      S.ramadan ? 'Ramadan: run 1–2 hours after iftar, once you have had water and a light meal. Never run while fasting.' : 'Drink a glass of water 30–60 minutes before, and take a bottle with you if it is hot.',
      ...(S.ramadan ? ['Football or badminton while fasting counts as training: skip the run that day, keep matches short in the heat, and stop if you feel dizzy.'] : []),
      'Breathe through your nose and mouth together; relax your shoulders.',
      'Stop and walk if you feel chest pain, dizziness or sharp pain, and tell the coach.',
    ];
    return warm + block('Main run', `${sessionMinutes(n)} min`, main) + cool + `<div class="blk tips"><b>Tips</b><ul>${li(tips)}</ul></div>`;
  }

  // ---------- Session variety: same difficulty, different feel ----------
  // The step (total running time) only changes through the plan rules; the style rotates after every run.
  const CUES = ['Short, quick steps', 'Relaxed shoulders and loose hands', 'Breathe out a little longer than you breathe in',
    'Swing your arms forward and back, not across your body', 'Look ahead, not at your feet', 'Finish the last minute gently, no sprint'];
  const runsDone = () => S.logs.filter((l) => l.parsed?.log && (l.parsed.log.run_km != null || l.parsed.log.run_min != null)).length;
  const half = (x) => Math.max(0.5, Math.round(x * 2) / 2);
  function variant(n) {
    const st = STEPS[n], k = runsDone(), cue = CUES[k % CUES.length];
    if (st.nonstop) {
      const v = [
        { key: 'steady', name: 'Steady run', note: 'One even pace from start to finish.' },
        { key: 'talk', name: 'Talk-test run', note: 'Easy enough to speak in full sentences the whole way.' },
        { key: 'route', name: 'New route', note: 'Same run, somewhere different: a park loop or a new street.' },
      ][k % 3];
      return { ...v, cue };
    }
    const styles = st.reps > 2 ? ['classic', 'pyramid', 'focus', 'route'] : ['classic', 'focus', 'route'];
    const key = styles[k % styles.length];
    if (key === 'pyramid') {
      const up = Array.from({ length: Math.ceil(st.reps / 2) }, (_, i) => i + 1);
      const pat = [...up, ...up.slice(0, Math.floor(st.reps / 2)).reverse()];
      const sum = pat.reduce((a, b) => a + b, 0), total = st.run * st.reps;
      return { key, name: 'Pyramid', runs: pat.map((p) => half((p * total) / sum)), note: `Build up, then come back down. Walk ${st.walk} min between runs.`, cue };
    }
    if (key === 'focus') return { key, name: 'Focus run', note: `Same intervals. Today, practise one thing: ${cue.toLowerCase()}.`, cue };
    if (key === 'route') return { key, name: 'New route', note: 'Same intervals, somewhere different: a park loop or a new street.', cue };
    return { key, name: 'Classic intervals', note: 'Run, walk, repeat. Keep the runs easy.', cue };
  }
  const mm = (m) => `${Math.floor(m)}:${String(Math.round((m % 1) * 60)).padStart(2, '0')}`;
  function sessionLine(n) {
    const v = variant(n), st = STEPS[n];
    if (v.runs) return `${v.name}: run ${v.runs.join(', ')} min, walking ${st.walk} min between`;
    return `${v.name}: ${stepText(n)}`;
  }

  function stepHTML(n) {
    const st = STEPS[n];
    const fmt = (m) => `${Math.floor(m)}:${String(Math.round((m % 1) * 60)).padStart(2, '0')}`;
    const v = variant(n);
    if (st.nonstop) return `<span class="sw"><b>${st.nonstop}</b><small>without stopping</small></span>`;
    if (v.runs) return `<span class="sw seq"><b>${v.runs.map((r) => (r % 1 ? r.toFixed(1) : r)).join('–')}</b><small>minutes running, walk ${fmt(st.walk)} between</small></span>`;
    return `<span class="sw"><b>${fmt(st.run)}</b><small>run</small></span><span class="sw walk"><b>${fmt(st.walk)}</b><small>walk</small></span><span class="sw reps"><b>×${st.reps}</b><small>rounds</small></span>`;
  }

  // ---------- Rendering ----------
  let tab = 'today';
  function show(view) {
    $('onboard').hidden = view !== 'onboard';
    $('goals').hidden = view !== 'goals';
    $('main').hidden = view !== 'main';
    $('ramadanBtn').hidden = view !== 'main';
  }
  function setTab(t) {
    tab = t;
    for (const n of ['today', 'plan', 'coach', 'food', 'week']) $('tab-' + n).hidden = n !== t;
    document.querySelectorAll('#tabbar button').forEach((b) => b.toggleAttribute('aria-current', b.dataset.tab === t));
    $('dock').hidden = t !== 'coach';
    $('tabbar').hidden = false;
    window.scrollTo(0, t === 'coach' ? document.body.scrollHeight : 0);
  }

  // Planned running distance for a step, at an easy beginner pace of about 7 min per km.
  function planKm(n) {
    const st = STEPS[n];
    if (st.final) return st.km;
    const mins = st.nonstop ? parseInt(st.nonstop, 10) : st.run * st.reps;
    return Math.max(1, Math.round((mins / 7) * 10) / 10);
  }

  function ringsSVG(parts) {
    const C = 90, W = 13, gap = 3;
    const arcs = parts.map((p, i) => {
      const r = 76 - i * (W + gap), len = 2 * Math.PI * r, f = Math.max(0, Math.min(1, p.frac || 0));
      return `<circle cx="${C}" cy="${C}" r="${r}" class="r-bg" style="stroke:${p.color}"/>` +
        `<circle cx="${C}" cy="${C}" r="${r}" class="r-fg" style="stroke:${p.color};stroke-dasharray:${len};stroke-dashoffset:${len * (1 - f)}"/>`;
    }).join('');
    return `<svg viewBox="0 0 180 180" role="img" aria-label="${parts.map((p) => `${p.label} ${p.text}`).join(', ')}">${arcs}</svg>`;
  }

  // ---------- Food tab: calorie tracker (rough ranges, no targets) ----------
  const SLOTS = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];
  const slotNow = () => { const h = new Date().getHours(); return h < 11 ? 'Breakfast' : h < 16 ? 'Lunch' : h < 19 ? 'Snacks' : 'Dinner'; };
  let mealSlot = slotNow();
  const r50 = (n) => Math.round(n / 50) * 50;

  function renderFood(T) {
    $('foodTabBtn').hidden = !S.goals?.cal;
    if (!S.goals?.cal && tab === 'food') setTab('today');
    if (document.activeElement !== $('calGoalIn')) $('calGoalIn').value = S.calGoal || '';
    $('calGoalClear').hidden = !S.calGoal;
    $('ideasCard').hidden = !S.calGoal;
    document.querySelectorAll('#segMeal button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === mealSlot)));
    const mid = Math.round((T.kLow + T.kHigh) / 2);
    $('foodDayTotal').innerHTML = (T.food ? `<b>${r50(T.kLow)}–${r50(T.kHigh)}</b> kcal today, approx.` : 'Nothing logged yet today. Add what you ate above.') + (S.calGoal ? `<br><span class="small">Your goal: ${S.calGoal.toLocaleString('en-IN')} kcal. About ${Math.max(0, r50(S.calGoal - mid)).toLocaleString('en-IN')} left.</span>` : '');
    const groups = {};
    S.logs.forEach((l, li) => {
      if (l.date !== dayKey()) return;
      (l.parsed?.log?.meals || []).forEach((m, mi) => {
        const g = l.kind === 'meal' ? (l.slot || 'Snacks') : 'From your check-ins';
        (groups[g] = groups[g] || []).push({ ...m, li, mi });
      });
    });
    const order = [...SLOTS, 'From your check-ins'].filter((g) => groups[g]);
    $('mealGroups').innerHTML = order.map((g) => {
      const lo = groups[g].reduce((a, m) => a + (+m.kcal_low || 0), 0), hi = groups[g].reduce((a, m) => a + (+m.kcal_high || 0), 0);
      return `<div class="meal-group"><div class="mg-h"><b>${g}</b><span>${r50(lo)}–${r50(hi)} kcal</span></div><ul class="meals">${groups[g].map((m) =>
        `<li><span>${esc(m.item)}</span><b>${m.kcal_low}–${m.kcal_high}</b><button class="rm" data-rm="${m.li}:${m.mi}" aria-label="Remove ${esc(m.item)}">×</button></li>`).join('')}</ul></div>`;
    }).join('');
    $('fuelNote').textContent = T.run ? 'You ran today, so make sure your meals have enough carbs and protein to recover.' : '';
    let cb = ''; const cv = [];
    for (let i = 6; i >= 0; i--) { const k = dayKey(addDays(new Date(), -i)); const D = dayTotals(k); cv.push([k, D.food ? Math.round((D.kLow + D.kHigh) / 2) : 0]); }
    const cmax = Math.max(1000, ...cv.map((v) => v[1]));
    for (const [k, v] of cv) cb += `<div class="wb ${k === dayKey() ? 'today' : ''}"><span>${v ? (v / 1000).toFixed(1) + 'k' : ''}</span><i style="height:${(v / cmax) * 70}%"></i>${new Date(k).toLocaleDateString('en-IN', { weekday: 'narrow' })}</div>`;
    $('calbars').innerHTML = cb;
  }

  // Offline stand-in: typical Indian portions as ranges.
  const FOOD_DB = [
    [/roti|chapati|phulka/, 'roti', 80, 120], [/paratha/, 'paratha', 200, 300], [/naan/, 'naan', 250, 350],
    [/biryani/, 'biryani (plate)', 500, 900], [/rice|chawal/, 'rice (bowl)', 200, 300], [/dal/, 'dal (bowl)', 150, 250],
    [/sabzi|bhindi|aloo|bhaji|vegetable/, 'sabzi (bowl)', 100, 200], [/chicken/, 'chicken curry (bowl)', 250, 400],
    [/fish/, 'fish curry (bowl)', 200, 350], [/egg|anda/, 'egg', 70, 90], [/dosa/, 'dosa', 150, 250], [/idli/, 'idli', 60, 90],
    [/poha/, 'poha (plate)', 250, 350], [/upma/, 'upma (plate)', 250, 350], [/samosa/, 'samosa', 150, 250], [/pav|bhaji/, 'pav bhaji', 400, 600],
    [/chai|tea/, 'chai', 80, 120], [/coffee/, 'coffee with milk', 60, 120], [/banana|kela/, 'banana', 90, 120], [/apple/, 'apple', 70, 100],
    [/dates|khajur/, 'dates (3)', 60, 80], [/pizza/, 'pizza (slice)', 250, 350], [/burger/, 'burger', 400, 600], [/coke|cold drink|soda/, 'cold drink', 130, 160],
    [/milk|doodh/, 'milk (glass)', 120, 160], [/curd|dahi/, 'curd (bowl)', 80, 120], [/salad/, 'salad', 50, 120],
  ];
  function demoMeal(text) {
    const parts = text.toLowerCase().split(/,| and | aur |\+|&/).map((x) => x.trim()).filter(Boolean);
    const meals = [];
    for (const part of parts) {
      const hit = FOOD_DB.find(([re]) => re.test(part)); if (!hit) continue;
      const n = +((part.match(/\d+/) || [1])[0]) || 1;
      meals.push({ item: n > 1 ? `${n} × ${hit[1]}` : hit[1], kcal_low: hit[2] * n, kcal_high: hit[3] * n });
    }
    return { meals, reply: meals.length ? '' : 'I could not recognise that food offline. Try naming each item, like "2 roti, dal".' };
  }

  async function addMeal() {
    const box = $('mealText'), text = box.value.trim();
    if (!text) { toast('Write what you ate first, for example "2 rotis and dal".'); return; }
    $('mealAdd').disabled = true;
    let r = await ai('meal', text, { slot: mealSlot, today: dayKey() });
    if (!Array.isArray(r.meals)) r = demoMeal(text);
    $('mealAdd').disabled = false;
    const meals = (r.meals || []).filter((m) => m && m.item).map((m) => ({ item: String(m.item).slice(0, 60), kcal_low: Math.max(0, Math.round(+m.kcal_low || 0)), kcal_high: Math.max(0, Math.round(+m.kcal_high || 0)) }));
    if (!meals.length) { toast(r.reply || 'I could not find any food in that. Try naming each item.'); return; }
    S.logs.push({ date: dayKey(), at: Date.now(), kind: 'meal', slot: mealSlot, text, parsed: { log: { meals, symptoms: [] }, reply: r.reply || '' } });
    box.value = ''; autoGrow(box); save(); renderToday();
    toast(`Added to ${mealSlot.toLowerCase()}: about ${r50(meals.reduce((a, m) => a + m.kcal_low, 0))}–${r50(meals.reduce((a, m) => a + m.kcal_high, 0))} kcal.`);
  }

  function removeMeal(li, mi) {
    const l = S.logs[li]; if (!l?.parsed?.log?.meals) return;
    l.parsed.log.meals.splice(mi, 1);
    if (l.kind === 'meal' && !l.parsed.log.meals.length) S.logs.splice(li, 1);
    save(); renderToday();
  }

  // ---------- 3D water glass (SVG): tapered tumbler, rising water, pour and ripple ----------
  const G = { rimY: 16, baseY: 156, rimW: 44, baseW: 32, rimRy: 9, baseRy: 6, maxY: 30 };
  let glassLevel = null, glassAnim = 0;
  const gW = (y) => G.baseW + (G.rimW - G.baseW) * (G.baseY - y) / (G.baseY - G.rimY);
  const gRy = (y) => G.baseRy + (G.rimRy - G.baseRy) * (G.baseY - y) / (G.baseY - G.rimY);
  const levelY = (f) => G.baseY - f * (G.baseY - G.maxY);
  function paintLevel(f) {
    const y = levelY(f), w = gW(y), ry = gRy(y);
    const body = f <= 0.001 ? '' : `M${60 - w} ${y} L${60 - G.baseW} ${G.baseY} A${G.baseW} ${G.baseRy} 0 0 0 ${60 + G.baseW} ${G.baseY} L${60 + w} ${y} A${w} ${ry} 0 0 1 ${60 - w} ${y}Z`;
    $('waterBody').setAttribute('d', body);
    const top = $('waterTop');
    top.setAttribute('cy', y); top.setAttribute('rx', f <= 0.001 ? 0 : w); top.setAttribute('ry', f <= 0.001 ? 0 : ry);
  }
  function drawGlass(f, glasses) {
    $('glassBack').setAttribute('d', `M${60 - G.rimW} ${G.rimY} L${60 - G.baseW} ${G.baseY} A${G.baseW} ${G.baseRy} 0 0 0 ${60 + G.baseW} ${G.baseY} L${60 + G.rimW} ${G.rimY} A${G.rimW} ${G.rimRy} 0 0 0 ${60 - G.rimW} ${G.rimY}Z`);
    $('glassFront').setAttribute('d', `M${60 - G.rimW} ${G.rimY} L${60 - G.baseW} ${G.baseY} A${G.baseW} ${G.baseRy} 0 0 0 ${60 + G.baseW} ${G.baseY} L${60 + G.rimW} ${G.rimY} A${G.rimW} ${G.rimRy} 0 0 1 ${60 - G.rimW} ${G.rimY}`);
    $('glassMarks').innerHTML = Array.from({ length: glasses - 1 }, (_, i) => {
      const y = levelY((i + 1) / glasses), x = 60 + gW(y);
      return `<path d="M${x - ((i + 1) % 4 ? 7 : 12)} ${y + 1} L${x - 2} ${y}" stroke="#fff" stroke-opacity="${(i + 1) % 4 ? 0.3 : 0.6}" stroke-width="1.4" stroke-linecap="round"/>`;
    }).join('');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (glassLevel === null || reduce) { glassLevel = f; paintLevel(f); return; }
    const from = glassLevel, to = f, t0 = performance.now(), dur = 900;
    glassLevel = f; cancelAnimationFrame(glassAnim);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      paintLevel(from + (to - from) * e);
      if (k < 1) glassAnim = requestAnimationFrame(step);
    };
    glassAnim = requestAnimationFrame(step);
  }
  function pour(f) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const y = levelY(Math.min(1, f)), st = $('stream'), rp = $('ripple');
    st.setAttribute('height', y + 20); st.style.transition = 'none'; st.setAttribute('opacity', '1');
    rp.setAttribute('cy', y); rp.setAttribute('rx', 4); rp.setAttribute('ry', 1.5); rp.setAttribute('opacity', '1');
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 900);
      st.setAttribute('opacity', k < 0.55 ? 1 : Math.max(0, 1 - (k - 0.55) / 0.45));
      st.setAttribute('width', 7 - 4 * k); st.setAttribute('x', 60 - (7 - 4 * k) / 2);
      const w = gW(y) * 0.9 * k;
      rp.setAttribute('rx', Math.max(4, w)); rp.setAttribute('ry', Math.max(1.5, gRy(y) * 0.9 * k)); rp.setAttribute('opacity', 1 - k);
      if (k < 1) requestAnimationFrame(step); else st.setAttribute('height', 0);
    };
    requestAnimationFrame(step);
  }

  function addWater(delta) {
    S.logs.push({ date: dayKey(), at: Date.now(), kind: 'water', text: delta > 0 ? '+1 glass' : '−1 glass', parsed: { log: { water_l: delta, meals: [], symptoms: [] } } });
    save(); renderToday();
    if (delta > 0) { const T2 = dayTotals(dayKey()); pour(T2.water_l / (S.ramadan ? 2.5 : 3)); }
  }

  // Calorie goal: only Rizwan sets it; the app never suggests a number and refuses unsafe ones.
  const CAL_MIN = 1800, CAL_MAX = 4500;
  function saveCalGoal() {
    const v = Math.round(+$('calGoalIn').value);
    if (!v) { $('calGoalMsg').textContent = 'Type a number, or leave it empty to just keep track.'; return; }
    if (v < CAL_MIN) { $('calGoalMsg').textContent = `That is too low for someone who runs regularly, so it was not saved. Talk to a doctor or dietitian before setting a goal under ${CAL_MIN.toLocaleString('en-IN')} kcal.`; return; }
    if (v > CAL_MAX) { $('calGoalMsg').textContent = `That is unusually high. Check it with a doctor or dietitian; goals above ${CAL_MAX.toLocaleString('en-IN')} kcal are not saved.`; return; }
    S.calGoal = v; S.ideas = null; save(); $('calGoalMsg').textContent = 'Goal saved. You can change it any time.'; renderToday();
  }

  const DEMO_IDEAS = {
    Breakfast: ['Poha with peanuts and a banana', 'Two eggs, two rotis and a glass of milk'],
    Lunch: ['Rice, dal, a bowl of sabzi and curd', 'Two rotis, chicken or paneer curry and salad'],
    Snacks: ['A banana and a handful of peanuts', 'Sprouts chaat or a glass of buttermilk'],
    Dinner: ['Two rotis, dal and a vegetable', 'Fish or egg curry with rice and salad'],
  };
  async function suggestMeals() {
    const T = dayTotals(dayKey());
    const done = new Set(logsFor(dayKey()).filter((l) => l.kind === 'meal').map((l) => l.slot));
    const left = SLOTS.filter((x) => !done.has(x) && SLOTS.indexOf(x) >= SLOTS.indexOf(slotNow()));
    $('ideasGo').disabled = true; $('ideasGo').textContent = 'Thinking…';
    let r = await ai('ideas', '', { calorie_goal: S.calGoal, eaten_kcal_low: T.kLow, eaten_kcal_high: T.kHigh, meals_left: left.length ? left : ['Snacks'], ran_today: T.run, ramadan_mode: S.ramadan, fasting_today: T.fasting });
    if (!Array.isArray(r.ideas)) r = { ideas: (left.length ? left : ['Snacks']).map((slot) => ({ slot, idea: DEMO_IDEAS[slot][0] })), note: '' };
    $('ideasGo').disabled = false; $('ideasGo').textContent = 'Suggest again';
    S.ideas = { date: dayKey(), list: r.ideas.slice(0, 5), note: r.note || '' }; save(); renderToday();
  }

  function renderToday() {
    show('main');
    $('ramadanBtn').setAttribute('aria-pressed', String(!!S.ramadan));
    $('dayLabel').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    $('goalName').textContent = labelOf(S.goal);
    $('flagBanner').hidden = !S.redFlag;

    // Rings: run, water, sleep
    const T = dayTotals(dayKey());
    const resting = S.redFlag || S.nextRest || !hasRun();
    const runGoal = hasRun() ? planKm(S.step) : 0, waterGoal = S.ramadan ? 2.5 : 3, sleepGoal = 8;
    const calGoal0 = !!S.goals?.cal;
    const slotsLogged = new Set(logsFor(dayKey()).filter((l) => l.kind === 'meal').map((l) => l.slot)).size;
    const parts = [
      { label: 'Run', color: 'var(--c-run)', frac: resting ? (T.run ? 1 : 0) : T.run_km / runGoal, text: resting ? (T.run ? `${+T.run_km.toFixed(1)} km` : hasRun() ? 'Rest day' : 'No run logged') : `${+T.run_km.toFixed(1)} / ${runGoal} km` },
      ...(calGoal0 ? [S.calGoal
        ? { label: 'Calories', color: 'var(--c-cal)', frac: ((T.kLow + T.kHigh) / 2) / S.calGoal, text: T.food ? `~${Math.round((T.kLow + T.kHigh) / 100) * 50} / ${S.calGoal.toLocaleString('en-IN')}` : `0 / ${S.calGoal.toLocaleString('en-IN')}` }
        : { label: 'Calories', color: 'var(--c-cal)', frac: slotsLogged / 4, text: T.food ? `${r50(T.kLow)}–${r50(T.kHigh)}` : 'None yet' }] : []),
      { label: 'Sleep', color: 'var(--c-sleep)', frac: (T.sleep_h || 0) / sleepGoal, text: `${T.sleep_h ?? 0} / ${sleepGoal} h` },
    ];
    // Water glass: fills in 250 ml glasses towards 3 L (2.5 L between iftar and sehri in Ramadan)
    const glasses = Math.round(waterGoal / 0.25);
    drawGlass(Math.min(1, T.water_l / waterGoal), glasses);
    $('waterAmt').textContent = `${+T.water_l.toFixed(2)} L`;
    $('waterGoal').textContent = `/ ${waterGoal} L`;
    $('waterHint').textContent = S.ramadan ? 'Ramadan: drink this between iftar and sehri. One tap adds a glass (250 ml).' : T.water_l >= waterGoal ? 'Goal reached. Keep sipping if it is hot or you ran.' : `One tap adds a glass (250 ml). ${Math.ceil((waterGoal - T.water_l) / 0.25)} glasses to go.`;
    $('waterMinus').disabled = T.water_l <= 0;
    $('rings').innerHTML = ringsSVG(parts);
    $('legend').innerHTML = parts.map((p) => `<li><i style="background:${p.color}"></i><span>${p.label}</span><b>${p.text}</b></li>`).join('');
    const mini = (label, val, sub) => `<div class="mini"><b>${val}</b><span>${label}${sub ? `<br><small>${sub}</small>` : ''}</span></div>`;
    $('miniStats').innerHTML = [
      T.hasSteps ? mini('Steps', T.steps.toLocaleString('en-IN'), 'from your phone') : `<button class="mini mini-add" id="stepsAdd"><b>+ Steps</b><span>Tap to add<br><small>the number from your phone</small></span></button>`,
      S.goals?.cal ? '' : mini('Food', T.food ? `${Math.round(T.kLow / 50) * 50}–${Math.round(T.kHigh / 50) * 50}` : '—', 'kcal, approx.'),
      S.ramadan || T.fasting ? mini('Fast', T.fasting ? 'Yes' : '—', 'Ramadan mode') : '',
    ].join('');

    // Calorie goal: food card (monitoring only). Whichever goal is in focus comes first.
    const calGoal = !!S.goals?.cal, calFocus = S.goal === 'cal';
    $('foodCard').hidden = !calGoal;
    if (calGoal) {
      const meals = logsFor(dayKey()).flatMap((l) => l.parsed?.log?.meals || []);
      $('foodTotal').innerHTML = T.food ? `<b>${Math.round(T.kLow / 50) * 50}–${Math.round(T.kHigh / 50) * 50}</b> kcal so far, approx.` : 'Nothing logged yet today.';
      $('mealsToday').innerHTML = meals.map((m) => `<li><span>${esc(m.item)}</span><b>${m.kcal_low}–${m.kcal_high}</b></li>`).join('');
    }
    const tt = $('tab-today');
    if (calFocus) tt.insertBefore($('foodCard'), document.querySelector('.rings-card')); else tt.insertBefore($('foodCard'), $('nextCard'));
    $('nextCard').hidden = !hasRun();
    $('runPlan').hidden = !hasRun();

    renderFood(T);
    $('ideas').innerHTML = S.ideas?.date === dayKey() ? `<ul class="meals ideas">${S.ideas.list.map((i) => `<li><span><b class="slot">${esc(i.slot || '')}</b> ${esc(i.idea || '')}</span>${i.kcal_low ? `<b>${i.kcal_low}–${i.kcal_high}</b>` : ''}</li>`).join('')}</ul>${S.ideas.note ? `<p class="small">${esc(S.ideas.note)}</p>` : ''}` : '';

    // Coach card: the latest thing the coach said today
    const todays = logsFor(dayKey()).filter((l) => !['meal', 'water'].includes(l.kind));
    const last = todays[todays.length - 1];
    if (last) { $('coachMsg').textContent = last.parsed?.reply || ''; $('coachTime').textContent = 'replying to your check-in'; }
    else if (S.morning?.date === dayKey()) { $('coachMsg').textContent = S.morning.message; $('coachTime').textContent = 'today'; }

    // Next session
    const total = (n) => sessionMinutes(n) + 16;
    if (S.redFlag) { $('nextLabel').textContent = 'Paused'; $('nextSession').innerHTML = '<span class="sw-text">No running until you feel OK</span>'; $('nextHint').textContent = 'See a doctor about the warning sign you mentioned.'; }
    else if (S.nextRest) { $('nextLabel').textContent = 'Next session'; $('nextSession').innerHTML = '<span class="sw-text">Rest day. An easy walk if you like.</span>'; $('nextHint').textContent = `Then: ${stepText(S.step)}`; }
    else { const v = variant(S.step); $('nextLabel').textContent = `Next run: ${v.name}`; $('nextSession').innerHTML = stepHTML(S.step); $('nextHint').textContent = `${v.note} About ${total(S.step)} min with warm-up and cool-down${S.ramadan ? ', after iftar' : ''}.`; }

    // PLAN tab
    const pct = Math.round(((S.step - 1) + S.atStep / SESSIONS_PER_STEP) / (LAST - 1) * 100);
    $('ringText').textContent = S.step;
    $('marks').innerHTML = Array.from({ length: LAST }, (_, i) => `<i class="${i + 1 < S.step ? 'done' : i + 1 === S.step ? 'now' : ''}" style="left:${(i / (LAST - 1)) * 100}%"></i>`).join('');
    $('runner').style.setProperty('--x', pct + '%');
    $('track').setAttribute('aria-label', `Step ${S.step} of ${LAST} on the way to ${GOAL.short}`);
    $('tapeLabel').textContent = GOAL.tape;
    $('ladderTitle').textContent = `All ${LAST} steps`;
    $('finishLead').textContent = S.done ? 'You did it:' : `${GOAL.short} by`;
    $('finishDate').textContent = S.done ? GOAL.short : fmtDate(targetDate());
    $('finishNote').textContent = S.done ? (S.runGoal === '5k' ? 'Next goal: 10K. Add it from your goals.' : 'Keep running for fun, and pick a new goal when you like.') : '';
    $('finishNote').hidden = !S.done;
    $('planLabel').textContent = S.redFlag ? 'Paused' : S.nextRest ? 'Rest day' : `Next run: ${variant(S.step).name}`;
    $('nextPlan').innerHTML = S.redFlag ? '<p class="small">No session until you have seen a doctor about the warning sign, or you feel completely fine.</p>'
      : sessionPlan(S.step, S.nextRest ? 'rest' : 'run');
    $('ladder').innerHTML = STEPS.slice(1).map((_, i) => { const n = i + 1; return `<li class="${n < S.step ? 'done' : n === S.step ? 'now' : ''}"><span class="n">${n}</span><span>${stepText(n)}</span>${n === S.step ? '<em>You are here</em>' : ''}</li>`; }).join('');

    // COACH tab: today's conversation, starting with the coach's own message
    const opener = S.morning?.date === dayKey() ? `<div class="bubble ai">${esc(S.morning.message)}<span class="meta">Coach, today</span></div>` : '';
    $('thread').innerHTML = opener + todays.map((l) => `
      <div class="bubble me">${esc(l.text)}</div>
      <div class="bubble ai ${l.parsed?.red_flag ? 'red' : ''}">${esc(l.parsed?.reply || '')}${l.note ? `<span class="meta">${esc(l.note)}</span>` : ''}</div>`).join('');

    // WEEK tab
    let bars = ''; const vals = [];
    for (let i = 6; i >= 0; i--) { const k = dayKey(addDays(new Date(), -i)); vals.push([k, dayTotals(k).run_km]); }
    const max = Math.max(3, ...vals.map((v) => v[1]));
    for (const [k, v] of vals) bars += `<div class="wb ${k === dayKey() ? 'today' : ''}"><span>${v ? +v.toFixed(1) : ''}</span><i style="height:${(v / max) * 70}%"></i>${new Date(k).toLocaleDateString('en-IN', { weekday: 'narrow' })}</div>`;
    $('weekbars').innerHTML = bars;
    const days = [...new Set(S.logs.map((l) => l.date))].sort().reverse();
    $('histList').innerHTML = days.length ? days.map((k) => {
      const D = dayTotals(k);
      const facts = [D.run ? `Ran ${+D.run_km.toFixed(1)} km` : 'No run', D.hasSteps ? `${D.steps.toLocaleString('en-IN')} steps` : '', D.water ? `${+D.water_l.toFixed(1)} L water` : '', D.sleep_h != null ? `${D.sleep_h} h sleep` : '', D.food ? `about ${Math.round(D.kLow)}–${Math.round(D.kHigh)} kcal` : ''].filter(Boolean).join(', ');
      return `<div class="hist-day"><h4>${fmtDate(k)}</h4><p>${facts}.</p>${logsFor(k).map((l) => `<p class="said">“${esc(l.text)}”</p><p class="replied">${esc(l.parsed?.reply || '')}</p>`).join('')}</div>`;
    }).join('') : '<p class="small">Nothing logged yet. Your check-ins will show up here.</p>';
  }

  async function morning(force = false) {
    const today = dayKey();
    if (!force && S.morning?.date === today) { renderToday(); return; }
    $('coachMsg').textContent = 'Looking at how yesterday went…'; $('coachMsg').classList.add('loading');
    const r = await ai('morning', '', context());
    $('coachMsg').classList.remove('loading');
    S.morning = { date: today, message: r.message || `Today: ${stepText(S.step)}.` }; save();
    renderToday();
  }

  // ---------- Actions ----------
  // ---------- Goals: in his own words, saved, editable, all kept going ----------
  // Starting step for each running goal from "how far can you run before you need to walk?"
  const START = { '5k': [1, 3, 5, 8, 12, 13], '10k': [1, 1, 1, 1, 2, 5] };
  let found = [], dist = null, days = 3, adding = false;

  function openSetup() {
    adding = !!S; found = []; dist = null; days = (S && S.runsPerWeek) || 3;
    $('onText').value = ''; autoGrow($('onText'));
    $('stepGoal').hidden = false; $('stepLevel').hidden = true;
    $('onBack').hidden = !S; $('onSample').hidden = !!S;
    show('onboard'); window.scrollTo(0, 0);
  }

  function demoGoals(text) {
    const t = text.toLowerCase(), g = [];
    if (/10\s*k|10\s*km|ten k/.test(t)) g.push({ type: '10k', label: 'Run 10K' });
    if (/5\s*k|5\s*km|five k|run|bhag/.test(t) && !g.length) g.push({ type: '5k', label: 'Run 5K without stopping' });
    if (/calor|kcal|food|eat|diet|khana/.test(t)) g.push({ type: 'cal', label: 'Keep track of my calories' });
    return { goals: g, unsupported: [], reply: g.length ? 'Got it. Here are your goals.' : '' };
  }

  async function readGoals() {
    const text = $('onText').value.trim();
    if (!text) { toast('Write your goal first, or tap one of the suggestions.'); return; }
    $('onGo').disabled = true; $('onGo').textContent = 'Reading your goal…';
    let r = await ai('goals', text, { today: dayKey(), existing_goals: Object.keys(S?.goals || {}) });
    if (!Array.isArray(r.goals)) r = demoGoals(text);
    $('onGo').disabled = false; $('onGo').textContent = 'Next';
    found = r.goals.filter((g) => GOALS[g.type]).map((g) => ({ type: g.type, label: String(g.label || GOALS[g.type].title).slice(0, 80) }));
    found = found.filter((g, i) => found.findIndex((x) => x.type === g.type) === i);
    if (!found.length) { toast(r.reply || 'I can help with running 5K or 10K and keeping track of calories. Try one of the suggestions.'); return; }
    window._goalReply = r.reply || '';
    $('foundGoals').innerHTML = found.map((g) => `<li><span class="g-dot">${GOALS[g.type].tape}</span><span><b>${esc(g.label)}</b><small>${S?.goals?.[g.type] ? 'Updates your existing goal' : GOALS[g.type].blurb}</small></span></li>`).join('');
    const un = (r.unsupported || []).filter(Boolean);
    $('goalNote').textContent = un.length ? `Not something this app can help with: ${un.join(', ')}. It covers running and keeping track of food.` : '';
    const needsLevel = found.some((g) => isRun(g.type) && !S?.goals?.[g.type]);
    $('stepLevel').querySelector('.card').hidden = !needsLevel;
    $('levelGo').textContent = needsLevel ? 'Build my plan' : 'Save my goals';
    paintSeg();
    $('stepGoal').hidden = true; $('stepLevel').hidden = false; window.scrollTo(0, 0);
  }

  function paintSeg() {
    document.querySelectorAll('#segDist button').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.v === dist)));
    document.querySelectorAll('#segDays button').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.v === days)));
  }

  function saveGoals() {
    const needsLevel = !$('stepLevel').querySelector('.card').hidden;
    if (needsLevel && dist == null) { toast('Tap how far you can run now, so the plan starts at the right level.'); return; }
    if (!S) S = { v: 3, logs: [], ramadan: false, goals: {}, goal: null, runGoal: null };
    let focus = null;
    for (const g of found) {
      if (S.goals[g.type]) { S.goals[g.type].label = g.label; focus = focus || g.type; continue; }
      if (isRun(g.type)) {
        if (g.type === '10k' && dist < 3) toast('The 10K plan starts at 30 minutes non-stop. The 5K goal may suit you first.', 6000);
        stash();
        S.goals[g.type] = { label: g.label, step: START[g.type][dist], atStep: 0, runsPerWeek: days, done: false, nextRest: false, lastChangeDay: null, created: dayKey() };
        loadRun(g.type);
      } else {
        S.goals[g.type] = { label: g.label, created: dayKey() };
      }
      focus = focus || g.type;
    }
    if (!S.runGoal) { const r = Object.keys(S.goals).find(isRun); if (r) loadRun(r); }
    S.goal = focus;
    if (!adding || window._goalReply) S.morning = { date: dayKey(), message: window._goalReply || 'Your goals are saved.' };
    save(); renderToday(); setTab('today');
  }

  function renderGoals() {
    show('goals');
    $('goalList').innerHTML = Object.entries(S.goals).map(([id, g]) => {
      let prog = 'No targets, just awareness';
      if (isRun(id)) { const st = S.runGoal === id ? S : g; const steps = GOALS[id].steps.length - 1; prog = st.done ? 'Finished 🏁' : `Step ${st.step} of ${steps}`; }
      return `<div class="goal-card ${S.goal === id ? 'focus' : ''}">
        <button class="goal-pick" data-goal="${id}"><span class="g-tape">${GOALS[id].tape}</span><span class="g-text"><b>${esc(labelOf(id))}</b><span>${prog}</span></span></button>
        <button class="g-edit" data-edit="${id}" aria-label="Edit this goal">Edit</button>
        <div class="g-form" id="edit-${id}" hidden>
          <label class="small" for="lbl-${id}">Your goal, in your words</label>
          <input id="lbl-${id}" value="${esc(labelOf(id))}" maxlength="80">
          <div class="g-actions"><button class="btn-small" data-save="${id}">Save</button><button class="btn-small danger" data-remove="${id}">Remove goal</button></div>
        </div></div>`;
    }).join('');
    $('addGoal').hidden = Object.keys(GOALS).every((id) => S.goals[id]);
  }

  function removeGoal(id) {
    if (S.runGoal === id) { S.runGoal = null; }
    delete S.goals[id];
    const left = Object.keys(S.goals);
    if (!left.length) { try { localStorage.removeItem(KEY); } catch {} S = null; start(); return; }
    if (!S.runGoal) { const r = left.find(isRun); if (r) { S.runGoal = null; Object.assign(S, S.goals[r]); S.runGoal = r; useGoal(r); } }
    if (S.goal === id) S.goal = S.runGoal || left[0];
    save(); renderGoals(); toast('Goal removed.');
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
      v: 3, goal: '5k', runGoal: '5k', goals: { cal: { label: 'Keep track of my calories', created: d(6) } }, created: d(6), step: 5, atStep: 1, runsPerWeek: 3, ramadan: false, sample: true,
      logs: [
        L(6, 'Ran 2k, walked 3 times. 2 bottles water. Slept 1am to 7am. Rice, dal, fish curry for lunch.', { run_km: 2, walk_breaks: 3, water_l: 2, sleep_h: 6, meals: [{ item: 'rice, dal, fish curry', kcal_low: 550, kcal_high: 800 }] }, 'Solid start. Try to get one more bottle of water in tomorrow.', 'repeat'),
        L(4, 'aaj 2.5k bhaga, 2 baar ruka, paani 3 bottle, 7 ghante soya', { run_km: 2.5, walk_breaks: 2, water_l: 3, sleep_h: 7 }, 'Fewer stops than last time. Good water day too.', 'up'),
        L(3, 'No run, college fest. Had biryani and cold drink. Slept 5 hours', { water_l: 1, sleep_h: 5, meals: [{ item: 'biryani + cold drink', kcal_low: 700, kcal_high: 1200 }] }, 'Rest days count too. Aim for an earlier night tonight.', 'repeat'),
        L(1, 'Ran 2.8k, back felt a bit stiff after. 2.5 L water.', { run_km: 2.8, water_l: 2.5, symptoms: ['back stiffness'] }, 'Good run. Keep tomorrow easy, and see a physio if the back stiffness keeps coming back.', 'repeat'),
      ],
    };
    useGoal('5k');
    S.morning = { date: dayKey(), message: 'Back was stiff yesterday, so today is your normal session, nice and easy. Get 3 bottles of water in before evening.' };
    save(); $('menu').hidden = true; renderToday(); setTab('today'); morning(true);
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

  function autoGrow(t) {
    if (!t.value || !t.offsetParent) { t.style.height = ''; return; } // empty or hidden: use the box's natural size so the example shows
    t.style.height = 'auto'; t.style.height = Math.min(160, Math.max(t.scrollHeight, 24)) + 'px';
  }

  // ---------- Wire up ----------
  $('onGo').addEventListener('click', readGoals);
  $('levelGo').addEventListener('click', saveGoals);
  $('levelBack').addEventListener('click', () => { $('stepLevel').hidden = true; $('stepGoal').hidden = false; });
  $('suggest').addEventListener('click', (e) => { const b = e.target.closest('[data-add]'); if (!b) return; const t = $('onText'); t.value = t.value.trim() ? `${t.value.trim().replace(/[.,]$/, '')} and ${b.dataset.add.toLowerCase()}` : b.dataset.add; autoGrow(t); });
  $('segDist').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { dist = +b.dataset.v; paintSeg(); } });
  $('segDays').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { days = +b.dataset.v; paintSeg(); } });
  $('onSample').addEventListener('click', loadSample);
  $('onBack').addEventListener('click', () => { Object.keys(S.goals).length > 1 ? renderGoals() : (renderToday(), setTab('today')); });
  $('goalList').addEventListener('click', (e) => {
    const t = e.target;
    const pick = t.closest('[data-goal]'), ed = t.closest('[data-edit]'), sv = t.closest('[data-save]'), rm = t.closest('[data-remove]');
    if (ed) { const f = $('edit-' + ed.dataset.edit); f.hidden = !f.hidden; if (!f.hidden) f.querySelector('input').focus(); return; }
    if (sv) { const id = sv.dataset.save, v = $('lbl-' + id).value.trim(); if (v) { S.goals[id].label = v.slice(0, 80); save(); toast('Goal updated.'); } renderGoals(); return; }
    if (rm) { if (rm.dataset.armed) { removeGoal(rm.dataset.remove); } else { rm.dataset.armed = '1'; rm.textContent = 'Tap again to remove'; } return; }
    if (pick) { const id = pick.dataset.goal; const switched = id !== S.goal; activate(id); renderToday(); setTab('today'); if (switched && isRun(id)) morning(true); }
  });
  $('addGoal').addEventListener('click', openSetup);
  $('mealAdd').addEventListener('click', addMeal);
  $('waterPlus').addEventListener('click', () => addWater(0.25));
  $('waterMinus').addEventListener('click', () => addWater(-0.25));
  $('calGoalSave').addEventListener('click', saveCalGoal);
  $('calGoalClear').addEventListener('click', () => { delete S.calGoal; S.ideas = null; save(); $('calGoalMsg').textContent = 'Goal removed. Still keeping track.'; renderToday(); });
  $('ideasGo').addEventListener('click', suggestMeals);
  $('mealText').addEventListener('input', (e) => autoGrow(e.target));
  $('segMeal').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { mealSlot = b.dataset.v; document.querySelectorAll('#segMeal button').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.v === mealSlot))); } });
  $('mealGroups').addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (!b) return; const [li, mi] = b.dataset.rm.split(':').map(Number); removeMeal(li, mi); });
  $('goalSwitch').addEventListener('click', renderGoals);
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
  });
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.go)));
  document.querySelectorAll('#tabbar button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('tellCoach').addEventListener('click', () => { setTab('coach'); setTimeout(() => $('ciText').focus(), 50); });
  $('miniStats').addEventListener('click', (e) => {
    if (!e.target.closest('#stepsAdd')) return;
    setTab('coach'); const t = $('ciText'); t.value = 'Steps today: '; autoGrow(t);
    setTimeout(() => { t.focus(); t.setSelectionRange(t.value.length, t.value.length); }, 50);
  });
  function confirmReset() {
    const b = document.querySelector('[data-act="reset"]');
    if (b.dataset.armed) return true;
    b.dataset.armed = '1'; b.textContent = 'Tap again to erase everything'; $('menu').hidden = false;
    setTimeout(() => { delete b.dataset.armed; b.textContent = 'Start over'; }, 4000);
    return false;
  }

  function start() {
    if (!S) { openSetup(); return; }
    if (S.goals && Object.keys(S.goals).length > 1) { renderGoals(); return; } // more than one goal: ask which one to focus on
    renderToday(); setTab('today'); morning();
  }
  start();
})();
