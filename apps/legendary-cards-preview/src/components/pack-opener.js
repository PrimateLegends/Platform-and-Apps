/**
 * Pack shelf + opener: shows sealed packs, rips one open and deals its six cards in a fan.
 * Tapping a dealt card shows its hints.
 */
import { PACK_BY_ID } from '../data/catalog.js';
import { vault } from '../lib/vault.js';
import { createCard } from './card.js';
import { openDialog } from './dialog.js';
import { renderHints } from './hints.js';

export function mountPacks(root) {
  vault.subscribe(state => {
    root.innerHTML = '';
    if (!state.packs.length) {
      root.innerHTML = '<p class="muted">No sealed packs left. Reset the demo to get two new ones.</p>';
      return;
    }
    state.packs.forEach(id => {
      const pack = PACK_BY_ID[id];
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'pack';
      item.innerHTML = `<img src="public/img/packs/${id}.png" alt=""><span>${pack.name}</span><small>6 cards, unrevealed</small>`;
      item.addEventListener('click', () => rip(id));
      root.append(item);
    });
  });
}

function rip(packId) {
  const cards = vault.openPack(packId);
  const wrap = document.createElement('div');
  wrap.className = 'deal';
  const hint = document.createElement('div');
  hint.className = 'deal__hint';
  hint.innerHTML = '<p class="muted">Tap a card to see its hints.</p>';
  const fan = document.createElement('div');
  fan.className = 'deal__fan';
  cards.forEach((card, i) => {
    const el = createCard(card, { size: 1.5, onSelect: c => { hint.innerHTML = renderHints(c.hints, { compact: true }); } });
    el.style.setProperty('--i', i);
    el.style.setProperty('--n', cards.length);
    fan.append(el);
  });
  wrap.append(fan, hint);
  openDialog({ title: PACK_BY_ID[packId].name, body: wrap, className: 'dialog--wide' });
}
