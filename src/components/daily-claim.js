/**
 * Daily claim: one sealed card every 24 hours, a 7-day streak tracker and a Bounty on day 7.
 * The preview has a "skip a day" control so the streak can be tried without waiting.
 */
import { STREAK_DAYS } from '../data/catalog.js';
import { vault } from '../lib/vault.js';
import { createCard } from './card.js';
import { renderHints } from './hints.js';

const DAY = 24 * 60 * 60 * 1000;
let clockOffset = 0;                       // demo only: fast-forwards time
const now = () => Date.now() + clockOffset;

const ICON = {
  done: '<svg viewBox="0 0 16 16" aria-label="Claimed"><circle cx="8" cy="8" r="7" fill="#2fbf65"/><path d="M4.6 8.3l2.2 2.1 4.6-4.7" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  wait: '<svg viewBox="0 0 16 16" aria-label="Ready today"><circle cx="8" cy="8" r="7" fill="#12242a" stroke="#e9c065" stroke-width="1.5"/><path d="M5.5 4.5h5M5.5 11.5h5M6 4.5c0 2.3 4 2.1 4 3.5s-4 1.2-4 3.5M10 4.5c0 2.3-4 2.1-4 3.5s4 1.2 4 3.5" fill="none" stroke="#e9c065" stroke-width="1.2"/></svg>'
};

export function mountDailyClaim(root) {
  root.innerHTML = `
    <ol class="streak" aria-label="${STREAK_DAYS}-day streak"></ol>
    <div class="row">
      <button type="button" class="btn" data-claim>Claim free card</button>
      <span class="muted" data-status></span>
    </div>
    <div class="claim-result" data-result hidden></div>
    <button type="button" class="link" data-skip>Skip ahead one day (demo)</button>`;

  const streakEl = root.querySelector('.streak');
  const btn = root.querySelector('[data-claim]');
  const status = root.querySelector('[data-status]');
  const result = root.querySelector('[data-result]');

  function render() {
    const s = vault.claimStatus(now());
    let shown = s.streak % STREAK_DAYS;
    if (s.streak && shown === 0 && !s.ready) shown = STREAK_DAYS;
    let lostAt = 0;
    if (!s.streak && s.lost % STREAK_DAYS) { shown = s.lost % STREAK_DAYS; lostAt = shown + 1; }

    streakEl.innerHTML = Array.from({ length: STREAK_DAYS }, (_, i) => {
      const day = i + 1;
      const state = day <= shown ? 'done' : day === lostAt ? 'lost' : day === shown + 1 && s.ready ? 'today' : '';
      const art = day === STREAK_DAYS
        ? '<img src="public/img/items/bounty.png" alt="Bounty">'
        : '<img src="public/img/cards/back-classic.png" alt="">';
      const mark = state === 'done' ? ICON.done : state === 'today' ? ICON.wait : state === 'lost' ? '<b class="x">✕</b>' : '';
      return `<li class="streak__day ${state}"><span>${art}${mark}</span><small>Day ${day}</small></li>`;
    }).join('');

    btn.disabled = !s.ready;
    status.textContent = s.ready ? 'Your free card is ready' : `Next card in ${Math.ceil((s.nextAt - now()) / 3600000)}h`;
  }

  btn.addEventListener('click', () => {
    const { card, bounty } = vault.claim(now());
    result.hidden = false;
    result.innerHTML = '';
    result.append(createCard(card, { size: 1.5 }));
    const info = document.createElement('div');
    info.innerHTML = `${bounty ? '<p class="bounty">7-day streak: +1 Bounty</p>' : ''}${renderHints(card.hints)}`;
    result.append(info);
    render();
  });
  root.querySelector('[data-skip]').addEventListener('click', () => { clockOffset += DAY + 60000; render(); });

  vault.subscribe(render);
}
