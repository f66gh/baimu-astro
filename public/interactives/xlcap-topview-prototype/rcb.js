// Browser port of XL-Cap/src/xlcap/partitioning/{rcb.py,_geometry.py,__init__.py}.
// Keep candidate cuts, lexicographic scoring, positive-area intersections and
// xlcap-partition/v1 output aligned with the Python implementation.
export const defaultConfig = Object.freeze({
  max_conductors: 24, min_conductors: 12, max_aspect_ratio: 3, max_depth: 20,
});

export function validateConfig(options = {}) {
  const config = { ...defaultConfig, ...options };
  const names = { max_conductors: '导体数上限', min_conductors: '期望导体数下限', max_depth: '递归深度上限' };
  for (const [key, name] of Object.entries(names)) {
    if (!Number.isSafeInteger(config[key]) || config[key] < 1) throw new Error(`${name}必须是正整数。`);
  }
  if (config.min_conductors > config.max_conductors) throw new Error('期望导体数下限不能大于上限。');
  if (!Number.isFinite(config.max_aspect_ratio) || config.max_aspect_ratio < 1) throw new Error('目标最大长宽比必须是大于或等于 1 的数。');
  return config;
}

const uniqueSorted = (values) => [...new Set(values)].sort((a, b) => a - b);
const boundsObject = (b) => ({ x_min: b[0], y_min: b[1], x_max: b[2], y_max: b[3] });
const aspect = (b) => Math.max((b[2] - b[0]) / (b[3] - b[1]), (b[3] - b[1]) / (b[2] - b[0]));
const intersects = (b, w) => b[0] < w[2] && b[2] > w[0] && b[1] < w[3] && b[3] > w[1];

function lessScore(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

// Count values < cut (or <= cut), without allocating Python's N × K matrix.
function countBefore(values, cut, inclusive = false) {
  let lo = 0, hi = values.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (values[mid] < cut || (inclusive && values[mid] === cut)) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function chooseCut(boxes, indices, bounds, config) {
  let best = null;
  for (const axis of [0, 1]) {
    const lo = bounds[axis], hi = bounds[axis + 2];
    const coordinates = [lo, hi], starts = [], ends = [];
    for (const index of indices) {
      const b = boxes[index];
      starts.push(b[axis]); ends.push(b[axis + 2]);
      for (const value of [b[axis], b[axis + 2], (b[axis] + b[axis + 2]) / 2]) {
        coordinates.push(Math.min(hi, Math.max(lo, value)));
      }
    }
    const points = uniqueSorted(coordinates), candidates = [...points, (lo + hi) / 2];
    for (let i = 1; i < points.length; i++) candidates.push((points[i - 1] + points[i]) / 2);
    starts.sort((a, b) => a - b); ends.sort((a, b) => a - b);
    for (const cut of uniqueSorted(candidates)) {
      if (cut <= lo || cut >= hi) continue;
      const left = countBefore(starts, cut);
      const right = indices.length - countBefore(ends, cut, true);
      if (!left || !right || Math.max(left, right) >= indices.length) continue;
      const a = [...bounds], c = [...bounds];
      a[axis + 2] = cut; c[axis] = cut;
      const largestAspect = Math.max(aspect(a), aspect(c));
      const score = [Math.max(0, largestAspect / config.max_aspect_ratio - 1),
        Math.max(left, right), left + right,
        Math.max(0, config.min_conductors - Math.min(left, right)),
        largestAspect, Math.abs((cut - lo) / (hi - lo) - 0.5), axis, cut];
      if (!best || lessScore(score, best.score)) best = { score, axis, cut, children: [a, c] };
    }
  }
  return best;
}

// The optional observer records actual recursion decisions without changing the result.
export function partitionLayout(layout, options = {}, onEvent = null) {
  const config = validateConfig(options);
  if (!Array.isArray(layout?.conductors) || !layout.conductors.length) throw new Error('版图必须包含导体。');
  const boxes = [], metadata = [], ids = new Set(), blockIds = new Set();
  const root = [Infinity, Infinity, -Infinity, -Infinity];
  for (const conductor of layout.conductors) {
    const cid = conductor.conductor_id;
    if (typeof cid !== 'string' || !cid || ids.has(cid)) throw new Error('导体编号缺失或重复。');
    ids.add(cid);
    if (conductor.blocks?.length !== 1) throw new Error('当前 RCB 仅支持每个导体一个长方体块。该样本仍可查看原始版图。');
    const block = conductor.blocks[0], g = block.geometry;
    if (typeof block.block_id !== 'string' || !block.block_id || blockIds.has(block.block_id)) throw new Error('几何块编号缺失或重复。');
    blockIds.add(block.block_id);
    const values = ['x_min', 'y_min', 'x_max', 'y_max', 'z_bottom', 'z_top'].map((key) => g?.[key]);
    if (!values.every(Number.isFinite)) throw new Error(`导体 ${cid} 的坐标必须是有限数值，且包含 Z 范围。`);
    if (values[0] >= values[2] || values[1] >= values[3] || values[4] >= values[5]) throw new Error(`导体 ${cid} 的长、宽、高必须大于零。`);
    const b = values.slice(0, 4);
    boxes.push(b);
    metadata.push({ conductor_id: cid, block_id: block.block_id,
      net_name: conductor.net_name ?? cid, layer_ref: block.layer_ref,
      z_bottom: values[4], z_top: values[5] });
    root[0] = Math.min(root[0], b[0]); root[1] = Math.min(root[1], b[1]);
    root[2] = Math.max(root[2], b[2]); root[3] = Math.max(root[3], b[3]);
  }

  const windows = [];
  const describe = (indices, bounds, path, depth, reason = null) => ({
    window_id: `w${path}`, bounds: boundsObject(bounds), depth,
    conductor_count: indices.length, aspect_ratio: aspect(bounds), terminal_reason: reason,
  });
  const allIndices = boxes.map((_, i) => i);
  onEvent?.({ type: 'start', window: describe(allIndices, root, '', 0) });
  function visit(indices, bounds, path, depth) {
    let reason;
    if (indices.length <= config.max_conductors) reason = 'within_limit';
    else if (depth >= config.max_depth) reason = 'max_depth';
    else {
      const decision = chooseCut(boxes, indices, bounds, config);
      if (decision) {
        const childIndices = decision.children.map((child) => indices.filter((index) => intersects(boxes[index], child)));
        onEvent?.({ type: 'split', window: describe(indices, bounds, path, depth),
          axis: decision.axis === 0 ? 'x' : 'y', cut: decision.cut, score: decision.score,
          children: decision.children.map((child, i) => describe(childIndices[i], child, path + i, depth + 1)),
          extra_fragments: childIndices[0].length + childIndices[1].length - indices.length,
        });
        decision.children.forEach((child, i) => visit(childIndices[i], child, path + i, depth + 1));
        return;
      }
      reason = 'no_count_reduction';
    }
    onEvent?.({ type: 'stop', window: describe(indices, bounds, path, depth, reason) });
    const wid = `w${path}`;
    const fragments = indices.map((index) => {
      const source = metadata[index], box = boxes[index];
      const clipped = [Math.max(box[0], bounds[0]), Math.max(box[1], bounds[1]), Math.min(box[2], bounds[2]), Math.min(box[3], bounds[3])];
      return { fragment_id: `${wid}:${source.block_id}`, source_conductor_id: source.conductor_id,
        source_block_id: source.block_id, net_name: source.net_name, layer_ref: source.layer_ref,
        geometry: { ...boundsObject(clipped), z_bottom: source.z_bottom, z_top: source.z_top } };
    });
    windows.push({ window_id: wid, bounds: boundsObject(bounds), depth, conductor_count: fragments.length,
      aspect_ratio: aspect(bounds), terminal_reason: reason, fragments });
  }
  visit(allIndices, root, '', 0);

  const counts = windows.map((w) => w.conductor_count), multiplicity = new Map();
  for (const w of windows) for (const f of w.fragments) multiplicity.set(f.source_conductor_id, (multiplicity.get(f.source_conductor_id) ?? 0) + 1);
  const total = counts.reduce((a, b) => a + b, 0);
  const metrics = {
    conductor_count: boxes.length, window_count: windows.length, empty_window_count: 0,
    fragment_count: total, extra_fragments: total - boxes.length, fragment_ratio: total / boxes.length,
    split_conductor_count: [...multiplicity.values()].filter((n) => n > 1).length,
    min_core_count: counts.reduce((a, b) => Math.min(a, b), Infinity),
    max_core_count: counts.reduce((a, b) => Math.max(a, b), 0), mean_core_count: total / counts.length,
    underfilled_windows: counts.filter((n) => n < config.min_conductors).length,
    over_limit_windows: counts.filter((n) => n > config.max_conductors).length,
    max_aspect_ratio: windows.reduce((m, w) => Math.max(m, w.aspect_ratio), 0),
    mean_aspect_ratio: windows.reduce((sum, w) => sum + w.aspect_ratio, 0) / windows.length,
    max_depth: windows.reduce((m, w) => Math.max(m, w.depth), 0),
    core_attention_pairs_proxy: counts.reduce((sum, n) => sum + n * n, 0),
  };
  return { schema_version: 'xlcap-partition/v1', layout_id: layout.layout_id ?? '', method: 'rcb', config,
    root_region: 'conductor_bbox', root_bounds: boundsObject(root), metrics, windows };
}
