/**
 * Collection grid: 40 slots per page (10 x 4 on desktop, 4 x 10 on phones), newest pulls last.
 */
import { RARITY_COLOR, RARITY_LABEL } from '../data/catalog.js';
import { vault } from '../lib/vault.js';
import { createCard, formatSerial } from './card.js';
import { openDialog } from './dialog.js';
import { renderHints } from './hints.js';

const PER_PAGE = 40;

export function mountCollection(root) {
  let page = 0;
  root.innerHTML = `
    <div class="grid" data-grid></div>
    <nav class="pager" aria-label="Pages">
      <button type="button" class="btn btn--ghost" data-prev aria-label="Previous page">◀</button>
      <span data-label></span>
      <button type="button" class="btn btn--ghost" data-next aria-label="Next page">▶</button>
    </nav>`;
  const grid = root.querySelector('[data-grid]');
  const label = root.querySelector('[data-label]');
  const prev = root.querySelector('[data-prev]');
  const next = root.querySelector('[data-next]');

  function render(state) {
    const cards = state.cards;
    const pages = Math.max(1, Math.ceil(cards.length / PER_PAGE));
    page = Math.min(page, pages - 1);
    grid.innerHTML = '';
    for (let i = 0; i < PER_PAGE; i++) {
      const card = cards[page * PER_PAGE + i];
      const cell = document.createElement('div');
      cell.className = 'grid__cell';
      if (card) cell.append(createCard(card, { size: 1, onSelect: inspect }));
      else cell.innerHTML = '<span class="slot" aria-label="Empty slot">?</span>';
      grid.append(cell);
    }
    label.textContent = `${page + 1} / ${pages}`;
    prev.disabled = page === 0;
    next.disabled = page >= pages - 1;
  }
  prev.addEventListener('click', () => { page--; render(vault.get()); });
  next.addEventListener('click', () => { page++; render(vault.get()); });
  vault.subscribe(render);
}

function inspect(card) {
  const body = document.createElement('div');
  body.className = 'inspect';
  body.append(createCard(card, { size: 2.5, label: false }));
  const info = document.createElement('div');
  info.innerHTML = `
    <p class="rarity" style="color:${RARITY_COLOR[card.rarity]}">${RARITY_LABEL[card.rarity]}</p>
    <dl class="facts">
      <dt>Card</dt><dd>#${formatSerial(card.no)}</dd>
      <dt>From</dt><dd>${card.source}</dd>
      <dt>Status</dt><dd>Sealed</dd>
    </dl>
    ${renderHints(card.hints)}`;
  body.append(info);
  openDialog({ title: 'Sealed card', body });
}
