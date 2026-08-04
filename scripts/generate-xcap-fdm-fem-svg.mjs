import { writeFile } from "node:fs/promises";

const outputPath = new URL(
	"../public/interactives/xcap-field-solvers/fdm-fem.svg",
	import.meta.url,
);

const domain = { x: 36, y: 36, width: 1128, height: 828 };
const oneVolt = { x: 142, y: 554, width: 398, height: 132 };
const zeroVolt = { x: 722, y: 226, width: 338, height: 132 };

const nx = 121;
const ny = 91;
const potential = new Float64Array(nx * ny);
const fixed = new Int8Array(nx * ny);

const index = (x, y) => y * nx + x;
const domainX = (x) => domain.x + (x / (nx - 1)) * domain.width;
const domainY = (y) => domain.y + (y / (ny - 1)) * domain.height;

function distanceToRect(x, y, rect) {
	const dx = Math.max(rect.x - x, 0, x - (rect.x + rect.width));
	const dy = Math.max(rect.y - y, 0, y - (rect.y + rect.height));
	return Math.hypot(dx, dy);
}

function isInside(x, y, rect) {
	return (
		x >= rect.x &&
		x <= rect.x + rect.width &&
		y >= rect.y &&
		y <= rect.y + rect.height
	);
}

for (let y = 0; y < ny; y += 1) {
	for (let x = 0; x < nx; x += 1) {
		const px = domainX(x);
		const py = domainY(y);
		const cell = index(x, y);

		if (isInside(px, py, oneVolt)) {
			potential[cell] = 1;
			fixed[cell] = 1;
			continue;
		}

		if (isInside(px, py, zeroVolt)) {
			potential[cell] = 0;
			fixed[cell] = 1;
			continue;
		}

		const d1 = distanceToRect(px, py, oneVolt);
		const d0 = distanceToRect(px, py, zeroVolt);
		potential[cell] = d0 / Math.max(d0 + d1, Number.EPSILON);
	}
}

const omega = 1.82;
for (let iteration = 0; iteration < 8000; iteration += 1) {
	for (let x = 1; x < nx - 1; x += 1) {
		potential[index(x, 0)] = potential[index(x, 1)];
		potential[index(x, ny - 1)] = potential[index(x, ny - 2)];
	}
	for (let y = 1; y < ny - 1; y += 1) {
		potential[index(0, y)] = potential[index(1, y)];
		potential[index(nx - 1, y)] = potential[index(nx - 2, y)];
	}

	let maxChange = 0;
	for (let y = 1; y < ny - 1; y += 1) {
		for (let x = 1; x < nx - 1; x += 1) {
			const cell = index(x, y);
			if (fixed[cell]) continue;

			const average =
				(potential[index(x - 1, y)] +
					potential[index(x + 1, y)] +
					potential[index(x, y - 1)] +
					potential[index(x, y + 1)]) /
				4;
			const next = potential[cell] + omega * (average - potential[cell]);
			maxChange = Math.max(maxChange, Math.abs(next - potential[cell]));
			potential[cell] = next;
		}
	}

	if (maxChange < 1e-8) break;
}

function samplePotential(px, py) {
	const gx = ((px - domain.x) / domain.width) * (nx - 1);
	const gy = ((py - domain.y) / domain.height) * (ny - 1);
	const x0 = Math.max(0, Math.min(nx - 2, Math.floor(gx)));
	const y0 = Math.max(0, Math.min(ny - 2, Math.floor(gy)));
	const tx = gx - x0;
	const ty = gy - y0;

	const top =
		potential[index(x0, y0)] * (1 - tx) +
		potential[index(x0 + 1, y0)] * tx;
	const bottom =
		potential[index(x0, y0 + 1)] * (1 - tx) +
		potential[index(x0 + 1, y0 + 1)] * tx;
	return top * (1 - ty) + bottom * ty;
}

const paleOrange = [255, 248, 242];
const strongOrange = [238, 151, 99];

function potentialColor(value) {
	const eased = Math.max(0, Math.min(1, value)) ** 0.86;
	const channels = paleOrange.map((start, channel) =>
		Math.round(start + (strongOrange[channel] - start) * eased),
	);
	return `rgb(${channels.join(" ")})`;
}

const displayColumns = 24;
const displayRows = 18;
const cellWidth = domain.width / displayColumns;
const cellHeight = domain.height / displayRows;
const cells = [];

for (let row = 0; row < displayRows; row += 1) {
	for (let column = 0; column < displayColumns; column += 1) {
		const x = domain.x + column * cellWidth;
		const y = domain.y + row * cellHeight;
		const value = samplePotential(x + cellWidth / 2, y + cellHeight / 2);
		cells.push(
			`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellWidth.toFixed(2)}" height="${cellHeight.toFixed(2)}" fill="${potentialColor(value)}"/>`,
		);
	}
}

function interpolateEdge(level, a, b) {
	const denominator = b.value - a.value;
	const t = Math.abs(denominator) < 1e-12 ? 0.5 : (level - a.value) / denominator;
	return {
		x: a.x + (b.x - a.x) * t,
		y: a.y + (b.y - a.y) * t,
	};
}

function contourPath(level) {
	const commands = [];
	for (let y = 0; y < ny - 1; y += 1) {
		for (let x = 0; x < nx - 1; x += 1) {
			const topLeft = {
				x: domainX(x),
				y: domainY(y),
				value: potential[index(x, y)],
			};
			const topRight = {
				x: domainX(x + 1),
				y: domainY(y),
				value: potential[index(x + 1, y)],
			};
			const bottomRight = {
				x: domainX(x + 1),
				y: domainY(y + 1),
				value: potential[index(x + 1, y + 1)],
			};
			const bottomLeft = {
				x: domainX(x),
				y: domainY(y + 1),
				value: potential[index(x, y + 1)],
			};

			const state =
				(topLeft.value >= level ? 8 : 0) |
				(topRight.value >= level ? 4 : 0) |
				(bottomRight.value >= level ? 2 : 0) |
				(bottomLeft.value >= level ? 1 : 0);
			if (state === 0 || state === 15) continue;

			const edges = {
				top: interpolateEdge(level, topLeft, topRight),
				right: interpolateEdge(level, topRight, bottomRight),
				bottom: interpolateEdge(level, bottomLeft, bottomRight),
				left: interpolateEdge(level, topLeft, bottomLeft),
			};

			const lookup = {
				1: [["left", "bottom"]],
				2: [["bottom", "right"]],
				3: [["left", "right"]],
				4: [["top", "right"]],
				5: [["top", "left"], ["bottom", "right"]],
				6: [["top", "bottom"]],
				7: [["top", "left"]],
				8: [["top", "left"]],
				9: [["top", "bottom"]],
				10: [["top", "right"], ["left", "bottom"]],
				11: [["top", "right"]],
				12: [["left", "right"]],
				13: [["bottom", "right"]],
				14: [["left", "bottom"]],
			};

			for (const [startEdge, endEdge] of lookup[state]) {
				const start = edges[startEdge];
				const end = edges[endEdge];
				commands.push(
					`M${start.x.toFixed(2)} ${start.y.toFixed(2)}L${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
				);
			}
		}
	}
	return commands.join("");
}

const contourLevels = [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95];
const contours = contourLevels
	.map(
		(level) =>
			`<path d="${contourPath(level)}" fill="none" stroke="#625E59" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`,
	)
	.join("\n\t\t");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900" role="img" aria-label="Discretized potential field around two conductors">
	<defs>
		<clipPath id="domain">
			<rect x="36" y="36" width="1128" height="828" rx="28"/>
		</clipPath>
		<pattern id="grid" width="${cellWidth}" height="${cellHeight}" patternUnits="userSpaceOnUse" patternTransform="translate(36 36)">
			<path d="M${cellWidth} 0H0V${cellHeight}" fill="none" stroke="#948C85" stroke-opacity="0.42" stroke-width="0.85"/>
		</pattern>
	</defs>

	<rect width="1200" height="900" fill="#F5F6F3"/>
	<g clip-path="url(#domain)">
		${cells.join("\n\t\t")}
		<rect x="36" y="36" width="1128" height="828" fill="url(#grid)"/>
		${contours}
	</g>

	<rect x="36" y="36" width="1128" height="828" rx="28" fill="none" stroke="#C9D1CF" stroke-width="3"/>
	<rect x="${oneVolt.x}" y="${oneVolt.y}" width="${oneVolt.width}" height="${oneVolt.height}" rx="14" fill="#ED8D5A" stroke="#C97047" stroke-width="3"/>
	<rect x="${zeroVolt.x}" y="${zeroVolt.y}" width="${zeroVolt.width}" height="${zeroVolt.height}" rx="14" fill="#9CA3A6" stroke="#747E82" stroke-width="3"/>
</svg>
`;

await writeFile(outputPath, svg, "utf8");
