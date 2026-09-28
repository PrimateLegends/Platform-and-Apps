/**
 * <sealed-card>: a Legendary Card seen from the back, with a rarity glow and a pointer-follow tilt.
 * Usage: createCard({ no, rarity, back }, { size: 2, onSelect })
 */
import { RARITY_COLOR, RARITY_LABEL } from '../data/catalog.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createCard(card, { size = 2, label = true, onSelect } = {}) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'card';
  el.style.setProperty('--px', size);
  el.style.setProperty('--glow', RARITY_COLOR[card.rarity]);
  el.setAttribute('aria-label', `${RARITY_LABEL[card.rarity]} sealed card #${formatSerial(card.no)}`);
  el.innerHTML = `
    <span class="card__face">
      <img class="card__back" src="public/img/cards/back-${card.back}.png" alt="">
      <img class="card__logo" src="public/img/brand/logo.png" alt="">
      <span class="card__shine"></span>
    </span>
    ${label ? `<span class="card__serial">#${formatSerial(card.no)}</span>` : ''}`;

  if (!reduceMotion) {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--tilt-x', `${(-y * 14).toFixed(1)}deg`);
      el.style.setProperty('--tilt-y', `${(x * 18).toFixed(1)}deg`);
    });
    el.addEventListener('pointerleave', () => {
      el.style.removeProperty('--tilt-x');
      el.style.removeProperty('--tilt-y');
    });
  }
  if (onSelect) el.addEventListener('click', () => onSelect(card));
  return el;
}

export const formatSerial = n => String(n).padStart(5, '0');
