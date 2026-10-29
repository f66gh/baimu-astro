// Architecture and exact spatial dependency tracing for the illustrative encoder-decoder.
export function architecture(size, levels) {
  const ops = [];
  let n = size;
  for (let i = 0; i < levels; i++) {
    ops.push({ type: 'conv', input: n, output: n });
    ops.push({ type: 'down', input: n, output: n / 2 });
    n /= 2;
  }
  ops.push({ type: 'conv', input: n, output: n });
  for (let i = 0; i < levels; i++) {
    ops.push({ type: 'up', input: n, output: n * 2 }); n *= 2;
    ops.push({ type: 'conv', input: n, output: n });
  }
  return ops;
}

export function dependencies(size, levels, x, y) {
  const ops = architecture(size, levels);
  let positions = new Set([y * size + x]);
  for (const op of [...ops].reverse()) {
    const previous = new Set();
    const add = (px, py) => { if (px >= 0 && py >= 0 && px < op.input && py < op.input) previous.add(py * op.input + px); };
    for (const at of positions) {
      const ox = at % op.output, oy = Math.floor(at / op.output);
      if (op.type === 'conv') {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) add(ox + dx, oy + dy);
      } else if (op.type === 'down') {
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) add(2 * ox + dx, 2 * oy + dy);
      } else add(Math.floor(ox / 2), Math.floor(oy / 2));
    }
    positions = previous;
  }
  return positions;
}

export function costTerms(size, channels, levels, cutoff) {
  const ops = architecture(size, levels), n = size * size, modes = (2 * cutoff + 1) ** 2;
  return {
    cnnConvs: ops.filter(o => o.type === 'conv').length,
    cnnConv: ops.filter(o => o.type === 'conv').reduce((sum, o) => sum + o.output ** 2 * 9 * channels ** 2, 0),
    cnnResample: ops.filter(o => o.type !== 'conv').reduce((sum, o) => sum + Math.max(o.input, o.output) ** 2 * channels, 0),
    // One C*n*log2(n) scale term; FFT and IFFT together differ by a constant factor.
    fnoFFT: channels * n * Math.log2(n), fnoMix: modes * channels ** 2, fnoLocal: n * channels ** 2, modes,
  };
}
