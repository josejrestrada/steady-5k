'use client';

import { useEffect } from 'react';
import { initSteady } from '../lib/steady';

export default function Home() {
  useEffect(() => initSteady(), []);

  return (
    <div className="app">
        <header className="topbar">
          <div className="brand"><span className="logo" aria-hidden="true"></span>Steady&nbsp;5K</div>
          <div className="top-actions">
            <button id="ramadanBtn" className="pill" hidden aria-pressed="false" title="Ramadan mode">🌙 Ramadan</button>
            <button id="menuBtn" className="icon-btn" aria-label="Menu">⋯</button>
          </div>
        </header>
        <div id="menu" className="menu" hidden>
          <button data-act="history">Past days</button>
          <button data-act="sample">Load sample week (made-up data)</button>
          <button data-act="reset" className="danger">Start over</button>
        </div>

        <div id="demoBanner" className="demo-banner" hidden>Demo mode: the AI is offline, so replies are basic. Your entries are still saved.</div>

        {/* ONBOARDING */}
        <main id="onboard" className="view" hidden>
          <section className="hero">
            <p className="eyebrow">Your goal</p>
            <h1>Run 5K without stopping to walk.</h1>
            <p className="lede">No forms. Tell me where your running is today, in your own words. I'll build the plan and set your finish line.</p>
          </section>
          <section className="card">
            <label htmlFor="onText" className="label">How's your running right now?</label>
            <div className="composer composer-lg">
              <textarea id="onText" rows={4} placeholder="e.g. I started 2 months ago, I can run about 1.5 km before I need to walk. I run 3 days a week, mostly evenings." />
              <button className="mic" data-target="onText" aria-label="Speak instead">🎤</button>
            </div>
            <button id="onGo" className="btn-primary">Build my plan</button>
            <button id="onSample" className="btn-link">Just exploring? Load a sample week</button>
          </section>
          <p className="notice">Not medical advice. Steady does not diagnose or prescribe. If you have chest pain, faint, or feel dizzy, stop and see a doctor.</p>
        </main>

        {/* TODAY */}
        <main id="today" className="view" hidden>
          <section className="coach-card" aria-live="polite">
            <div className="coach-head"><span className="coach-dot"></span>Coach <span id="coachTime" className="muted"></span></div>
            <p id="coachMsg" className="coach-msg">…</p>
          </section>

          <section id="flagBanner" className="flag" hidden>
            <strong>Training paused.</strong>
            <span id="flagText">You mentioned a warning sign. Please see a doctor before your next run.</span>
            <button id="flagClear" className="btn-small">A doctor has checked me / I feel fine now</button>
          </section>

          <section className="finish card">
            <div className="finish-top">
              <div>
                <p className="eyebrow">Finish line</p>
                <h2 id="finishDate">5K non-stop</h2>
              </div>
              <div className="ring" id="ring"><span id="ringText">1/13</span></div>
            </div>
            <div className="bar"><span id="barFill"></span></div>
            <p id="finishNote" className="muted small"></p>
          </section>

          <section className="card next">
            <p className="eyebrow" id="nextLabel">Next run</p>
            <h3 id="nextSession">—</h3>
            <p id="nextHint" className="muted small"></p>
            <div id="nextPlan"></div>
          </section>

          <section className="card">
            <p className="eyebrow">Today so far</p>
            <div className="chips" id="chips"></div>
          </section>

          <section className="thread" id="thread"></section>

          <section className="week card">
            <p className="eyebrow">Last 7 days · km run</p>
            <div className="weekbars" id="weekbars"></div>
          </section>

          <p className="notice">Not medical advice. Steady does not diagnose or prescribe. Prototype for a class project; use made-up data only.</p>
          <div className="spacer"></div>
        </main>

        {/* HISTORY */}
        <main id="history" className="view" hidden>
          <button className="btn-link back" data-go="today">← Today</button>
          <h2>Past days</h2>
          <div id="histList"></div>
        </main>

        <footer id="dock" className="dock" hidden>
          <div className="composer">
            <textarea id="ciText" rows={1} placeholder="How did today go? Run, steps, food, water, sleep — just say it." />
            <button className="mic" data-target="ciText" aria-label="Speak instead">🎤</button>
            <button id="ciSend" className="send" aria-label="Send">➤</button>
          </div>
        </footer>

        <div id="toast" className="toast" hidden></div>
      </div>
  );
}
