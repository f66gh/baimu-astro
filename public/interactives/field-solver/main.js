const canvas = document.getElementById("field-canvas");
const ctx = canvas.getContext("2d");
const caption = document.getElementById("canvas-caption");
const panelTitle = document.getElementById("panel-title");
const panelSummary = document.getElementById("panel-summary");
const definitionList = document.getElementById("definition-list");
const controlsPanel = document.getElementById("controls-panel");
const tabs = Array.from(document.querySelectorAll(".mode-tab"));
const compareRows = Array.from(document.querySelectorAll("[data-compare]"));

const state = {
	mode: "general",
	voltage: 1,
	epsilon: 3.9,
	fdmSize: 24,
	fdmGrid: [],
	fdmFixed: [],
	fdmCursor: 0,
	fdmIterations: 0,
	fdmAuto: false,
	femRefine: 3,
	femShowLocal: true,
	femHover: -1,
	bemPanels: 18,
	bemShowInfluence: true,
	bemSelected: 2,
	raf: 0,
	lastAutoStep: 0,
};

const copy = {
	general: {
		title: "通用场求解器",
		summary: "把导体几何、介质参数和边界电压转成电场问题。先求空间电势 phi，再由 E = -grad(phi) 得到电场，最后积分导体表面的法向通量得到电荷 Q。",
		caption: "主线：几何 + epsilon + 边界电压 -> phi -> E -> Q -> C。这里的数值是概念估计。",
		defs: [
			["场求解器", "把几何结构和材料参数转成电磁场方程并数值求解的软件。"],
			["电势 phi", "空间里每个点的电压高度；等值线越密，电场越强。"],
			["法向通量", "电场穿过导体表面的强弱，积分后就是导体表面电荷。"],
		],
	},
	fdm: {
		title: "FDM 有限差分",
		summary: "Finite Difference Method，把空间切成规则格点。Laplace 方程在格点上变成“中心点约等于四邻居平均值”，不断迭代后电势会收敛。",
		caption: "FDM 好理解，但复杂曲线边界会被规则网格切成台阶状。",
		defs: [
			["规则体网格", "整个求解区域都铺满方格，导体和介质都落在格点上。"],
			["relaxation", "反复用邻居平均值更新内部格点，让电势逐渐满足 Laplace 方程。"],
			["边界条件", "导体格点固定为给定电压，不参与更新。"],
		],
	},
	fem: {
		title: "FEM 有限元",
		summary: "Finite Element Method，把空间切成不规则三角形或四面体。在每个单元里用简单函数近似电势，再把局部方程组装成全局线性方程。",
		caption: "FEM 的强项是复杂几何和多材料区域，代价是网格生成与方程组装更复杂。",
		defs: [
			["单元 element", "一个小三角形或四面体，局部近似在这里定义。"],
			["节点 node", "单元顶点上的未知电势值。"],
			["形状函数", "单元内用来从节点电势插值得到连续电势的简单函数。"],
		],
	},
	bem: {
		title: "BEM 边界元",
		summary: "Boundary Element Method，只离散导体表面和介质边界，把未知量放在 panel 上。它不用填满开放空间，所以很适合 3D 电容抽取的导体表面问题。",
		caption: "BEM 的直觉：每个表面小片上的电荷都会影响其他小片，最终形成 A sigma = V。",
		defs: [
			["panel", "导体表面或边界被切成的小面片。"],
			["sigma", "表面电荷密度，是 BEM 中常见的未知量。"],
			["稠密矩阵", "每个 panel 可能影响很多 panel，所以矩阵非零项多。"],
		],
	},
};

function init() {
	setupTabs();
	resetFdm();
	renderControls();
	resizeCanvas();
	window.addEventListener("resize", resizeCanvas);
	canvas.addEventListener("mousemove", handleCanvasMove);
	canvas.addEventListener("mouseleave", () => {
		state.femHover = -1;
	});
	canvas.addEventListener("click", handleCanvasClick);
	requestAnimationFrame(loop);
}

function setupTabs() {
	tabs.forEach((tab) => {
		tab.addEventListener("click", () => {
			state.mode = tab.dataset.mode;
			state.fdmAuto = false;
			tabs.forEach((item) => item.classList.toggle("active", item === tab));
			renderControls();
			updatePanel();
			draw();
		});
	});
}

function resizeCanvas() {
	const rect = canvas.getBoundingClientRect();
	const dpr = Math.max(1, window.devicePixelRatio || 1);
	canvas.width = Math.floor(rect.width * dpr);
	canvas.height = Math.floor(rect.height * dpr);
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	draw();
}

function updatePanel() {
	const current = copy[state.mode];
	panelTitle.textContent = current.title;
	panelSummary.textContent = current.summary;
	caption.textContent = current.caption;
	definitionList.innerHTML = current.defs
		.map(([term, desc]) => `<div class="definition-item"><strong>${term}</strong><span>${desc}</span></div>`)
		.join("");
	compareRows.forEach((row) => row.classList.toggle("highlight", row.dataset.compare === state.mode));
}

function renderControls() {
	updatePanel();
	if (state.mode === "general") {
		controlsPanel.innerHTML = `
			<div class="control-row">
				<label for="voltage">左导体电压 <output>${state.voltage.toFixed(2)} V</output></label>
				<input id="voltage" type="range" min="0.5" max="2" step="0.05" value="${state.voltage}">
			</div>
			<div class="control-row">
				<label for="epsilon">相对介电常数 epsilon_r <output>${state.epsilon.toFixed(1)}</output></label>
				<input id="epsilon" type="range" min="1" max="8" step="0.1" value="${state.epsilon}">
			</div>
			<div class="metric-box" id="general-metrics"></div>
		`;
		bindRange("voltage", (value) => state.voltage = value, (value) => `${value.toFixed(2)} V`, updateGeneralMetrics);
		bindRange("epsilon", (value) => state.epsilon = value, (value) => value.toFixed(1), updateGeneralMetrics);
		updateGeneralMetrics();
	}

	if (state.mode === "fdm") {
		controlsPanel.innerHTML = `
			<div class="button-grid">
				<button class="action-btn" type="button" id="fdm-step">单步迭代</button>
				<button class="action-btn ${state.fdmAuto ? "active" : ""}" type="button" id="fdm-auto">${state.fdmAuto ? "暂停" : "自动迭代"}</button>
				<button class="action-btn" type="button" id="fdm-reset">重置</button>
			</div>
			<div class="control-row">
				<label for="fdm-size">网格密度 <output>${state.fdmSize} x ${state.fdmSize}</output></label>
				<input id="fdm-size" type="range" min="16" max="32" step="8" value="${state.fdmSize}">
			</div>
			<div class="metric-box">
				<strong>更新公式</strong><br>
				phi(i,j) = [phi(i+1,j) + phi(i-1,j) + phi(i,j+1) + phi(i,j-1)] / 4<br>
				当前迭代：<span id="fdm-iter">${state.fdmIterations}</span>
			</div>
		`;
		document.getElementById("fdm-step").addEventListener("click", () => {
			stepFdmBatch(1);
			draw();
			renderControls();
		});
		document.getElementById("fdm-auto").addEventListener("click", () => {
			state.fdmAuto = !state.fdmAuto;
			renderControls();
		});
		document.getElementById("fdm-reset").addEventListener("click", () => {
			resetFdm();
			draw();
			renderControls();
		});
		bindRange("fdm-size", (value) => {
			state.fdmSize = value;
			resetFdm();
		}, (value) => `${value} x ${value}`);
	}

	if (state.mode === "fem") {
		controlsPanel.innerHTML = `
			<div class="switch-row">
				<span>显示局部单元</span>
				<input id="fem-local" type="checkbox" ${state.femShowLocal ? "checked" : ""}>
			</div>
			<div class="control-row">
				<label for="fem-refine">边界加密程度 <output>${state.femRefine}</output></label>
				<input id="fem-refine" type="range" min="1" max="5" step="1" value="${state.femRefine}">
			</div>
			<div class="metric-box">
				<strong>流程</strong><br>
				局部单元矩阵 -> 按共享节点组装 -> 全局稀疏线性方程 -> 节点电势
			</div>
		`;
		document.getElementById("fem-local").addEventListener("change", (event) => {
			state.femShowLocal = event.target.checked;
			draw();
		});
		bindRange("fem-refine", (value) => state.femRefine = value, (value) => `${value}`);
	}

	if (state.mode === "bem") {
		controlsPanel.innerHTML = `
			<div class="switch-row">
				<span>显示影响线</span>
				<input id="bem-lines" type="checkbox" ${state.bemShowInfluence ? "checked" : ""}>
			</div>
			<div class="control-row">
				<label for="bem-panels">panel 数量 <output>${state.bemPanels}</output></label>
				<input id="bem-panels" type="range" min="8" max="36" step="2" value="${state.bemPanels}">
			</div>
			<div class="metric-box">
				<strong>边界方程</strong><br>
				A sigma = V<br>
				sigma 是每个 panel 上的表面电荷密度。
			</div>
		`;
		document.getElementById("bem-lines").addEventListener("change", (event) => {
			state.bemShowInfluence = event.target.checked;
			draw();
		});
		bindRange("bem-panels", (value) => {
			state.bemPanels = value;
			state.bemSelected = Math.min(state.bemSelected, value - 1);
		}, (value) => `${value}`);
	}
}

function bindRange(id, setter, format = (value) => `${value}`, afterChange = null) {
	const input = document.getElementById(id);
	const output = input.closest(".control-row")?.querySelector("output");
	input.addEventListener("input", () => {
		const value = Number(input.value);
		setter(value);
		if (output) output.textContent = format(value);
		if (afterChange) afterChange();
		draw();
	});
}

function loop(time) {
	if (state.fdmAuto && state.mode === "fdm" && time - state.lastAutoStep > 70) {
		stepFdmBatch(20);
		state.lastAutoStep = time;
		const iter = document.getElementById("fdm-iter");
		if (iter) iter.textContent = state.fdmIterations;
	}
	draw();
	state.raf = requestAnimationFrame(loop);
}

function draw() {
	clearCanvas();
	if (state.mode === "general") drawGeneral();
	if (state.mode === "fdm") drawFdm();
	if (state.mode === "fem") drawFem();
	if (state.mode === "bem") drawBem();
}

function clearCanvas() {
	const { width, height } = canvas.getBoundingClientRect();
	ctx.clearRect(0, 0, width, height);
	ctx.fillStyle = css("--panel");
	ctx.fillRect(0, 0, width, height);
}

function css(name) {
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function updateGeneralMetrics() {
	const box = document.getElementById("general-metrics");
	if (!box) return;
	const q = state.epsilon * state.voltage * 0.42;
	const c = q / state.voltage;
	box.innerHTML = `
		<strong>概念估计</strong><br>
		Q ~ epsilon_r * V * scale = ${q.toFixed(2)} arb<br>
		C ~ Q / V = ${c.toFixed(2)} arb/V<br>
		这不是精确求解，只用来显示比例关系。
	`;
}

function drawGeneral() {
	const rect = canvas.getBoundingClientRect();
	const w = rect.width;
	const h = rect.height;
	const plot = getPlotBox(w, h);
	drawPotentialBackground(plot, state.voltage, state.epsilon);
	drawEquipotentials(plot);
	drawSubstrate(plot);
	const left = { x: plot.x + plot.w * 0.22, y: plot.y + plot.h * 0.35, w: 44, h: plot.h * 0.36 };
	const right = { x: plot.x + plot.w * 0.72, y: plot.y + plot.h * 0.35, w: 44, h: plot.h * 0.36 };
	drawConductor(left, `${state.voltage.toFixed(2)} V`, css("--hot"));
	drawConductor(right, "0 V", css("--cold"));
	drawFieldArrows(plot, 7);
	drawFluxArrows(left, "right");
	drawFluxArrows(right, "left");
	drawFlowChips([
		"几何 + epsilon + U",
		"解 div(epsilon grad phi)=0",
		"E = -grad(phi)",
		"积分通量得 Q",
		"Q = C U",
	], plot.x + 16, plot.y + 18);
	updateGeneralMetrics();
}

function getPlotBox(w, h) {
	const pad = Math.max(20, Math.min(w, h) * 0.06);
	return { x: pad, y: pad, w: w - pad * 2, h: h - pad * 2 - 42 };
}

function drawPotentialBackground(plot, voltage, epsilon) {
	const image = ctx.createImageData(Math.max(1, Math.floor(plot.w)), Math.max(1, Math.floor(plot.h)));
	for (let y = 0; y < image.height; y++) {
		for (let x = 0; x < image.width; x++) {
			const nx = x / image.width;
			const ny = y / image.height;
			const leftPull = 1 / (0.08 + Math.hypot(nx - 0.24, ny - 0.48));
			const rightPull = 1 / (0.08 + Math.hypot(nx - 0.74, ny - 0.48));
			const phi = clamp((leftPull * voltage) / (leftPull + rightPull + 0.35 / epsilon), 0, 2);
			const t = clamp(phi / 2, 0, 1);
			const color = mixColor([38, 120, 181], [217, 93, 57], t);
			const i = (y * image.width + x) * 4;
			image.data[i] = color[0];
			image.data[i + 1] = color[1];
			image.data[i + 2] = color[2];
			image.data[i + 3] = 92;
		}
	}
	ctx.putImageData(image, plot.x, plot.y);
}

function drawEquipotentials(plot) {
	ctx.save();
	ctx.strokeStyle = "rgba(255,255,255,0.58)";
	ctx.lineWidth = 1;
	for (let i = 1; i < 7; i++) {
		const x = plot.x + plot.w * (i / 7);
		ctx.beginPath();
		for (let y = plot.y + 12; y < plot.y + plot.h - 12; y += 8) {
			const wobble = Math.sin(y * 0.035 + i) * 9;
			if (y === plot.y + 12) ctx.moveTo(x + wobble, y);
			else ctx.lineTo(x + wobble, y);
		}
		ctx.stroke();
	}
	ctx.restore();
}

function drawSubstrate(plot) {
	ctx.fillStyle = "rgba(15, 118, 110, 0.12)";
	ctx.fillRect(plot.x, plot.y + plot.h - 44, plot.w, 44);
	ctx.strokeStyle = css("--accent");
	ctx.setLineDash([5, 5]);
	line(plot.x, plot.y + plot.h - 44, plot.x + plot.w, plot.y + plot.h - 44);
	ctx.setLineDash([]);
	label("substrate / reference", plot.x + 10, plot.y + plot.h - 17, css("--accent"));
}

function drawConductor(box, text, color) {
	ctx.fillStyle = color;
	roundRect(box.x, box.y, box.w, box.h, 6, true, false);
	ctx.strokeStyle = "rgba(0,0,0,0.22)";
	ctx.lineWidth = 1.5;
	roundRect(box.x, box.y, box.w, box.h, 6, false, true);
	label(text, box.x + box.w / 2, box.y + box.h / 2, "#fff", "center");
}

function drawFieldArrows(plot, count) {
	for (let i = 0; i < count; i++) {
		const y = plot.y + plot.h * (0.24 + i * 0.085);
		const x1 = plot.x + plot.w * 0.34;
		const x2 = plot.x + plot.w * 0.66;
		arrow(x1, y + Math.sin(i) * 12, x2, y + Math.cos(i) * 10, css("--ink"), 0.72);
	}
	label("E = -grad(phi)", plot.x + plot.w * 0.49, plot.y + plot.h * 0.26, css("--ink"), "center");
}

function drawFluxArrows(box, side) {
	const dir = side === "right" ? 1 : -1;
	const x = side === "right" ? box.x + box.w : box.x;
	for (let i = 0; i < 5; i++) {
		const y = box.y + box.h * (0.18 + i * 0.16);
		arrow(x, y, x + dir * 32, y, css("--accent-2"), 0.85);
	}
	label("epsilon E dot n", x + dir * 48, box.y + box.h + 16, css("--accent-2"), "center");
}

function drawFlowChips(items, x, y) {
	let cx = x;
	const maxW = canvas.getBoundingClientRect().width - x - 20;
	items.forEach((item, index) => {
		const width = Math.min(maxW, Math.max(104, ctx.measureText(item).width + 22));
		if (cx + width > x + maxW) {
			cx = x;
			y += 34;
		}
		ctx.fillStyle = "rgba(255,255,255,0.72)";
		ctx.strokeStyle = css("--line");
		roundRect(cx, y, width, 26, 6, true, true);
		label(item, cx + width / 2, y + 17, css("--ink"), "center", "11px");
		cx += width + 8;
		if (index < items.length - 1 && cx + 18 < x + maxW) {
			label("->", cx, y + 17, css("--muted"), "left", "12px");
			cx += 22;
		}
	});
}

function resetFdm() {
	const n = state.fdmSize;
	state.fdmGrid = Array.from({ length: n }, () => Array(n).fill(0.5));
	state.fdmFixed = Array.from({ length: n }, () => Array(n).fill(false));
	for (let y = 0; y < n; y++) {
		for (let x = 0; x < n; x++) {
			if (x === 0 || y === 0 || x === n - 1 || y === n - 1) {
				state.fdmGrid[y][x] = 0;
				state.fdmFixed[y][x] = true;
			}
		}
	}
	const left = conductorCells(n, 0.2, 0.44, 0.08, 0.28);
	const right = conductorCells(n, 0.72, 0.44, 0.08, 0.28);
	left.forEach(([x, y]) => {
		state.fdmGrid[y][x] = 1;
		state.fdmFixed[y][x] = true;
	});
	right.forEach(([x, y]) => {
		state.fdmGrid[y][x] = 0;
		state.fdmFixed[y][x] = true;
	});
	state.fdmCursor = 0;
	state.fdmIterations = 0;
}

function conductorCells(n, fx, fy, fw, fh) {
	const cells = [];
	const x0 = Math.floor(n * fx);
	const x1 = Math.max(x0 + 1, Math.floor(n * (fx + fw)));
	const y0 = Math.floor(n * fy);
	const y1 = Math.max(y0 + 1, Math.floor(n * (fy + fh)));
	for (let y = y0; y <= y1; y++) {
		for (let x = x0; x <= x1; x++) {
			if (x > 0 && x < n - 1 && y > 0 && y < n - 1) cells.push([x, y]);
		}
	}
	return cells;
}

function stepFdmBatch(batch) {
	const n = state.fdmSize;
	for (let k = 0; k < batch; k++) {
		let attempts = 0;
		while (attempts < n * n) {
			const idx = state.fdmCursor % (n * n);
			const x = idx % n;
			const y = Math.floor(idx / n);
			state.fdmCursor = (state.fdmCursor + 1) % (n * n);
			attempts++;
			if (!state.fdmFixed[y][x]) {
				state.fdmGrid[y][x] = (
					state.fdmGrid[y][x + 1] +
					state.fdmGrid[y][x - 1] +
					state.fdmGrid[y + 1][x] +
					state.fdmGrid[y - 1][x]
				) / 4;
				break;
			}
		}
	}
	state.fdmIterations += batch;
}

function drawFdm() {
	const rect = canvas.getBoundingClientRect();
	const plot = getSquarePlot(rect.width, rect.height);
	const n = state.fdmSize;
	const cell = plot.size / n;

	ctx.fillStyle = css("--panel-2");
	ctx.fillRect(plot.x, plot.y, plot.size, plot.size);
	for (let y = 0; y < n; y++) {
		for (let x = 0; x < n; x++) {
			const t = clamp(state.fdmGrid[y][x], 0, 1);
			const color = mixColor([37, 120, 181], [217, 93, 57], t);
			ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
			ctx.fillRect(plot.x + x * cell, plot.y + y * cell, cell + 0.3, cell + 0.3);
			if (state.fdmFixed[y][x]) {
				ctx.fillStyle = t > 0.5 ? "rgba(80,20,10,0.38)" : "rgba(8,40,70,0.38)";
				ctx.fillRect(plot.x + x * cell, plot.y + y * cell, cell, cell);
			}
		}
	}
	ctx.strokeStyle = "rgba(255,255,255,0.28)";
	ctx.lineWidth = 1;
	for (let i = 0; i <= n; i++) {
		const p = plot.x + i * cell;
		line(p, plot.y, p, plot.y + plot.size);
		const q = plot.y + i * cell;
		line(plot.x, q, plot.x + plot.size, q);
	}
	const cursor = state.fdmCursor % (n * n);
	const cx = cursor % n;
	const cy = Math.floor(cursor / n);
	ctx.strokeStyle = css("--accent-2");
	ctx.lineWidth = 2.5;
	ctx.strokeRect(plot.x + cx * cell + 1, plot.y + cy * cell + 1, cell - 2, cell - 2);
	label("1 V fixed", plot.x + plot.size * 0.25, plot.y + plot.size * 0.39, "#fff", "center");
	label("0 V fixed", plot.x + plot.size * 0.77, plot.y + plot.size * 0.39, "#fff", "center");
	label(`iteration ${state.fdmIterations}`, plot.x, plot.y + plot.size + 24, css("--muted"));
}

function getSquarePlot(w, h) {
	const size = Math.min(w - 46, h - 92);
	return { x: (w - size) / 2, y: 28, size };
}

function drawFem() {
	const rect = canvas.getBoundingClientRect();
	const w = rect.width;
	const h = rect.height;
	const plot = getPlotBox(w, h);
	const triangles = buildFemTriangles(plot, state.femRefine);
	ctx.fillStyle = css("--panel-2");
	ctx.fillRect(plot.x, plot.y, plot.w, plot.h);
	triangles.forEach((tri, index) => {
		const hot = Math.max(...tri.map((p) => p.phi));
		const cold = Math.min(...tri.map((p) => p.phi));
		const t = (hot + cold) / 2;
		const color = mixColor([37, 120, 181], [217, 93, 57], t);
		ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},0.28)`;
		ctx.strokeStyle = index === state.femHover ? css("--accent-2") : "rgba(95,111,118,0.55)";
		ctx.lineWidth = index === state.femHover ? 2.5 : 1;
		pathTriangle(tri);
		ctx.fill();
		ctx.stroke();
	});
	drawFEMConductors(plot);
	if (state.femShowLocal) {
		const index = state.femHover >= 0 ? state.femHover : Math.floor(triangles.length * 0.46);
		drawLocalFemTriangle(triangles[index]);
	}
	drawFemFlow(plot);
}

function buildFemTriangles(plot, refine) {
	const cols = 6 + refine * 2;
	const rows = 4 + refine;
	const points = [];
	for (let y = 0; y <= rows; y++) {
		const row = [];
		for (let x = 0; x <= cols; x++) {
			const nx = x / cols;
			const ny = y / rows;
			const dense = Math.exp(-Math.abs(nx - 0.25) * 5) + Math.exp(-Math.abs(nx - 0.72) * 5);
			const jitter = (Math.sin(x * 17 + y * 9) * 0.5 + 0.5) * 8 * (1 - dense * 0.2);
			row.push({
				x: plot.x + nx * plot.w + (x > 0 && x < cols ? jitter - 4 : 0),
				y: plot.y + ny * plot.h + (y > 0 && y < rows ? Math.cos(x * 5 + y * 13) * 5 : 0),
				phi: clamp(1 - nx + Math.sin(ny * Math.PI) * 0.08, 0, 1),
			});
		}
		points.push(row);
	}
	const triangles = [];
	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < cols; x++) {
			const a = points[y][x];
			const b = points[y][x + 1];
			const c = points[y + 1][x];
			const d = points[y + 1][x + 1];
			if ((x + y) % 2 === 0) {
				triangles.push([a, b, d], [a, d, c]);
			} else {
				triangles.push([a, b, c], [b, d, c]);
			}
		}
	}
	return triangles;
}

function pathTriangle(tri) {
	ctx.beginPath();
	ctx.moveTo(tri[0].x, tri[0].y);
	ctx.lineTo(tri[1].x, tri[1].y);
	ctx.lineTo(tri[2].x, tri[2].y);
	ctx.closePath();
}

function drawFEMConductors(plot) {
	drawConductor({ x: plot.x + plot.w * 0.18, y: plot.y + plot.h * 0.34, w: 42, h: plot.h * 0.34 }, "1 V", css("--hot"));
	drawConductor({ x: plot.x + plot.w * 0.72, y: plot.y + plot.h * 0.34, w: 42, h: plot.h * 0.34 }, "0 V", css("--cold"));
}

function drawLocalFemTriangle(tri) {
	if (!tri) return;
	ctx.save();
	pathTriangle(tri);
	ctx.fillStyle = "rgba(240, 163, 74, 0.28)";
	ctx.strokeStyle = css("--accent-2");
	ctx.lineWidth = 3;
	ctx.fill();
	ctx.stroke();
	tri.forEach((p, i) => {
		ctx.fillStyle = css("--accent-2");
		ctx.beginPath();
		ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
		ctx.fill();
		label(`node ${i + 1}`, p.x + 8, p.y - 8, css("--ink"), "left", "11px");
	});
	const cx = (tri[0].x + tri[1].x + tri[2].x) / 3;
	const cy = (tri[0].y + tri[1].y + tri[2].y) / 3;
	label("element", cx, cy, css("--ink"), "center");
	ctx.restore();
}

function drawFemFlow(plot) {
	const y = plot.y + plot.h - 28;
	drawFlowChips(["局部刚度矩阵", "共享节点组装", "全局稀疏方程", "节点 phi"], plot.x + 12, y);
}

function drawBem() {
	const rect = canvas.getBoundingClientRect();
	const plot = getPlotBox(rect.width, rect.height);
	ctx.fillStyle = css("--panel-2");
	ctx.fillRect(plot.x, plot.y, plot.w, plot.h);
	drawSubstrate(plot);
	const shapes = getBemShapes(plot);
	const panels = buildBemPanels(shapes, state.bemPanels);
	if (state.bemShowInfluence) drawBemInfluence(panels);
	drawBemShapes(shapes);
	drawBemPanels(panels);
	drawBemMatrix(plot);
}

function getBemShapes(plot) {
	return [
		{ x: plot.x + plot.w * 0.18, y: plot.y + plot.h * 0.25, w: plot.w * 0.18, h: plot.h * 0.36, label: "conductor A 1 V", color: css("--hot") },
		{ x: plot.x + plot.w * 0.62, y: plot.y + plot.h * 0.34, w: plot.w * 0.18, h: plot.h * 0.28, label: "conductor B 0 V", color: css("--cold") },
	];
}

function buildBemPanels(shapes, count) {
	const panels = [];
	shapes.forEach((shape, shapeIndex) => {
		const perShape = Math.max(4, Math.floor(count / shapes.length));
		for (let i = 0; i < perShape; i++) {
			const p1 = pointOnRect(shape, i / perShape);
			const p2 = pointOnRect(shape, (i + 1) / perShape);
			const x1 = p1.x;
			const y1 = p1.y;
			const x2 = p2.x;
			const y2 = p2.y;
			panels.push({
				x1, y1, x2, y2,
				cx: (x1 + x2) / 2,
				cy: (y1 + y2) / 2,
				shapeIndex,
				sigma: shapeIndex === 0 ? 0.7 + 0.3 * Math.sin(i) : -0.5 - 0.2 * Math.cos(i),
			});
		}
	});
	return panels.slice(0, count);
}

function pointOnRect(shape, t) {
	const perimeter = 2 * (shape.w + shape.h);
	let distance = (t % 1) * perimeter;
	if (distance <= shape.w) {
		return { x: shape.x + distance, y: shape.y };
	}
	distance -= shape.w;
	if (distance <= shape.h) {
		return { x: shape.x + shape.w, y: shape.y + distance };
	}
	distance -= shape.h;
	if (distance <= shape.w) {
		return { x: shape.x + shape.w - distance, y: shape.y + shape.h };
	}
	distance -= shape.w;
	return { x: shape.x, y: shape.y + shape.h - distance };
}

function drawBemShapes(shapes) {
	shapes.forEach((shape) => {
		drawConductor(shape, "", shape.color);
		label(shape.label, shape.x + shape.w / 2, shape.y + shape.h / 2, "#fff", "center", "12px");
	});
}

function drawBemPanels(panels) {
	panels.forEach((panel, index) => {
		const selected = index === state.bemSelected;
		ctx.strokeStyle = selected ? css("--accent-2") : (panel.sigma > 0 ? css("--hot") : css("--cold"));
		ctx.lineWidth = selected ? 4 : 2;
		line(panel.x1, panel.y1, panel.x2, panel.y2);
		if (index % 2 === 0 || selected) {
			label("sigma", panel.cx, panel.cy - 8, ctx.strokeStyle, "center", "10px");
		}
	});
}

function drawBemInfluence(panels) {
	const selected = panels[state.bemSelected] || panels[0];
	if (!selected) return;
	panels.forEach((panel, index) => {
		if (index === state.bemSelected || index % 3 !== 0) return;
		ctx.strokeStyle = "rgba(180, 83, 9, 0.28)";
		ctx.lineWidth = 1.2;
		ctx.beginPath();
		ctx.moveTo(selected.cx, selected.cy);
		const mx = (selected.cx + panel.cx) / 2;
		const my = (selected.cy + panel.cy) / 2 - 34;
		ctx.quadraticCurveTo(mx, my, panel.cx, panel.cy);
		ctx.stroke();
	});
}

function drawBemMatrix(plot) {
	const x = plot.x + plot.w * 0.43;
	const y = plot.y + 22;
	const size = 108;
	ctx.fillStyle = "rgba(255,255,255,0.70)";
	ctx.strokeStyle = css("--line");
	roundRect(x, y, size, size, 6, true, true);
	label("A sigma = V", x + size / 2, y + 18, css("--ink"), "center", "12px");
	const cells = 5;
	const startX = x + 18;
	const startY = y + 32;
	const cell = 12;
	for (let r = 0; r < cells; r++) {
		for (let c = 0; c < cells; c++) {
			const alpha = r === c ? 0.65 : 0.22 + 0.18 * Math.sin(r * 2 + c);
			ctx.fillStyle = `rgba(15, 118, 110, ${alpha})`;
			ctx.fillRect(startX + c * cell, startY + r * cell, cell - 2, cell - 2);
		}
	}
	label("dense influence", x + size / 2, y + size - 10, css("--muted"), "center", "10px");
}

function handleCanvasMove(event) {
	if (state.mode !== "fem") return;
	const rect = canvas.getBoundingClientRect();
	const plot = getPlotBox(rect.width, rect.height);
	const triangles = buildFemTriangles(plot, state.femRefine);
	const x = event.clientX - rect.left;
	const y = event.clientY - rect.top;
	state.femHover = triangles.findIndex((tri) => pointInTriangle({ x, y }, tri[0], tri[1], tri[2]));
}

function handleCanvasClick(event) {
	if (state.mode !== "bem") return;
	const rect = canvas.getBoundingClientRect();
	const plot = getPlotBox(rect.width, rect.height);
	const panels = buildBemPanels(getBemShapes(plot), state.bemPanels);
	const x = event.clientX - rect.left;
	const y = event.clientY - rect.top;
	let best = 0;
	let bestDist = Infinity;
	panels.forEach((panel, index) => {
		const dist = Math.hypot(panel.cx - x, panel.cy - y);
		if (dist < bestDist) {
			best = index;
			bestDist = dist;
		}
	});
	state.bemSelected = best;
	draw();
}

function pointInTriangle(p, a, b, c) {
	const area = (p1, p2, p3) => Math.abs((p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) / 2);
	const total = area(a, b, c);
	const sum = area(p, b, c) + area(a, p, c) + area(a, b, p);
	return Math.abs(total - sum) < 0.5;
}

function label(text, x, y, color = css("--ink"), align = "left", size = "12px") {
	ctx.save();
	ctx.fillStyle = color;
	ctx.font = `650 ${size} ui-sans-serif, system-ui, sans-serif`;
	ctx.textAlign = align;
	ctx.textBaseline = "middle";
	ctx.fillText(text, x, y);
	ctx.restore();
}

function line(x1, y1, x2, y2) {
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
}

function arrow(x1, y1, x2, y2, color, alpha = 1) {
	const angle = Math.atan2(y2 - y1, x2 - x1);
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.strokeStyle = color;
	ctx.fillStyle = color;
	ctx.lineWidth = 2;
	line(x1, y1, x2, y2);
	ctx.beginPath();
	ctx.moveTo(x2, y2);
	ctx.lineTo(x2 - Math.cos(angle - 0.55) * 10, y2 - Math.sin(angle - 0.55) * 10);
	ctx.lineTo(x2 - Math.cos(angle + 0.55) * 10, y2 - Math.sin(angle + 0.55) * 10);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}

function roundRect(x, y, w, h, r, fill, stroke) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + r);
	ctx.lineTo(x + w, y + h - r);
	ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	ctx.lineTo(x + r, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + h - r);
	ctx.lineTo(x, y + r);
	ctx.quadraticCurveTo(x, y, x + r, y);
	ctx.closePath();
	if (fill) ctx.fill();
	if (stroke) ctx.stroke();
}

function mixColor(a, b, t) {
	return a.map((value, index) => Math.round(value + (b[index] - value) * t));
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

init();
