import test from 'node:test';
import assert from 'node:assert/strict';
import { expandEnvironment } from '../public/interactives/xlcap-topview-prototype/environment.js';

function fixture(boxes, pairs, core = [0, 0, 2, 2]) {
  const bounds = (a) => Object.fromEntries(['x_min', 'y_min', 'x_max', 'y_max'].map((key, i) => [key, a[i]]));
  const conductors = boxes.map((box, i) => ({ conductor_id: `c${i}`, blocks: [{ block_id: `b${i}`, layer_ref: 'M1', geometry: bounds(box) }] }));
  const matrix = boxes.map((_, i) => boxes.map((_, j) => i === j ? 1 : 0));
  for (const [i, j, weight] of pairs) {
    matrix[i][j] = matrix[j][i] = -weight;
    matrix[i][i] += weight; matrix[j][j] += weight;
  }
  return {
    layout: { units: { length: 'um' }, conductors, window: bounds(core) },
    label: { quality_summary: { passed: true }, capacitance: { unit: 'fF', maxwell_matrix: matrix },
      matrix_order: boxes.map((_, i) => ({ index: i, conductor_id: `c${i}`, block_id: `b${i}`, layer_ref: 'M1' })) },
    partition: { windows: [{ window_id: 'w0', bounds: bounds(core) }] },
  };
}
const example = () => fixture([[0, 0, 1, 1], [2.5, 0, 3, 1], [4, 0, 5, 1], [-10, 1, 1, 1.5]], [[0, 1, 95], [0, 2, 4], [0, 3, 1], [1, 2, 1000]]);
const run = (f) => expandEnvironment(f.layout, f.label, f.partition);

test('minimum passing radius includes equality and whole conductors, keeping targets fixed', () => {
  const f = example(), before = structuredClone(f), result = run(f), w = result.windows[0];
  assert.deepEqual(f, before);
  assert.equal(w.r_um, 1);
  assert.equal(w.omission_ratio, .05);
  assert.equal(w.omission_at_zero, 1);
  assert.deepEqual(w.previous_event, { r_um: 0, omission_ratio: 1 });
  assert.deepEqual(w.target_conductor_ids, ['c0']);
  assert.deepEqual(w.included_conductor_ids, ['c0', 'c1']);
  assert.deepEqual(w.environment_conductor_ids, ['c1']);
  assert.deepEqual(w.boundary_partial_excluded_ids, ['c3']);
  assert.deepEqual(w.environment_bounds_um, { x_min: -1, y_min: -1, x_max: 3, y_max: 3 });
  assert.equal(result.summary.mean_included_count, 2);
});

test('explicit matrix indices and conductor/block identities determine alignment', () => {
  const f = example(), expected = run(f), permutation = [2, 0, 3, 1];
  const original = f.label.capacitance.maxwell_matrix;
  f.label.capacitance.maxwell_matrix = permutation.map((i) => permutation.map((j) => original[i][j]));
  f.label.matrix_order = permutation.map((old, index) => ({ ...f.label.matrix_order[old], index })).reverse();
  assert.deepEqual(run(f), expected);
});

test('target-target coupling is counted twice, self/ground terms are excluded and r=0 can pass', () => {
  const f = fixture([[0, 0, 1, 1], [1, 0, 2, 1], [3, 0, 4, 1]], [[0, 1, 100], [0, 2, 5], [1, 2, 5]]);
  const first = run(f).windows[0];
  assert.equal(first.r_um, 0);
  assert.equal(first.previous_event, null);
  assert.equal(first.omission_ratio, 10 / 210);
  f.label.capacitance.maxwell_matrix[0][0] *= 1000;
  assert.deepEqual(run(f).windows[0], first);
});

test('simultaneous entry events include every entering conductor', () => {
  const f = fixture([[0, 0, 1, 1], [2, 0, 3, 1], [-1, 0, 0, 1]], [[0, 1, 50], [0, 2, 50]]);
  const w = run(f).windows[0];
  assert.equal(w.r_um, 1); assert.equal(w.included_conductor_count, 3);
  assert.deepEqual(w.curve.r_um, [0, 1]);
  assert.equal(w.omission_ratio, 0);
});

test('undefined cores have null radii and are excluded from means', () => {
  const noTarget = fixture([[-1, 0, 3, 1]], []);
  assert.equal(run(noTarget).windows[0].status, 'undefined_no_complete_targets');
  const noCoupling = run(fixture([[0, 0, 1, 1]], []));
  assert.equal(noCoupling.windows[0].status, 'undefined_zero_coupling');
  assert.equal(noCoupling.windows[0].r_um, null);
  assert.equal(noCoupling.summary.mean_radius_um, null);
  assert.equal(noCoupling.summary.defined_count, 0);
});

test('invalid labels are rejected without mutating geometry', () => {
  const mutations = [
    (f) => { f.label = undefined; },
    (f) => { f.label.quality_summary.passed = false; },
    (f) => { f.label.capacitance.unit = 'unknown'; },
    (f) => { f.label.matrix_order[0].index = 1; },
    (f) => { f.label.matrix_order[0].block_id = 'wrong'; },
    (f) => { f.label.matrix_order[0].layer_ref = 'M2'; },
    (f) => { f.label.capacitance.maxwell_matrix[0][1] = 1; },
    (f) => { f.label.capacitance.maxwell_matrix[0][1] -= 10; },
    (f) => { f.label.capacitance.maxwell_matrix[0][0] = 0; },
    (f) => { f.label.capacitance.maxwell_matrix[0].pop(); },
  ];
  for (const mutate of mutations) {
    const f = example(); mutate(f); const layout = structuredClone(f.layout);
    assert.throws(() => run(f)); assert.deepEqual(f.layout, layout);
  }
});
