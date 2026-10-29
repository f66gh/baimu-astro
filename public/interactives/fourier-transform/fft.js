import { setupCanvas, css, text, onResize, onTheme, dft } from './common.js';

const $ = (id) => document.getElementById(id);
let stage = 0; let selected = -1; let layout = null; let randSeed = 7;

const bitrev = (i, bits) => { let r = 0; for (let b = 0; b < bits; b++) r = (r << 1) | ((i >> b) & 1); return r; };
const fmt = (re, im) => {
  const r = Math.abs(re) < 0.05 ? 0 : re; const m = Math.abs(im) < 0.05 ? 0 : im;
  if (m === 0) return r.toFixed(1).replace('.0', '');
  if (r === 0) return `${m.toFixed(1).replace('.0', '')}i`;
  return `${r.toFixed(1).replace('.0', '')}${m > 0 ? '+' : '−'}${Math.abs(m).toFixed(1).replace('.0', '')}i`;
};

function inputSignal(N) {
  const kind = $('input').value;
  if (kind === 'rect') return Array.from({ length: N }, (_, n) => (n < N / 2 ? 1 : 0));
  if (kind === 'cos') return Array.from({ length: N }, (_, n) => Math.round(Math.cos((4 * Math.PI * n) / N) * 100) / 100);
  if (kind === 'ramp') return Array.from({ length: N }, (_, n) => n);
  let s = randSeed;
  return Array.from({ length: N }, () => { s = (s * 16807) % 2147483647; return (s % 7) - 3; });
}

// Iterative radix-2 DIT FFT that records every stage and every butterfly.
function compute(N) {
  const L = Math.log2(N);
  const x = inputSignal(N);
  const order = Array.from({ length: N }, (_, i) => bitrev(i, L));
  let re = order.map((i) => x[i]); let im = new Array(N).fill(0);
  const vals = [{ re: [...re], im: [...im] }];
  const edges = []; // edges[s] = [{from, to, tw, neg}]
  for (let s = 1; s <= L; s++) {
    const m = 1 << s; const half = m >> 1;
    const nre = [...re]; const nim = [...im]; const es = [];
    for (let j = 0; j < N; j += m) {
      for (let t = 0; t < half; t++) {
        const a = (-2 * Math.PI * t) / m; const wr = Math.cos(a); const wi = Math.sin(a);
        const p = j + t; const q = j + t + half;
        const vr = re[q] * wr - im[q] * wi; const vi = re[q] * wi + im[q] * wr;
        nre[p] = re[p] + vr; nim[p] = im[p] + vi;
        nre[q] = re[p] - vr; nim[q] = im[p] - vi;
        const twN = (t * N) / m;
        es.push({ from: p, to: p, tw: null }, { from: p, to: q, tw: null },
          { from: q, to: p, tw: twN }, { from: q, to: q, tw: twN, neg: true });
      }
    }
    re = nre; im = nim; vals.push({ re: [...re], im: [...im] }); edges.push(es);
  }
  const ref = dft(x);
  let err = 0; for (let k = 0; k < N; k++) err = Math.max(err, Math.hypot(ref.re[k] - re[k], ref.im[k] - im[k]));
  return { N, L, x, order, vals, edges, err };
}

function dependency(res, out) {
  // active[s] = set of node indices at stage s that feed output `out`.
  const active = Array.from({ length: res.L + 1 }, () => new Set());
  active[res.L].add(out);
  for (let s = res.L; s >= 1; s--) {
    for (const e of res.edges[s - 1]) if (active[s].has(e.to)) active[s - 1].add(e.from);
  }
  return active;
}

const explanations = (res) => {
  const { N, L } = res;
  const arr = [
    `<b>第 0 层 · 位反转重排：</b>把输入下标写成 ${L} 位二进制再倒过来（例如 1 = ${(1).toString(2).padStart(L, '0')} → ${bitrev(1, L).toString(2).padStart(L, '0')} = ${bitrev(1, L)}）。这样偶数下标 n 排在上半，奇数排在下半，后面每层只需相邻合并。<br><br>核心公式（偶/奇拆分）：<br><span class="mono">X[k] = E[k] + W<sub>N</sub><sup>k</sup>·O[k]</span><br><span class="mono">X[k+N/2] = E[k] − W<sub>N</sub><sup>k</sup>·O[k]</span><br>E、O 是偶数项、奇数项各自的 N/2 点 DFT。一次乘法 Wᵏ·O[k] 同时服务两个输出，这就是“蝶形”。`,
  ];
  for (let s = 1; s <= L; s++) {
    const m = 1 << s;
    arr.push(`<b>第 ${s} 层：</b>把相邻的两个 ${m / 2} 点 DFT 合并成 ${m} 点 DFT，共 ${N / m} 组、${N / 2} 个蝶形。旋转因子为 <span class="mono">W${m}ᵗ = W${N}^(t·${N / m})</span>，t = 0…${m / 2 - 1}。${s === L ? '<br><br>到这里输出就是按自然顺序排列的 X[0…N−1]。点右侧任意输出，会看到它经过 log₂N 层连到了<b>全部</b> N 个输入：每个频率依旧是所有采样的加权和，只是共享了中间结果。' : ''}`);
  }
  return arr;
};

function drawFly() {
  const N = +$('N').value;
  const res = compute(N); const { L } = res;
  stage = Math.min(stage, L);
  const showVals = N === 8;
  const rowH = N === 8 ? 40 : 26;
  const { ctx, w, h } = setupCanvas($('fly'), rowH * N + 40);
  const left = 70; const right = showVals ? 118 : 60;
  const colX = (s) => left + ((w - left - right) * s) / L;
  const rowY = (i) => 28 + i * rowH;
  layout = { colX, rowY, L, N, rowH, w };
  const dep = selected >= 0 && stage === L ? dependency(res, selected) : null;

  // Column headers.
  for (let s = 0; s <= L; s++) {
    text(ctx, s === 0 ? '位反转' : `第 ${s} 层`, colX(s), 14, s === stage ? css('--c2') : css('--muted'), 'center', 12);
  }
  // Edges.
  for (let s = 1; s <= stage; s++) {
    for (const e of res.edges[s - 1]) {
      const onPath = dep && dep[s].has(e.to) && dep[s - 1].has(e.from);
      const recent = s === stage;
      let col = e.tw === null ? css('--c1') : css('--c2');
      ctx.globalAlpha = dep ? (onPath ? 1 : 0.12) : recent ? 0.95 : 0.35;
      if (onPath) col = css('--c4');
      ctx.strokeStyle = col; ctx.lineWidth = onPath ? 2.2 : recent ? 1.6 : 1;
      ctx.beginPath(); ctx.moveTo(colX(s - 1) + 6, rowY(e.from)); ctx.lineTo(colX(s) - 6, rowY(e.to)); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Twiddle labels on the lower input of each butterfly (only for the active stage to avoid clutter).
    if (s === stage && !dep) {
      const m = 1 << s; const half = m >> 1;
      for (let j = 0; j < N; j += m) for (let t = 0; t < half; t++) {
        const q = j + t + half; const tw = (t * N) / m;
        const lx = colX(s - 1) + 14;
        text(ctx, `W${sub(N)}${sup(tw)}`, lx, rowY(q) - 4, css('--c2'), 'left', 10);
      }
    }
  }
  // Nodes.
  for (let s = 0; s <= L; s++) {
    for (let i = 0; i < N; i++) {
      const filled = s <= stage;
      const hl = dep && dep[s].has(i);
      ctx.fillStyle = filled ? (hl ? css('--c4') : css('--panel')) : css('--background');
      ctx.strokeStyle = filled ? (hl ? css('--c4') : css('--text')) : css('--line');
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(colX(s), rowY(i), 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (showVals && filled && s > 0 && s < L) {
        text(ctx, fmt(res.vals[s].re[i], res.vals[s].im[i]), colX(s), rowY(i) + 15, css('--muted'), 'center', 10);
      }
    }
  }
  // Inputs and outputs labels.
  for (let i = 0; i < N; i++) {
    const n = res.order[i];
    text(ctx, `x[${n}]${showVals ? ' = ' + res.x[n] : ''}`, colX(0) - 10, rowY(i) + 4, css('--text'), 'right', 11);
    if (stage === L) {
      const v = res.vals[L];
      const lab = showVals ? `X[${i}] = ${fmt(v.re[i], v.im[i])}` : `X[${i}]`;
      text(ctx, lab, colX(L) + 10, rowY(i) + 4, i === selected ? css('--c4') : css('--text'), 'left', 11);
    }
  }
  $('lbl-stage').textContent = `当前：${stage === 0 ? '位反转后的输入' : `第 ${stage}/${L} 层`}`;
  $('explain').innerHTML = explanations(res)[stage];
  $('st-err').textContent = res.err.toExponential(1);
  $('st-dft').textContent = `${N * N}`;
  $('st-fft').textContent = `${(N / 2) * L}`;
}
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n) => String(n).split('').map((d) => SUP[+d]).join('');
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n) => String(n).split('').map((d) => SUB[+d]).join('');

function drawCost() {
  const { ctx, w, h } = setupCanvas($('cost'), 190);
  const x0 = 46; const y0 = 10; const pw = w - x0 - 14; const ph = h - 40;
  const maxP = 20; const maxLog = 40 * Math.log10(2) + 0.3; // up to (2^20)^2
  const X = (p) => x0 + ((p - 1) / (maxP - 1)) * pw;
  const Y = (lg) => y0 + ph - (lg / maxLog) * ph;
  ctx.strokeStyle = css('--grid'); ctx.strokeRect(x0 + 0.5, y0 + 0.5, pw, ph);
  for (let e = 0; e <= 12; e += 3) {
    ctx.strokeStyle = css('--grid'); ctx.beginPath(); ctx.moveTo(x0, Y(e)); ctx.lineTo(x0 + pw, Y(e)); ctx.stroke();
    text(ctx, `10${sup(e)}`, x0 - 6, Y(e) + 4, css('--muted'), 'right');
  }
  for (const p of [1, 4, 8, 12, 16, 20]) text(ctx, `2${sup(p)}`, X(p), h - 16, css('--muted'), 'center');
  text(ctx, 'N', x0 + pw, h - 4, css('--muted'), 'right');
  const curve = (f, col) => {
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
    for (let p = 1; p <= maxP; p += 0.1) { const v = Math.log10(f(2 ** p, p)); if (p === 1) ctx.moveTo(X(p), Y(v)); else ctx.lineTo(X(p), Y(v)); }
    ctx.stroke();
  };
  curve((N) => N * N, css('--c2'));
  curve((N, p) => (N / 2) * p, css('--c1'));
  text(ctx, 'DFT: N²', X(15), Y(Math.log10(2 ** 30)) - 8, css('--c2'), 'center', 12);
  text(ctx, 'FFT: (N/2)·log₂N', X(15), Y(Math.log10(2 ** 14 * 15)) + 18, css('--c1'), 'center', 12);
  // Marker: 64×64 grid flattened (like a 2D FNO input), N = 4096.
  const p = 12; const N = 2 ** p;
  ctx.strokeStyle = css('--muted'); ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(X(p), y0); ctx.lineTo(X(p), y0 + ph); ctx.stroke(); ctx.setLineDash([]);
  text(ctx, 'N = 4096（如 64×64 网格）', X(p) - 6, y0 + 14, css('--text'), 'right', 11);
  text(ctx, `DFT ${(N * N / 1e6).toFixed(1)}M 次 / FFT ${((N / 2) * p / 1e3).toFixed(1)}K 次 ≈ ${Math.round((N * N) / ((N / 2) * p))} 倍`, X(p) - 6, y0 + 29, css('--text'), 'right', 11);
}

$('fly').addEventListener('click', (e) => {
  if (!layout || stage !== layout.L) return;
  const rect = $('fly').getBoundingClientRect();
  const px = e.clientX - rect.left; const py = e.clientY - rect.top;
  if (px < layout.colX(layout.L) - 20) { selected = -1; drawFly(); return; }
  const i = Math.round((py - 28) / layout.rowH);
  selected = i >= 0 && i < layout.N && i !== selected ? i : -1;
  drawFly();
});
$('next').addEventListener('click', () => { stage += 1; drawFly(); });
$('prev').addEventListener('click', () => { stage = Math.max(0, stage - 1); selected = -1; drawFly(); });
$('all').addEventListener('click', () => { stage = 99; drawFly(); });
$('N').addEventListener('input', () => { stage = 0; selected = -1; drawFly(); });
$('input').addEventListener('input', () => { randSeed = Math.floor(Math.random() * 1e6) + 1; drawFly(); });
const redraw = () => { drawFly(); drawCost(); };
onResize(redraw); onTheme(redraw);
redraw();
