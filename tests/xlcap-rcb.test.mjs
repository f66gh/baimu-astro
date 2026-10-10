import test from 'node:test';
import assert from 'node:assert/strict';
import { partitionLayout } from '../public/interactives/xlcap-topview-prototype/rcb.js';
import { partitionWithTrace, replayTrace } from '../public/interactives/xlcap-topview-prototype/rcb-trace.js';

function layout(boxes) {
  return { layout_id: 'test', conductors: boxes.map((box, i) => ({ conductor_id: `c${i}`, net_name: `net${i}`,
    blocks: [{ block_id: `b${i}`, layer_ref: `M${i % 3 + 1}`, geometry: {
      x_min: box[0], y_min: box[1], x_max: box[2], y_max: box[3], z_bottom: i % 3, z_top: i % 3 + 0.1,
    } }],
  })) };
}
const area = (b) => (b.x_max - b.x_min) * (b.y_max - b.y_min);
const close = (a, b) => assert.ok(Math.abs(a - b) <= Math.max(1, Math.abs(b)) * 1e-10, `${a} != ${b}`);

test('crossing conductors retain identity, geometry and area in a nonoverlapping tiling', () => {
  const source = layout([[0, 0, 10, .5], [0, 2, 10, 2.5], [4, -1, 4.5, 4], [7, -1, 7.5, 4]]);
  const before = structuredClone(source), config = { max_conductors: 2, min_conductors: 1 };
  const result = partitionLayout(source, config);
  assert.deepEqual(source, before);
  assert.deepEqual(result, partitionLayout(source, config));
  assert.ok(result.metrics.extra_fragments > 0);
  assert.ok(result.metrics.max_core_count <= 2);
  close(result.windows.reduce((sum, w) => sum + area(w.bounds), 0), area(result.root_bounds));
  for (const [i, w] of result.windows.entries()) {
    for (const other of result.windows.slice(i + 1)) {
      const a = w.bounds, b = other.bounds;
      assert.ok(Math.min(a.x_max, b.x_max) <= Math.max(a.x_min, b.x_min)
        || Math.min(a.y_max, b.y_max) <= Math.max(a.y_min, b.y_min));
    }
  }
  for (const c of source.conductors) {
    const block = c.blocks[0], g = block.geometry;
    let covered = 0;
    for (const w of result.windows) {
      const matching = w.fragments.filter((f) => f.source_conductor_id === c.conductor_id);
      const b = w.bounds;
      const intersects = g.x_min < b.x_max && g.x_max > b.x_min && g.y_min < b.y_max && g.y_max > b.y_min;
      assert.equal(matching.length, intersects ? 1 : 0);
      if (!intersects) continue;
      const f = matching[0];
      assert.equal(f.source_block_id, block.block_id); assert.equal(f.net_name, c.net_name); assert.equal(f.layer_ref, block.layer_ref);
      assert.deepEqual(f.geometry, { x_min: Math.max(g.x_min, b.x_min), y_min: Math.max(g.y_min, b.y_min),
        x_max: Math.min(g.x_max, b.x_max), y_max: Math.min(g.y_max, b.y_max), z_bottom: g.z_bottom, z_top: g.z_top });
      covered += area(f.geometry);
    }
    close(covered, area(g));
  }
});

test('touching a cut does not create a fragment in the neighboring window', () => {
  const r = partitionLayout(layout([[0, 0, 1, 1], [1, 0, 2, 1]]), { max_conductors: 1, min_conductors: 1 });
  assert.equal(r.metrics.window_count, 2); assert.equal(r.metrics.fragment_count, 2);
  assert.deepEqual(r.windows.map((w) => w.bounds), [
    { x_min: 0, y_min: 0, x_max: 1, y_max: 1 }, { x_min: 1, y_min: 0, x_max: 2, y_max: 1 },
  ]);
});

test('the exact capacity limit stops, using conductor bounds rather than the solver window', () => {
  const source = layout(Array.from({ length: 24 }, (_, i) => [i, 0, i + .3, 2]));
  source.window = { x_min: -100, y_min: -100, x_max: 100, y_max: 100 };
  const r = partitionLayout(source);
  assert.equal(r.metrics.window_count, 1); assert.equal(r.windows[0].terminal_reason, 'within_limit');
  assert.deepEqual(r.root_bounds, { x_min: 0, y_min: 0, x_max: 23.3, y_max: 2 });
});

test('inseparable conductors and depth-limited cores report capacity exceptions', () => {
  const r = partitionLayout(layout(Array(4).fill([0, 0, 2, 2])), { max_conductors: 2, min_conductors: 1 });
  assert.equal(r.metrics.over_limit_windows, 1); assert.equal(r.windows[0].terminal_reason, 'no_count_reduction');
  const depth = partitionLayout(layout(Array.from({ length: 16 }, (_, i) => [i, 0, i + .2, 2])),
    { max_conductors: 1, min_conductors: 1, max_depth: 1 });
  assert.equal(depth.windows.length, 2);
  assert.ok(depth.windows.every((w) => w.terminal_reason === 'max_depth'));
  assert.equal(depth.metrics.over_limit_windows, 2);
});

test('reject invalid parameters, duplicate IDs and unsupported multiblock conductors', () => {
  const source = layout([[0, 0, 1, 1]]);
  for (const config of [{ max_conductors: 0 }, { min_conductors: 30 }, { max_depth: true }, { max_aspect_ratio: Infinity }]) {
    assert.throws(() => partitionLayout(source, config));
  }
  assert.throws(() => partitionLayout(layout([])));
  const duplicate = layout([[0, 0, 1, 1], [2, 0, 3, 1]]);
  duplicate.conductors[1].blocks[0].block_id = 'b0';
  assert.throws(() => partitionLayout(duplicate), /编号/);
  source.conductors[0].blocks.push(structuredClone(source.conductors[0].blocks[0]));
  assert.throws(() => partitionLayout(source), /一个长方体块/);
});

test('trace records actual depth-first decisions, including terminal visits', () => {
  const source = layout([[0, 0, 1, 1], [2, 0, 3, 1], [4, 0, 5, 1], [6, 0, 7, 1]]);
  const config = { max_conductors: 1, min_conductors: 1, max_aspect_ratio: 100 };
  const { result, trace } = partitionWithTrace(source, config);
  assert.deepEqual(result, partitionLayout(source, config));
  assert.deepEqual(trace.events.map((e) => `${e.type}:${e.window.window_id}`),
    ['split:w', 'split:w0', 'stop:w00', 'stop:w01', 'split:w1', 'stop:w10', 'stop:w11']);
  const first = replayTrace(trace, 1);
  assert.equal(first.windows.length, 2); assert.equal(first.pending_count, 2); assert.equal(first.completed_count, 0);
  const leaf = replayTrace(trace, 3);
  assert.equal(leaf.completed_count, 1); assert.equal(leaf.pending_count, 2);
  const end = replayTrace(trace, trace.events.length);
  assert.deepEqual(end.windows, result.windows.map(({ fragments, ...w }) => w));
  assert.equal(end.pending_count, 0);
  const before = structuredClone(trace);
  assert.deepEqual(replayTrace(trace, 1), first);
  assert.deepEqual(replayTrace(trace, 0).windows, [trace.root]);
  assert.deepEqual(trace, before, 'seeking must not mutate the trace');
});

test('every intermediate frame tiles the root and counts actual crossing conductors', () => {
  const source = layout([[0, 0, 10, .5], [0, 2, 10, 2.5], [4, -1, 4.5, 4], [7, -1, 7.5, 4]]);
  const { result, trace } = partitionWithTrace(source, { max_conductors: 2, min_conductors: 1 });
  for (let step = 0; step <= trace.events.length; step++) {
    const frame = replayTrace(trace, step);
    close(frame.windows.reduce((sum, w) => sum + area(w.bounds), 0), area(result.root_bounds));
    for (const [i, w] of frame.windows.entries()) {
      const b = w.bounds;
      const count = source.conductors.filter((c) => {
        const g = c.blocks[0].geometry;
        return g.x_min < b.x_max && g.x_max > b.x_min && g.y_min < b.y_max && g.y_max > b.y_min;
      }).length;
      assert.equal(w.conductor_count, count);
      for (const other of frame.windows.slice(i + 1)) {
        const c = other.bounds;
        assert.ok(Math.min(b.x_max, c.x_max) <= Math.max(b.x_min, c.x_min)
          || Math.min(b.y_max, c.y_max) <= Math.max(b.y_min, c.y_min));
      }
    }
    const event = frame.event;
    if (event?.type === 'split') {
      assert.equal(event.extra_fragments, event.children.reduce((sum, w) => sum + w.conductor_count, 0) - event.window.conductor_count);
      const [left, right] = event.children;
      assert.equal(left.bounds[`${event.axis}_max`], event.cut);
      assert.equal(right.bounds[`${event.axis}_min`], event.cut);
    }
  }
  assert.equal(trace.events.filter((e) => e.type === 'split').reduce((sum, e) => sum + e.extra_fragments, 0), result.metrics.extra_fragments);
});

test('no-cut and over-capacity traces still explain their stopping reason', () => {
  const small = partitionWithTrace(layout([[0, 0, 1, 1]]));
  assert.equal(small.trace.events.length, 1);
  assert.equal(small.trace.events[0].window.terminal_reason, 'within_limit');
  const inseparable = partitionWithTrace(layout(Array(4).fill([0, 0, 2, 2])), { max_conductors: 2, min_conductors: 1 });
  assert.equal(inseparable.trace.events.length, 1);
  assert.equal(inseparable.trace.events[0].window.terminal_reason, 'no_count_reduction');
  assert.equal(replayTrace(inseparable.trace, 0).windows[0].terminal_reason, null);
  assert.equal(replayTrace(inseparable.trace, 1).pending_count, 0);
  const depth = partitionWithTrace(layout(Array.from({ length: 16 }, (_, i) => [i, 0, i + .2, 2])),
    { max_conductors: 1, min_conductors: 1, max_depth: 1 });
  assert.equal(depth.trace.events.filter((e) => e.type === 'stop' && e.window.terminal_reason === 'max_depth').length, 2);
  assert.throws(() => replayTrace(small.trace, -1), RangeError);
  assert.throws(() => replayTrace(small.trace, 2), RangeError);
});
