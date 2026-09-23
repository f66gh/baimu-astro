// Uniform dielectric, square grid, and a grounded outer boundary.
// All three solves retain exactly the same conductor geometry.
export const width = 101;
export const height = 65;
export const conductors = [
  { name: 'A₁', x0: 14, x1: 48, y0: 29, y1: 35 },
  { name: 'A₂', x0: 52, x1: 86, y0: 29, y1: 35 },
  { name: 'B', x0: 16, x1: 58, y0: 11, y1: 16 },
  { name: 'C', x0: 44, x1: 84, y0: 49, y1: 54 },
];

const owner = new Uint8Array(width * height);
conductors.forEach((shape, index) => {
  for (let y = shape.y0; y <= shape.y1; y++) {
    for (let x = shape.x0; x <= shape.x1; x++) owner[y * width + x] = index + 1;
  }
});

export function solve(v1, v2) {
  const field = new Float64Array(width * height);
  const voltages = [0, v1, v2, 0, 0];
  for (let i = 0; i < field.length; i++) field[i] = voltages[owner[i]];

  // SOR relaxation solves the five-point discrete Laplace equation.
  // This is an educational 2D solve, not a 3D process-capacitance model.
  for (let iteration = 0; iteration < 12000; iteration++) {
    let largestUpdate = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (owner[i]) continue;
        const average = (field[i - 1] + field[i + 1] + field[i - width] + field[i + width]) / 4;
        const change = 1.85 * (average - field[i]);
        field[i] += change;
        largestUpdate = Math.max(largestUpdate, Math.abs(change));
      }
    }
    if (largestUpdate < 1e-11) return field;
  }
  throw new Error('电势求解未收敛，请刷新重试。');
}

export function inducedCharge(field, conductorIndex) {
  // Sum outward electric flux across grid edges on the conductor boundary.
  // The common permittivity / depth factor cancels in the displayed ratios.
  const id = conductorIndex + 1;
  let charge = 0;
  for (let i = 0; i < field.length; i++) {
    if (owner[i] !== id) continue;
    for (const neighbor of [i - 1, i + 1, i - width, i + width]) {
      if (owner[neighbor] !== id) charge += field[i] - field[neighbor];
    }
  }
  return charge;
}

export function createModel() {
  const first = solve(1, 0);
  const second = solve(0, 1);
  // Independently solve both-at-1V; do not manufacture the reference by addition.
  const together = solve(1, 1);
  const sum = first.map((value, i) => value + second[i]);
  let maxDifference = 0;
  for (let i = 0; i < sum.length; i++) {
    maxDifference = Math.max(maxDifference, Math.abs(sum[i] - together[i]));
  }
  const fields = { first, second, sum, together };
  const charges = {};
  for (const [key, field] of Object.entries(fields)) {
    charges[key] = [2, 3].map((index) =>
      inducedCharge(field, index) / Math.abs(inducedCharge(together, index)));
  }
  return { fields, charges, maxDifference };
}
