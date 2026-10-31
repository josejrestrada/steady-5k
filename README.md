# Steady 5K

**Jose Ramil Jr. D. Estrada** · Roll No. **[roll number]** · MAI-594 Introduction to Vibe Coding · AY 2026–27

> **A running coach for Rizwan, a 22-year-old new runner, that gets him to 5K without stopping: he tells it about his day in one message (typed or spoken, English or Hinglish), and it logs everything, adjusts his plan and speaks first each day, including during Ramadan.**

- **Live app:** [https://…]
- **Report:** [REPORT.md](REPORT.md)

Not medical advice. The app does not diagnose or prescribe. Prototype: use made-up data only.

## How it works

- `index.html`, `style.css`, `app.js`: the app (plain HTML/CSS/JavaScript, no build step). Data is stored only in the browser (localStorage).
- `api/coach.js`: a Vercel serverless function that calls Google Gemini. The API key is read from the `GEMINI_API_KEY` environment variable on Vercel and is **never** committed.
- If the AI is unreachable, the app switches to a labelled demo mode with basic rule-based replies.
- A red-flag check in `app.js` (chest pain, fainting, dizziness, etc.) pauses training even if the AI misses it.

## Credits

- Google Gemini API (AI model), called from a Vercel serverless function.
- Manrope font by Mikhail Sharanda, via Google Fonts (SIL Open Font License).
- No third-party code libraries. The run/walk plan ladder was written for this project.
- Built with Claude (Anthropic) as the AI coding assistant; see the AI-use disclosure in the report.
