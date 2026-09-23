import { createModel, conductors, width, height } from './model.js';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d');
const buttons = [...document.querySelectorAll('[data-mode]')];
const descriptions = {
  first: ['A₁ = 1 V，A₂ = 0 V', 'A₂ 仍在原位并接地，不能从求解环境中删除。B、C 始终为 0 V。'],
  second: ['A₁ = 0 V，A₂ = 1 V', '换成激励 A₂，A₁ 仍在原位并接地。几何、介质和外边界完全不变。'],
  sum: ['φ₁ + φ₂：两段都变成 1 V', '把前两次的电势逐点相加，B、C 上的电荷也相加。A₁、A₂ 各为 1 V，并不是 2 V。'],
  together: ['独立求解：A₁ = A₂ = 1 V', '直接让两段同时为 1 V，再独立求解。与“两次结果叠加”对照，电势和对外电荷在数值精度内一致。'],
};
let model;
let currentMode = 'first';

// Follow the containing article's theme; fall back to the system in a new tab.
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
let parentRoot;
try { parentRoot = window.parent !== window ? window.parent.document.documentElement : null; } catch { /* Cross-origin embed. */ }
function syncTheme() {
  document.documentElement.dataset.theme = parentRoot?.dataset.theme || (systemTheme.matches ? 'dark' : 'light');
}
syncTheme();
systemTheme.addEventListener('change', syncTheme);
if (parentRoot) new MutationObserver(syncTheme).observe(parentRoot, { attributes: true, attributeFilter: ['data-theme'] });

// Keep this iframe tall enough on narrow screens and when its details expand.
// The article's existing .note-interactive minimum height remains in effect.
if (parentRoot && window.frameElement) {
  const frame = window.frameElement;
  new ResizeObserver(() => {
    frame.style.height = `${Math.ceil(document.body.getBoundingClientRect().height) + 2}px`;
  }).observe(document.body);
}

const heatmap = document.createElement('canvas');
heatmap.width = width;
heatmap.height = height;
const heatContext = heatmap.getContext('2d');
const colors = [[16, 31, 55], [41, 127, 152], [129, 198, 168], [251, 227, 151]];

function draw() {
  if (!model) return;
  const field = model.fields[currentMode];
  const pixels = heatContext.createImageData(width, height);
  for (let i = 0; i < field.length; i++) {
    const level = Math.max(0, Math.min(1, field[i])) * (colors.length - 1);
    const start = Math.min(colors.length - 2, Math.floor(level));
    const fraction = level - start;
    for (let c = 0; c < 3; c++) pixels.data[4 * i + c] = colors[start][c] * (1 - fraction) + colors[start + 1][c] * fraction;
    pixels.data[4 * i + 3] = 255;
  }
  heatContext.putImageData(pixels, 0, 0);

  const box = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(box.width * ratio);
  canvas.height = Math.round(box.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.imageSmoothingEnabled = true;
  context.drawImage(heatmap, 0, 0, box.width, box.height);
  const sx = box.width / width;
  const sy = box.height / height;
  const voltages = currentMode === 'first' ? [1, 0, 0, 0] : currentMode === 'second' ? [0, 1, 0, 0] : [1, 1, 0, 0];
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `600 ${Math.max(12, Math.min(15, box.width / 32))}px system-ui, sans-serif`;
  conductors.forEach((shape, index) => {
    const x = shape.x0 * sx;
    const y = shape.y0 * sy;
    const w = (shape.x1 - shape.x0 + 1) * sx;
    const h = (shape.y1 - shape.y0 + 1) * sy;
    context.fillStyle = voltages[index] ? '#fbe397' : '#182c43';
    context.strokeStyle = voltages[index] ? '#ffe9b1' : '#9bb4c8';
    context.lineWidth = 1;
    context.fillRect(x, y, w, h);
    context.strokeRect(x, y, w, h);
    context.fillStyle = voltages[index] ? '#192d39' : '#eef5fa';
    context.fillText(`${shape.name} · ${voltages[index]} V`, x + w / 2, y + h / 2);
  });
  canvas.setAttribute('aria-label', `${descriptions[currentMode][0]}。电势从深蓝色的 0 V 过渡到浅黄色的 1 V。B、C 接地，所有导体始终保留。`);
}

function format(value) { return value.toFixed(3).replace('-', '−'); }

function render() {
  buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === currentMode)));
  ['b', 'c'].forEach((target, index) => {
    const charge = model.charges[currentMode][index];
    document.querySelector(`#charge-${target}`).textContent = format(charge);
    document.querySelector(`#bar-${target}`).style.width = `${Math.min(100, Math.abs(charge) * 100)}%`;
    document.querySelector(`#equation-${target}`).textContent = `${format(model.charges.first[index])} + (${format(model.charges.second[index])}) ≈ ${format(model.charges.together[index])}`;
  });
  document.querySelector('#state-title').textContent = descriptions[currentMode][0];
  document.querySelector('#state-description').textContent = descriptions[currentMode][1];
  draw();
}

buttons.forEach((button) => button.addEventListener('click', () => {
  currentMode = button.dataset.mode;
  render();
}));
new ResizeObserver(draw).observe(canvas);

// Let the loading state paint before the small, one-time numerical solve.
requestAnimationFrame(() => setTimeout(() => {
  try {
    model = createModel();
    document.querySelector('#comparison').textContent = `叠加与独立求解的最大电势差：${model.maxDifference.toExponential(1)} V`;
    buttons.forEach((button) => { button.disabled = false; });
    render();
  } catch (error) {
    document.querySelector('#state-title').textContent = '暂时无法绘制';
    document.querySelector('#state-description').textContent = error.message;
    document.querySelector('#comparison').textContent = '求解失败，可刷新页面重试。';
  }
}, 0));
