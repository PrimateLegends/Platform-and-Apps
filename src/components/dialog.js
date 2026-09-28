/**
 * Minimal accessible dialog on top of the native <dialog> element.
 */
export function openDialog({ title, body, className = '' }) {
  const dialog = document.createElement('dialog');
  dialog.className = `dialog ${className}`;
  dialog.innerHTML = `
    <form method="dialog" class="dialog__close"><button aria-label="Close">✕</button></form>
    <h2 class="dialog__title">${title}</h2>
    <div class="dialog__body"></div>`;
  const slot = dialog.querySelector('.dialog__body');
  if (typeof body === 'string') slot.innerHTML = body; else slot.append(body);
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}
