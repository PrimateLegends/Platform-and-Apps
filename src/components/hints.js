/**
 * Hints panel for a sealed card: card type, possible clan (with odds) and rarity, which stays hidden.
 */
import { CARD_TYPES, CLAN_BY_ID } from '../data/catalog.js';

export function renderHints(hints, { compact = false } = {}) {
  const type = CARD_TYPES[hints.type];
  const typeTag = type ? `<span class="tag" style="--tag:${type.color}">${type.label}</span>` : '—';

  if (compact) {
    const [clanId, pct] = hints.clans[0] || [];
    const clan = CLAN_BY_ID[clanId];
    return `<p class="hints-inline">${typeTag}${clan ? `<span>${clan.name} <b>${pct}%</b></span>` : ''}<em>Rarity: to be revealed</em></p>`;
  }

  const clans = hints.clans.map(([id, pct]) => {
    const clan = CLAN_BY_ID[id];
    return `
      <li class="odds">
        <img src="public/img/clans/${id}.png" alt="">
        <span class="odds__name">${clan.name}</span>
        <b class="odds__pct">${pct}%</b>
        <span class="odds__bar"><i style="width:${pct}%;background:${clan.color}"></i></span>
      </li>`;
  }).join('');

  return `
    <dl class="hints">
      <dt>Card type</dt><dd>${typeTag}</dd>
      <dt>Possible clan</dt><dd><ul class="odds-list">${clans}</ul></dd>
      <dt>Rarity</dt><dd><em>To be revealed</em></dd>
    </dl>`;
}
