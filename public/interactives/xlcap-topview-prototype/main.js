// Local sample viewer: orthographic XY projection and the complete Maxwell matrix.
import { validateConfig } from './rcb.js';
import { replayTrace } from './rcb-trace.js';

const $ = (id) => document.getElementById(id);
const canvas = $('layout-canvas');
const ctx = canvas.getContext('2d');
const viewport = $('viewport');
const viewer = document.querySelector('.viewer');
const palette = ['#3b82f6', '#f59e0b', '#14b8a6', '#a78bfa', '#f472b6', '#f97316', '#84cc16', '#06b6d4'];
const state = { model: null, visible: new Set(), width: 0, height: 0, centerX: 0, centerY: 0, scale: 1, fitScale: 1, fitted: true, selected: null, hovered: null, drag: null, importId: 0,
  mode: 'original', partition: null, fragments: [], windows: [], selectedWindow: null, partitionBusy: false, partitionDirty: false,
  trace: null, step: 0, frame: null, environment: null, environmentError: null, environmentFocused: false,
  environmentSets: { targets: new Set(), included: new Set(), partial: new Set() } };
let partitionWorker = null;
let playbackTimer = null;
let scheduled = false;
let dragDepth = 0;
const format = (n) => Number(n.toPrecision(5)).toLocaleString('en-US', { maximumFractionDigits: 6 });
const color = (i) => palette[i] || `hsl(${(i * 137.508 + 215) % 360} 68% 58%)`;
const stopReasons = { within_limit: '已满足数量上限', max_depth: '达到递归深度上限', no_count_reduction: '无法继续减少导体数量' };
const updateMatrixResize = setupMatrixResize();
setupTheme();

function setupTheme() {
  const storageKey = 'aiu-theme';
  const root = document.documentElement;
  const button = $('theme-toggle');
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  const validTheme = (value) => value === 'light' || value === 'dark';
  let preferredTheme;
  try { preferredTheme = localStorage.getItem(storageKey); } catch {}

  function applyTheme() {
    const theme = validTheme(preferredTheme) ? preferredTheme : systemTheme.matches ? 'dark' : 'light';
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    button.title = theme === 'dark' ? '切换到白天模式' : '切换到黑夜模式';
    $('theme-label').textContent = theme === 'dark' ? '黑夜' : '白天';
    requestDraw();
  }

  button.addEventListener('click', () => {
    preferredTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(storageKey, preferredTheme); } catch {}
    applyTheme();
  });
  systemTheme.addEventListener('change', applyTheme);
  window.addEventListener('storage', (event) => {
    if (event.key !== storageKey && event.key !== null) return;
    // Reuse the site's preference, including changes from another tab or the parent page.
    try {
      if (event.storageArea !== localStorage) return;
      preferredTheme = localStorage.getItem(storageKey);
    } catch { return; }
    applyTheme();
  });
  applyTheme();
}

function parseGeometry(raw) {
  const layout = raw?.layout ?? raw;
  if (!Array.isArray(layout?.conductors) || !layout.conductors.length) throw new Error('未找到导体几何，请导入 sample.json 或含有 conductors 的 layout.json。');
  const stackLayers = Array.isArray(raw.process_stack?.beol_layers) ? raw.process_stack.beol_layers : [];
  const layerMetadata = new Map(stackLayers.map((layer) => [layer.name, layer]));
  const layers = new Map();
  const blocks = [];
  const ids = new Set();
  const bounds = { x_min: Infinity, x_max: -Infinity, y_min: Infinity, y_max: -Infinity };
  for (const conductor of layout.conductors) {
    const id = String(conductor.conductor_id ?? '');
    if (!id || ids.has(id)) throw new Error('导体编号缺失或重复，请检查样本文件。');
    ids.add(id);
    if (!Array.isArray(conductor.blocks) || !conductor.blocks.length) throw new Error(`导体 ${id} 没有可显示的几何块。`);
    for (const block of conductor.blocks) {
      const g = block.geometry;
      if (!g || !['x_min', 'x_max', 'y_min', 'y_max'].every((key) => Number.isFinite(g[key])) || g.x_max <= g.x_min || g.y_max <= g.y_min) throw new Error(`导体 ${id} 的 X–Y 坐标无效。`);
      const layerName = String(block.layer_ref ?? '未命名层');
      if (!layers.has(layerName)) {
        const meta = layerMetadata.get(layerName);
        const number = layerName.match(/^M(\d+)$/i);
        layers.set(layerName, { name: layerName, order: meta?.order ?? (number ? Number(number[1]) : Infinity), z: meta?.z_bottom ?? g.z_bottom ?? 0, count: 0, conductors: new Set() });
      }
      const layer = layers.get(layerName);
      layer.count++;
      layer.conductors.add(id);
      blocks.push({ id, blockId: String(block.block_id ?? id), net: String(conductor.net_name ?? id), layer: layerName, geometry: { ...g } });
      bounds.x_min = Math.min(bounds.x_min, g.x_min); bounds.x_max = Math.max(bounds.x_max, g.x_max);
      bounds.y_min = Math.min(bounds.y_min, g.y_min); bounds.y_max = Math.max(bounds.y_max, g.y_max);
    }
  }
  const sortedLayers = [...layers.values()].sort((a, b) => a.z - b.z || a.order - b.order || a.name.localeCompare(b.name, 'en', { numeric: true }));
  const usedColors = new Set();
  sortedLayers.forEach((layer, index) => {
    let colorIndex = Number.isFinite(layer.order) && layer.order > 0 ? layer.order - 1 : index;
    while (usedColors.has(colorIndex)) colorIndex++;
    usedColors.add(colorIndex); layer.color = color(colorIndex);
  });
  const layerIndex = new Map(sortedLayers.map((layer, index) => [layer.name, index]));
  blocks.sort((a, b) => layerIndex.get(a.layer) - layerIndex.get(b.layer));
  const window = layout.window;
  const validWindow = window && ['x_min', 'x_max', 'y_min', 'y_max'].every((key) => Number.isFinite(window[key])) && window.x_max > window.x_min && window.y_max > window.y_min;
  const windowBox = validWindow ? { x_min: window.x_min, x_max: window.x_max, y_min: window.y_min, y_max: window.y_max } : { ...bounds };
  const fitBounds = { x_min: Math.min(bounds.x_min, windowBox.x_min), x_max: Math.max(bounds.x_max, windowBox.x_max), y_min: Math.min(bounds.y_min, windowBox.y_min), y_max: Math.max(bounds.y_max, windowBox.y_max) };
  const rawUnit = layout.units?.length ?? raw.process_stack?.units?.length ?? 'um';
  return { id: String(raw.sample_id ?? layout.layout_id ?? '未命名样本'), layout, label: raw.label, blocks, layers: sortedLayers, window: windowBox, bounds: fitBounds, conductorCount: ids.size, unit: rawUnit === 'um' ? 'μm' : String(rawUnit), matrix: parseMatrix(raw) };
}

function parseMatrix(raw) {
  const values = raw.label?.capacitance?.maxwell_matrix;
  if (values == null) return { message: '暂无电容矩阵。此文件只有几何信息或尚未生成电容标签。' };
  const order = raw.label?.matrix_order;
  const size = Array.isArray(values) ? values.length : 0;
  if (!size || !values.every((row) => Array.isArray(row) && row.length === size && row.every(Number.isFinite))) {
    return { message: '电容矩阵数据无效：需要行列数相等且所有数值有效的完整矩阵。' };
  }
  if (!Array.isArray(order) || order.length !== size) return { message: '矩阵的导体顺序缺失或与矩阵维度不一致，无法显示对应关系。' };
  const names = Array(size).fill(null);
  for (let position = 0; position < size; position++) {
    const entry = order[position];
    const index = entry?.index ?? position;
    if (!Number.isInteger(index) || index < 0 || index >= size || names[index] !== null || typeof entry?.conductor_id !== 'string' || !entry.conductor_id.trim()) {
      return { message: '矩阵的导体顺序无效，无法显示对应关系。' };
    }
    names[index] = entry.conductor_id;
  }
  return { values, names, unit: String(raw.label.capacitance.unit ?? raw.process_stack?.units?.capacitance ?? '单位未提供') };
}

async function importFile(file) {
  stopPlayback();
  const importId = ++state.importId;
  $('error').hidden = true;
  try {
    const text = await file.text();
    let raw;
    try { raw = JSON.parse(text); } catch { throw new Error('文件不是有效的 JSON，请选择 sample.json 或 layout.json。'); }
    const model = parseGeometry(raw);
    if (importId !== state.importId) return;
    partitionWorker?.terminate(); partitionWorker = null;
    stopPlayback();
    state.partition = null; state.fragments = []; state.windows = []; state.selectedWindow = null;
    state.trace = null; state.step = 0; state.frame = null;
    state.environment = null; state.environmentError = null;
    state.partitionBusy = false; state.partitionDirty = false;
    state.mode = 'original';
    $('view-modes').disabled = false;
    document.querySelector('[name="view-mode"][value="original"]').checked = true;
    $('partition-panel').hidden = true;
    $('partition-error').hidden = true;
    $('partition-status').textContent = '选择 RCB 切分或左右对比，计算核心窗口';
    state.model = model;
    state.visible = new Set(model.layers.map((layer) => layer.name));
    state.selected = null; state.hovered = null; state.drag = null;
    viewport.classList.remove('is-panning');
    viewport.classList.add('has-sample');
    $('empty-state').hidden = true;
    $('sample-name').textContent = `${model.id} · ${file.name}`;
    $('sample-name').title = file.name;
    for (const id of ['zoom-in', 'zoom-out', 'fit-view', 'show-all', 'show-labels']) $(id).disabled = false;
    renderLayers();
    renderMatrix();
    renderDetails($('sample-info'), [['导体', `${model.conductorCount} 个`], ['几何块', `${model.blocks.length} 个`], ['窗口宽', `${format(model.window.x_max - model.window.x_min)} ${model.unit}`], ['窗口高', `${format(model.window.y_max - model.window.y_min)} ${model.unit}`]]);
    $('sample-placeholder').hidden = true;
    $('cursor-info').textContent = `X →   Y ↑ · ${model.unit}`;
    inspect(null);
    updateStatus();
    fitView();
    renderPartition();
    updateMatrixResize();
  } catch (error) {
    if (importId !== state.importId) return;
    $('error').textContent = error.message || '无法读取这个文件。';
    $('error').hidden = false;
  }
}

function updateMatrixHint() {
  if (!state.model?.matrix.values) return;
  $('matrix-hint').textContent = '行列按原始导体顺序排列，显示样本中的全部电容值。可横向、纵向滚动，悬停查看完整精度。'
    + (state.mode === 'environment' ? ' 外扩使用此完整矩阵计算目标耦合覆盖，未重新求解裁窗电容。' : state.mode === 'original' ? '' : ' RCB 仅分解几何，此矩阵不是各核心窗口重新求解的电容。');
}

function setMode(mode) {
  stopPlayback();
  state.mode = mode;
  state.drag = null; state.hovered = null;
  viewport.classList.remove('is-panning');
  $('partition-panel').hidden = mode === 'original';
  state.selectedWindow = mode === 'environment' ? defaultEnvironmentWindow(state.selectedWindow) : null;
  refreshPartitionView(); renderPartition(); updatePartitionStatus();
  updateMatrixHint(); inspect(selectedBlock());
  fitView(); updateMatrixResize();
  if (mode !== 'original' && !state.partition && !state.partitionBusy) runPartition();
}

function stopPlayback() {
  if (playbackTimer !== null) clearInterval(playbackTimer);
  playbackTimer = null;
  $('step-play').textContent = '自动播放';
  $('step-play').setAttribute('aria-pressed', 'false');
}

function setTraceStep(step, automatic = false) {
  if (!state.trace || state.mode !== 'steps') return;
  if (!automatic) stopPlayback();
  state.step = Math.max(0, Math.min(state.trace.events.length, step));
  if (state.step === state.trace.events.length) stopPlayback();
  state.selectedWindow = null; state.hovered = null;
  refreshPartitionView(); renderPartition(); inspect(selectedBlock()); requestDraw();
}

function togglePlayback() {
  if (!state.trace || state.partitionBusy || state.mode !== 'steps') return;
  if (playbackTimer !== null) { stopPlayback(); return; }
  if (state.step === state.trace.events.length) setTraceStep(0);
  playbackTimer = setInterval(() => setTraceStep(state.step + 1, true), 1400);
  $('step-play').textContent = '暂停';
  $('step-play').setAttribute('aria-pressed', 'true');
}

function refreshPartitionView() {
  state.frame = null; state.windows = []; state.fragments = [];
  if (!state.partition) return;
  if (state.mode === 'steps' && state.trace) {
    state.frame = replayTrace(state.trace, state.step);
    state.windows = state.frame.windows;
    for (const w of state.windows) {
      const b = w.bounds;
      for (const block of state.model.blocks) {
        const g = block.geometry;
        if (g.x_min >= b.x_max || g.x_max <= b.x_min || g.y_min >= b.y_max || g.y_max <= b.y_min) continue;
        state.fragments.push({ ...block, windowId: w.window_id, geometry: { ...g,
          x_min: Math.max(g.x_min, b.x_min), y_min: Math.max(g.y_min, b.y_min),
          x_max: Math.min(g.x_max, b.x_max), y_max: Math.min(g.y_max, b.y_max) } });
      }
    }
  } else {
    state.windows = state.partition.windows;
    state.fragments = state.windows.flatMap((w) => w.fragments.map((f) => ({
      id: f.source_conductor_id, blockId: f.source_block_id, net: f.net_name, layer: f.layer_ref,
      geometry: f.geometry, windowId: w.window_id,
    })));
  }
  const layerOrder = new Map(state.model.layers.map((layer, index) => [layer.name, index]));
  state.fragments.sort((a, b) => layerOrder.get(a.layer) - layerOrder.get(b.layer));
}

function updatePartitionStatus() {
  if (!state.partition) return;
  const c = state.partition.config;
  $('partition-status').textContent = `${state.mode === 'steps' ? '最终结果：' : ''}${state.partition.metrics.window_count} 个核心窗口 · 当前参数：上限 ${c.max_conductors} / 期望下限 ${c.min_conductors} / 长宽比 ${c.max_aspect_ratio}`;
  if (state.partitionDirty) $('partition-status').textContent += ' · 参数已修改，需重新切分';
}

function renderTrace() {
  const active = state.mode === 'steps';
  $('trace-player').hidden = !active; $('step-panel').hidden = !active;
  const ready = active && state.trace !== null && !state.partitionBusy;
  const total = state.trace?.events.length ?? 0;
  $('step-first').disabled = $('step-prev').disabled = !ready || state.step === 0;
  $('step-next').disabled = $('step-last').disabled = !ready || state.step === total;
  $('step-play').disabled = $('step-range').disabled = !ready;
  $('step-counter').textContent = `第 ${state.step} / ${total} 步`;
  $('step-range').max = total; $('step-range').value = state.step;
  $('step-range').setAttribute('aria-valuetext', `第 ${state.step} 步，共 ${total} 步`);
  $('step-details').replaceChildren();
  if (!ready) {
    $('step-title').textContent = '等待切分过程';
    $('step-description').textContent = state.partitionBusy ? '正在计算并记录递归过程…' : '尚无可播放的过程，请检查样本和切分参数。';
    return;
  }
  const event = state.frame.event, c = state.partition.config;
  let description, entries;
  if (!event) {
    const root = state.trace.root;
    $('step-title').textContent = '初始区域';
    description = `从覆盖全部导体的矩形开始，共 ${root.conductor_count} 个导体。下一步检查根窗口 w。`;
    entries = [['根窗口', root.window_id], ['导体数', `${root.conductor_count}`], ['数量上限', `${c.max_conductors}`], ['长宽比', format(root.aspect_ratio)]];
  } else if (event.type === 'split') {
    const [a, b] = event.children, vertical = event.axis === 'x';
    $('step-title').textContent = `切分窗口 ${event.window.window_id}`;
    description = `${event.window.window_id} 有 ${event.window.conductor_count} 个导体，超过上限 ${c.max_conductors}。在 ${event.axis.toUpperCase()} = ${format(event.cut)} ${state.model.unit} 处${vertical ? '竖切' : '横切'}，得到 ${a.window_id}（${a.conductor_count} 个）和 ${b.window_id}（${b.conductor_count} 个），新增 ${event.extra_fragments} 个片段。`;
    entries = [['本步父窗口', event.window.window_id], ['父窗口导体', `${event.window.conductor_count}`], ['递归深度', `${event.window.depth}`],
      ['切线', `${event.axis.toUpperCase()} = ${format(event.cut)} ${state.model.unit}`],
      [vertical ? '左侧导体' : '下侧导体', `${a.conductor_count}`], [vertical ? '右侧导体' : '上侧导体', `${b.conductor_count}`],
      ['新增片段', `${event.extra_fragments}`], ['最差子窗口长宽比', format(event.score[4])], ['形状超标惩罚', format(event.score[0])]];
  } else {
    const w = event.window;
    $('step-title').textContent = `停止窗口 ${w.window_id}`;
    description = `${w.window_id} 有 ${w.conductor_count} 个导体，${stopReasons[w.terminal_reason]}，保留为最终核心窗口。`;
    entries = [['本步窗口', w.window_id], ['导体数', `${w.conductor_count}`], ['递归深度', `${w.depth}`], ['长宽比', format(w.aspect_ratio)], ['停止原因', stopReasons[w.terminal_reason]]];
  }
  if (state.step === total) description += ` 全部处理完成，共 ${state.windows.length} 个核心窗口。`;
  $('step-description').textContent = description;
  renderDetails($('step-details'), entries);
}

function runPartition() {
  if (!state.model) return;
  stopPlayback();
  let config;
  try {
    config = validateConfig({ max_conductors: $('max-conductors').valueAsNumber,
      min_conductors: $('min-conductors').valueAsNumber, max_aspect_ratio: $('max-aspect').valueAsNumber });
  } catch (error) {
    $('partition-error').textContent = error.message;
    $('partition-error').hidden = false;
    return;
  }
  partitionWorker?.terminate();
  state.partition = null; state.fragments = []; state.windows = []; state.selectedWindow = null;
  state.trace = null; state.step = 0; state.frame = null;
  state.environment = null; state.environmentError = null;
  state.hovered = null; state.partitionBusy = true; state.partitionDirty = false;
  $('partition-error').hidden = true;
  $('partition-status').textContent = '正在浏览器中计算 RCB…';
  $('run-partition').textContent = '计算中…'; $('run-partition').disabled = true;
  renderPartition(); inspect(selectedBlock()); requestDraw();
  let worker;
  const finish = (error, result, trace, environment, environmentError) => {
    if (partitionWorker !== worker) return;
    worker?.terminate(); partitionWorker = null;
    state.partitionBusy = false;
    $('run-partition').textContent = '重新切分'; $('run-partition').disabled = false;
    if (error) {
      $('partition-error').textContent = error;
      $('partition-error').hidden = false;
      $('partition-status').textContent = '未生成切分结果，可调整参数或切回原始版图';
    } else {
      state.partition = result; state.trace = trace;
      state.environment = environment ?? null; state.environmentError = environmentError ?? null;
      if (state.mode === 'environment') state.selectedWindow = defaultEnvironmentWindow();
      refreshPartitionView(); updatePartitionStatus();
    }
    renderPartition();
    if (state.mode === 'environment' && state.environmentFocused) {
      if (selectedEnvironment()) focusEnvironment(); else fitView();
    } else if (state.fitted) fitView();
    updateMatrixResize(); requestDraw();
  };
  try {
    worker = new Worker(new URL('./rcb-worker.js', import.meta.url), { type: 'module' });
    partitionWorker = worker;
    worker.onmessage = ({ data }) => finish(data.error, data.result, data.trace, data.environment, data.environmentError);
    worker.onerror = (event) => { event.preventDefault(); finish('无法运行浏览器切分程序，请刷新页面后重试。'); };
    worker.postMessage({ layout: state.model.layout, label: state.model.label, config });
  } catch (error) {
    // Construction can fail before there is a Worker (for example, browser policy).
    partitionWorker = worker;
    finish(error.message || '无法启动浏览器切分程序。');
  }
}

function renderPartition() {
  const result = state.partition;
  $('run-partition').disabled = state.partitionBusy;
  $('run-partition').textContent = state.partitionBusy ? '计算中…' : '重新切分';
  $('partition-metrics').replaceChildren();
  $('partition-warning').hidden = true;
  const select = $('window-select');
  select.replaceChildren(new Option('全部窗口', '')); select.disabled = !result;
  if (result) {
    const m = result.metrics;
    renderDetails($('partition-metrics'), state.frame ? [['当前区域', `${state.windows.length} 个`],
      ['待检查', `${state.frame.pending_count} 个`], ['已停止', `${state.frame.completed_count} 个`],
      ['已执行切分', `${state.frame.split_count} 次`], ['当前额外片段', `${state.fragments.length - m.conductor_count} 个`]] : [['核心窗口', `${m.window_count} 个`],
      ['导体数范围', `${m.min_core_count}–${m.max_core_count}`], ['平均导体数', format(m.mean_core_count)],
      ['被切开的导体', `${m.split_conductor_count} 个`], ['额外片段', `${m.extra_fragments} 个`],
      ['低于期望下限', `${m.underfilled_windows} 个窗口`], ['超出数量上限', `${m.over_limit_windows} 个窗口`],
      ['最大长宽比', format(m.max_aspect_ratio)]]);
    const over = state.windows.filter((w) => w.terminal_reason !== null && w.conductor_count > result.config.max_conductors).length;
    if (over) {
      $('partition-warning').textContent = `${over} 个已停止的窗口仍超过数量上限，已用红色边框标记。选择窗口可查看停止原因。`;
      $('partition-warning').hidden = false;
    }
    state.windows.forEach((w) => select.append(new Option(`${w.window_id} · ${w.conductor_count} 个导体${w.terminal_reason === null ? ' · 待检查' : w.conductor_count > result.config.max_conductors ? ' · 超限' : ''}`, w.window_id)));
  }
  renderWindowInfo(); renderTrace(); renderEnvironment();
}

function selectWindow(id) {
  state.selectedWindow = id || null;
  state.hovered = null;
  renderWindowInfo(); renderEnvironment(); inspect(selectedBlock());
  if (state.mode === 'environment') {
    if (state.environmentFocused && selectedEnvironment()) focusEnvironment();
    else if (state.fitted || !state.selectedWindow) fitView();
  }
  requestDraw();
}

const selectedEnvironment = () => state.environment?.windows.find((w) => w.window_id === state.selectedWindow);
const percent = (ratio) => `${format(ratio * 100)}%`;

function defaultEnvironmentWindow(id) {
  const windows = state.environment?.windows ?? [];
  return windows.find((w) => w.window_id === id)?.window_id
    ?? windows.find((w) => w.status === 'expanded')?.window_id ?? windows[0]?.window_id ?? null;
}

function renderEnvironment() {
  const active = state.mode === 'environment';
  $('environment-panel').hidden = $('environment-banner').hidden = !active;
  viewer.classList.toggle('environment-mode', active);
  const windows = state.environment?.windows ?? [], selected = selectedEnvironment();
  state.environmentSets = {
    targets: new Set(selected?.target_conductor_ids), included: new Set(selected?.included_conductor_ids),
    partial: new Set(selected?.boundary_partial_excluded_ids),
  };
  const select = $('environment-select');
  select.replaceChildren(new Option('全部范围', ''));
  windows.forEach((w) => select.append(new Option(`${w.window_id} · ${w.r_um === null ? '未定义' : `r = ${format(w.r_um)} μm`}`, w.window_id)));
  select.value = selected?.window_id ?? '';
  select.disabled = !windows.length;
  const index = windows.indexOf(selected);
  $('environment-prev').disabled = !windows.length || index === 0;
  $('environment-next').disabled = !windows.length || index === windows.length - 1;
  $('environment-focus').disabled = !selected;
  $('show-environments').disabled = !windows.length || !selected;
  $('environment-info').replaceChildren(); $('environment-proof').textContent = '';
  $('environment-current').textContent = selected?.status === 'expanded'
    ? `${selected.window_id}：遗漏 ${percent(selected.omission_at_zero)} → ${percent(selected.omission_ratio)} · 纳入 ${selected.included_conductor_count} 根（新增 ${selected.added_conductor_count} 根）` : '';
  const message = $('environment-message');
  message.dataset.status = selected?.status ?? '';
  if (!state.environment) {
    message.textContent = state.partitionBusy ? '正在计算核心及外扩范围…' : state.environmentError ?? '请先完成 RCB 切分。';
    $('environment-summary').textContent = message.textContent;
    return;
  }
  const stats = state.environment.summary;
  $('environment-summary').textContent = `${stats.defined_count} / ${windows.length} 个核心可计算`
    + (stats.defined_count ? ` · 平均纳入 ${format(stats.mean_included_count)} 根 · 平均 r = ${format(stats.mean_radius_um)} μm` : '')
    + (stats.undefined_count ? ` · ${stats.undefined_count} 个未定义` : '');
  if (!selected) {
    message.textContent = '显示全部可计算窗口的外扩边界。点击核心或从列表选择，查看对应范围。平均值只统计可计算窗口。';
    renderDetails($('environment-info'), [['核心窗口', `${windows.length} 个`], ['可计算', `${stats.defined_count} 个`], ['未定义', `${stats.undefined_count} 个`]]);
    return;
  }
  if (selected.status !== 'expanded') {
    message.textContent = selected.status === 'undefined_no_complete_targets'
      ? '核心内没有完整导体，5% 遗漏比例未定义。相交片段不作为目标。'
      : '目标导体的总耦合为零，5% 遗漏比例未定义。';
    renderDetails($('environment-info'), [['核心窗口', selected.window_id], ['完整目标导体', `${selected.complete_target_count} 根`], ['外扩距离', '未定义']]);
    return;
  }
  const b = selected.environment_bounds_um, core = selected.core_bounds_um;
  message.textContent = selected.r_um === 0 ? '核心自身已满足 5% 阈值，无需外扩。' : '已找到最小合格范围，四边各外扩相同距离。';
  renderDetails($('environment-info'), [['核心窗口', selected.window_id], ['每侧外扩 r', `${format(selected.r_um)} μm`],
    ['遗漏比例', `${percent(selected.omission_at_zero)} → ${percent(selected.omission_ratio)}`],
    ['完整目标导体', `${selected.complete_target_count} 根`], ['纳入导体总数', `${selected.included_conductor_count} 根`],
    ['新增环境导体', `${selected.added_conductor_count} 根`], ['边界相交未纳入', `${selected.boundary_partial_excluded_ids.length} 根`],
    ['核心宽 × 高', `${format(core.x_max - core.x_min)} × ${format(core.y_max - core.y_min)} μm`],
    ['外扩宽 × 高', `${format(b.x_max - b.x_min)} × ${format(b.y_max - b.y_min)} μm`],
    ['外扩 X 范围', `${format(b.x_min)} … ${format(b.x_max)}`], ['外扩 Y 范围', `${format(b.y_min)} … ${format(b.y_max)}`]]);
  $('environment-proof').textContent = selected.previous_event
    ? `上一个导体纳入时刻 r = ${format(selected.previous_event.r_um)} μm，遗漏 ${percent(selected.previous_event.omission_ratio)}，仍高于 5%。两次纳入之间，遗漏比例不变。`
    : 'r = 0 已达标，因此最小距离为 0。';
}

function moveEnvironment(direction) {
  const windows = state.environment?.windows ?? [];
  if (!windows.length) return;
  const index = windows.indexOf(selectedEnvironment());
  selectWindow(windows[index < 0 ? (direction > 0 ? 0 : windows.length - 1) : Math.max(0, Math.min(windows.length - 1, index + direction))].window_id);
}

function focusEnvironment() {
  const w = selectedEnvironment();
  if (!w) return;
  fitBounds(w.environment_bounds_um ?? w.core_bounds_um);
  state.fitted = false; state.environmentFocused = true;
}

function renderWindowInfo() {
  const w = state.windows.find((w) => w.window_id === state.selectedWindow);
  $('window-select').value = w?.window_id ?? '';
  $('clear-window').disabled = !w;
  $('window-info').replaceChildren();
  if (!w) return;
  const b = w.bounds;
  renderDetails($('window-info'), [['窗口编号', w.window_id], ['导体 / 片段数', `${w.conductor_count}`],
    ['X 范围', `${format(b.x_min)} … ${format(b.x_max)}`], ['Y 范围', `${format(b.y_min)} … ${format(b.y_max)}`],
    ['宽 × 高', `${format(b.x_max - b.x_min)} × ${format(b.y_max - b.y_min)} ${state.model.unit}`],
    ['长宽比', format(w.aspect_ratio)], ['递归深度', `${w.depth}`], ['处理状态', stopReasons[w.terminal_reason] ?? '待检查']]);
}

function renderDetails(element, entries) {
  element.replaceChildren();
  for (const [key, value] of entries) {
    const term = document.createElement('dt'); term.textContent = key;
    const detail = document.createElement('dd'); detail.textContent = value;
    element.append(term, detail);
  }
}

function renderMatrix() {
  const matrix = state.model.matrix;
  const table = $('matrix-table');
  const scroll = $('matrix-scroll');
  table.replaceChildren();
  scroll.hidden = !matrix.values;
  $('matrix-value').hidden = !matrix.values;
  $('matrix-empty').hidden = Boolean(matrix.values);
  if (!matrix.values) {
    $('matrix-summary').textContent = '暂无可用矩阵';
    $('matrix-hint').textContent = '俯视图仍可正常查看。';
    $('matrix-empty').textContent = matrix.message;
    updateMatrixResize();
    return;
  }
  const { values, names, unit } = matrix;
  $('matrix-summary').textContent = `${names.length} × ${names.length} · 单位 ${unit}`;
  updateMatrixHint();
  $('matrix-value').textContent = '悬停或单击单元格，查看对应导体和完整数值。';
  const head = table.createTHead();
  const headerRow = head.insertRow();
  for (const name of ['行 / 列', ...names]) {
    const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = name; headerRow.append(cell);
  }
  const body = table.createTBody();
  for (let row = 0; row < values.length; row++) {
    const tr = body.insertRow();
    const header = document.createElement('th'); header.scope = 'row'; header.textContent = names[row]; tr.append(header);
    for (let col = 0; col < values.length; col++) {
      const value = values[row][col];
      const cell = tr.insertCell();
      cell.dataset.row = row; cell.dataset.col = col;
      cell.textContent = value === 0 ? '0' : value.toExponential(5);
      cell.title = `C[${names[row]}, ${names[col]}] = ${value} ${unit}`;
      if (row === col) cell.classList.add('diagonal');
      else if (value === 0) cell.classList.add('zero');
    }
  }
  scroll.scrollTop = 0; scroll.scrollLeft = 0;
  updateMatrixResize();
}

function setupMatrixResize() {
  if (window.self !== window.top) return () => {};
  viewer.classList.add('standalone');
  const handle = $('matrix-resize');
  const scroll = $('matrix-scroll');
  const panel = document.querySelector('.matrix-panel');
  const workspace = document.querySelector('.workspace');
  const defaultHeight = 230, minHeight = 100;
  let preferredHeight = defaultHeight, maxHeight = defaultHeight, drag = null;

  function finishDrag() {
    if (!drag) return;
    const pointerId = drag.pointerId;
    drag = null;
    viewer.classList.remove('is-resizing-matrix');
    if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
  }

  function update() {
    handle.hidden = !state.model?.matrix.values;
    if (handle.hidden) { finishDrag(); return; }
    const panelChrome = panel.getBoundingClientRect().height - scroll.getBoundingClientRect().height;
    const fixedHeight = ['.header', '.error', '.partition-toolbar', '.trace-player', '.environment-banner', '.statusbar'].reduce((sum, selector) => sum + document.querySelector(selector).getBoundingClientRect().height, 0);
    const workspaceMin = parseFloat(getComputedStyle(workspace).minHeight);
    // Keep both panes usable. Short/mobile windows can still scroll the whole viewer.
    maxHeight = Math.max(defaultHeight, Math.floor(viewer.clientHeight - fixedHeight - workspaceMin - handle.offsetHeight - panelChrome));
    const height = Math.round(Math.max(minHeight, Math.min(maxHeight, preferredHeight)));
    scroll.style.height = `${height}px`;
    handle.setAttribute('aria-valuemin', minHeight);
    handle.setAttribute('aria-valuemax', maxHeight);
    handle.setAttribute('aria-valuenow', height);
    handle.setAttribute('aria-valuetext', `矩阵高度 ${height} 像素`);
  }

  function setHeight(height) {
    preferredHeight = Math.max(minHeight, Math.min(maxHeight, height));
    update();
  }

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || drag) return;
    event.preventDefault();
    handle.focus({ preventScroll: true });
    drag = { pointerId: event.pointerId, y: event.clientY, height: scroll.getBoundingClientRect().height };
    handle.setPointerCapture(event.pointerId);
    viewer.classList.add('is-resizing-matrix');
  });
  handle.addEventListener('pointermove', (event) => {
    if (drag?.pointerId === event.pointerId) setHeight(drag.height + drag.y - event.clientY);
  });
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    handle.addEventListener(eventName, (event) => { if (drag?.pointerId === event.pointerId) finishDrag(); });
  }
  handle.addEventListener('dblclick', () => setHeight(defaultHeight));
  handle.addEventListener('keydown', (event) => {
    const height = scroll.getBoundingClientRect().height;
    const next = { ArrowUp: height + 24, ArrowDown: height - 24, Home: minHeight, End: maxHeight, Enter: defaultHeight }[event.key];
    if (next !== undefined) { event.preventDefault(); setHeight(next); }
  });
  window.addEventListener('blur', finishDrag);
  window.addEventListener('resize', update);
  return update;
}

function renderLayers() {
  $('layer-list').replaceChildren();
  for (const layer of state.model.layers) {
    const row = document.createElement('label'); row.className = 'layer';
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = true; input.dataset.layer = layer.name; input.setAttribute('aria-label', `显示 ${layer.name}`);
    const swatch = document.createElement('span'); swatch.className = 'swatch'; swatch.style.background = layer.color;
    const name = document.createElement('span'); name.className = 'layer-name'; name.textContent = layer.name;
    const count = document.createElement('span'); count.className = 'count'; count.textContent = `${layer.count} 块`;
    row.append(input, swatch, name, count);
    input.addEventListener('change', () => {
      if (input.checked) state.visible.add(layer.name); else state.visible.delete(layer.name);
      state.hovered = null;
      if (state.selected && !state.model.blocks.some((block) => block.id === state.selected && state.visible.has(block.layer))) state.selected = null;
      inspect(selectedBlock()); updateStatus(); requestDraw();
    });
    $('layer-list').append(row);
  }
}

function updateStatus() {
  const count = state.model.blocks.filter((block) => state.visible.has(block.layer)).length;
  $('layer-summary').textContent = `${state.visible.size} / ${state.model.layers.length} 层可见`;
  $('status').textContent = `${count} 个可见几何块 · 滚轮缩放，拖动平移`;
}

function inspect(block) {
  $('inspector-title').textContent = block?.windowId ? '导体片段信息' : block && block.id === state.selected ? '已选中导体' : '导体信息';
  $('inspector-hint').hidden = Boolean(block);
  if (!block) { $('inspector').replaceChildren(); return; }
  const g = block.geometry;
  const membership = state.mode === 'environment' && selectedEnvironment()?.status === 'expanded'
    ? [['当前范围', state.environmentSets.targets.has(block.id) ? '核心目标导体' : state.environmentSets.included.has(block.id) ? '已纳入环境导体' : state.environmentSets.partial.has(block.id) ? '边界相交，未纳入' : '范围外，未纳入']] : [];
  renderDetails($('inspector'), [['原导体编号', block.id], ...membership, ...(block.windowId ? [['所属窗口', block.windowId]] : []), ['网络', block.net], ['图层', block.layer], ['X 范围', `${format(g.x_min)} … ${format(g.x_max)}`], ['Y 范围', `${format(g.y_min)} … ${format(g.y_max)}`], ['宽 × 高', `${format(g.x_max - g.x_min)} × ${format(g.y_max - g.y_min)} ${state.model.unit}`]]);
}

const selectedBlock = () => (state.selectedWindow && state.mode !== 'environment' ? state.fragments : state.model?.blocks)?.find((block) => block.id === state.selected && state.visible.has(block.layer) && (state.mode === 'environment' || !state.selectedWindow || block.windowId === state.selectedWindow));
const paneWidth = () => state.mode === 'compare' ? state.width / 2 : state.width;
const isPartitionPane = (pane) => state.mode === 'partition' || state.mode === 'steps' || state.mode === 'environment' || (state.mode === 'compare' && pane === 1);
const toScreen = (x, y) => ({ x: paneWidth() / 2 + (x - state.centerX) * state.scale, y: state.height / 2 - (y - state.centerY) * state.scale });
const toWorld = (x, y) => ({ x: (x - paneWidth() / 2) / state.scale + state.centerX, y: (state.height / 2 - y) / state.scale + state.centerY });
const pointer = (event) => {
  const rect = canvas.getBoundingClientRect(), x = event.clientX - rect.left;
  const pane = state.drag?.pane ?? (state.mode === 'compare' && x >= paneWidth() ? 1 : 0);
  return { x: x - pane * paneWidth(), y: event.clientY - rect.top, pane };
};

function fitView() {
  if (!state.model) return;
  state.environmentFocused = false;
  const b = { ...state.model.bounds };
  if (state.mode === 'environment') for (const w of visibleEnvironments()) {
    const e = w.environment_bounds_um;
    b.x_min = Math.min(b.x_min, e.x_min); b.y_min = Math.min(b.y_min, e.y_min);
    b.x_max = Math.max(b.x_max, e.x_max); b.y_max = Math.max(b.y_max, e.y_max);
  }
  fitBounds(b);
}

function fitBounds(b) {
  if (!state.model || !state.width || !state.height) return;
  state.centerX = (b.x_min + b.x_max) / 2; state.centerY = (b.y_min + b.y_max) / 2;
  state.fitScale = Math.min(Math.max(1, paneWidth() - 80) / (b.x_max - b.x_min), Math.max(1, state.height - 130) / (b.y_max - b.y_min));
  state.scale = state.fitScale; state.fitted = true;
  requestDraw();
}

function zoom(factor, point = { x: paneWidth() / 2, y: state.height / 2 }) {
  if (!state.model) return;
  state.environmentFocused = false;
  const before = toWorld(point.x, point.y);
  state.scale = Math.max(state.fitScale * .2, Math.min(state.fitScale * 100, state.scale * factor));
  const after = toWorld(point.x, point.y);
  state.centerX += before.x - after.x; state.centerY += before.y - after.y;
  state.fitted = false; requestDraw();
}

function hitTest(point) {
  const world = toWorld(point.x, point.y);
  const tolerance = 3 / state.scale;
  const partitioned = isPartitionPane(point.pane) && state.mode !== 'environment' && state.partition;
  const blocks = partitioned ? state.fragments : state.model.blocks;
  const core = partitioned ? hitWindow(point) : null;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i], g = block.geometry;
    if (partitioned && block.windowId !== core?.window_id) continue;
    if (state.visible.has(block.layer) && world.x >= g.x_min - tolerance && world.x <= g.x_max + tolerance && world.y >= g.y_min - tolerance && world.y <= g.y_max + tolerance) return block;
  }
  return null;
}

function hitWindow(point) {
  if (!isPartitionPane(point.pane) || !state.partition) return null;
  const p = toWorld(point.x, point.y), root = state.partition.root_bounds;
  return state.windows.find(({ bounds: b }) => p.x >= b.x_min && p.y >= b.y_min
    && (p.x < b.x_max || (p.x === root.x_max && b.x_max === root.x_max))
    && (p.y < b.y_max || (p.y === root.y_max && b.y_max === root.y_max))) ?? null;
}

function niceStep(target) {
  const power = 10 ** Math.floor(Math.log10(target));
  const ratio = target / power;
  return (ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10) * power;
}

function requestDraw() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; draw(); });
}

function draw() {
  const { width, height, model } = state;
  if (!width || !height) return;
  const css = getComputedStyle(document.documentElement);
  const style = (name) => css.getPropertyValue(name).trim();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = style('--bg'); ctx.fillRect(0, 0, width, height);
  if (!model) {
    ctx.fillStyle = style('--major-grid');
    for (let x = 16; x < width; x += 24) for (let y = 16; y < height; y += 24) ctx.fillRect(x, y, 1, 1);
    return;
  }
  for (const pane of state.mode === 'compare' ? [0, 1] : [0]) {
    ctx.save(); ctx.translate(pane * paneWidth(), 0);
    ctx.beginPath(); ctx.rect(0, 0, paneWidth(), height); ctx.clip();
    drawPane(style, isPartitionPane(pane));
    ctx.restore();
  }
  if (state.mode === 'compare') {
    ctx.strokeStyle = style('--line'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(paneWidth(), 0); ctx.lineTo(paneWidth(), height); ctx.stroke();
  }
  $('zoom-label').textContent = `${Math.round(state.scale / state.fitScale * 100)}%`;
}

function drawPane(style, partitioned) {
  const width = paneWidth(), { height, model } = state;
  const environmentMode = state.mode === 'environment';
  const environment = environmentMode ? selectedEnvironment() : null;
  const min = toWorld(0, height), max = toWorld(width, 0);
  const major = niceStep(90 / state.scale);
  const grid = (step, stroke) => {
    ctx.beginPath(); ctx.strokeStyle = stroke; ctx.lineWidth = .6;
    for (let i = Math.ceil(min.x / step); i <= Math.floor(max.x / step); i++) { const x = toScreen(i * step, 0).x; ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let i = Math.ceil(min.y / step); i <= Math.floor(max.y / step); i++) { const y = toScreen(0, i * step).y; ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();
  };
  grid(major / 5, style('--grid'));
  grid(major, style('--major-grid'));
  const w = model.window, corner = toScreen(w.x_min, w.y_max);
  const ww = (w.x_max - w.x_min) * state.scale, wh = (w.y_max - w.y_min) * state.scale;
  ctx.fillStyle = style('--window'); ctx.fillRect(corner.x, corner.y, ww, wh);
  ctx.strokeStyle = style('--muted'); ctx.lineWidth = 1; ctx.setLineDash([5, 5]); ctx.strokeRect(corner.x, corner.y, ww, wh); ctx.setLineDash([]);
  if (partitioned && state.partition) drawCoreWindows(style, false);
  if (environmentMode) drawEnvironments(style, false);
  const colors = new Map(model.layers.map((layer) => [layer.name, layer.color]));
  const highlight = [];
  for (const block of partitioned && state.partition && !environmentMode ? state.fragments : model.blocks) {
    if (!state.visible.has(block.layer)) continue;
    const g = block.geometry, point = toScreen(g.x_min, g.y_max);
    const bw = (g.x_max - g.x_min) * state.scale, bh = (g.y_max - g.y_min) * state.scale;
    if (point.x + bw < 0 || point.y + bh < 0 || point.x > width || point.y > height) continue;
    const dimmed = environmentMode ? environment?.status === 'expanded' && !state.environmentSets.included.has(block.id)
      : partitioned && state.selectedWindow && block.windowId !== state.selectedWindow;
    ctx.globalAlpha = dimmed ? environmentMode && state.environmentSets.partial.has(block.id) ? .3 : .15 : 1;
    ctx.fillStyle = colors.get(block.layer); ctx.fillRect(point.x, point.y, bw, bh);
    ctx.strokeStyle = colors.get(block.layer); ctx.lineWidth = .65; ctx.strokeRect(point.x, point.y, bw, bh);
    if (!dimmed && (block.id === state.selected || block.id === state.hovered?.id)) highlight.push({ point, bw, bh });
    if (!dimmed && $('show-labels').checked) {
      ctx.fillStyle = style('--text'); ctx.font = '10px system-ui'; ctx.textAlign = 'left';
      ctx.fillText(block.id, point.x + bw + 3, point.y + Math.min(bh / 2 + 3, 12));
    }
  }
  ctx.globalAlpha = 1;
  for (const { point, bw, bh } of highlight) {
    ctx.strokeStyle = style('--surface'); ctx.lineWidth = 5; ctx.strokeRect(point.x - 1, point.y - 1, bw + 2, bh + 2);
    ctx.strokeStyle = style('--text'); ctx.lineWidth = 1.5; ctx.strokeRect(point.x - 1, point.y - 1, bw + 2, bh + 2);
  }
  if (partitioned && state.partition) drawCoreWindows(style, true);
  if (environmentMode) drawEnvironments(style, true);
  if (state.mode === 'steps' && state.frame) drawTraceFocus(style);
  // World-coordinate ticks and a scale bar keep the view quantitatively readable.
  ctx.fillStyle = style('--muted'); ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'center';
  for (let i = Math.ceil(min.x / major); i <= Math.floor(max.x / major); i++) {
    const x = toScreen(i * major, 0).x;
    if (x > 35 && x < width - 30) ctx.fillText(format(i * major), x, 14);
  }
  ctx.textAlign = 'left';
  for (let i = Math.ceil(min.y / major); i <= Math.floor(max.y / major); i++) {
    const y = toScreen(0, i * major).y;
    if (y > 65 && y < height - 70) ctx.fillText(format(i * major), 7, y + 3);
  }
  const length = niceStep(65 / state.scale), pixels = length * state.scale;
  ctx.fillStyle = style('--surface'); ctx.fillRect(12, height - 53, pixels + 18, 40);
  ctx.strokeStyle = style('--text'); ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(21, height - 30); ctx.lineTo(21 + pixels, height - 30); ctx.moveTo(21, height - 34); ctx.lineTo(21, height - 26); ctx.moveTo(21 + pixels, height - 34); ctx.lineTo(21 + pixels, height - 26); ctx.stroke();
  ctx.fillStyle = style('--text'); ctx.fillText(`${format(length)} ${model.unit}`, 21, height - 38);
  const title = environmentMode ? state.partitionBusy ? '5% 环境外扩 · 计算中…'
    : `5% 环境外扩 · ${environment ? `${environment.window_id} · ${environment.r_um === null ? '未定义' : `r = ${format(environment.r_um)} μm`}` : state.environment ? '全部范围' : '暂无范围'}`
    : partitioned ? state.partition ? state.mode === 'steps' ? `RCB 过程 · 第 ${state.step} / ${state.trace.events.length} 步` : 'RCB 切分 · 核心窗口' : state.partitionBusy ? 'RCB 计算中…' : 'RCB · 尚未生成结果' : '原始版图';
  ctx.font = '600 11px system-ui'; ctx.textAlign = 'left';
  ctx.fillStyle = style('--surface'); ctx.fillRect(12, 27, Math.min(width - 24, ctx.measureText(title).width + 18), 26);
  ctx.fillStyle = style('--text'); ctx.fillText(title, 21, 44, Math.max(1, width - 42));
}

function visibleEnvironments() {
  const windows = (state.environment?.windows ?? []).filter((w) => w.status === 'expanded');
  return !state.selectedWindow || $('show-environments').checked ? windows : windows.filter((w) => w.window_id === state.selectedWindow);
}

function drawEnvironments(style, borders) {
  const windows = visibleEnvironments().sort((a, b) => Number(a.window_id === state.selectedWindow) - Number(b.window_id === state.selectedWindow));
  for (const w of windows) {
    const b = w.environment_bounds_um, p = toScreen(b.x_min, b.y_max);
    const width = (b.x_max - b.x_min) * state.scale, height = (b.y_max - b.y_min) * state.scale;
    if (p.x + width < 0 || p.y + height < 0 || p.x > paneWidth() || p.y > state.height) continue;
    const selected = w.window_id === state.selectedWindow;
    ctx.save();
    if (!borders) {
      ctx.globalAlpha = selected ? .075 : .015; ctx.fillStyle = style('--environment');
      ctx.fillRect(p.x, p.y, width, height);
    } else {
      ctx.globalAlpha = selected || !state.selectedWindow ? 1 : .25;
      ctx.setLineDash([8, 5]); ctx.strokeStyle = style('--surface'); ctx.lineWidth = selected ? 5 : 3;
      ctx.strokeRect(p.x, p.y, width, height);
      ctx.strokeStyle = style('--environment'); ctx.lineWidth = selected ? 2.5 : 1.2;
      ctx.strokeRect(p.x, p.y, width, height); ctx.setLineDash([]);
      if (selected || !state.selectedWindow) {
        const label = selected ? `${w.window_id} · r ${format(w.r_um)} μm` : w.window_id;
        ctx.font = '600 11px ui-monospace, monospace'; ctx.textAlign = 'left';
        const x = Math.max(5, Math.min(p.x + 4, paneWidth() - ctx.measureText(label).width - 14));
        const y = Math.max(70, Math.min(p.y - 7, state.height - 65));
        ctx.fillStyle = style('--surface'); ctx.fillRect(x - 4, y - 13, ctx.measureText(label).width + 8, 19);
        ctx.fillStyle = style('--environment'); ctx.fillText(label, x, y);
      }
    }
    ctx.restore();
  }
}

function drawCoreWindows(style, borders) {
  state.windows.forEach((w, index) => {
    const b = w.bounds, point = toScreen(b.x_min, b.y_max);
    const width = (b.x_max - b.x_min) * state.scale, height = (b.y_max - b.y_min) * state.scale;
    if (point.x + width < 0 || point.y + height < 0 || point.x > paneWidth() || point.y > state.height) return;
    const selected = state.selectedWindow === w.window_id;
    const pending = w.terminal_reason === null;
    const over = !pending && w.conductor_count > state.partition.config.max_conductors;
    const stroke = style(over ? '--danger' : selected ? '--accent' : state.mode === 'environment' ? state.selectedWindow ? '--muted' : '--accent' : state.mode === 'steps' ? pending ? '--muted' : '--done' : '--text');
    if (!borders) {
      ctx.fillStyle = stroke; ctx.globalAlpha = selected ? .10 : index % 2 ? .055 : .025;
      ctx.fillRect(point.x, point.y, width, height); ctx.globalAlpha = 1;
      return;
    }
    ctx.strokeStyle = stroke; ctx.lineWidth = selected || over ? 2.5 : 1;
    ctx.setLineDash(pending ? [5, 4] : []);
    ctx.strokeRect(point.x, point.y, width, height); ctx.setLineDash([]);
    if (width > 36 && height > 24) {
      ctx.save(); ctx.beginPath(); ctx.rect(point.x + 2, point.y + 2, width - 4, height - 4); ctx.clip();
      const label = `${w.window_id} · ${w.conductor_count}${over ? ' 超限' : pending ? ' 待检查' : state.mode === 'steps' ? ' 已停止' : ''}`;
      ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'left';
      ctx.fillStyle = style('--surface'); ctx.fillRect(point.x + 3, point.y + 3, ctx.measureText(label).width + 10, 17);
      ctx.fillStyle = stroke; ctx.fillText(label, point.x + 8, point.y + 15);
      ctx.restore();
    }
  });
}

function drawTraceFocus(style) {
  const event = state.frame.event, w = event?.window ?? state.trace.root;
  const b = w.bounds, topLeft = toScreen(b.x_min, b.y_max);
  const width = (b.x_max - b.x_min) * state.scale, height = (b.y_max - b.y_min) * state.scale;
  const stopped = event?.type === 'stop';
  const over = stopped && w.conductor_count > state.partition.config.max_conductors;
  ctx.save();
  ctx.strokeStyle = style(stopped ? over ? '--danger' : '--done' : '--accent');
  ctx.lineWidth = 3; ctx.setLineDash(stopped ? [] : [7, 4]);
  ctx.strokeRect(topLeft.x, topLeft.y, width, height);
  if (event?.type === 'split') {
    const a = event.axis === 'x' ? toScreen(event.cut, b.y_min) : toScreen(b.x_min, event.cut);
    const c = event.axis === 'x' ? toScreen(event.cut, b.y_max) : toScreen(b.x_max, event.cut);
    ctx.setLineDash([]);
    // White/dark halo makes this cut visible over conductors of any layer color.
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y);
    ctx.strokeStyle = style('--surface'); ctx.lineWidth = 7; ctx.stroke();
    ctx.strokeStyle = style('--cut'); ctx.lineWidth = 3; ctx.stroke();
  }
  ctx.restore();
}

$('step-first').addEventListener('click', () => setTraceStep(0));
$('step-prev').addEventListener('click', () => setTraceStep(state.step - 1));
$('step-next').addEventListener('click', () => setTraceStep(state.step + 1));
$('step-last').addEventListener('click', () => setTraceStep(state.trace?.events.length ?? 0));
$('step-play').addEventListener('click', togglePlayback);
$('step-range').addEventListener('input', (event) => setTraceStep(event.target.valueAsNumber));
canvas.addEventListener('keydown', (event) => {
  if (state.mode === 'environment' && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault(); moveEnvironment(event.key === 'ArrowLeft' ? -1 : 1); return;
  }
  if (state.mode !== 'steps' || !state.trace) return;
  const next = { ArrowLeft: state.step - 1, ArrowRight: state.step + 1, Home: 0, End: state.trace.events.length }[event.key];
  if (next !== undefined) { event.preventDefault(); setTraceStep(next); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stopPlayback(); });
window.addEventListener('pagehide', stopPlayback);
$('view-modes').addEventListener('change', (event) => { if (event.target.name === 'view-mode') setMode(event.target.value); });
$('partition-form').addEventListener('submit', (event) => { event.preventDefault(); runPartition(); });
$('partition-form').addEventListener('input', () => {
  stopPlayback();
  state.partitionDirty = true;
  $('partition-error').hidden = true;
  $('partition-status').textContent = state.partitionBusy ? '正在计算，修改的参数需完成后重新切分' : '参数已修改，点击“重新切分”应用到当前样本';
});
$('window-select').addEventListener('change', (event) => selectWindow(event.target.value));
$('clear-window').addEventListener('click', () => selectWindow(null));
$('environment-select').addEventListener('change', (event) => selectWindow(event.target.value));
$('environment-prev').addEventListener('click', () => moveEnvironment(-1));
$('environment-next').addEventListener('click', () => moveEnvironment(1));
$('environment-focus').addEventListener('click', focusEnvironment);
$('show-environments').addEventListener('change', () => { if (state.fitted) fitView(); requestDraw(); });
$('choose-file').addEventListener('click', () => $('file-input').click());
$('choose-empty').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', (event) => { const file = event.target.files[0]; if (file) importFile(file); event.target.value = ''; });
$('fit-view').addEventListener('click', fitView);
$('zoom-in').addEventListener('click', () => zoom(1.35));
$('zoom-out').addEventListener('click', () => zoom(1 / 1.35));
$('show-all').addEventListener('click', () => { state.visible = new Set(state.model.layers.map((layer) => layer.name)); document.querySelectorAll('[data-layer]').forEach((input) => { input.checked = true; }); updateStatus(); requestDraw(); });
$('show-labels').addEventListener('change', requestDraw);
for (const eventName of ['pointerover', 'click']) {
  $('matrix-table').addEventListener(eventName, (event) => {
    const cell = event.target.closest('td');
    if (cell) $('matrix-value').textContent = cell.title;
  });
}
document.addEventListener('dragenter', (event) => { if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); dragDepth++; viewer.classList.add('drag-over'); } });
document.addEventListener('dragover', (event) => { if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } });
document.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) viewer.classList.remove('drag-over'); });
document.addEventListener('drop', (event) => {
  event.preventDefault(); dragDepth = 0; viewer.classList.remove('drag-over');
  const file = event.dataTransfer?.files[0]; if (file) importFile(file);
});
canvas.addEventListener('wheel', (event) => {
  if (!state.model) return;
  event.preventDefault(); zoom(Math.exp(-Math.max(-200, Math.min(200, event.deltaY)) * .002), pointer(event));
}, { passive: false });
canvas.addEventListener('pointerdown', (event) => {
  if (!state.model || event.button !== 0 || state.drag) return;
  const point = pointer(event);
  state.drag = { pointerId: event.pointerId, ...point, centerX: state.centerX, centerY: state.centerY, moved: false };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (!state.model) return;
  const point = pointer(event);
  if (state.drag) {
    if (event.pointerId !== state.drag.pointerId) return;
    const dx = point.x - state.drag.x, dy = point.y - state.drag.y;
    if (Math.hypot(dx, dy) > 3) state.drag.moved = true;
    if (state.drag.moved) {
      state.centerX = state.drag.centerX - dx / state.scale; state.centerY = state.drag.centerY + dy / state.scale;
      state.environmentFocused = false;
      state.fitted = false; viewport.classList.add('is-panning'); requestDraw();
    }
  } else {
    const hit = hitTest(point);
    if (hit !== state.hovered) { state.hovered = hit; inspect(hit ?? selectedBlock()); requestDraw(); }
  }
  const world = toWorld(point.x, point.y);
  $('cursor-info').textContent = `X ${format(world.x)} · Y ${format(world.y)} ${state.model.unit}`;
});
canvas.addEventListener('pointerup', (event) => {
  if (!state.drag || state.drag.pointerId !== event.pointerId) return;
  if (!state.drag.moved) {
    const point = pointer(event);
    state.hovered = hitTest(point); state.selected = state.hovered?.id ?? null;
    if (isPartitionPane(point.pane)) {
      const core = hitWindow(point);
      if (core || state.mode !== 'environment') state.selectedWindow = core?.window_id ?? null;
      renderWindowInfo(); renderEnvironment();
      if (state.mode === 'environment') {
        if (state.environmentFocused) focusEnvironment();
        else if (state.fitted) fitView();
      }
    }
    inspect(state.hovered);
  }
  state.drag = null; viewport.classList.remove('is-panning'); canvas.releasePointerCapture(event.pointerId); requestDraw();
});
canvas.addEventListener('pointercancel', () => { state.drag = null; viewport.classList.remove('is-panning'); });
canvas.addEventListener('pointerleave', () => { if (!state.drag) { state.hovered = null; inspect(selectedBlock()); requestDraw(); } });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { state.selected = null; state.hovered = null; selectWindow(null); } });
new ResizeObserver(() => {
  state.width = viewport.clientWidth; state.height = viewport.clientHeight;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(state.width * dpr); canvas.height = Math.round(state.height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state.environmentFocused && state.mode === 'environment') focusEnvironment();
  else if (state.fitted) fitView();
  requestDraw();
}).observe(viewport);
