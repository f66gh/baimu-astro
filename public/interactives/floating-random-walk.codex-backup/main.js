// Floating Random Walk Interactive - Main Logic

// 1. 初始化常量与配置
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const CANVAS_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// 导体基础定义
const DEFAULT_CONDUCTORS = [
  { id: 'A', name: '导体 A', x: 230, y: 150, w: 140, h: 50, voltage: 1 },
  { id: 'B', name: '导体 B', x: 80, y: 60, w: 100, h: 45, voltage: 0 },
  { id: 'C', name: '导体 C', x: 420, y: 220, w: 100, h: 45, voltage: 0 }
];

// Substrate (底部)
const SUBSTRATE_Y = 370;

// 2. 状态变量
let masterId = 'A'; // 当前主导体
let conductors = JSON.parse(JSON.stringify(DEFAULT_CONDUCTORS));

// 游走状态
let currentWalk = {
  points: [],    // [{x, y}] 路径点
  current: null, // {x, y} 当前游走点
  status: 'idle', // 'idle' | 'walking' | 'finished'
  hitTarget: null // 命中目标 ID: 'B' | 'C' | 'SUB' | 'unfinished'
};

// 历史路径（仅用于 Canvas 展示）
let historyWalks = [];

// 统计信息
let stats = {
  total: 0,
  hits: {
    A: 0,
    B: 0,
    C: 0,
    SUB: 0,
    unfinished: 0
  },
  totalHops: 0
};

// 控制参数（从 DOM 获取/同步）
let settings = {
  batchSize: 200,
  speed: 1, // 每帧跳跃次数 (1 - 50)
  stoppingThreshold: 3, // 判定命中距离
  showCube: true,
  recentOnly: true
};

// 自动动画句柄
let animationFrameId = null;
let isAutoWalking = false;

// DOM 元素引用
let canvas, ctx;

// 3. 几何辅助函数
function getDistanceToRect(px, py, rx, ry, rw, rh) {
  const dx = Math.max(rx - px, 0, px - (rx + rw));
  const dy = Math.max(ry - py, 0, py - (ry + rh));
  return Math.sqrt(dx * dx + dy * dy);
}

// 寻找游走点到所有 0V 目标、substrate、画布边界的最近距离。
// 画布左/右/上边界只用于停止路径，不计入电容统计。
function findClosestTarget(px, py) {
  let minD = Infinity;
  let closestId = null;

  // 1. 遍历 0V 导体 (即非 master 的其他导体)
  conductors.forEach(cond => {
    if (cond.id !== masterId) {
      const d = getDistanceToRect(px, py, cond.x, cond.y, cond.w, cond.h);
      if (d < minD) {
        minD = d;
        closestId = cond.id;
      }
    }
  });

  // 2. 到 Substrate (底面) 距离
  const dSub = Math.max(SUBSTRATE_Y - py, 0);
  if (dSub < minD) {
    minD = dSub;
    closestId = 'SUB';
  }

  // 3. 到画布左、右、上边界的距离。它们不是物理 substrate，命中后不计数。
  const dLeft = px;
  if (dLeft < minD) {
    minD = dLeft;
    closestId = 'BOUNDARY';
  }

  const dRight = CANVAS_WIDTH - px;
  if (dRight < minD) {
    minD = dRight;
    closestId = 'BOUNDARY';
  }

  const dTop = py;
  if (dTop < minD) {
    minD = dTop;
    closestId = 'BOUNDARY';
  }

  return { d: minD, id: closestId };
}

function recordFinishedWalk(points, hitTarget) {
  historyWalks.push({
    points: [...points],
    hitTarget
  });

  const maxHist = settings.recentOnly ? 5 : 100;
  while (historyWalks.length > maxHist) {
    historyWalks.shift();
  }
}

function recordCountedSample(points, hitTarget) {
  stats.total++;
  stats.hits[hitTarget]++;
  stats.totalHops += points.length;
  recordFinishedWalk(points, hitTarget);
}

// 在 Master 导体表面极小外部生成随机均匀起点
function sampleMasterSurface(mId) {
  const master = conductors.find(c => c.id === mId);
  if (!master) return { x: 300, y: 200 };

  const offset = 2; // 微小偏移量，避免一出发就判定在导体表面内
  const w = master.w;
  const h = master.h;
  const rx = master.x;
  const ry = master.y;

  // 四条边总周长
  const perimeter = 2 * w + 2 * h;
  const r = Math.random() * perimeter;

  if (r < w) {
    // 顶边
    return { x: rx + Math.random() * w, y: ry - offset };
  } else if (r < 2 * w) {
    // 底边
    return { x: rx + Math.random() * w, y: ry + h + offset };
  } else if (r < 2 * w + h) {
    // 左边
    return { x: rx - offset, y: ry + Math.random() * h };
  } else {
    // 右边
    return { x: rx + w + offset, y: ry + Math.random() * h };
  }
}

// 4. FRW 单步游走算法
function initNewWalk() {
  const startPt = sampleMasterSurface(masterId);
  currentWalk.points = [startPt];
  currentWalk.current = { ...startPt };
  currentWalk.status = 'walking';
  currentWalk.hitTarget = null;
  
  updateFlowSteps(1); // 采样起始点
}

function singleHop() {
  if (currentWalk.status !== 'walking') {
    initNewWalk();
  }

  const pt = currentWalk.current;
  const { d, id } = findClosestTarget(pt.x, pt.y);

  // 如果距离过小，或者已经超出合理边界，判定命中
  if (d < settings.stoppingThreshold) {
    currentWalk.hitTarget = id;
    currentWalk.status = 'finished';

    if (id === 'BOUNDARY') {
      recordFinishedWalk(currentWalk.points, id);
      updateFlowSteps(4); // 跑到示意边界：停止，但不进入统计
    } else {
      recordCountedSample(currentWalk.points, id);
      updateFlowSteps(5); // 命中物理边界并统计
    }

    updateUIStats();
    return;
  }

  // 构建 2D Transition Square (边长 2d)，随机 Hop 到四条边之一
  const rSide = Math.floor(Math.random() * 4);
  let nextPt = { x: pt.x, y: pt.y };
  const randOffset = (Math.random() * 2 - 1) * d; // [-d, d]

  switch (rSide) {
    case 0: // 顶边
      nextPt.x = pt.x + randOffset;
      nextPt.y = pt.y - d;
      break;
    case 1: // 底边
      nextPt.x = pt.x + randOffset;
      nextPt.y = pt.y + d;
      break;
    case 2: // 左边
      nextPt.x = pt.x - d;
      nextPt.y = pt.y + randOffset;
      break;
    case 3: // 右边
      nextPt.x = pt.x + d;
      nextPt.y = pt.y + randOffset;
      break;
  }

  // 保证不彻底飞出极值 (越界兜底)
  nextPt.x = Math.max(1, Math.min(CANVAS_WIDTH - 1, nextPt.x));
  nextPt.y = Math.max(1, Math.min(CANVAS_HEIGHT - 1, nextPt.y));

  currentWalk.points.push(nextPt);
  currentWalk.current = nextPt;

  // 防护跳跃上限，防止死循环游走
  if (currentWalk.points.length > 500) {
    currentWalk.hitTarget = 'unfinished';
    currentWalk.status = 'finished';
    recordCountedSample(currentWalk.points, 'unfinished');
    updateUIStats();
  } else {
    updateFlowSteps(3); // 随机跳转中
  }
}

// 快速运行一条路径到结束（不加动画，用于批量采样）
function runWalkToFinish() {
  const startPt = sampleMasterSurface(masterId);
  const pts = [startPt];
  let cur = { ...startPt };
  let hit = null;
  let hops = 0;

  while (hops < 500) {
    const { d, id } = findClosestTarget(cur.x, cur.y);

    if (d < settings.stoppingThreshold) {
      hit = id;
      break;
    }

    const rSide = Math.floor(Math.random() * 4);
    const randOffset = (Math.random() * 2 - 1) * d;
    let nextPt = { x: cur.x, y: cur.y };

    switch (rSide) {
      case 0: nextPt.x = cur.x + randOffset; nextPt.y = cur.y - d; break;
      case 1: nextPt.x = cur.x + randOffset; nextPt.y = cur.y + d; break;
      case 2: nextPt.x = cur.x - d; nextPt.y = cur.y + randOffset; break;
      case 3: nextPt.x = cur.x + d; nextPt.y = cur.y + randOffset; break;
    }

    nextPt.x = Math.max(1, Math.min(CANVAS_WIDTH - 1, nextPt.x));
    nextPt.y = Math.max(1, Math.min(CANVAS_HEIGHT - 1, nextPt.y));

    pts.push(nextPt);
    cur = nextPt;
    hops++;
  }

  if (!hit) {
    hit = 'unfinished';
  }

  if (hit === 'BOUNDARY') {
    recordFinishedWalk(pts, hit);
    return;
  }

  recordCountedSample(pts, hit);
}

// 5. 渲染控制
function draw() {
  ctx.save();
  const scale = canvas._scale || 1;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 5.1 绘制介质背景
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--card-bg');
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 5.2 绘制 Substrate 底部金属地
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--substrate-color');
  ctx.fillRect(0, SUBSTRATE_Y, CANVAS_WIDTH, CANVAS_HEIGHT - SUBSTRATE_Y);
  
  // 底部 Substrate 地文字
  ctx.fillStyle = '#ffffff';
  ctx.font = `10px ${CANVAS_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('SUBSTRATE (参考地, 0V)', CANVAS_WIDTH / 2, SUBSTRATE_Y + 18);

  // 5.3 绘制导体 (A, B, C)
  conductors.forEach(cond => {
    const isMaster = cond.id === masterId;
    const color = getComputedStyle(document.documentElement).getPropertyValue(
      isMaster ? '--master-color' : '--ground-color'
    );

    // 绘制金属矩形框
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(cond.x, cond.y, cond.w, cond.h, 4);
    ctx.fill();

    // 绘制拉丝金属感或渐变
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(cond.x, cond.y, cond.w, cond.h / 2);

    // 导体外框
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-color');
    ctx.lineWidth = 1;
    ctx.strokeRect(cond.x, cond.y, cond.w, cond.h);

    // 导体文字
    ctx.fillStyle = isMaster ? (getComputedStyle(document.documentElement).getPropertyValue('--btn-primary-text') || '#ffffff') : '#ffffff';
    ctx.font = `bold 11px ${CANVAS_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${cond.name} (${cond.voltage}V)`, cond.x + cond.w / 2, cond.y + cond.h / 2);
  });

  // 5.4 绘制历史路径
  ctx.lineWidth = 1;
  historyWalks.forEach(walk => {
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--path-history');
    ctx.beginPath();
    walk.points.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();

    // 绘制历史终点标记圆点
    if (walk.points.length > 0) {
      const endPt = walk.points[walk.points.length - 1];
      ctx.fillStyle = walk.hitTarget === 'SUB' ? '#343a40' : (walk.hitTarget === 'B' ? '#6c757d' : '#8a929a');
      ctx.beginPath();
      ctx.arc(endPt.x, endPt.y, 2, 0, 2 * Math.PI);
      ctx.fill();
    }
  });

  // 5.5 绘制当前游走路径与 Transition Cube
  if (currentWalk.status === 'walking' && currentWalk.points.length > 0) {
    const pts = currentWalk.points;
    
    // 路径高亮细线
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--path-active');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    pts.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();

    // 路径历史节点微小圆点
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--path-active');
    pts.forEach((pt, idx) => {
      if (idx < pts.length - 1) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    // 当前点高亮亮圈
    const cur = currentWalk.current;
    ctx.fillStyle = '#ff0055';
    ctx.beginPath();
    ctx.arc(cur.x, cur.y, 3.5, 0, 2 * Math.PI);
    ctx.fill();

    // 计算当前避障圆 & 正方形 Transition Square
    const { d } = findClosestTarget(cur.x, cur.y);

    if (settings.showCube && d > settings.stoppingThreshold) {
      // 绘制 Transition Square 截面 (正方形)
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--cube-fill');
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--cube-stroke');
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]); // 虚线表示
      ctx.fillRect(cur.x - d, cur.y - d, 2 * d, 2 * d);
      ctx.strokeRect(cur.x - d, cur.y - d, 2 * d, 2 * d);
      ctx.setLineDash([]); // 还原

      // 在正方形右上角标记 2D Square
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted');
      ctx.font = `9px ${CANVAS_FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(`d=${Math.round(d)}px (Transition Box)`, cur.x + d + 4, cur.y - d + 8);
    }
  }

  ctx.restore();
}

// 6. UI 与动画同步
function autoWalkLoop() {
  if (!isAutoWalking) return;

  // 根据速度设置，每帧跳跃多次
  for (let s = 0; s < settings.speed; s++) {
    if (currentWalk.status !== 'walking') {
      initNewWalk();
    }
    singleHop();
    if (currentWalk.status === 'finished') {
      // 路径走完了，这一帧不再继续跳，等下一帧开始新路径
      break;
    }
  }

  draw();
  animationFrameId = requestAnimationFrame(autoWalkLoop);
}

function updateUIStats() {
  // 基础数据
  document.getElementById('stat-total').innerText = stats.total;
  document.getElementById('stat-current-hops').innerText = currentWalk.status === 'walking' ? currentWalk.points.length : 0;
  
  const meanHops = stats.total > 0 ? Math.round(stats.totalHops / stats.total) : 0;
  document.getElementById('stat-mean-hops').innerText = meanHops;

  // 命中比例统计
  const totalFinished = stats.total;
  const list = ['A', 'B', 'C', 'SUB', 'unfinished'];
  
  list.forEach(item => {
    const val = stats.hits[item] || 0;
    const pct = totalFinished > 0 ? ((val / totalFinished) * 100).toFixed(1) : '0.0';
    
    const countEl = document.getElementById(`hit-count-${item.toLowerCase()}`);
    const pctEl = document.getElementById(`hit-pct-${item.toLowerCase()}`);
    const barEl = document.getElementById(`hit-bar-${item.toLowerCase()}`);
    
    if (countEl) countEl.innerText = val;
    if (pctEl) pctEl.innerText = pct + '%';
    if (barEl) barEl.style.width = pct + '%';
  });

  // 教学电容估计
  // C = (Hit_X / Total) * C_scale
  // 常数设为 12.0 pF 起点
  const C_scale = 12.0; 
  let capB = 0;
  let capC = 0;
  let capSub = 0;

  if (totalFinished > 0) {
    capB = ((stats.hits['B'] || 0) / totalFinished) * C_scale;
    capC = ((stats.hits['C'] || 0) / totalFinished) * C_scale;
    capSub = ((stats.hits['SUB'] || 0) / totalFinished) * C_scale;
  }

  // 对应更新
  if (masterId === 'A') {
    document.getElementById('cap-master-b').innerText = `${capB.toFixed(3)} pF`;
    document.getElementById('cap-master-c').innerText = `${capC.toFixed(3)} pF`;
    document.getElementById('cap-master-sub').innerText = `${capSub.toFixed(3)} pF`;
  } else if (masterId === 'B') {
    document.getElementById('cap-master-b').innerText = `${capB.toFixed(3)} pF (A)`;
    // 重新排列显示
    const capA = ((stats.hits['A'] || 0) / totalFinished) * C_scale;
    document.getElementById('cap-master-b').innerText = `${capA.toFixed(3)} pF`;
    document.getElementById('cap-master-c').innerText = `${capC.toFixed(3)} pF`;
    document.getElementById('cap-master-sub').innerText = `${capSub.toFixed(3)} pF`;
  } else {
    // masterId === 'C'
    const capA = ((stats.hits['A'] || 0) / totalFinished) * C_scale;
    document.getElementById('cap-master-b').innerText = `${capA.toFixed(3)} pF`;
    document.getElementById('cap-master-c').innerText = `${capB.toFixed(3)} pF`;
    document.getElementById('cap-master-sub').innerText = `${capSub.toFixed(3)} pF`;
  }
}

// 可视化底部流程条激活
function updateFlowSteps(stepNum) {
  const steps = document.querySelectorAll('.flow-step');
  steps.forEach((step, idx) => {
    if (idx + 1 === stepNum) {
      step.classList.add('active');
    } else {
      step.classList.remove('active');
    }
  });
}

// 7. 事件绑定与参数响应
function setupEventListeners() {
  // 7.1 主导体切换
  const masterRadios = document.querySelectorAll('input[name="master-conductor"]');
  masterRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      masterId = e.target.value;
      
      // 更新导体的电压状态
      conductors.forEach(c => {
        c.voltage = c.id === masterId ? 1 : 0;
      });

      // 重新设置主导体电容估计标签
      updateCapacitanceLabels();

      // 重置单次路径与动画
      currentWalk.status = 'idle';
      currentWalk.points = [];
      
      // 真实算法中改变主导体需要清空或者属于新的统计集
      // 顺滑体验：自动清空统计，让用户看新的主导体的采样统计
      clearStats();
      initNewWalk();
      draw();
    });
  });

  // 7.2 单步、重置、自动游走
  document.getElementById('btn-step').addEventListener('click', () => {
    if (isAutoWalking) {
      isAutoWalking = false;
      document.getElementById('btn-auto').innerHTML = '<span>▶</span> 自动游走';
    }
    updateFlowSteps(2); // 避障与构造
    singleHop();
    draw();
  });

  document.getElementById('btn-reset-walk').addEventListener('click', () => {
    initNewWalk();
    draw();
  });

  document.getElementById('btn-auto').addEventListener('click', () => {
    isAutoWalking = !isAutoWalking;
    const btn = document.getElementById('btn-auto');
    if (isAutoWalking) {
      btn.innerHTML = '<span>⏸</span> 暂停';
      btn.classList.add('btn-primary');
      autoWalkLoop();
    } else {
      btn.innerHTML = '<span>▶</span> 自动游走';
      btn.classList.remove('btn-primary');
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    }
  });

  // 7.3 批量采样
  document.getElementById('btn-batch').addEventListener('click', () => {
    // 暂停自动游走以保证计算流畅
    if (isAutoWalking) {
      isAutoWalking = false;
      document.getElementById('btn-auto').innerHTML = '<span>▶</span> 自动游走';
      document.getElementById('btn-auto').classList.remove('btn-primary');
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    }

    // 显示加载态
    const btn = document.getElementById('btn-batch');
    const originalText = btn.innerHTML;
    btn.innerText = '计算中...';
    btn.disabled = true;

    // 分批次异步执行，防止大计算量冻结浏览器 UI
    setTimeout(() => {
      const size = settings.batchSize;
      for (let i = 0; i < size; i++) {
        runWalkToFinish();
      }
      btn.innerHTML = originalText;
      btn.disabled = false;
      
      initNewWalk();
      updateFlowSteps(5); // 命中并统计
      draw();
      updateUIStats();
    }, 50);
  });

  // 7.4 清空统计
  document.getElementById('btn-clear').addEventListener('click', () => {
    clearStats();
    initNewWalk();
    draw();
  });

  // 7.5 滑块同步
  const sliderBatch = document.getElementById('slider-batch');
  sliderBatch.addEventListener('input', (e) => {
    settings.batchSize = parseInt(e.target.value);
    document.getElementById('val-batch').innerText = settings.batchSize;
  });

  const sliderSpeed = document.getElementById('slider-speed');
  sliderSpeed.addEventListener('input', (e) => {
    settings.speed = parseInt(e.target.value);
    document.getElementById('val-speed').innerText = settings.speed;
  });

  const sliderThreshold = document.getElementById('slider-threshold');
  sliderThreshold.addEventListener('input', (e) => {
    settings.stoppingThreshold = parseInt(e.target.value);
    document.getElementById('val-threshold').innerText = `${settings.stoppingThreshold}px`;
  });

  // 7.6 开关同步
  const checkCube = document.getElementById('check-cube');
  checkCube.addEventListener('change', (e) => {
    settings.showCube = e.target.checked;
    draw();
  });

  const checkRecent = document.getElementById('check-recent');
  checkRecent.addEventListener('change', (e) => {
    settings.recentOnly = e.target.checked;
    // 裁剪历史路径
    const limit = settings.recentOnly ? 5 : 100;
    if (historyWalks.length > limit) {
      historyWalks = historyWalks.slice(-limit);
    }
    draw();
  });
}

function clearStats() {
  stats.total = 0;
  stats.totalHops = 0;
  stats.hits = { A: 0, B: 0, C: 0, SUB: 0, unfinished: 0 };
  historyWalks = [];
  updateUIStats();
}

// 动态修正电容估计项的标注
function updateCapacitanceLabels() {
  const lblB = document.getElementById('lbl-cap-b');
  const lblC = document.getElementById('lbl-cap-c');
  const lblSub = document.getElementById('lbl-cap-sub');

  if (masterId === 'A') {
    lblB.innerText = 'C_AB (耦合电容 B):';
    lblC.innerText = 'C_AC (耦合电容 C):';
    lblSub.innerText = 'C_A_sub (地电容 Sub):';
  } else if (masterId === 'B') {
    lblB.innerText = 'C_BA (耦合电容 A):';
    lblC.innerText = 'C_BC (耦合电容 C):';
    lblSub.innerText = 'C_B_sub (地电容 Sub):';
  } else {
    // C
    lblB.innerText = 'C_CA (耦合电容 A):';
    lblC.innerText = 'C_CB (耦合电容 B):';
    lblSub.innerText = 'C_C_sub (地电容 Sub):';
  }
}

// 8. 窗口尺寸自适应 (Canvas 保持 600x400 比例，响应式拉伸)
function handleResize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const displayWidth = Math.max(320, Math.floor(rect.width));
  
  // 逻辑坐标保持 600x400，CSS 显示也保持 3:2。内部像素只按同一个比例和 DPR 放大，
  // 避免 x/y 非等比缩放把 Canvas 文字竖向拉伸。
  const scale = (displayWidth * dpr) / CANVAS_WIDTH;
  canvas.width = Math.floor(CANVAS_WIDTH * scale);
  canvas.height = Math.floor(CANVAS_HEIGHT * scale);
  canvas._scale = scale;
  
  draw();
}

// 9. 启动入口
window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('frw-canvas');
  ctx = canvas.getContext('2d');

  setupEventListeners();
  handleResize();
  window.addEventListener('resize', handleResize);

  // 初始化并展示
  initNewWalk();
  updateCapacitanceLabels();
  updateUIStats();
  draw();
});
