/**
 * Wallet picker: lists every wallet installed in the browser (EIP-6963 multi-injected provider
 * discovery, plus any legacy injected provider) and connects to the one the user picks.
 * The preview only reads the address; it never asks for a signature or a transaction.
 */
import { openDialog } from './dialog.js';

const found = new Map();   // uuid -> { info, provider }

window.addEventListener('eip6963:announceProvider', e => {
  const { info, provider } = e.detail || {};
  if (info?.uuid && provider) found.set(info.uuid, { info, provider });
});
window.dispatchEvent(new Event('eip6963:requestProvider'));

function installed() {
  const list = [...found.values()];
  const legacy = window.ethereum;
  if (legacy && !list.some(w => w.provider === legacy) && !list.length) {
    list.push({ info: { uuid: 'injected', name: 'Browser wallet', icon: '' }, provider: legacy });
  }
  return list;
}

export function mountWallet(button) {
  let address = null;
  const paint = () => { button.textContent = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Connect wallet'; };
  paint();

  button.addEventListener('click', () => {
    const wallets = installed();
    const body = document.createElement('div');
    body.className = 'wallets';
    if (!wallets.length) {
      body.innerHTML = '<p class="muted">No wallet found in this browser. Install any EVM wallet and reload.</p>';
    }
    wallets.forEach(({ info, provider }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'wallets__item';
      b.innerHTML = `${info.icon?.startsWith('data:image/') ? `<img src="${info.icon}" alt="">` : '<span class="wallets__dot"></span>'}<span>${info.name}</span>`;
      b.addEventListener('click', async () => {
        try {
          const [acc] = await provider.request({ method: 'eth_requestAccounts' });
          address = acc ? acc.toLowerCase() : null;
          paint();
          dialog.close();
        } catch { /* user rejected */ }
      });
      body.append(b);
    });
    const dialog = openDialog({ title: 'Connect a wallet', body });
  });
}
