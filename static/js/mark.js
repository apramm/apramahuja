// Upgrades the inline SVG poster (.mark) to an interactive <model-viewer> on first interaction.
const mark = document.querySelector('.mark[data-model]');
let started = false;

async function upgrade() {
  if (started) return;
  started = true;
  try {
    await import(mark.dataset.viewer);
  } catch {
    return; // keep the poster
  }
  const mv = document.createElement('model-viewer');
  const attrs = {
    src: mark.dataset.model,
    alt: 'Low-poly mountain with a trail; drag to rotate',
    'camera-controls': '',
    'disable-zoom': '',
    'disable-pan': '',
    'interaction-prompt': 'none',
    'shadow-intensity': '0',
    exposure: '1',
    'camera-orbit': '35deg 65deg auto',
    'max-camera-orbit': 'auto 85deg auto',
    loading: 'eager',
  };
  for (const [k, v] of Object.entries(attrs)) mv.setAttribute(k, v);
  if (matchMedia('(prefers-reduced-motion: no-preference)').matches) mv.setAttribute('auto-rotate', '');
  mv.addEventListener('load', () => {
    mark.removeAttribute('aria-hidden'); // now interactive: expose model-viewer's own label
    mark.classList.add('is-3d');
  }, { once: true });
  mv.addEventListener('error', () => mv.remove(), { once: true });
  mark.append(mv);
}

if (mark) {
  for (const type of ['pointerenter', 'touchstart', 'click']) {
    mark.addEventListener(type, upgrade, { passive: true, once: true });
  }
}
