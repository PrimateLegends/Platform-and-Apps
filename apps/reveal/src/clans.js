// The clan of a revealed card is the colour of the primates drawn on it, not the clan printed in its text.
// Fur colours -> clan hint keys. Rules from the team:
//   brown and dark brown = Earth · skyblue = Crimson · light = Sakura or Ember · zombie = any clan but Prism/Phantom
export const FUR = Object.freeze({
  brown: [[119, 64, 28], [132, 57, 33], [46, 31, 10], [110, 59, 26]],
  black: [[50, 50, 50]],
  'golden-ape': [[244, 182, 34], [232, 176, 44]],
  orange: [[237, 97, 21], [228, 112, 34]],
  purple: [[190, 21, 245], [176, 40, 230]],
  pink: [[231, 149, 199]],
  'red-hair': [[216, 36, 36], [150, 40, 36], [194, 255, 248]],   // skyblue counts as Crimson
  ghost: [[221, 247, 246], [214, 240, 244]],
  rainbowe: [[128, 206, 184]],
  LIGHT: [[255, 235, 210]],
  ZOMBIE: [[117, 188, 118]]
});
const RARE_ONLY = new Set(['rainbowe', 'ghost']);

const dist2 = (a, b) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);

/** Nearest fur family for an [r, g, b] colour. */
export function furFamily(rgb) {
  if (!Array.isArray(rgb) || rgb.length < 3 || rgb.some(v => !Number.isFinite(v))) throw new Error('rgb expected');
  let best = null, bestD = Infinity;
  for (const [k, list] of Object.entries(FUR)) for (const c of list) { const d = dist2(rgb, c); if (d < bestD) { bestD = d; best = k; } }
  return best;
}

/** Clans for a front: the fur colours of its primates, resolved against the clan printed on the card. */
export function clansFromFur(furs, printedClan) {
  const out = [];
  const add = k => { if (k && !out.includes(k)) out.push(k); };
  for (const rgb of furs) {
    const k = furFamily(rgb);
    if (k === 'ZOMBIE') add(printedClan && !RARE_ONLY.has(printedClan) ? printedClan : null);
    else if (k === 'LIGHT') (printedClan === 'pink' || printedClan === 'orange' ? [printedClan] : ['pink', 'orange']).forEach(add);
    else add(k);
  }
  return out;
}
