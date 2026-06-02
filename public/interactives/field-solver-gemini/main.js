/**
 * Field Solver Interactive Demonstration
 * Developed for engineering education.
 * Realized in raw vanilla JavaScript/Canvas 2D without modern build tools.
 */

class FieldSolverInteractive {
	constructor() {
		this.canvas = document.getElementById('field-canvas');
		this.ctx = this.canvas.getContext('2d');
		this.captionEl = document.getElementById('canvas-caption');
		this.panelTitleEl = document.getElementById('panel-title');
		this.panelSummaryEl = document.getElementById('panel-summary');
		this.definitionListEl = document.getElementById('definition-list');
		this.controlsPanelEl = document.getElementById('controls-panel');

		// 页面交互状态
		this.currentMode = 'general'; // 'general' | 'fdm' | 'fem' | 'bem'
		this.logicalWidth = 500;
		this.logicalHeight = 350;

		// 统一颜色配置 (同步自 CSS Variables)
		this.colors = {};
		this.updateColors();

		// 通用模块状态
		this.generalParams = {
			voltage: 1.5, // 0.5V 到 2.0V
			epsilonR: 4.0, // 1 到 8
		};

		// FDM 模块状态
		this.fdmParams = {
			density: 24, // 16, 24, 32
			isAutoIterating: false,
			steps: 0,
			sweeps: 0,
		};
		this.fdmGrid = null;
		this.fdmBoundary = null;
		this.fdmLastUpdate = null;
		this.fdmHighlight = { i: 1, j: 1 }; // 当前高亮的更新格点
		this.fdmAnimationFrameId = null;

		// FEM 模块状态
		this.femParams = {
			refinement: 1, // 0 (疏), 1 (中), 2 (密)
			showLocal: true,
		};
		this.femHoveredTriangleIndex = -1;
		this.femMesh = null; // 包含 nodes 和 triangles

		// BEM 模块状态
		this.bemParams = {
			panelCount: 24, // 12 到 48
			showInfluence: true,
		};
		this.bemHoveredPanelIndex = -1;
		this.bemPanels = [];
		this.bemPulseOffset = 0; // 影响线粒子动画

		// 绑定窗口调整大小
		window.addEventListener('resize', () => this.handleResize());
		
		// 绑定 Canvas 鼠标交互
		this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
		this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
		this.canvas.addEventListener('click', (e) => this.handleMouseClick(e));

		// 初始化
		this.initTabs();
		this.handleResize();
		this.setMode('general');
		this.animate();
	}

	updateColors() {
		const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		if (isDark) {
			this.colors = {
				bg: '#14191b',
				panel: '#1d2427',
				panel2: '#263135',
				ink: '#edf3f4',
				muted: '#a8b6ba',
				line: '#354348',
				accent: '#40b8a7',
				accent2: '#f0a34a',
				hot: '#f18461',
				cold: '#64a9dc',
				good: '#72c293',
			};
		} else {
			this.colors = {
				bg: '#f6f7f8',
				panel: '#ffffff',
				panel2: '#eef3f5',
				ink: '#1f2a2e',
				muted: '#5f6f76',
				line: '#d5dddf',
				accent: '#0f766e',
				accent2: '#b45309',
				hot: '#d95d39',
				cold: '#2578b5',
				good: '#2f855a',
			};
		}
	}

	handleResize() {
		const dpr = window.devicePixelRatio || 1;
		const rect = this.canvas.getBoundingClientRect();
		this.canvas.width = rect.width * dpr;
		this.canvas.height = rect.height * dpr;
		this.updateColors();
		this.draw();
	}

	initTabs() {
		const tabs = document.querySelectorAll('.mode-tab');
		tabs.forEach(tab => {
			tab.addEventListener('click', () => {
				tabs.forEach(t => t.classList.remove('active'));
				tab.classList.add('active');
				this.setMode(tab.dataset.mode);
			});
		});

		// 监听暗色模式切换，实时重绘
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
			this.updateColors();
			this.draw();
		});
	}

	setMode(mode) {
		this.currentMode = mode;
		this.captionEl.textContent = '';
		
		// 停止 FDM 自动迭代
		this.stopFdmAuto();

		// 高亮对比表
		document.querySelectorAll('.compare-row').forEach(row => {
			row.classList.remove('highlight');
		});
		const targetRow = document.getElementById(`compare-row-${mode}`);
		if (targetRow) targetRow.classList.add('highlight');

		// 初始化模块数据
		if (mode === 'fdm') {
			this.initFdm();
		} else if (mode === 'fem') {
			this.initFem();
		} else if (mode === 'bem') {
			this.initBem();
		}

		this.renderExplanation();
		this.renderControls();
		this.draw();
	}

	// ----------------------------------------------------
	// 1. 通用场求解器逻辑与物理模型
	// ----------------------------------------------------

	// 使用“镜像电荷法 (Method of Images)”来计算电势
	getGeneralPotential(x, y) {
		const V = this.generalParams.voltage;
		// 两个电极和接地平面的参数
		const xL = 150, yL = 160;
		const xR = 350, yR = 160;
		const yG = 300; // 接地线 Y 坐标
		const a = 40;  // 软化半径，刚好等于导体的物理半径

		// 距离计算 (引入软化项 a 避免发散，并使圆内部电位恒定平滑)
		const rL = Math.sqrt((x - xL) ** 2 + (y - yL) ** 2 + a ** 2);
		const rR = Math.sqrt((x - xR) ** 2 + (y - yR) ** 2 + a ** 2);
		// 镜像电荷在接地平面对称侧 y_img = 2 * yG - y_src
		const rLi = Math.sqrt((x - xL) ** 2 + (y - (2 * yG - yL)) ** 2 + a ** 2);
		const rRi = Math.sqrt((x - xR) ** 2 + (y - (2 * yG - yR)) ** 2 + a ** 2);

		// 电量：左极正电 qL ~ V, 右极由于感应带负电 qR ~ -0.4 * qL
		const qL = V;
		const qR = -0.45 * V;

		// 势函数叠加 phi = C * ( qL*ln(rLi/rL) + qR*ln(rRi/rR) )
		// 系数 C 用于归一化，使左导体（x=150,y=160处）的最大电势接近 V
		const C = 0.65;
		let phi = C * (qL * Math.log(rLi / rL) + qR * Math.log(rRi / rR));

		// 约束电势范围在接地线之上的物理极限 [0, V] 之间
		if (y > yG) return 0;
		if (phi < 0) phi = 0;
		if (phi > V) phi = V;
		return phi;
	}

	getGeneralElectricField(x, y) {
		const delta = 1.5;
		const phiX1 = this.getGeneralPotential(x - delta, y);
		const phiX2 = this.getGeneralPotential(x + delta, y);
		const phiY1 = this.getGeneralPotential(x, y - delta);
		const phiY2 = this.getGeneralPotential(x, y + delta);

		return {
			x: (phiX1 - phiX2) / (2 * delta),
			y: (phiY1 - phiY2) / (2 * delta)
		};
	}

	getConductorRects() {
		return {
			left: { x: 110, y: 130, w: 95, h: 56, voltage: this.generalParams.voltage, label: '左导线', hot: true },
			right: { x: 330, y: 130, w: 95, h: 56, voltage: 0, label: '右导线', hot: false },
		};
	}

	isInsideRect(x, y, rect, pad = 0) {
		return x >= rect.x - pad && x <= rect.x + rect.w + pad && y >= rect.y - pad && y <= rect.y + rect.h + pad;
	}

	rectBoundaryPoint(rect, t) {
		const p = ((t % 1) + 1) % 1;
		const perimeter = 2 * (rect.w + rect.h);
		let d = p * perimeter;
		if (d <= rect.w) return { x: rect.x + d, y: rect.y, nx: 0, ny: -1 };
		d -= rect.w;
		if (d <= rect.h) return { x: rect.x + rect.w, y: rect.y + d, nx: 1, ny: 0 };
		d -= rect.h;
		if (d <= rect.w) return { x: rect.x + rect.w - d, y: rect.y + rect.h, nx: 0, ny: 1 };
		d -= rect.w;
		return { x: rect.x, y: rect.y + rect.h - d, nx: -1, ny: 0 };
	}

	rectBoundaryPoints(rect, count) {
		return Array.from({ length: count }, (_, k) => this.rectBoundaryPoint(rect, k / count));
	}

	drawWireRect(ctx, rect, scaleX, scaleY, stroke, fill, title, subtitle) {
		const x = rect.x * scaleX;
		const y = rect.y * scaleY;
		const w = rect.w * scaleX;
		const h = rect.h * scaleY;
		ctx.fillStyle = fill;
		ctx.strokeStyle = stroke;
		ctx.lineWidth = 4;
		ctx.fillRect(x, y, w, h);
		ctx.strokeRect(x, y, w, h);
		ctx.fillStyle = 'rgba(255,255,255,0.14)';
		ctx.fillRect(x, y, w, h * 0.42);
		ctx.fillStyle = this.colors.ink;
		ctx.font = `bold ${Math.max(12, Math.floor(12 * scaleX))}px sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(title, x + w / 2, y + h / 2 - 7 * scaleY);
		ctx.font = `${Math.max(10, Math.floor(10 * scaleX))}px sans-serif`;
		ctx.fillStyle = this.colors.muted;
		ctx.fillText(subtitle, x + w / 2, y + h / 2 + 11 * scaleY);
	}

	drawGeneral(ctx, w, h) {
		const scaleX = w / this.logicalWidth;
		const scaleY = h / this.logicalHeight;

		// 1. 绘制电势热力图：在离线网格上做超级平滑的像素采样
		const gridW = 80;
		const gridH = 60;
		const cellW = this.logicalWidth / gridW;
		const cellH = 300 / gridH; // 只计算到接地线以上的区域

		for (let i = 0; i < gridW; i++) {
			for (let j = 0; j < gridH; j++) {
				const lx = (i + 0.5) * cellW;
				const ly = (j + 0.5) * cellH;
				const phi = this.getGeneralPotential(lx, ly);
				const ratio = phi / 2.0; // 相对最大电压 2.0 的比例

				// 渲染热力颜色：高电位(红偏橙色)，低电位(暗淡或蓝灰色)
				ctx.fillStyle = this.getPotColor(ratio, 0.25);
				ctx.fillRect(lx * scaleX, ly * scaleY, cellW * scaleX + 0.5, cellH * scaleY + 0.5);
			}
		}

		// 2. 绘制接地 Substrate (地平面)
		ctx.fillStyle = this.colors.panel2;
		ctx.fillRect(0, 300 * scaleY, w, h - 300 * scaleY);
		ctx.beginPath();
		ctx.strokeStyle = this.colors.line;
		ctx.lineWidth = 2;
		ctx.moveTo(0, 300 * scaleY);
		ctx.lineTo(w, 300 * scaleY);
		ctx.stroke();

		// 画接地符号斜线
		ctx.strokeStyle = this.colors.line;
		ctx.lineWidth = 1.5;
		for (let x = 20; x < this.logicalWidth; x += 30) {
			ctx.beginPath();
			ctx.moveTo(x * scaleX, 300 * scaleY);
			ctx.lineTo((x - 8) * scaleX, 308 * scaleY);
			ctx.stroke();
		}

		// 3. 绘制等势线 (Isopotential Lines)
		ctx.strokeStyle = this.colors.muted;
		ctx.lineWidth = 1;
		ctx.setLineDash([3, 4]);
		const potLevels = [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8];
		
		// 极度精简的马尔辛立方(Marching Squares)等效采样画虚线等势线
		for (let level of potLevels) {
			if (level > this.generalParams.voltage) continue;
			ctx.beginPath();
			for (let lx = 10; lx < this.logicalWidth; lx += 15) {
				let prevY = -1;
				for (let ly = 10; ly <= 300; ly += 6) {
					const phi = this.getGeneralPotential(lx, ly);
					if (Math.abs(phi - level) < 0.04) {
						if (prevY === -1) {
							ctx.moveTo(lx * scaleX, ly * scaleY);
						} else {
							ctx.lineTo(lx * scaleX, ly * scaleY);
						}
						prevY = ly;
					}
				}
			}
			ctx.stroke();
		}
		ctx.setLineDash([]);

		const rects = this.getConductorRects();

		// 4. 绘制电场线 (Electric Field Lines)
		ctx.strokeStyle = this.colors.accent;
		ctx.lineWidth = 1.2;
		const startPoints = this.rectBoundaryPoints(rects.left, 16);
		for (let k = 0; k < startPoints.length; k++) {
			let lx = startPoints[k].x + startPoints[k].nx * 3;
			let ly = startPoints[k].y + startPoints[k].ny * 3;

			ctx.beginPath();
			ctx.moveTo(lx * scaleX, ly * scaleY);

			let step = 3;
			let active = true;
			let pathPoints = [{x: lx, y: ly}];

			for (let stepCount = 0; stepCount < 120 && active; stepCount++) {
				const E = this.getGeneralElectricField(lx, ly);
				const E_mag = Math.sqrt(E.x ** 2 + E.y ** 2);
				if (E_mag < 0.001) break;

				// 沿着电场方向行进 (E 向量指向电势下降最快的方向，即正电荷引向负电荷/地)
				lx += (E.x / E_mag) * step;
				ly += (E.y / E_mag) * step;

				pathPoints.push({x: lx, y: ly});

				// 边界条件判断：如果打在右导线矩形上或地平面上，就停止
				if (this.isInsideRect(lx, ly, rects.right, 2) || ly >= 300 || lx < 0 || lx > this.logicalWidth || ly < 0) {
					active = false;
				}
			}

			// 绘制曲线
			if (pathPoints.length > 1) {
				ctx.beginPath();
				ctx.moveTo(pathPoints[0].x * scaleX, pathPoints[0].y * scaleY);
				for (let p of pathPoints) {
					ctx.lineTo(p.x * scaleX, p.y * scaleY);
				}
				ctx.stroke();

				// 在曲线中部画一个小箭头
				const midIdx = Math.floor(pathPoints.length * 0.45);
				if (midIdx > 0 && midIdx < pathPoints.length) {
					const pCurr = pathPoints[midIdx];
					const pPrev = pathPoints[midIdx - 1];
					const dx = pCurr.x - pPrev.x;
					const dy = pCurr.y - pPrev.y;
					const angle = Math.atan2(dy, dx);
					
					this.drawArrowhead(ctx, pCurr.x * scaleX, pCurr.y * scaleY, angle, 6);
				}
			}
		}

		// 5. 绘制导体表面法向电通量箭头 (Normal Flux Lines)
		ctx.lineWidth = 2;
		const fluxLeft = this.rectBoundaryPoints(rects.left, 16);
		const fluxRight = this.rectBoundaryPoints(rects.right, 16);
		for (let k = 0; k < fluxLeft.length; k++) {
			const lp = fluxLeft[k];
			const rp = fluxRight[k];

			// 左侧导体法向箭头：向外
			const E = this.getGeneralElectricField(lp.x, lp.y);
			const E_normal = (E.x * lp.nx + E.y * lp.ny) * this.generalParams.epsilonR; // 通量与介电常数成正比
			const arrowLen = Math.max(2, Math.abs(E_normal) * 14);

			ctx.strokeStyle = this.colors.hot;
			ctx.beginPath();
			ctx.moveTo(lp.x * scaleX, lp.y * scaleY);
			// 朝着法向方向绘制
			const endX = lp.x + arrowLen * lp.nx;
			const endY = lp.y + arrowLen * lp.ny;
			ctx.lineTo(endX * scaleX, endY * scaleY);
			ctx.stroke();
			this.drawArrowhead(ctx, endX * scaleX, endY * scaleY, Math.atan2(lp.ny, lp.nx), 5, this.colors.hot);

			// 右侧导体法向箭头：向内
			const ER = this.getGeneralElectricField(rp.x, rp.y);
			const ER_normal = (ER.x * rp.nx + ER.y * rp.ny) * this.generalParams.epsilonR;
			const arrowLenR = Math.max(2, Math.abs(ER_normal) * 14);

			ctx.strokeStyle = this.colors.cold;
			ctx.beginPath();
			ctx.moveTo(rp.x * scaleX, rp.y * scaleY);
			// 负通量引向内
			const endXR = rp.x - arrowLenR * rp.nx;
			const endYR = rp.y - arrowLenR * rp.ny;
			ctx.lineTo(endXR * scaleX, endYR * scaleY);
			ctx.stroke();
			this.drawArrowhead(ctx, endXR * scaleX, endYR * scaleY, Math.atan2(-rp.ny, -rp.nx), 5, this.colors.cold);
		}

		// 6. 绘制矩形导线横截面
		this.drawWireRect(ctx, rects.left, scaleX, scaleY, this.colors.hot, this.colors.panel, `${this.generalParams.voltage.toFixed(1)} V`, '左导线 (高电位)');
		this.drawWireRect(ctx, rects.right, scaleX, scaleY, this.colors.cold, this.colors.panel, `0.0 V`, '右导线 (参考地)');

		// 地标注文字
		ctx.fillStyle = this.colors.ink;
		ctx.font = `bold ${Math.floor(11 * scaleX)}px sans-serif`;
		ctx.fillText(`GROUND Substrate (参考地平面 0V)`, 250 * scaleX, 322 * scaleY);

		this.captionEl.innerHTML = `左侧高电位导线周围聚集<strong>正电荷</strong>，表面发出<strong>电场线 (E = -grad phi)</strong>；右侧导体及底部半导体衬底接地 (0V)，聚集感应<strong>负电荷</strong>。`;
	}

	// ----------------------------------------------------
	// 2. FDM 有限差分模块逻辑与算法
	// ----------------------------------------------------

	initFdm() {
		const N = parseInt(this.fdmParams.density);
		this.fdmGrid = Array(N).fill(0).map(() => Array(N).fill(0.0));
		this.fdmBoundary = Array(N).fill(0).map(() => Array(N).fill(false));

		// 设置 FDM 矩形导体横截面，贴近芯片金属线截面
		const leftRect = {
			i0: Math.floor(N * 0.38),
			i1: Math.floor(N * 0.55),
			j0: Math.floor(N * 0.25),
			j1: Math.floor(N * 0.43),
		};
		const rightRect = {
			i0: Math.floor(N * 0.38),
			i1: Math.floor(N * 0.55),
			j0: Math.floor(N * 0.62),
			j1: Math.floor(N * 0.80),
		};

		for (let i = 0; i < N; i++) {
			for (let j = 0; j < N; j++) {
				// 底部接地：i = N-1 (最底下一行)
				if (i === N - 1) {
					this.fdmGrid[i][j] = 0.0;
					this.fdmBoundary[i][j] = true;
				}

				// 左导体
				if (i >= leftRect.i0 && i <= leftRect.i1 && j >= leftRect.j0 && j <= leftRect.j1) {
					this.fdmGrid[i][j] = 1.0; // 固定为 1 V
					this.fdmBoundary[i][j] = true;
				}

				// 右导体
				if (i >= rightRect.i0 && i <= rightRect.i1 && j >= rightRect.j0 && j <= rightRect.j1) {
					this.fdmGrid[i][j] = 0.0; // 固定为 0 V
					this.fdmBoundary[i][j] = true;
				}
			}
		}

		this.fdmParams.steps = 0;
		this.fdmParams.sweeps = 0;
		this.fdmHighlight = { i: Math.floor(N * 0.4), j: Math.floor(N * 0.5) };
		this.fdmLastUpdate = null;
	}

	advanceFdmHighlight() {
		const N = parseInt(this.fdmParams.density);
		let found = false;
		let attempts = 0;
		while (!found && attempts < N * N) {
			this.fdmHighlight.j++;
			if (this.fdmHighlight.j >= N - 1) {
				this.fdmHighlight.j = 1;
				this.fdmHighlight.i++;
				if (this.fdmHighlight.i >= N - 1) {
					this.fdmHighlight.i = 1;
				}
			}
			if (!this.fdmBoundary[this.fdmHighlight.i][this.fdmHighlight.j]) {
				found = true;
			}
			attempts++;
		}
	}

	runFdmSingleCellStep() {
		const N = parseInt(this.fdmParams.density);
		const i = this.fdmHighlight.i;
		const j = this.fdmHighlight.j;
		if (i > 0 && i < N - 1 && j > 0 && j < N - 1 && !this.fdmBoundary[i][j]) {
			const oldVal = this.fdmGrid[i][j];
			const up = this.fdmGrid[i - 1][j];
			const down = this.fdmGrid[i + 1][j];
			const left = this.fdmGrid[i][j - 1];
			const right = this.fdmGrid[i][j + 1];
			const newVal = (up + down + left + right) / 4.0;
			this.fdmGrid[i][j] = newVal;
			this.fdmLastUpdate = { i, j, oldVal, newVal, up, down, left, right };
			this.fdmParams.steps++;
		}
		this.advanceFdmHighlight();
		this.updateFdmMetricDisplay();
	}

	runFdmSweep() {
		const N = parseInt(this.fdmParams.density);
		for (let i = 1; i < N - 1; i++) {
			for (let j = 1; j < N - 1; j++) {
				if (!this.fdmBoundary[i][j]) {
					const oldVal = this.fdmGrid[i][j];
					const up = this.fdmGrid[i - 1][j];
					const down = this.fdmGrid[i + 1][j];
					const left = this.fdmGrid[i][j - 1];
					const right = this.fdmGrid[i][j + 1];
					const newVal = (up + down + left + right) / 4.0;
					this.fdmGrid[i][j] = newVal;
					this.fdmHighlight = { i, j };
					this.fdmLastUpdate = { i, j, oldVal, newVal, up, down, left, right };
				}
			}
		}
		this.fdmParams.sweeps++;

		// 更新公式显示的 DOM
		this.updateFdmMetricDisplay();
	}

	stopFdmAuto() {
		this.fdmParams.isAutoIterating = false;
		if (this.fdmAnimationFrameId) {
			cancelAnimationFrame(this.fdmAnimationFrameId);
			this.fdmAnimationFrameId = null;
		}
		const autoBtn = document.getElementById('fdm-auto-btn');
		if (autoBtn) {
			autoBtn.textContent = '自动迭代';
			autoBtn.classList.remove('active');
		}
	}

	drawFdm(ctx, w, h) {
		const N = parseInt(this.fdmParams.density);
		const cellW = w / N;
		const cellH = (300 * (h / this.logicalHeight)) / (N - 1); // 映射到底部地平面以上

		// 1. 绘制方格网格的电势颜色
		for (let i = 0; i < N; i++) {
			for (let j = 0; j < N; j++) {
				const x = j * cellW;
				const y = i * cellH;

				if (i === N - 1) {
					// 底部接地线
					ctx.fillStyle = this.colors.line;
					ctx.fillRect(x, y, cellW, 6);
					continue;
				}

				const pot = this.fdmGrid[i][j];
				
				if (this.fdmBoundary[i][j]) {
					// 导体内部
					if (pot > 0.5) {
						ctx.fillStyle = this.getPotColor(pot, 0.7);
					} else {
						ctx.fillStyle = this.colors.panel2;
					}
				} else {
					// 内部空间
					ctx.fillStyle = this.getPotColor(pot, 0.35);
				}
				ctx.fillRect(x, y, cellW - 0.5, cellH - 0.5);

				// 绘制网格细线 (只有在密度不大于 24 时才清晰可见，避免高密度网格纯黑)
				if (N <= 24) {
					ctx.strokeStyle = this.colors.line;
					ctx.lineWidth = 0.5;
					ctx.strokeRect(x, y, cellW, cellH);
				}
			}
		}

		// 2. 标出固定边界和电位值
		ctx.font = `bold ${N <= 16 ? '11px' : '9px'} sans-serif`;
		ctx.fillStyle = this.colors.ink;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		// 抽样在一些格点里写下数值，让用户明显感知到“格点上的标量场”
		const stepLabel = N <= 16 ? 2 : 3;
		for (let i = 1; i < N - 1; i += stepLabel) {
			for (let j = 1; j < N - 1; j += stepLabel) {
				if (this.fdmBoundary[i][j]) continue;
				const x = (j + 0.5) * cellW;
				const y = (i + 0.5) * cellH;
				ctx.fillStyle = this.colors.muted;
				ctx.fillText(this.fdmGrid[i][j].toFixed(2), x, y);
			}
		}

		// 3. 高亮正在更新的格点 (高亮十字架)
		const hi = this.fdmHighlight.i;
		const hj = this.fdmHighlight.j;
		if (hi > 0 && hi < N - 1 && hj > 0 && hj < N - 1) {
			const hx = (hj + 0.5) * cellW;
			const hy = (hi + 0.5) * cellH;

			// 高亮十字架线
			ctx.strokeStyle = this.colors.accent2;
			ctx.lineWidth = 1.5;
			ctx.setLineDash([2, 2]);
			
			ctx.beginPath();
			ctx.moveTo(hx, hy - cellH * 2);
			ctx.lineTo(hx, hy + cellH * 2);
			ctx.moveTo(hx - cellW * 2, hy);
			ctx.lineTo(hx + cellW * 2, hy);
			ctx.stroke();
			ctx.setLineDash([]);

			// 高亮中心格点
			ctx.strokeStyle = this.colors.accent2;
			ctx.lineWidth = 2.5;
			ctx.strokeRect(hj * cellW, hi * cellH, cellW, cellH);

			ctx.fillStyle = this.colors.accent2;
			ctx.fillRect(hx - 2.5, hy - 2.5, 5, 5);

			const labels = [
				{ i: hi, j: hj, text: `φ(${hi},${hj})`, dx: 0, dy: 0, color: this.colors.accent2 },
				{ i: hi - 1, j: hj, text: '上', dx: 0, dy: -1, color: this.colors.ink },
				{ i: hi + 1, j: hj, text: '下', dx: 0, dy: 1, color: this.colors.ink },
				{ i: hi, j: hj - 1, text: '左', dx: -1, dy: 0, color: this.colors.ink },
				{ i: hi, j: hj + 1, text: '右', dx: 1, dy: 0, color: this.colors.ink },
			];
			ctx.font = `bold ${Math.max(9, Math.floor(Math.min(cellW, cellH) * 0.32))}px sans-serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			labels.forEach(item => {
				const x = (item.j + 0.5) * cellW;
				const y = (item.i + 0.5) * cellH;
				ctx.fillStyle = 'rgba(255,255,255,0.76)';
				ctx.fillRect(item.j * cellW + 2, item.i * cellH + 2, cellW - 4, cellH - 4);
				ctx.fillStyle = item.color;
				ctx.fillText(item.text, x, y);
			});
		}

		// 4. 标识导体
		const scaleX = w / this.logicalWidth;
		const scaleY = h / this.logicalHeight;
		ctx.font = 'bold 12px sans-serif';
		ctx.fillStyle = this.colors.ink;
		ctx.fillText("1.0 V 固定边界", 150 * scaleX, 160 * scaleY);
		ctx.fillText("0.0 V 固定边界", 350 * scaleX, 160 * scaleY);

		this.captionEl.innerHTML = `FDM 通过将连续空间划分为<strong>规则方格</strong>，每次单格更新只改一个未知格点；一轮扫网格会依次更新所有内部未知格点。当前已执行 <strong>${this.fdmParams.steps}</strong> 次单格更新，<strong>${this.fdmParams.sweeps}</strong> 轮扫网格。`;
	}

	updateFdmMetricDisplay() {
		const displayEl = document.getElementById('fdm-metric-formula');
		if (!displayEl) return;

		const hi = this.fdmHighlight.i;
		const hj = this.fdmHighlight.j;
		const N = parseInt(this.fdmParams.density);

		if (hi > 0 && hi < N - 1 && hj > 0 && hj < N - 1) {
			const last = this.fdmLastUpdate;
			const center = this.fdmGrid[hi][hj].toFixed(3);
			const up = this.fdmGrid[hi-1][hj].toFixed(3);
			const down = this.fdmGrid[hi+1][hj].toFixed(3);
			const left = this.fdmGrid[hi][hj-1].toFixed(3);
			const right = this.fdmGrid[hi][hj+1].toFixed(3);
			const updatedText = last
				? `上一次更新：φ(${last.i},${last.j}) ${last.oldVal.toFixed(3)} → ${last.newVal.toFixed(3)}`
				: '单格更新会把当前 φ(i,j) 替换为四邻居平均值。';

			displayEl.innerHTML = `
				<div class="metric-box">
					<strong>当前高亮格点 (${hi}, ${hj}) 的五点模板：</strong><br>
					φ<sub>i,j</sub> = (φ<sub>i-1,j</sub> + φ<sub>i+1,j</sub> + φ<sub>i,j-1</sub> + φ<sub>i,j+1</sub>) / 4<br>
					<span style="color:var(--accent-2); font-weight:bold;">${center}</span> = (${up} + ${down} + ${left} + ${right}) / 4<br>
					矩阵行：-4φ<sub>i,j</sub> + φ<sub>上</sub> + φ<sub>下</sub> + φ<sub>左</sub> + φ<sub>右</sub> = 0<br>
					<small>${updatedText}</small>
				</div>
			`;
		}
	}

	// ----------------------------------------------------
	// 3. FEM 有限元模块逻辑与算法
	// ----------------------------------------------------

	initFem() {
		const nodes = [];
		const triangles = [];
		const rects = this.getConductorRects();
		const cols = this.femParams.refinement === 0 ? 8 : this.femParams.refinement === 1 ? 12 : 16;
		const rows = this.femParams.refinement === 0 ? 5 : this.femParams.refinement === 1 ? 7 : 9;
		const x0 = 30, x1 = 470, y0 = 40, y1 = 300;
		const nodeIndex = Array.from({ length: rows + 1 }, () => Array(cols + 1).fill(-1));

		const classifyNode = (x, y) => {
			if (Math.abs(y - y1) < 0.001) return 'boundary-cold';
			if (this.isInsideRect(x, y, rects.left, 4)) return 'boundary-hot';
			if (this.isInsideRect(x, y, rects.right, 4)) return 'boundary-cold';
			return 'internal';
		};

		for (let r = 0; r <= rows; r++) {
			for (let c = 0; c <= cols; c++) {
				const baseX = x0 + (x1 - x0) * c / cols;
				const baseY = y0 + (y1 - y0) * r / rows;
				const nearWire = this.isInsideRect(baseX, baseY, rects.left, 55) || this.isInsideRect(baseX, baseY, rects.right, 55);
				const jitter = nearWire ? 4 : 9;
				const x = c === 0 || c === cols ? baseX : baseX + Math.sin(c * 7 + r * 3) * jitter;
				const y = r === 0 || r === rows ? baseY : baseY + Math.cos(c * 5 + r * 11) * jitter;
				const idx = nodes.length;
				nodeIndex[r][c] = idx;
				nodes.push({ x, y, type: classifyNode(x, y), pot: this.getGeneralPotential(x, y) });
			}
		}

		const triInsideConductor = (a, b, c) => {
			const cx = (nodes[a].x + nodes[b].x + nodes[c].x) / 3;
			const cy = (nodes[a].y + nodes[b].y + nodes[c].y) / 3;
			return this.isInsideRect(cx, cy, rects.left, 0) || this.isInsideRect(cx, cy, rects.right, 0);
		};

		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const a = nodeIndex[r][c];
				const b = nodeIndex[r][c + 1];
				const d = nodeIndex[r + 1][c];
				const e = nodeIndex[r + 1][c + 1];
				const localTris = (r + c) % 2 === 0 ? [[a, b, e], [a, e, d]] : [[a, b, d], [b, e, d]];
				localTris.forEach(tri => {
					if (!triInsideConductor(...tri)) triangles.push(tri);
				});
			}
		}

		this.femMesh = { nodes, triangles };
	}

	drawFem(ctx, w, h) {
		const scaleX = w / this.logicalWidth;
		const scaleY = h / this.logicalHeight;

		const { nodes, triangles } = this.femMesh;

		// 1. 绘制每个三角形单元
		triangles.forEach((tri, index) => {
			const n0 = nodes[tri[0]];
			const n1 = nodes[tri[1]];
			const n2 = nodes[tri[2]];

			const isHovered = index === this.femHoveredTriangleIndex;

			// 在三角形内部填充插值电势
			ctx.beginPath();
			ctx.moveTo(n0.x * scaleX, n0.y * scaleY);
			ctx.lineTo(n1.x * scaleX, n1.y * scaleY);
			ctx.lineTo(n2.x * scaleX, n2.y * scaleY);
			ctx.closePath();

			// 单元内部的色彩插值：通过平均值来映射
			const avgPot = (n0.pot + n1.pot + n2.pot) / 3.0;
			ctx.fillStyle = this.getPotColor(avgPot, isHovered ? 0.75 : 0.38);
			ctx.fill();

			// 绘制三角形的网格边界线
			ctx.strokeStyle = isHovered ? this.colors.accent2 : this.colors.line;
			ctx.lineWidth = isHovered ? 2.0 : 0.8;
			ctx.stroke();

			// 如果高亮，在三角形内部绘制局部线性插值的示意渐变 (Shape Function)
			if (isHovered && this.femParams.showLocal) {
				ctx.save();
				ctx.beginPath();
				ctx.moveTo(n0.x * scaleX, n0.y * scaleY);
				ctx.lineTo(n1.x * scaleX, n1.y * scaleY);
				ctx.lineTo(n2.x * scaleX, n2.y * scaleY);
				ctx.closePath();
				ctx.clip();

				// 绘制一个放射状或线性色彩流
				const grad = ctx.createLinearGradient(n0.x * scaleX, n0.y * scaleY, n2.x * scaleX, n2.y * scaleY);
				grad.addColorStop(0, this.getPotColor(n0.pot, 0.9));
				grad.addColorStop(0.5, this.getPotColor(n1.pot, 0.9));
				grad.addColorStop(1, this.getPotColor(n2.pot, 0.9));
				ctx.fillStyle = grad;
				ctx.fillRect(0, 0, w, h);
				ctx.restore();

				// 在悬停单元边界上重新描红
				ctx.strokeStyle = this.colors.accent2;
				ctx.lineWidth = 2.5;
				ctx.stroke();
			}
		});

		// 2. 绘制有限元节点 (Nodes)
		nodes.forEach(node => {
			ctx.beginPath();
			ctx.arc(node.x * scaleX, node.y * scaleY, 3.5, 0, Math.PI * 2);

			if (node.type === 'boundary-hot') {
				ctx.fillStyle = this.colors.hot;
			} else if (node.type === 'boundary-cold') {
				ctx.fillStyle = this.colors.cold;
			} else {
				ctx.fillStyle = this.colors.accent;
			}
			ctx.fill();

			// 绘制节点的外圈
			ctx.strokeStyle = this.colors.panel;
			ctx.lineWidth = 1;
			ctx.stroke();
		});

		// 3. 绘制两个矩形导线的物理截面，使画面贴近芯片金属线横截面
		const rects = this.getConductorRects();
		ctx.strokeStyle = this.colors.hot;
		ctx.lineWidth = 2;
		ctx.setLineDash([2, 4]);
		ctx.strokeRect(rects.left.x * scaleX, rects.left.y * scaleY, rects.left.w * scaleX, rects.left.h * scaleY);

		ctx.strokeStyle = this.colors.cold;
		ctx.strokeRect(rects.right.x * scaleX, rects.right.y * scaleY, rects.right.w * scaleX, rects.right.h * scaleY);
		ctx.setLineDash([]);

		// 底部地平面
		ctx.strokeStyle = this.colors.line;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(30 * scaleX, 300 * scaleY);
		ctx.lineTo(470 * scaleX, 300 * scaleY);
		ctx.stroke();

		// 说明更新
		if (this.femHoveredTriangleIndex !== -1) {
			const tri = triangles[this.femHoveredTriangleIndex];
			const n0 = nodes[tri[0]];
			const n1 = nodes[tri[1]];
			const n2 = nodes[tri[2]];
			this.captionEl.innerHTML = `当前悬停<strong>单元 ${this.femHoveredTriangleIndex} (Element)</strong>。节点电压：N1=<strong>${n0.pot.toFixed(2)}V</strong>, N2=<strong>${n1.pot.toFixed(2)}V</strong>, N3=<strong>${n2.pot.toFixed(2)}V</strong>。在单元内部，电势采用一阶线性插值函数逼近。`;
		} else {
			this.captionEl.innerHTML = `FEM 将空间划分为不规则的<strong>三角形网格 (Mesh)</strong>。在导体和边界处三角形<strong>更细密</strong>，在外围稀疏。移动鼠标悬停在三角形上查看其局部单元。`;
		}
	}

	// ----------------------------------------------------
	// 4. BEM 边界元模块逻辑与算法
	// ----------------------------------------------------

	initBem() {
		this.bemPanels = [];
		const M = parseInt(this.bemParams.panelCount);
		const rects = this.getConductorRects();
		const panelsPerWire = Math.max(8, M);

		const addRectPanels = (rect, type, pot) => {
			for (let k = 0; k < panelsPerWire; k++) {
				const p1 = this.rectBoundaryPoint(rect, k / panelsPerWire);
				const p2 = this.rectBoundaryPoint(rect, (k + 1) / panelsPerWire);
				const cx = (p1.x + p2.x) / 2;
				const cy = (p1.y + p2.y) / 2;
				const nx = p1.nx || p2.nx;
				const ny = p1.ny || p2.ny;
				this.bemPanels.push({
					x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
					cx, cy, nx, ny,
					charge: type === 'hot' ? 1.0 + 0.35 * (cx > rect.x + rect.w / 2 ? 1 : 0) : -0.7,
					type,
					pot
				});
			}
		};

		addRectPanels(rects.left, 'hot', this.generalParams.voltage);
		addRectPanels(rects.right, 'cold', 0.0);

		// 3. 地平面 Panel (简化为一段水平线段边界)
		const groundY = 300;
		const numG = 8;
		for (let k = 0; k < numG; k++) {
			const x1 = 50 + (400 * k) / numG;
			const x2 = 50 + (400 * (k + 1)) / numG;
			this.bemPanels.push({
				x1, y1: groundY, x2, y2: groundY,
				cx: (x1 + x2) / 2,
				cy: groundY,
				nx: 0,
				ny: -1,
				charge: -0.4 * (1.0 - Math.abs((x1 + x2)/2 - 250) / 250), // 越靠近中间负电荷越多
				type: 'cold',
				pot: 0.0
			});
		}
	}

	drawBem(ctx, w, h) {
		const scaleX = w / this.logicalWidth;
		const scaleY = h / this.logicalHeight;

		// 1. 绘制空气介质背景：明确显示“空间没有网格，100% 留空”
		ctx.fillStyle = this.colors.bg;
		ctx.fillRect(0, 0, w, h);

		// 地平面实体底座
		ctx.fillStyle = this.colors.panel2;
		ctx.fillRect(0, 300 * scaleY, w, h - 300 * scaleY);
		ctx.beginPath();
		ctx.strokeStyle = this.colors.line;
		ctx.lineWidth = 1;
		ctx.moveTo(0, 300 * scaleY);
		ctx.lineTo(w, 300 * scaleY);
		ctx.stroke();

		// 2. 绘制 BEM 边界 Panels
		this.bemPanels.forEach((panel, index) => {
			const isHovered = index === this.bemHoveredPanelIndex;

			ctx.strokeStyle = panel.type === 'hot' ? this.colors.hot : this.colors.cold;
			ctx.lineWidth = isHovered ? 4.0 : 2.5;

			ctx.beginPath();
			ctx.moveTo(panel.x1 * scaleX, panel.y1 * scaleY);
			ctx.lineTo(panel.x2 * scaleX, panel.y2 * scaleY);
			ctx.stroke();

			// 绘制 panel 端点的分割点
			ctx.fillStyle = this.colors.ink;
			ctx.beginPath();
			ctx.arc(panel.x1 * scaleX, panel.y1 * scaleY, 2, 0, Math.PI * 2);
			ctx.arc(panel.x2 * scaleX, panel.y2 * scaleY, 2, 0, Math.PI * 2);
			ctx.fill();

			// 在 Panel 中点标出电荷符号（红色 +，蓝色 -）
			const signSize = isHovered ? 12 : 7;
			ctx.font = `bold ${signSize}px sans-serif`;
			ctx.fillStyle = panel.charge > 0 ? this.colors.hot : this.colors.cold;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(panel.charge > 0 ? '+' : '-', panel.cx * scaleX, panel.cy * scaleY - 6 * panel.ny * scaleY);
		});

		// 3. 绘制相互作用/耦合影响线 (Influence/Coupling Lines)
		// 如果悬停在某个 panel 上，从该 panel 出发，发射至所有其他 panel 的相互作用线
		if (this.bemHoveredPanelIndex !== -1 && this.bemParams.showInfluence) {
			const srcPanel = this.bemPanels[this.bemHoveredPanelIndex];

			this.bemPanels.forEach((destPanel, index) => {
				if (index === this.bemHoveredPanelIndex) return;

				const dx = destPanel.cx - srcPanel.cx;
				const dy = destPanel.cy - srcPanel.cy;
				const dist = Math.sqrt(dx ** 2 + dy ** 2);

				// 耦合强弱：基于 1/r 二维格林函数
				const coupling = 1 / (dist + 30);
				
				ctx.strokeStyle = this.colors.accent2;
				ctx.lineWidth = Math.min(2.0, coupling * 150);
				ctx.globalAlpha = Math.min(0.8, coupling * 100);
				
				// 画一条带有稍微弧度的虚线代表相互作用
				ctx.beginPath();
				ctx.moveTo(srcPanel.cx * scaleX, srcPanel.cy * scaleY);
				// 弧控制点
				const midX = (srcPanel.cx + destPanel.cx) / 2 - dy * 0.1;
				const midY = (srcPanel.cy + destPanel.cy) / 2 + dx * 0.1;
				ctx.quadraticCurveTo(midX * scaleX, midY * scaleY, destPanel.cx * scaleX, destPanel.cy * scaleY);
				ctx.stroke();

				// 光点粒子流动动画 (流向四周表示源面板对全局的影响)
				ctx.globalAlpha = 1.0;
				const t = (this.bemPulseOffset / 60) % 1.0;
				// 在贝塞尔曲线上计算动画粒子坐标
				const px = (1-t)**2 * srcPanel.cx + 2*(1-t)*t * midX + t**2 * destPanel.cx;
				const py = (1-t)**2 * srcPanel.cy + 2*(1-t)*t * midY + t**2 * destPanel.cy;

				ctx.fillStyle = this.colors.accent2;
				ctx.beginPath();
				ctx.arc(px * scaleX, py * scaleY, 2.5, 0, Math.PI * 2);
				ctx.fill();
			});
			ctx.globalAlpha = 1.0;

			// 高亮显示源 Panel 的中心点
			ctx.fillStyle = this.colors.accent2;
			ctx.beginPath();
			ctx.arc(srcPanel.cx * scaleX, srcPanel.cy * scaleY, 5, 0, Math.PI * 2);
			ctx.fill();
		}

		// 两个导体的标注
		ctx.fillStyle = this.colors.ink;
		ctx.font = 'bold 12px sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText("左矩形导线表面 Panels", 157 * scaleX, 112 * scaleY);
		ctx.fillText("右矩形导线表面 Panels", 377 * scaleX, 112 * scaleY);

		if (this.bemHoveredPanelIndex !== -1) {
			const p = this.bemPanels[this.bemHoveredPanelIndex];
			this.captionEl.innerHTML = `当前选中 <strong>Panel ${this.bemHoveredPanelIndex}</strong>。该片带电密度为：<strong>${p.charge.toFixed(2)} &sigma;<sub>0</sub></strong>。它对全空间产生 1/r 库仑势，会影响其他<strong>所有</strong> Panels 上的电位。`;
		} else {
			this.captionEl.innerHTML = `BEM <strong>仅对边界和表面</strong>进行离散。空间空气中<strong>无任何网格</strong>！移动鼠标悬停在 Panel 上以显示库仑势相互影响线。`;
		}
	}

	// ----------------------------------------------------
	// 5. 交互核心：控制面板、定义、参数滑块
	// ----------------------------------------------------

	renderExplanation() {
		this.definitionListEl.innerHTML = '';
		
		const defs = {
			general: [
				{ t: '场求解器 (Field Solver)', d: '把复杂的空间导线几何结构和材料参数（介电常数）转化为电势偏微分方程（Laplace 方程），并在空间中求解的数值计算软件。' },
				{ t: '电势 phi (Potential)', d: '空间中每一点的“电压高度”。电荷会受到电势差的作用产生运动。' },
				{ t: '电场 E (Electric Field)', d: '电势下降最快的方向，数值等于负梯度：E = -grad(phi)。' },
				{ t: '法向电通量积分 (Normal Flux)', d: '穿过导体表面的电场强度的积分。根据高斯定律，它直接正比于导体表面所聚集的电荷：Q = integral(ε E · n dS)。' }
			],
			fdm: [
				{ t: 'FDM 有限差分法', d: 'Finite Difference Method。将求解空间划分为规则均匀方格，利用 Taylor 级数展开，把偏微分方程（导数）近似为相邻格点数值的算术差分。' },
				{ t: '单格更新与扫网格', d: '单格更新只改一个未知格点；一轮 sweep 才是把所有内部未知格点依次更新一遍。两者都在逼近同一个线性方程组 Aφ=b。' },
				{ t: '五点模板 (5-point stencil)', d: '二维 Laplace 方程离散后，一个格点只直接连接上、下、左、右四个邻居，因此矩阵 A 的一行只含中心点和四邻居的系数。' }
			],
			fem: [
				{ t: 'FEM 有限元法', d: 'Finite Element Method。将复杂的连续求解区域剖分为由不规则三角形（2D）或四面体（3D）组成的网格（Mesh）。' },
				{ t: '形状函数 (Shape Function)', d: '在每个三角形内部，假设电势以简单一阶线性函数（如 Ax + By + C）进行近似。通过求解所有三角形顶点（Nodes）处的电压，组装出全局稀疏线性方程组。' }
			],
			bem: [
				{ t: 'BEM 边界元法', d: 'Boundary Element Method。它不需要剖分整个三维空间（如空气层），而仅仅将导体的表面和介质的分界面剖分为微小的边界单元（Panels）。' },
				{ t: '全耦合稠密矩阵 (Dense Matrix)', d: '在 BEM 中，由于库仑相互作用是远程的，每个表面 Panel 的电荷会直接影响其他任意 Panel 上的电位。因此组装出的线性系统 A σ = V 是全满的稠密矩阵，计算代价大但极适合处理无限开放空间。' }
			]
		};

		// 填充标题和简介
		const titles = {
			general: '通用场求解器基本原理',
			fdm: 'FDM 有限差分法：差分格点松弛迭代',
			fem: 'FEM 有限元法：不规则网格与基函数',
			bem: 'BEM 边界元法：边界离散与全耦合'
		};
		const summaries = {
			general: '展示由麦克斯韦静电方程（Laplace）决定的真实场分布：从高电位向地（参考地）延伸。调节参数观察电场强度、导体表面电荷及最终反推电容值的物理链条。',
			fdm: '将连续空间彻底网格化。通过在每个格点套用“中心点等于四周邻居均值”的极简公式，多次迭代逐步逼近电势分布。它是最经典的偏微分方程数值解法。',
			fem: '极度适合处理曲线导体和复杂的介质边界。在每个三角形内部使用简单一阶多项式，把全局偏微分方程组装为大型稀疏线性代数方程组。',
			bem: '静电提取（RCX）中的黄金方案。通过格林函数法，只对导体表面进行 Panel 划分。免去了对广大空气区域做网格剖分的麻烦，直接对表面电荷密度 σ 进行求解。'
		};

		this.panelTitleEl.textContent = titles[this.currentMode];
		this.panelSummaryEl.textContent = summaries[this.currentMode];

		defs[this.currentMode].forEach(item => {
			const div = document.createElement('div');
			div.className = 'definition-item';
			div.innerHTML = `<strong>${item.t}</strong><span>${item.d}</span>`;
			this.definitionListEl.appendChild(div);
		});
	}

	renderControls() {
		this.controlsPanelEl.innerHTML = '';

		if (this.currentMode === 'general') {
			// 左导体电压滑块
			const rowV = this.createSliderRow('voltage', '左导体电压 (V)', 0.5, 2.0, 0.1, this.generalParams.voltage, 'V');
			this.controlsPanelEl.appendChild(rowV);

			// 相对介电常数滑块
			const rowE = this.createSliderRow('epsilonR', '介电常数 (relative epsilon_r)', 1.0, 8.0, 0.5, this.generalParams.epsilonR, '');
			this.controlsPanelEl.appendChild(rowE);

			// 计算电荷与电容估计
			const metricBox = document.createElement('div');
			metricBox.className = 'metric-box';
			const Q_estim = this.generalParams.epsilonR * this.generalParams.voltage * 4.32;
			const C_estim = this.generalParams.epsilonR * 4.32;
			metricBox.innerHTML = `
				<strong>【物理量抽取反推估算】</strong><br>
				&bull; 表面感应总电荷 Q<sub>估</sub> &approx; <span style="color:var(--hot); font-weight:bold;">${Q_estim.toFixed(1)} fC</span><br>
				&bull; 抽取互寄生电容 C<sub>12</sub> = Q / V &approx; <span style="color:var(--accent); font-weight:bold;">${C_estim.toFixed(2)} fF</span><br>
				<small style="color:var(--muted); display:block; margin-top:4px;">* 提示：高介电常数材料（如高 k 介质）会成正比地增大寄生电容，导致更强的信号耦合和延迟。</small>
			`;
			this.controlsPanelEl.appendChild(metricBox);

		} else if (this.currentMode === 'fdm') {
			// 网格密度选择
			const rowD = document.createElement('div');
			rowD.className = 'control-row';
			rowD.innerHTML = `
				<label>网格密度 (Grid Density) <output id="fdm-density-val">${this.fdmParams.density}x${this.fdmParams.density}</output></label>
				<div class="button-grid">
					<button class="action-btn ${this.fdmParams.density === 16 ? 'active' : ''}" type="button" data-density="16">16 x 16 (快)</button>
					<button class="action-btn ${this.fdmParams.density === 24 ? 'active' : ''}" type="button" data-density="24">24 x 24 (中)</button>
					<button class="action-btn ${this.fdmParams.density === 32 ? 'active' : ''}" type="button" data-density="32">32 x 32 (精细)</button>
				</div>
			`;
			this.controlsPanelEl.appendChild(rowD);

			// 控制按钮组：单步、自动、重置
			const rowBtns = document.createElement('div');
			rowBtns.className = 'control-row';
			rowBtns.innerHTML = `
				<div class="button-grid" style="grid-template-columns: repeat(4, minmax(0, 1fr));">
					<button class="action-btn" id="fdm-step-btn" type="button">单格更新</button>
					<button class="action-btn" id="fdm-sweep-btn" type="button">一轮扫网格</button>
					<button class="action-btn" id="fdm-auto-btn" type="button">自动单格</button>
					<button class="action-btn" id="fdm-reset-btn" type="button">重置</button>
				</div>
			`;
			this.controlsPanelEl.appendChild(rowBtns);

			// 动态公式显示框
			const formulaBox = document.createElement('div');
			formulaBox.id = 'fdm-metric-formula';
			this.controlsPanelEl.appendChild(formulaBox);

			// 绑定事件
			rowD.querySelectorAll('.action-btn').forEach(btn => {
				btn.addEventListener('click', () => {
					rowD.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active'));
					btn.classList.add('active');
					this.fdmParams.density = parseInt(btn.dataset.density);
					document.getElementById('fdm-density-val').textContent = `${this.fdmParams.density}x${this.fdmParams.density}`;
					this.stopFdmAuto();
					this.initFdm();
					this.draw();
				});
			});

			document.getElementById('fdm-step-btn').addEventListener('click', () => {
				this.stopFdmAuto();
				this.runFdmSingleCellStep();
				this.draw();
			});

			document.getElementById('fdm-sweep-btn').addEventListener('click', () => {
				this.stopFdmAuto();
				this.runFdmSweep();
				this.draw();
			});

			const autoBtn = document.getElementById('fdm-auto-btn');
			autoBtn.addEventListener('click', () => {
				if (this.fdmParams.isAutoIterating) {
					this.stopFdmAuto();
				} else {
					this.fdmParams.isAutoIterating = true;
					autoBtn.textContent = '暂停';
					autoBtn.classList.add('active');
					this.runFdmAutoLoop();
				}
			});

			document.getElementById('fdm-reset-btn').addEventListener('click', () => {
				this.stopFdmAuto();
				this.initFdm();
				this.draw();
			});

			this.updateFdmMetricDisplay();

		} else if (this.currentMode === 'fem') {
			// 边界加密度
			const rowRef = document.createElement('div');
			rowRef.className = 'control-row';
			rowRef.innerHTML = `
				<label>边界网格加密度 (Refinement) <output id="fem-ref-val">中等</output></label>
				<div class="button-grid">
					<button class="action-btn ${this.femParams.refinement === 0 ? 'active' : ''}" type="button" data-ref="0">稀疏</button>
					<button class="action-btn ${this.femParams.refinement === 1 ? 'active' : ''}" type="button" data-ref="1">中等</button>
					<button class="action-btn ${this.femParams.refinement === 2 ? 'active' : ''}" type="button" data-ref="2">密集</button>
				</div>
			`;
			this.controlsPanelEl.appendChild(rowRef);

			// 插值开关
			const rowSwitch = document.createElement('div');
			rowSwitch.className = 'control-row switch-row';
			rowSwitch.innerHTML = `
				<span>显示单元内渐变插值</span>
				<input type="checkbox" id="fem-show-local-chk" ${this.femParams.showLocal ? 'checked' : ''}>
			`;
			this.controlsPanelEl.appendChild(rowSwitch);

			// 绑定事件
			rowRef.querySelectorAll('.action-btn').forEach(btn => {
				btn.addEventListener('click', () => {
					rowRef.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active'));
					btn.classList.add('active');
					this.femParams.refinement = parseInt(btn.dataset.ref);
					
					const labels = ['稀疏', '中等', '密集'];
					document.getElementById('fem-ref-val').textContent = labels[this.femParams.refinement];
					
					this.femHoveredTriangleIndex = -1;
					this.initFem();
					this.draw();
				});
			});

			const labels = ['稀疏', '中等', '密集'];
			document.getElementById('fem-ref-val').textContent = labels[this.femParams.refinement];

			document.getElementById('fem-show-local-chk').addEventListener('change', (e) => {
				this.femParams.showLocal = e.target.checked;
				this.draw();
			});

		} else if (this.currentMode === 'bem') {
			// Panel 数量
			const rowPanel = this.createSliderRow('panelCount', '每条导体边界 Panel 数量', 12, 48, 4, this.bemParams.panelCount, '段');
			this.controlsPanelEl.appendChild(rowPanel);

			// 影响线开关
			const rowSwitch = document.createElement('div');
			rowSwitch.className = 'control-row switch-row';
			rowSwitch.innerHTML = `
				<span>显示格林函数全局影响线</span>
				<input type="checkbox" id="bem-show-influence-chk" ${this.bemParams.showInfluence ? 'checked' : ''}>
			`;
			this.controlsPanelEl.appendChild(rowSwitch);

			// 耦合方程示意
			const equationBox = document.createElement('div');
			equationBox.className = 'metric-box';
			equationBox.innerHTML = `
				<strong>【BEM 全局满矩阵方程 A &sigma; = V】</strong><br>
				对于划分的 <span style="color:var(--accent2); font-weight:bold;">${this.bemPanels.length}</span> 个 Panels：<br>
				矩阵 [A] 维度：<strong>${this.bemPanels.length} &times; ${this.bemPanels.length} (全满)</strong><br>
				[A] 的每一个元素 A<sub>ij</sub> = ln(1/r<sub>ij</sub>) 刻画了全耦合：任一 Panel j 上的电荷都在 Panel i 处产生电势。
			`;
			this.controlsPanelEl.appendChild(equationBox);

			document.getElementById('bem-show-influence-chk').addEventListener('change', (e) => {
				this.bemParams.showInfluence = e.target.checked;
				this.draw();
			});
		}
	}

	createSliderRow(paramName, labelText, min, max, step, currentVal, suffix = '') {
		const row = document.createElement('div');
		row.className = 'control-row';
		row.innerHTML = `
			<label>${labelText} <output id="${paramName}-val">${currentVal} ${suffix}</output></label>
			<input type="range" min="${min}" max="${max}" step="${step}" value="${currentVal}" id="${paramName}-range">
		`;

		const rangeInput = row.querySelector('input');
		rangeInput.addEventListener('input', (e) => {
			const val = parseFloat(e.target.value);
			document.getElementById(`${paramName}-val`).textContent = `${val} ${suffix}`;
			
			if (this.currentMode === 'general') {
				this.generalParams[paramName] = val;
				// 更新面板
				this.renderControls();
			} else if (this.currentMode === 'bem') {
				this.bemParams[paramName] = val;
				this.bemHoveredPanelIndex = -1;
				this.initBem();
				this.renderControls();
			}
			this.draw();
		});

		return row;
	}

	runFdmAutoLoop() {
		if (!this.fdmParams.isAutoIterating) return;

		// 每帧跑多个单格更新，仍能看到“格点逐个被扫过”的过程
		for (let step = 0; step < 6; step++) {
			this.runFdmSingleCellStep();
		}
		this.draw();

		this.fdmAnimationFrameId = requestAnimationFrame(() => this.runFdmAutoLoop());
	}

	// ----------------------------------------------------
	// 6. 统一绘图驱动
	// ----------------------------------------------------

	draw() {
		const dpr = window.devicePixelRatio || 1;
		const w = this.canvas.width / dpr;
		const h = this.canvas.height / dpr;

		this.ctx.save();
		this.ctx.scale(dpr, dpr);
		this.ctx.clearRect(0, 0, w, h);

		if (this.currentMode === 'general') {
			this.drawGeneral(this.ctx, w, h);
		} else if (this.currentMode === 'fdm') {
			this.drawFdm(this.ctx, w, h);
		} else if (this.currentMode === 'fem') {
			this.drawFem(this.ctx, w, h);
		} else if (this.currentMode === 'bem') {
			this.drawBem(this.ctx, w, h);
		}

		this.ctx.restore();
	}

	animate() {
		// 统一驱动全局轻量动画
		if (this.currentMode === 'bem' && this.bemParams.showInfluence) {
			this.bemPulseOffset += 0.8;
			this.draw();
		}
		requestAnimationFrame(() => this.animate());
	}

	// ----------------------------------------------------
	// 7. 鼠标交互与碰撞检测
	// ----------------------------------------------------

	handleMouseMove(e) {
		const dpr = window.devicePixelRatio || 1;
		const rect = this.canvas.getBoundingClientRect();
		// 将物理鼠标位置，转换为逻辑画布坐标
		const mPhysicalX = e.clientX - rect.left;
		const mPhysicalY = e.clientY - rect.top;
		
		const mx = mPhysicalX * (this.logicalWidth / rect.width);
		const my = mPhysicalY * (this.logicalHeight / rect.height);

		if (this.currentMode === 'fem' && this.femMesh) {
			// 检测鼠标悬停在哪个三角形内
			let foundIdx = -1;
			const { nodes, triangles } = this.femMesh;

			for (let idx = 0; idx < triangles.length; idx++) {
				const tri = triangles[idx];
				const n0 = nodes[tri[0]];
				const n1 = nodes[tri[1]];
				const n2 = nodes[tri[2]];

				if (this.isPointInTriangle(mx, my, n0.x, n0.y, n1.x, n1.y, n2.x, n2.y)) {
					foundIdx = idx;
					break;
				}
			}

			if (foundIdx !== this.femHoveredTriangleIndex) {
				this.femHoveredTriangleIndex = foundIdx;
				this.draw();
			}
		} else if (this.currentMode === 'bem') {
			// 检测鼠标悬停在哪个 Panel 附近 (就近检测中点)
			let foundIdx = -1;
			let minDist = 18; // 碰撞检测半径

			this.bemPanels.forEach((panel, index) => {
				const dist = Math.sqrt((mx - panel.cx) ** 2 + (my - panel.cy) ** 2);
				if (dist < minDist) {
					foundIdx = index;
					minDist = dist;
				}
			});

			if (foundIdx !== this.bemHoveredPanelIndex) {
				this.bemHoveredPanelIndex = foundIdx;
				this.draw();
			}
		}
	}

	handleMouseLeave() {
		if (this.currentMode === 'fem' && this.femHoveredTriangleIndex !== -1) {
			this.femHoveredTriangleIndex = -1;
			this.draw();
		} else if (this.currentMode === 'bem' && this.bemHoveredPanelIndex !== -1) {
			this.bemHoveredPanelIndex = -1;
			this.draw();
		}
	}

	handleMouseClick(e) {
		// 如果在 FDM 模式下点击，可以手动设置格点电压（彩蛋/附加高级交互）
		if (this.currentMode === 'fdm') {
			this.handleMouseMove(e);
		}
	}

	// ----------------------------------------------------
	// 8. 辅助计算与绘制工具
	// ----------------------------------------------------

	// 三角形包含性重心坐标检测
	isPointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
		const v0x = cx - ax, v0y = cy - ay;
		const v1x = bx - ax, v1y = by - ay;
		const v2x = px - ax, v2y = py - ay;
		
		const dot00 = v0x * v0x + v0y * v0y;
		const dot01 = v0x * v1x + v0y * v1y;
		const dot02 = v0x * v2x + v0y * v2y;
		const dot11 = v1x * v1x + v1y * v1y;
		const dot12 = v1x * v2x + v1y * v2y;
		
		const invDenom = 1.0 / (dot00 * dot11 - dot01 * dot01);
		const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
		const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
		
		return (u >= 0) && (v >= 0) && (u + v <= 1);
	}

	// 绘制箭头辅助函数
	drawArrowhead(ctx, x, y, angle, size, style) {
		ctx.save();
		ctx.fillStyle = style || this.colors.accent;
		ctx.translate(x, y);
		ctx.rotate(angle);
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(-size, -size * 0.4);
		ctx.lineTo(-size * 0.8, 0);
		ctx.lineTo(-size, size * 0.4);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}

	// 根据电位大小映射颜色：高电位(暖红), 低电位(冷蓝)
	getPotColor(ratio, alpha) {
		// 归一化限制在 [0, 1]
		const r = Math.min(Math.max(ratio, 0.0), 1.0);
		
		// 提取 CSS 变量对应的高低温配色 RGB
		// --hot: #f18461 (241, 132, 97) 或 #d95d39 (217, 93, 57)
		// --cold: #64a9dc (100, 169, 220) 或 #2578b5 (37, 120, 181)
		
		const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		let rgbHot, rgbCold;
		if (isDark) {
			rgbHot = [241, 132, 97];
			rgbCold = [100, 169, 220];
		} else {
			rgbHot = [217, 93, 57];
			rgbCold = [37, 120, 181];
		}

		const rComp = Math.floor(rgbCold[0] * (1.0 - r) + rgbHot[0] * r);
		const gComp = Math.floor(rgbCold[1] * (1.0 - r) + rgbHot[1] * r);
		const bComp = Math.floor(rgbCold[2] * (1.0 - r) + rgbHot[2] * r);

		return `rgba(${rComp}, ${gComp}, ${bComp}, ${alpha})`;
	}
}

// 确保 DOM 载入后启动交互
window.addEventListener('DOMContentLoaded', () => {
	new FieldSolverInteractive();
});
