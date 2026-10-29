import { setupCanvas, css, text, onResize, onTheme, dft } from './common.js';

const $ = (id) => document.getElementById(id);
const tau = 2 * Math.PI;
const fmt = (v, digits = 4) => (Math.abs(v) < 0.5 * 10 ** -digits ? 0 : v).toFixed(digits);
const complex = (r, i) => `${fmt(r)} ${i < -0.00005 ? '−' : '+'} ${fmt(Math.abs(i))}i`;
const state = { N: 8, k: 1, n: 2, cutoff: 1, mode: 'lowpass' };
let data, spectrumBox;
const signed = (j, N) => j <= Math.floor(N / 2) ? j : j - N;
const index = (k) => (k + state.N) % state.N;

function calculate() {
  const { N } = state;
  const samples = Array.from({ length: N }, (_, n) => (n / N) ** 2);
  const X = dft(samples);
  const re = Array.from(X.re, v => v / N), im = Array.from(X.im, v => v / N);
  const bins = Array.from({ length: N }, (_, j) => ({ j, k: signed(j, N), re: re[j], im: im[j], mag: Math.hypot(re[j], im[j]) })).sort((a, b) => a.k - b.k);
  data = { samples, X, re, im, bins };
}

// Real trigonometric interpolation. A self-paired Nyquist bin contributes one cosine.
function reconstruction(x, retained) {
  let value = 0;
  for (const b of retained) value += b.re * Math.cos(tau * b.k * x) - b.im * Math.sin(tau * b.k * x);
  return value;
}

function chart(id, ymin, ymax, height = 215, xmin = 0, xmax = 1) {
  const { ctx, w, h } = setupCanvas($(id), height);
  const left = 38, right = 16, top = 18, bottom = 30;
  const X = x => left + (x - xmin) / (xmax - xmin) * (w - left - right);
  const Y = y => h - bottom - (y - ymin) / (ymax - ymin) * (h - top - bottom);
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = ymin + (ymax - ymin) * i / 4;
    ctx.strokeStyle = css('--grid'); ctx.beginPath(); ctx.moveTo(left, Y(y)); ctx.lineTo(w - right, Y(y)); ctx.stroke();
    text(ctx, fmt(y, 2), left - 6, Y(y) + 4, css('--muted'), 'right', 10);
  }
  const xticks = xmin === 0 && xmax === 1 ? [0, .25, .5, .75, 1] : [];
  for (const x of xticks) text(ctx, String(x), X(x), h - 10, css('--muted'), 'center', 10);
  ctx.strokeStyle = css('--line'); ctx.beginPath(); ctx.moveTo(left, Y(0)); ctx.lineTo(w - right, Y(0)); ctx.stroke();
  return { ctx, w, h, X, Y, left, right };
}
function line(p, fn, color, dashed = false) {
  const { ctx, X, Y } = p;
  ctx.strokeStyle = css(color); ctx.lineWidth = 1.8; ctx.setLineDash(dashed ? [4, 4] : []); ctx.beginPath();
  for (let i = 0; i <= 400; i++) { const x = i / 400; if (!i) ctx.moveTo(X(x), Y(fn(x))); else ctx.lineTo(X(x), Y(fn(x))); }
  ctx.stroke(); ctx.setLineDash([]);
}
function dot(p, x, y, color, radius = 3.5, hollow = false) {
  p.ctx.beginPath(); p.ctx.arc(p.X(x), p.Y(y), radius, 0, tau);
  p.ctx.fillStyle = css(hollow ? '--panel' : color); p.ctx.fill();
  p.ctx.strokeStyle = css(color); p.ctx.lineWidth = 1.6; p.ctx.stroke();
}
function guide(p, x) {
  p.ctx.strokeStyle = css('--c4'); p.ctx.setLineDash([3, 4]); p.ctx.beginPath();
  p.ctx.moveTo(p.X(x), 18); p.ctx.lineTo(p.X(x), p.h - 30); p.ctx.stroke(); p.ctx.setLineDash([]);
}

function drawSamples() {
  const showBasis = $('show-basis').checked;
  const p = chart('samples', showBasis ? -1.2 : 0, showBasis ? 1.2 : 1.05, 290);
  if (showBasis) {
    line(p, x => Math.cos(tau * state.k * x), '--c2');
    line(p, x => -Math.sin(tau * state.k * x), '--c3');
    for (let n = 0; n < state.N; n++) {
      dot(p, n / state.N, Math.cos(tau * state.k * n / state.N), '--c2', 2);
      dot(p, n / state.N, -Math.sin(tau * state.k * n / state.N), '--c3', 2);
    }
  }
  line(p, x => x * x, '--c1', true);
  for (let n = 0; n < state.N; n++) dot(p, n / state.N, data.samples[n], n === state.n ? '--c4' : '--c1', n === state.n ? 5 : 3);
  dot(p, 1, 1, '--c1', 4, true);
  guide(p, state.n / state.N);
  text(p.ctx, 'x（位置）', p.w - 16, 12, css('--muted'), 'right', 10);
  document.querySelectorAll('.basis-legend').forEach(el => { el.hidden = !showBasis; });
}
function drawSpectrum() {
  const N = state.N;
  const max = Math.max(...data.bins.map(b => b.mag)) * 1.15;
  const p = chart('spectrum', 0, max, 235, data.bins[0].k - .5, data.bins.at(-1).k + .5);
  const spacing = (p.w - p.left - p.right) / N;
  const paired = index(-state.k);
  for (const b of data.bins) {
    const color = b.k === state.k ? '--c2' : b.j === paired ? '--c4' : '--c1';
    p.ctx.fillStyle = css(color);
    p.ctx.fillRect(p.X(b.k) - spacing * .32, p.Y(b.mag), spacing * .64, p.Y(0) - p.Y(b.mag));
    if (N <= 16 || b.k % (N >= 64 ? 8 : 4) === 0 || b.k === state.k) text(p.ctx, String(b.k), p.X(b.k), p.h - 11, css(color), 'center', 10);
  }
  text(p.ctx, '系数模长', p.left, 12, css('--muted'), 'left', 10);
  text(p.ctx, 'k（带符号频率）', p.w - 16, 12, css('--muted'), 'right', 10);
  spectrumBox = { left: p.left, spacing, N };
}
function drawReconstruction(retained) {
  const fn = x => reconstruction(x, retained);
  const ys = Array.from({ length: 401 }, (_, j) => fn(j / 400));
  const p = chart('reconstruction', Math.min(-.08, ...ys) - .03, Math.max(1.02, ...ys) + .03, 280);
  line(p, x => x * x, '--muted', true); line(p, fn, '--c2');
  for (let n = 0; n < state.N; n++) {
    dot(p, n / state.N, data.samples[n], '--c1', 4);
    dot(p, n / state.N, fn(n / state.N), '--c2', 2);
  }
}
function render() {
  const { N, k, n, cutoff, mode } = state;
  const j = index(k), partner = index(-k);
  const r = data.re[j], i = data.im[j], mag = Math.hypot(r, i);
  const nyquist = N % 2 === 0 && k === N / 2;
  $('frequency-value').textContent = `k = ${k}`;
  $('frequency').value = k;
  $('sample-value').textContent = `${n} / ${N - 1}`;
  $('coefficient').textContent = complex(r, i);
  $('sum-real').textContent = fmt(data.X.re[j]);
  $('sum-imag').textContent = fmt(data.X.im[j]);
  $('mean-real').textContent = fmt(r);
  $('mean-imag').textContent = fmt(i);
  $('products').innerHTML = data.samples.map((v, q) => {
    const c = Math.cos(tau * k * q / N), s = -Math.sin(tau * k * q / N);
    return `<tr${q === n ? ' class="selected"' : ''}><td>${q}</td><td>${fmt(q / N)}</td><td>${fmt(v)}</td><td>${fmt(c)}</td><td>${fmt(s)}</td><td>${fmt(v * c)}</td><td>${fmt(v * s)}</td></tr>`;
  }).join('');
  $('coefficient-stats').innerHTML = `<div><dt>带符号频率 / 数组索引</dt><dd>${k} / ${j}</dd></div><div><dt>归一化系数</dt><dd>${complex(r, i)}</dd></div><div><dt>系数模长</dt><dd>${fmt(mag)}</dd></div><div><dt>相位</dt><dd>${mag < 1e-12 ? '零系数无定义' : `${fmt(Math.atan2(i, r) * 180 / Math.PI, 1)}°`}</dd></div>`;
  let note;
  if (k === 0) note = `零频表示采样平均值：${fmt(r)}。`;
  else if (nyquist) note = `奈奎斯特频率：正负 ${k} 在采样点上相同，只保留一份。`;
  else note = `配对频率 ${-k} 的系数互为共轭。正负频率离零点同样远，频率高低相同。`;
  $('frequency-note').textContent = note;
  $('cutoff-value').textContent = cutoff;
  $('cutoff-control').hidden = mode !== 'lowpass';
  const retained = data.bins.filter(b => mode === 'lowpass' ? Math.abs(b.k) <= cutoff : b.j === j || b.j === partner);
  const error = Math.max(...data.samples.map((v, q) => Math.abs(v - reconstruction(q / N, retained))));
  $('retained').textContent = `保留 ${retained.length} / ${N} 个系数`;
  $('error').textContent = `采样点最大误差 ${error.toExponential(2)}`;
  $('error').dataset.value = error;
  $('pair').disabled = j === partner;
  drawSamples(); drawSpectrum(); drawReconstruction(retained);
}
function setCount() {
  state.N = Number($('count').value);
  const half = Math.floor(state.N / 2);
  $('frequency').min = -Math.floor((state.N - 1) / 2); $('frequency').max = half;
  state.k = Math.max(Number($('frequency').min), Math.min(half, state.k));
  state.n = Math.min(state.n, state.N - 1);
  $('sample-index').max = state.N - 1; $('sample-index').value = state.n;
  state.cutoff = Math.min(half, state.cutoff); $('cutoff').max = half; $('cutoff').value = state.cutoff;
  calculate(); render();
}
$('count').addEventListener('change', setCount);
$('show-basis').addEventListener('change', drawSamples);
$('frequency').addEventListener('input', e => { state.k = Number(e.target.value); render(); });
$('sample-index').addEventListener('input', e => { state.n = Number(e.target.value); render(); });
$('cutoff').addEventListener('input', e => { state.cutoff = Number(e.target.value); render(); });
$('mode').addEventListener('change', e => { state.mode = e.target.value; render(); });
$('zero').addEventListener('click', () => { state.k = 0; render(); });
$('pair').addEventListener('click', () => { state.k = signed(index(-state.k), state.N); render(); });
function setRetention(all) {
  state.mode = 'lowpass'; $('mode').value = 'lowpass';
  state.cutoff = all ? Math.floor(state.N / 2) : 0; $('cutoff').value = state.cutoff; render();
}
$('all').addEventListener('click', () => setRetention(true));
$('dc-only').addEventListener('click', () => setRetention(false));
$('reset').addEventListener('click', () => {
  Object.assign(state, { N: 8, k: 1, n: 2, cutoff: 1, mode: 'lowpass' });
  $('count').value = 8; $('mode').value = 'lowpass'; $('show-basis').checked = true; setCount();
});
$('spectrum').addEventListener('click', e => {
  const x = e.clientX - $('spectrum').getBoundingClientRect().left;
  const at = Math.floor((x - spectrumBox.left) / spectrumBox.spacing);
  if (at >= 0 && at < spectrumBox.N) { state.k = data.bins[at].k; render(); }
});
onResize(render); onTheme(render);
setCount();
