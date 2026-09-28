/**
 * Legendary Cards UI preview — entry point.
 * Everything runs locally: rolls, the vault and the claim streak live in localStorage.
 */
import { mountCollection } from './components/collection.js';
import { mountDailyClaim } from './components/daily-claim.js';
import { mountPacks } from './components/pack-opener.js';
import { mountWallet } from './components/wallet.js';
import { vault } from './lib/vault.js';

mountWallet(document.querySelector('[data-wallet]'));
mountPacks(document.querySelector('[data-packs]'));
mountDailyClaim(document.querySelector('[data-claim-root]'));
mountCollection(document.querySelector('[data-collection]'));

const counts = document.querySelector('[data-counts]');
vault.subscribe(state => {
  counts.innerHTML = `
    <span><b>${state.cards.length}</b> sealed cards</span>
    <span><b>${state.packs.length}</b> packs</span>
    <span><img src="public/img/items/bounty.png" alt=""> <b>${state.bounties}</b> Bounties</span>`;
});
document.querySelector('[data-reset]').addEventListener('click', () => vault.reset());

// crafted by Crovy & Yuki
