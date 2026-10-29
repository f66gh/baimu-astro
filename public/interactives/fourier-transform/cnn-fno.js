import { setupCanvas, css, text, onResize, onTheme } from './common.js';
import { architecture, dependencies, costTerms } from './cnn-fno-math.js';
const $ = id => document.getElementById(id);
const state = { size: 64, channels: 8, levels: 2, cutoff: 3, x: 32, y: 32 };
const boxes = {};
const number = x => x.toLocaleString('zh-CN');

function grid(id, size, predicate, color, target = false) {
  const canvas = $(id), width = canvas.clientWidth;
  const { ctx, w, h } = setupCanvas(canvas, Math.min(width, 360));
  const side = Math.min(w - 24, h - 28), left = (w - side) / 2, top = 8, cell = side / size;
  ctx.fillStyle = css('--grid'); ctx.fillRect(left, top, side, side);
  ctx.fillStyle = css(color);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (predicate(x, y)) ctx.fillRect(left + x * cell, top + y * cell, cell, cell);
  if (size <= 64) {
    ctx.strokeStyle = css('--panel'); ctx.lineWidth = .35;
    ctx.beginPath();
    for (let j = 0; j <= size; j++) { ctx.moveTo(left + j * cell, top); ctx.lineTo(left + j * cell, top + side); ctx.moveTo(left, top + j * cell); ctx.lineTo(left + side, top + j * cell); }
    ctx.stroke();
  }
  if (target) {
    ctx.strokeStyle = css('--c2'); ctx.lineWidth = 2.5;
    ctx.strokeRect(left + state.x * cell - 1, top + state.y * cell - 1, cell + 2, cell + 2);
    ctx.beginPath(); ctx.arc(left + (state.x + .5) * cell, top + (state.y + .5) * cell, Math.max(6, cell), 0, 2 * Math.PI); ctx.stroke();
  }
  text(ctx, target ? `${size} × ${size} 空间网格` : '完整频谱 · 零频居中', w / 2, h - 3, css('--muted'), 'center', 11);
  boxes[id] = { left, top, side, cell };
}
function fields(id, entries) { $(id).innerHTML = entries.map(([key,val]) => `<div><dt>${key}</dt><dd>${val}</dd></div>`).join(''); }
function render() {
  const { size, channels, levels, cutoff, x, y } = state;
  const ops = architecture(size, levels), dep = dependencies(size, levels, x, y), n = size ** 2;
  $('modes-label').textContent = cutoff; $('x-label').textContent = x; $('y-label').textContent = y;
  $('cnn-path').innerHTML = `<span>输入<b>${size}×${size}×${channels}</b></span>` + ops.map(o => `<span>${{conv:'3×3 卷积',down:'↓ 平均池化',up:'↑ 最近邻上采样'}[o.type]}<b>${o.output}×${o.output}×${channels}</b></span>`).join('');
  $('fno-path').innerHTML = `<span>输入<b>${size}×${size}×${channels}</b></span><span>二维 FFT</span><span>保留低频<br>通道混合</span><span>补零 · 逆 FFT</span><span>加逐点分支<br>激活</span><span>输出<b>${size}×${size}×${channels}</b></span>`;
  grid('cnn-grid', size, (gx,gy) => dep.has(gy * size + gx), '--c1', true);
  grid('fno-grid', size, () => true, '--c3', true);
  grid('mode-grid', size, (gx,gy) => Math.abs(gx - size / 2) <= cutoff && Math.abs(gy - size / 2) <= cutoff, '--c3');
  $('cnn-coverage').textContent = `输入依赖 ${dep.size} / ${n} 个位置（${(dep.size / n * 100).toFixed(1)}%）`;
  $('cnn-coverage').dataset.count = dep.size;
  $('fno-coverage').textContent = `频域分支可访问 ${n} / ${n} 个位置（100%）`;
  const costs = costTerms(size, channels, levels, cutoff);
  $('mode-count').textContent = `每轴保留 ${-cutoff} 到 ${cutoff}，共 ${costs.modes} 个频率位置；空间网格仍是 ${size} × ${size}。`;
  $('mode-count').dataset.count = costs.modes;
  fields('cnn-cost', [['卷积层数',costs.cnnConvs],['各层卷积量级项之和',number(costs.cnnConv)],['池化与插值量级项之和',number(costs.cnnResample)]]);
  fields('fno-cost', [['FFT 与逆 FFT 的量级项',number(costs.fnoFFT)],['频域通道混合量级项',number(costs.fnoMix)],['逐点通道混合量级项',number(costs.fnoLocal)]]);
}
for (const [id, key] of [['size','size'],['channels','channels'],['levels','levels'],['modes','cutoff'],['target-x','x'],['target-y','y']]) {
  $(id).addEventListener(id === 'modes' || id.startsWith('target') ? 'input' : 'change', () => {
    const oldSize = state.size;
    state[key] = Number($(id).value);
    if (id === 'size') {
      state.x = Math.min(state.size - 1, Math.floor(state.x * state.size / oldSize));
      state.y = Math.min(state.size - 1, Math.floor(state.y * state.size / oldSize));
      state.cutoff = Math.min(state.cutoff, state.size / 2 - 1);
      $('modes').max = state.size / 2 - 1; $('modes').value = state.cutoff;
      for (const [axis,k] of [['target-x','x'],['target-y','y']]) { $(axis).max = state.size - 1; $(axis).value = state[k]; }
    }
    render();
  });
}
for (const id of ['cnn-grid','fno-grid']) $(id).addEventListener('click', e => {
  const rect = $(id).getBoundingClientRect(), b = boxes[id];
  const x = Math.floor((e.clientX - rect.left - b.left) / b.cell), y = Math.floor((e.clientY - rect.top - b.top) / b.cell);
  if (x < 0 || y < 0 || x >= state.size || y >= state.size) return;
  state.x = x; state.y = y; $('target-x').value = x; $('target-y').value = y; render();
});
$('modes').max = state.size / 2 - 1;
onResize(render); onTheme(render); render();
