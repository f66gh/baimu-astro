// Shared helpers for the Fourier transform note interactives.

// Follow the containing article's theme; fall back to the system in a new tab.
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
let parentRoot = null;
try { parentRoot = window.parent !== window ? window.parent.document.documentElement : null; } catch { /* Cross-origin embed. */ }
const themeListeners = [];
function syncTheme() {
  document.documentElement.dataset.theme = parentRoot?.dataset.theme || (systemTheme.matches ? 'dark' : 'light');
  themeListeners.forEach((fn) => fn());
}
syncTheme();
systemTheme.addEventListener('change', syncTheme);
if (parentRoot) new MutationObserver(syncTheme).observe(parentRoot, { attributes: true, attributeFilter: ['data-theme'] });
export function onTheme(fn) { themeListeners.push(fn); }

// Keep the iframe tall enough for its content.
if (parentRoot && window.frameElement) {
  const frame = window.frameElement;
  new ResizeObserver(() => {
    frame.style.height = `${Math.ceil(document.body.getBoundingClientRect().height) + 2}px`;
  }).observe(document.body);
}

export function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// HiDPI canvas: keeps CSS width, sets a logical height; returns a context in CSS pixels.
export function setupCanvas(canvas, height) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || canvas.parentElement.clientWidth;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, height);
  return { ctx, w, h: height };
}

export function onResize(fn) {
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(fn, 60); });
}

export function text(ctx, s, x, y, color, align = 'left', size = 11) {
  ctx.save();
  ctx.fillStyle = color; ctx.textAlign = align;
  ctx.font = `${size}px system-ui, sans-serif`;
  ctx.fillText(s, x, y);
  ctx.restore();
}

// Naive DFT (O(N^2)), returns { re, im }.
export function dft(x) {
  const N = x.length;
  const re = new Float64Array(N); const im = new Float64Array(N);
  for (let k = 0; k < N; k++) {
    let sr = 0; let si = 0;
    for (let n = 0; n < N; n++) {
      const a = (-2 * Math.PI * k * n) / N;
      sr += x[n] * Math.cos(a); si += x[n] * Math.sin(a);
    }
    re[k] = sr; im[k] = si;
  }
  return { re, im };
}
