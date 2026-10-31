// Serverless function (Vercel). Calls Google Gemini and returns structured JSON.
// The API key lives ONLY in the host's environment variable GEMINI_API_KEY. Never commit it.

// Tried in order. Thinking is switched off where the model allows it, so replies come back in a few seconds.
const MODELS = [
  ...(process.env.GEMINI_MODEL ? [{ id: process.env.GEMINI_MODEL, thinking: null }] : []),
  { id: 'gemini-3.5-flash-lite', thinking: { thinkingLevel: 'minimal' } },
  { id: 'gemini-3.5-flash-lite', thinking: null },
  { id: 'gemini-3.8-flash', thinking: { thinkingLevel: 'low' } },
  { id: 'gemini-3.8-flash', thinking: null },
  { id: 'gemini-flash-latest', thinking: null },
];

const PLAN_LADDER = `Plan steps (1 to 13):
1 run 1 min / walk 1.5 min x 8
2 run 1.5 / walk 1.5 x 7
3 run 2 / walk 1.5 x 6
4 run 3 / walk 1.5 x 5
5 run 4 / walk 1.5 x 4
6 run 5 / walk 1 x 4
7 run 7 / walk 1 x 3
8 run 9 / walk 1 x 3
9 run 12 / walk 1 x 2
10 run 15 / walk 1 x 2
11 run 20 min non-stop
12 run 25 min non-stop
13 run 5 km non-stop (the finish line)`;

const SYSTEM = `You are "Steady", the coach inside a prototype running app built for one person: Rizwan, 22, a college student in India who started running two months ago.
His goal: run 5 km at one steady pace without stopping to walk, then 10 km. His struggles: stamina and back pain.
He eats mostly home-cooked Indian food (brunch at college, 2-3 restaurant meals a week). He is Muslim and fasts in Ramadan; thirst is his hardest problem when fasting; he avoids running while fasting but plays football and badminton while fasting.
He writes in English or Hinglish, sometimes through voice transcription with spelling errors. Understand roti, dal, sabzi, bhindi, biryani, roza, sehri, iftar, paani, bhaga (ran), soya (slept), etc.

${PLAN_LADDER}

RULES (never break these):
1. Replies are at most 2 short sentences and under 40 words, warm and direct, like a coach texting a friend. No lists. At most one emoji.
2. Never diagnose. Never name or recommend medicines, painkillers, supplements or rehab exercises. Never tell him to push through pain.
3. RED FLAGS: chest pain or tightness, fainting or nearly fainting, dizziness or light-headedness, breathlessness that does not settle, palpitations, pain that keeps coming back or is getting worse, blood. If any is present: red_flag=true, plan_action="rest", and the reply tells him to stop training today and see a doctor (for chest pain/tightness or fainting: get medical help urgently). Give no training tips in that reply.
4. Mild soreness or back discomfort that is not a red flag: plan_action "down" or "rest", and suggest a doctor or physio if it keeps happening.
5. Never encourage skipping meals, crash dieting, extreme calorie targets, running while fasting in the heat, or extra/double sessions to catch up. Never comment on his body or weight.
6. Calories: estimate typical Indian home portions as a range (kcal_low, kcal_high). If portion size is unknown, use a wide range. Never claim precision.
7. Never invent numbers he did not give: use null. 1 bottle = 1 litre and 1 glass = 0.25 litre unless he says otherwise. Steps come from his phone, e.g. "7k steps" = 7000; never treat steps as km.
8. If a check-in is too vague to log (e.g. "ok", "hi"), set needs_question=true and ask exactly one short question.
9. Never sell, link or recommend products or brands.
10. If he asks a question, answer it within these rules and log only what he actually reported.
Output ONLY valid JSON matching the requested shape.`;

function prompt(mode, text, ctx) {
  const c = JSON.stringify(ctx || {});
  if (mode === 'onboard') {
    return `He is setting up the app and describes his running now: """${text}"""
Context: ${c}
Choose the plan step he can already do comfortably (be conservative; if unclear choose a lower step). Guess runs_per_week from what he says (default 3, clamp 2-5). Set ramadan=true only if he says he is fasting now.
Return JSON: {"start_step": integer 1-13, "runs_per_week": integer, "ramadan": boolean, "reply": string (max 2 sentences: confirm where he starts and that the first session is ready)}`;
  }
  if (mode === 'morning') {
    return `Write the message he sees when he opens the app today, before he types anything.
Context (today's planned session, recent logs, Ramadan mode, days since last run, time of day): ${c}
Pick the ONE thing that matters most today from his recent logs (often water, sometimes sleep or rest). If ramadan_mode is true, the run should be after iftar, never while fasting, and mention water between iftar and sehri. If the last check-in had a red flag, tell him to rest and see a doctor before running again.
Return JSON: {"message": string (max 2 sentences, under 40 words), "focus": "run"|"water"|"sleep"|"rest"}`;
  }
  return `Daily check-in from Rizwan: """${text}"""
Context (today's planned session, plan step, sessions done at this step, Ramadan mode, recent logs, date): ${c}
plan_action rules: "up" only if he did today's planned session comfortably with no pain; "repeat" if partly done, tough, or no run today; "down" if pain, he struggled badly, or he missed 4+ days; "rest" for red flags, illness, exhaustion, or a match/tournament day.
ramadan_detected=true if he mentions roza, fasting, sehri or iftar as happening now.
Return JSON: {"log": {"run_km": number|null, "run_min": number|null, "walk_breaks": number|null, "ran_nonstop": boolean|null, "steps": number|null, "water_l": number|null, "sleep_h": number|null, "meals": [{"item": string, "kcal_low": number, "kcal_high": number}], "fasting": boolean|null, "symptoms": [string]}, "red_flag": boolean, "ramadan_detected": boolean, "plan_action": "up"|"repeat"|"down"|"rest", "nudge": "water"|"sleep"|"food"|"run"|"none", "needs_question": boolean, "reply": string}`;
}

async function callGemini(model, key, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return r;
  } finally { clearTimeout(t); }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'no_key' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { mode, text = '', context = {} } = body || {};
  if (!['onboard', 'checkin', 'morning'].includes(mode)) return res.status(400).json({ error: 'bad mode' });
  if (typeof text !== 'string' || text.length > 1500) return res.status(400).json({ error: 'text too long' });

  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: prompt(mode, text, context) }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 1024 },
  };

  try {
    let r = null, lastErr = '';
    for (const m of MODELS) {
      const cfg = { ...payload.generationConfig, ...(m.thinking ? { thinkingConfig: m.thinking } : {}) };
      try {
        r = await callGemini(m.id, key, { ...payload, generationConfig: cfg });
      } catch (e) { lastErr += `${m.id}: ${String(e).slice(0, 80)} | `; r = null; continue; } // timeout: try the next model
      if (r.ok) break;
      lastErr += `${m.id}: ${r.status} ${(await r.text()).slice(0, 200)} | `;
      if (r.status === 401 || r.status === 403) break; // bad key: no point trying other models
    }
    if (!r) return res.status(502).json({ error: 'ai_unreachable', detail: lastErr });
    if (!r.ok) return res.status(502).json({ error: 'ai_error', detail: lastErr });
    const data = await r.json();
    const raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    const clean = raw.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    let out;
    try { out = JSON.parse(clean); } catch { return res.status(502).json({ error: 'bad_json', raw: raw.slice(0, 300) }); }
    return res.status(200).json(out);
  } catch (e) {
    return res.status(502).json({ error: 'ai_unreachable', detail: String(e).slice(0, 200) });
  }
};
