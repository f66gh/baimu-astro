import { partitionLayout } from './rcb.js';

// Store one compact event per visited node, rather than copying every frame's
// geometry. Event order is the algorithm's depth-first, child-0-before-child-1 order.
export function partitionWithTrace(layout, config = {}) {
  const trace = { root: null, events: [] };
  const result = partitionLayout(layout, config, (event) => {
    if (event.type === 'start') trace.root = event.window;
    else trace.events.push(event);
  });
  return { result, trace };
}

export function replayTrace(trace, step) {
  if (!Number.isSafeInteger(step) || step < 0 || step > trace.events.length) throw new RangeError('无效的切分步骤。');
  const active = new Map([[trace.root.window_id, trace.root]]);
  let splits = 0;
  for (let i = 0; i < step; i++) {
    const event = trace.events[i];
    if (event.type === 'split') {
      active.delete(event.window.window_id);
      for (const child of event.children) active.set(child.window_id, child);
      splits++;
    } else active.set(event.window.window_id, event.window);
  }
  const windows = [...active.values()].sort((a, b) => a.window_id < b.window_id ? -1 : a.window_id > b.window_id ? 1 : 0);
  const completed = windows.filter((w) => w.terminal_reason !== null).length;
  return { windows, event: step ? trace.events[step - 1] : null,
    pending_count: windows.length - completed, completed_count: completed, split_count: splits };
}
