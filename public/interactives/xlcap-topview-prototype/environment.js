// Equal four-sided expansion using the full sample's off-diagonal couplings.
// Targets are whole conductors in the fixed core. Ground/self capacitance and
// partially contained conductors never count toward the retained coupling.
const coordinates = ['x_min', 'y_min', 'x_max', 'y_max'];
const identity = (conductor, block) => JSON.stringify([conductor, block]);

function sum(values) {
  // Compensated summation, especially for small omitted tails.
  let total = 0, correction = 0;
  for (const value of values) {
    const next = total + value;
    correction += Math.abs(total) >= Math.abs(value) ? (total - next) + value : (value - next) + total;
    total = next;
  }
  return total + correction;
}

function alignMatrix(layout, label) {
  if (!label?.capacitance?.maxwell_matrix) throw new Error('需要带有电容标签的 sample.json。仅有几何的 layout.json 可以切分，但无法计算 5% 外扩范围。');
  if (label.quality_summary?.passed !== true) throw new Error('电容标签缺少通过质量检查的标记，暂不计算外扩范围。');
  // A common capacitance unit cancels in the omission ratio.
  if (!['F', 'pF', 'fF', 'aF'].includes(label.capacitance.unit)) throw new Error('电容单位缺失或不支持，无法计算外扩范围。');
  if (layout.units?.length !== 'um') throw new Error('当前外扩计算支持长度单位为 μm 的样本。');
  const conductors = layout.conductors;
  if (!conductors?.length || conductors.some((c) => c.blocks?.length !== 1)) throw new Error('当前外扩计算要求每根导体只有一个长方体块。');
  const n = conductors.length, matrix = label.capacitance.maxwell_matrix, order = label.matrix_order;
  if (!Array.isArray(matrix) || matrix.length !== n || !matrix.every((row) => Array.isArray(row) && row.length === n && row.every(Number.isFinite))) throw new Error('电容矩阵必须完整、有限，且与版图导体数量一致。');
  if (!Array.isArray(order) || order.length !== n) throw new Error('矩阵顺序与导体数量不一致，无法计算外扩范围。');
  const mapping = new Map(), indices = new Set();
  for (const entry of order) {
    if (!entry || !Number.isInteger(entry.index) || entry.index < 0 || entry.index >= n || indices.has(entry.index)) throw new Error('矩阵索引缺失或重复，无法对齐电容标签。');
    const key = identity(entry.conductor_id, entry.block_id);
    if (mapping.has(key)) throw new Error('矩阵中存在重复的导体与几何块编号。');
    mapping.set(key, entry); indices.add(entry.index);
  }
  const seen = new Set();
  const permutation = conductors.map((c) => {
    const block = c.blocks[0], key = identity(c.conductor_id, block.block_id), entry = mapping.get(key);
    if (!entry || seen.has(key) || entry.layer_ref !== block.layer_ref) throw new Error('电容矩阵与版图的导体、几何块或图层编号不匹配。');
    const g = block.geometry;
    if (!coordinates.every((k) => Number.isFinite(g?.[k])) || g.x_max <= g.x_min || g.y_max <= g.y_min) throw new Error('导体几何无效，无法计算外扩范围。');
    seen.add(key);
    return entry.index;
  });
  let norm = 0, difference = 0;
  for (let i = 0; i < n; i++) {
    if (matrix[i][i] <= 0) throw new Error('Maxwell 矩阵对角项必须为正。');
    for (let j = 0; j < n; j++) {
      if (i !== j && matrix[i][j] > 0) throw new Error('Maxwell 矩阵存在正的非对角项，无法按耦合覆盖计算外扩。');
      norm = Math.hypot(norm, matrix[i][j]);
      difference = Math.hypot(difference, matrix[i][j] - matrix[j][i]);
    }
  }
  if (difference > 1e-10 * norm) throw new Error('Maxwell 矩阵不对称，无法计算外扩范围。');
  return permutation.map((i) => permutation.map((j) => matrix[i][j]));
}

export function expandEnvironment(layout, label, partition, epsilon = .05) {
  if (!Number.isFinite(epsilon) || epsilon < 0 || epsilon > 1) throw new Error('遗漏比例必须位于 0 到 1 之间。');
  const matrix = alignMatrix(layout, label);
  if (!partition?.windows?.length) throw new Error('请先完成核心窗口切分。');
  const conductors = layout.conductors, ids = conductors.map((c) => c.conductor_id);
  const boxes = conductors.map((c) => c.blocks[0].geometry);
  const windows = partition.windows.map((core) => {
    const b = core.bounds;
    if (!coordinates.every((k) => Number.isFinite(b?.[k])) || b.x_max <= b.x_min || b.y_max <= b.y_min) throw new Error('核心窗口几何无效。');
    const radii = boxes.map((g) => Math.max(0, b.x_min - g.x_min, b.y_min - g.y_min, g.x_max - b.x_max, g.y_max - b.y_max));
    const targets = radii.map((r, i) => r === 0 ? i : -1).filter((i) => i >= 0);
    const targetIds = targets.map((i) => ids[i]);
    const record = { window_id: core.window_id, core_bounds_um: { ...b }, complete_target_count: targets.length,
      target_conductor_ids: targetIds, r_um: null, environment_bounds_um: null };
    if (!targets.length) return { ...record, status: 'undefined_no_complete_targets' };
    const weights = ids.map((_, j) => sum(targets.map((i) => i === j ? 0 : -matrix[i][j])));
    const total = sum(weights);
    if (total <= 0) return { ...record, status: 'undefined_zero_coupling' };
    const events = [...new Set(radii)].sort((a, b) => a - b);
    // Evaluate actual entry events. Equality includes the entire conductor.
    const omissions = events.map((r) => sum(weights.filter((_, i) => radii[i] > r)) / total);
    const counts = events.map((r) => radii.filter((d) => d <= r).length);
    const index = omissions.findIndex((ratio) => ratio <= epsilon);
    const r = events[index];
    const env = { x_min: b.x_min - r, y_min: b.y_min - r, x_max: b.x_max + r, y_max: b.y_max + r };
    const included = ids.filter((_, i) => radii[i] <= r), targetSet = new Set(targetIds);
    const partial = ids.filter((_, i) => radii[i] > r && boxes[i].x_min < env.x_max && boxes[i].x_max > env.x_min
      && boxes[i].y_min < env.y_max && boxes[i].y_max > env.y_min);
    return { ...record, status: 'expanded', r_um: r, environment_bounds_um: env,
      included_conductor_ids: included, environment_conductor_ids: included.filter((id) => !targetSet.has(id)),
      boundary_partial_excluded_ids: partial, included_conductor_count: included.length,
      added_conductor_count: included.length - targets.length, omission_ratio: omissions[index], omission_at_zero: omissions[0],
      previous_event: index ? { r_um: events[index - 1], omission_ratio: omissions[index - 1] } : null,
      curve: { r_um: events, omission_ratio: omissions, included_count: counts } };
  });
  const defined = windows.filter((w) => w.status === 'expanded');
  return { epsilon, expansion_mode: 'distance', length_unit: 'um', windows,
    summary: { defined_count: defined.length, undefined_count: windows.length - defined.length,
      mean_included_count: defined.length ? sum(defined.map((w) => w.included_conductor_count)) / defined.length : null,
      mean_radius_um: defined.length ? sum(defined.map((w) => w.r_um)) / defined.length : null } };
}
