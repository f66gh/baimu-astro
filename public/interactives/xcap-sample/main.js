import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const els = {
    viewport: document.getElementById('viewport'),
    canvas: document.getElementById('scene-canvas'),
    dropZone: document.getElementById('drop-zone'),
    chooseEmpty: document.getElementById('choose-file-empty'),
    chooseSidebar: document.getElementById('choose-file-sidebar'),
    fileInput: document.getElementById('file-input'),
    viewControls: document.getElementById('view-controls'),
    resetView: document.getElementById('reset-view'),
    hoverInspector: document.getElementById('hover-inspector'),
    hoverContent: document.getElementById('hover-content'),
    labelsLayer: document.getElementById('labels-layer'),
    errorPanel: document.getElementById('error-panel'),
    sampleInfo: document.getElementById('sample-info'),
    activatedSelect: document.getElementById('activated-conductor'),
    activationInfo: document.getElementById('activation-info'),
    qualityInfo: document.getElementById('quality-info'),
    matrixTable: document.getElementById('matrix-table'),
    referenceTable: document.getElementById('reference-table'),
    beolTable: document.getElementById('beol-table'),
    mediaTable: document.getElementById('media-table'),
    toggles: {
        dielectricColors: document.getElementById('toggle-dielectric-colors'),
        dielectricLabels: document.getElementById('toggle-dielectric-labels'),
        interlayerBoundaries: document.getElementById('toggle-interlayer-boundaries'),
        fieldLines: document.getElementById('toggle-field-lines'),
        axis: document.getElementById('toggle-axis'),
        ground: document.getElementById('toggle-ground'),
        conductorLabels: document.getElementById('toggle-conductor-labels'),
        layerLabels: document.getElementById('toggle-layer-labels'),
        transparentConductors: document.getElementById('toggle-transparent-conductors'),
        hover: document.getElementById('toggle-hover')
    }
};

const state = {
    model: null,
    activatedId: null,
    matrixHover: null,
    isDragging: false,
    hoveredObject: null
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(window.matchMedia('(prefers-color-scheme: dark)').matches ? 0x11151b : 0xe8ecf2);

const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: els.canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groups = {
    conductors: new THREE.Group(),
    media: new THREE.Group(),
    interlayers: new THREE.Group(),
    fieldLines: new THREE.Group(),
    fieldMarkers: [],
    helpers: new THREE.Group(),
    labels: []
};

scene.add(groups.media, groups.interlayers, groups.conductors, groups.fieldLines, groups.helpers);
scene.add(new THREE.AmbientLight(0xffffff, 0.74));
const sun = new THREE.DirectionalLight(0xffffff, 0.82);
sun.position.set(6, 12, 8);
scene.add(sun);

const materials = {
    ground: new THREE.MeshLambertMaterial({ color: 0x424955, transparent: true, opacity: 0.86 }),
    active: new THREE.MeshLambertMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.96 }),
    conductor: new THREE.MeshLambertMaterial({ color: 0x3284ff, transparent: true, opacity: 0.84 }),
    conductorTransparent: new THREE.MeshLambertMaterial({ color: 0x3284ff, transparent: true, opacity: 0.38 }),
    media: new THREE.MeshBasicMaterial({ color: 0x9fd3ff, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }),
    boundary: new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.58 }),
    field: new THREE.LineBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.78 }),
    axisX: new THREE.LineBasicMaterial({ color: 0xef4444 }),
    axisY: new THREE.LineBasicMaterial({ color: 0x22c55e }),
    axisZ: new THREE.LineBasicMaterial({ color: 0x3b82f6 })
};

const colorRamp = [0x8dd3c7, 0xffffb3, 0xbebada, 0xfb8072, 0x80b1d3, 0xfdb462, 0xb3de69, 0xfccde5, 0xbc80bd, 0xccebc5, 0xffed6f];

init();
window.__xcapDebug = {
    fieldMarkerCount: () => groups.fieldMarkers.length,
    fieldMarkerPositions: () => groups.fieldMarkers.map((marker) => marker.position.toArray().map((value) => Number(value.toFixed(4)))),
    interlayerNames: () => state.model?.interlayers.map((region) => region.kind === 'above-top' ? region.name : `L${region.index}: ${region.name}`) || []
};

function init() {
    resizeRenderer();
    window.addEventListener('resize', resizeRenderer);

    els.chooseEmpty.addEventListener('click', () => els.fileInput.click());
    els.chooseSidebar.addEventListener('click', () => els.fileInput.click());
    els.fileInput.addEventListener('change', (event) => {
        const [file] = event.target.files || [];
        if (file) importFile(file);
        els.fileInput.value = '';
    });

    ['dragenter', 'dragover'].forEach((type) => {
        els.viewport.addEventListener(type, (event) => {
            event.preventDefault();
            els.dropZone.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach((type) => {
        els.viewport.addEventListener(type, (event) => {
            event.preventDefault();
            els.dropZone.classList.remove('drag-over');
        });
    });

    els.viewport.addEventListener('drop', (event) => {
        const [file] = event.dataTransfer.files || [];
        if (file) importFile(file);
    });

    els.resetView.addEventListener('click', fitCameraToModel);
    els.activatedSelect.addEventListener('change', () => {
        state.activatedId = els.activatedSelect.value;
        renderAll();
    });

    Object.values(els.toggles).forEach((toggle) => toggle.addEventListener('change', renderAll));

    renderer.domElement.addEventListener('pointerdown', () => {
        state.isDragging = true;
    });
    window.addEventListener('pointerup', () => {
        state.isDragging = false;
    });
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    animate();
}

async function importFile(file) {
    clearError();
    try {
        const text = await file.text();
        let raw;
        try {
            raw = JSON.parse(text);
        } catch {
            throw new Error('Invalid JSON. Please import a valid XCap sample JSON file.');
        }
        validateSample(raw);
        state.model = buildModel(raw);
        state.activatedId = state.model.conductors[0]?.id || null;
        state.matrixHover = null;
        camera.userData.fitted = false;
        renderAll();
    } catch (error) {
        showError(error.message || 'Could not import this sample.');
    }
}

function validateSample(raw) {
    const required = [
        ['layout', 'conductors'],
        ['process_stack', 'beol_layers'],
        ['process_stack', 'plate_media'],
        ['label', 'matrix_order'],
        ['label', 'capacitance', 'maxwell_matrix']
    ];
    for (const path of required) {
        let cursor = raw;
        for (const key of path) cursor = cursor?.[key];
        if (!Array.isArray(cursor)) {
            throw new Error(`Schema mismatch. Missing required array: ${path.join('.')}.`);
        }
    }
    if (!raw.layout.conductors.length) throw new Error('Schema mismatch. layout.conductors must contain at least one conductor.');
}

function buildModel(raw) {
    const beolLayers = raw.process_stack.beol_layers.map((layer) => ({
        ...layer,
        used: false
    })).sort((a, b) => a.order - b.order);

    const layerByName = new Map(beolLayers.map((layer) => [layer.name, layer]));
    const conductors = raw.layout.conductors.map((conductor) => {
        const blocks = (conductor.blocks || []).map((block) => {
            const layer = layerByName.get(block.layer_ref);
            if (layer) layer.used = true;
            return {
                conductorId: conductor.conductor_id,
                conductorNet: conductor.net_name,
                id: block.block_id,
                processDomain: block.process_domain,
                layerRef: block.layer_ref,
                geometry: block.geometry,
                layer
            };
        });
        return {
            id: conductor.conductor_id,
            netName: conductor.net_name,
            blocks
        };
    });

    const rawWindowBox = raw.layout.window;
    const metalLayerRange = deriveMetalLayerRange(beolLayers, conductors, rawWindowBox);
    const windowBox = {
        ...rawWindowBox,
        z_min: metalLayerRange.zMin,
        z_max: metalLayerRange.zMax,
        z_span_um: metalLayerRange.zMax - metalLayerRange.zMin,
        volume_um3: rawWindowBox.xy_area_um2
            ? rawWindowBox.xy_area_um2 * (metalLayerRange.zMax - metalLayerRange.zMin)
            : rawWindowBox.volume_um3
    };
    const plateMedia = raw.process_stack.plate_media.map((medium, index) => ({
        ...medium,
        index,
        clipped: clipRange(medium.z_bottom, medium.z_top, windowBox.z_min, windowBox.z_max)
    })).filter((medium) => medium.clipped);
    const interlayers = deriveInterlayers(raw.process_stack.substrate_reference, beolLayers, windowBox, metalLayerRange);
    const matrixOrder = raw.label.matrix_order.map((entry) => ({
        index: entry.index,
        conductorId: entry.conductor_id,
        blockId: entry.block_id,
        layerRef: entry.layer_ref
    })).sort((a, b) => a.index - b.index);
    const matrix = raw.label.capacitance.maxwell_matrix;
    const referenceRows = buildReferenceRows(raw.label.capacitance.block_reference_capacitance || []);

    return {
        raw,
        sampleId: raw.sample_id,
        dataset: raw.dataset || {},
        pdk: raw.process_stack.metadata?.pdk || raw.layout.process?.pdk || {},
        units: {
            length: raw.layout.units?.length || raw.process_stack.units?.length || 'um',
            capacitance: raw.label.units?.capacitance || raw.process_stack.units?.capacitance || 'fF'
        },
        windowBox,
        substrate: raw.process_stack.substrate_reference,
        conductors,
        beolLayers,
        metalLayerRange,
        plateMedia,
        interlayers,
        matrixOrder,
        matrix,
        referenceRows,
        quality: raw.label.quality_summary || {},
        hasGround: Boolean(raw.layout.window?.contains_substrate_reference),
        scale: computeScale(windowBox)
    };
}

function deriveMetalLayerRange(beolLayers, conductors, windowBox) {
    const sorted = [...beolLayers].sort((a, b) => a.order - b.order);
    if (!sorted.length) {
        return {
            bottomLayer: null,
            topLayer: null,
            zMin: windowBox.z_min,
            zMax: windowBox.z_max,
            label: 'Window range'
        };
    }
    const usedOrders = conductors
        .flatMap((conductor) => conductor.blocks.map((block) => block.layer?.order))
        .filter((order) => Number.isFinite(order));
    const minUsed = usedOrders.length ? Math.min(...usedOrders) : sorted[0].order;
    const maxUsed = usedOrders.length ? Math.max(...usedOrders) : sorted[sorted.length - 1].order;
    const bottomOrder = Math.max(sorted[0].order, minUsed - 2);
    const topOrder = Math.min(sorted[sorted.length - 1].order, maxUsed + 2);
    const bottomLayer = sorted.find((layer) => layer.order >= bottomOrder) || sorted[0];
    const topLayer = [...sorted].reverse().find((layer) => layer.order <= topOrder) || sorted[sorted.length - 1];
    const hasGroundContext = Boolean(windowBox?.contains_substrate_reference) && bottomLayer.order === sorted[0].order;
    const bottomLabel = hasGroundContext ? 'GROUND' : bottomLayer.name;
    const zMin = hasGroundContext ? Math.min(windowBox.z_min, bottomLayer.z_bottom) : bottomLayer.z_bottom;
    return {
        bottomLayer,
        topLayer,
        bottomOrder: bottomLayer.order,
        topOrder: topLayer.order,
        zMin,
        zMax: topLayer.z_top,
        label: `${bottomLabel} to ${topLayer.name}`
    };
}

function deriveInterlayers(substrate, beolLayers, windowBox, metalLayerRange) {
    const regions = [];
    const sorted = [...beolLayers]
        .filter((layer) => {
            if (!metalLayerRange?.bottomLayer || !metalLayerRange?.topLayer) return true;
            return layer.order >= metalLayerRange.bottomLayer.order && layer.order <= metalLayerRange.topLayer.order;
        })
        .sort((a, b) => a.order - b.order);
    if (!sorted.length) return regions;
    const first = sorted[0];
    const hasGroundContext = Boolean(windowBox?.contains_substrate_reference) && first.order === beolLayers[0]?.order;
    const lowerRef = hasGroundContext ? (substrate?.reference_name || 'GROUND') : `${first.name} base`;
    const pushRegion = (region) => {
        const clipped = clipRange(region.zBottom, region.zTop, windowBox.z_min, windowBox.z_max);
        if (clipped) regions.push({ ...region, zBottom: clipped.bottom, zTop: clipped.top, clipped });
    };
    pushRegion({
        index: 0,
        name: `${lowerRef} to ${first.name}`,
        lowerRef,
        upperRef: first.name,
        zBottom: windowBox.z_min ?? 0,
        zTop: first.z_top,
        kind: 'interlayer'
    });
    for (let i = 0; i < sorted.length - 1; i += 1) {
        const lower = sorted[i];
        const upper = sorted[i + 1];
        pushRegion({
            index: i + 1,
            name: `${lower.name} to ${upper.name}`,
            lowerRef: lower.name,
            upperRef: upper.name,
            zBottom: lower.z_top,
            zTop: upper.z_top,
            kind: 'interlayer'
        });
    }
    const topLayer = sorted[sorted.length - 1];
    pushRegion({
        index: sorted.length,
        name: `Above ${topLayer.name}`,
        lowerRef: topLayer.name,
        upperRef: 'WINDOW_TOP',
        zBottom: topLayer.z_top,
        zTop: windowBox.z_max,
        kind: 'above-top'
    });
    return regions;
}

function clipRange(bottom, top, windowBottom, windowTop) {
    const clippedBottom = Math.max(bottom, windowBottom);
    const clippedTop = Math.min(top, windowTop);
    if (!(clippedTop > clippedBottom)) return null;
    return { bottom: clippedBottom, top: clippedTop, thickness: clippedTop - clippedBottom };
}

function buildReferenceRows(referenceCaps) {
    const refs = new Set();
    const rows = referenceCaps.map((row) => {
        const values = {};
        for (const ref of row.reference_breakdown || []) {
            refs.add(ref.reference_id);
            values[ref.reference_id] = ref.capacitance;
        }
        return {
            conductorId: row.conductor_id,
            blockId: row.block_id,
            total: row.total_to_references,
            values
        };
    });
    return { refs: [...refs].sort(), rows };
}

function computeScale(box) {
    const span = Math.max(box.x_span_um || box.x_max - box.x_min, box.y_span_um || box.y_max - box.y_min, box.z_span_um || box.z_max - box.z_min, 1);
    return Math.min(18 / span, 6);
}

function renderAll() {
    if (!state.model) return;
    els.dropZone.classList.add('hidden');
    els.viewControls.classList.remove('hidden');
    els.activatedSelect.disabled = false;
    renderScene();
    renderSidebar();
}

function renderScene() {
    clearGroup(groups.conductors);
    clearGroup(groups.media);
    clearGroup(groups.interlayers);
    clearGroup(groups.fieldLines);
    groups.fieldMarkers = [];
    clearGroup(groups.helpers);
    clearLabels();

    const model = state.model;
    renderMedia(model);
    renderInterlayers(model);
    renderGround(model);
    renderConductors(model);
    renderFieldLines(model);
    renderAxis(model);
    fitCameraToModel(false);
}

function renderMedia(model) {
    if (!els.toggles.dielectricColors.checked) return;
    for (const medium of model.plateMedia) {
        const height = Math.max(0.002, medium.clipped.thickness);
        const size = windowSize(model);
        const geometry = new THREE.BoxGeometry(size.x, height * model.scale, size.y);
        const material = materials.media.clone();
        material.color = new THREE.Color(colorRamp[medium.index % colorRamp.length]);
        material.opacity = 0.10 + Math.min(0.12, Math.max(0, (medium.diel || 3.9) - 3) * 0.018);
        const mesh = new THREE.Mesh(geometry, material);
        const center = toScene(model, centerOfWindow(model).x, centerOfWindow(model).y, (medium.clipped.bottom + medium.clipped.top) / 2);
        mesh.position.copy(center);
        mesh.userData = { kind: 'medium', medium };
        groups.media.add(mesh);
        if (els.toggles.dielectricLabels.checked) addLabel(medium.name, new THREE.Vector3(center.x, center.y, center.z), 'medium');
    }
}

function renderInterlayers(model) {
    if (!els.toggles.interlayerBoundaries.checked) return;
    const size = windowSize(model);
    for (const region of model.interlayers) {
        const bottom = region.zBottom;
        const top = region.zTop;
        drawBoundaryPlane(model, size, bottom, `L${region.index} bottom`);
        drawBoundaryPlane(model, size, top, `L${region.index} top`);
        if (els.toggles.layerLabels.checked) {
            const pos = toScene(model, model.windowBox.x_min, model.windowBox.y_min, (bottom + top) / 2);
            addLabel(region.kind === 'above-top' ? region.name : `L${region.index}: ${region.name}`, pos, 'interlayer');
        }
    }
}

function drawBoundaryPlane(model, size, z, label) {
    const cx = centerOfWindow(model).x;
    const cy = centerOfWindow(model).y;
    const y = (z - model.windowBox.z_min) * model.scale;
    const x0 = (model.windowBox.x_min - cx) * model.scale;
    const x1 = (model.windowBox.x_max - cx) * model.scale;
    const z0 = -(model.windowBox.y_min - cy) * model.scale;
    const z1 = -(model.windowBox.y_max - cy) * model.scale;
    const points = [
        new THREE.Vector3(x0, y, z0),
        new THREE.Vector3(x1, y, z0),
        new THREE.Vector3(x1, y, z1),
        new THREE.Vector3(x0, y, z1),
        new THREE.Vector3(x0, y, z0)
    ];
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), materials.boundary);
    line.userData = { kind: 'interlayer-boundary', label };
    groups.interlayers.add(line);
}

function renderGround(model) {
    if (!els.toggles.ground.checked || !model.hasGround) return;
    const size = windowSize(model);
    const geometry = new THREE.BoxGeometry(size.x, Math.max(0.04, 0.08 * model.scale), size.y);
    const mesh = new THREE.Mesh(geometry, materials.ground);
    const center = toScene(model, centerOfWindow(model).x, centerOfWindow(model).y, model.windowBox.z_min);
    mesh.position.set(center.x, center.y - 0.05, center.z);
    mesh.userData = { kind: 'ground', substrate: model.substrate };
    groups.helpers.add(mesh);
    if (els.toggles.layerLabels.checked) addLabel(model.substrate?.reference_name || 'GROUND', mesh.position.clone().add(new THREE.Vector3(0, 0.16, 0)), 'ground');
}

function renderConductors(model) {
    for (const conductor of model.conductors) {
        for (const block of conductor.blocks) {
            const g = block.geometry;
            const geometry = new THREE.BoxGeometry(
                Math.max(0.02, (g.x_max - g.x_min) * model.scale),
                Math.max(0.02, (g.z_top - g.z_bottom) * model.scale),
                Math.max(0.02, (g.y_max - g.y_min) * model.scale)
            );
            const isActive = conductor.id === state.activatedId;
            const material = isActive ? materials.active.clone() : (els.toggles.transparentConductors.checked ? materials.conductorTransparent.clone() : materials.conductor.clone());
            if (isActive && els.toggles.transparentConductors.checked) material.opacity = 0.68;
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(toScene(model, (g.x_min + g.x_max) / 2, (g.y_min + g.y_max) / 2, (g.z_bottom + g.z_top) / 2));
            mesh.userData = { kind: 'conductor', conductor, block };
            groups.conductors.add(mesh);
            if (els.toggles.conductorLabels.checked) {
                addLabel(conductor.id, mesh.position.clone().add(new THREE.Vector3(0, geometry.parameters.height / 2 + 0.14, 0)), 'conductor');
            }
        }
    }
}

function renderFieldLines(model) {
    if (!els.toggles.fieldLines.checked || !state.activatedId) return;
    const active = model.conductors.find((c) => c.id === state.activatedId);
    if (!active?.blocks[0]) return;
    const activeIndex = matrixIndexForConductor(model, state.activatedId);
    const couplings = model.matrix[activeIndex] || [];
    const targets = allocateFieldTargets(model, active, couplings);
    let lineOrdinal = 0;
    for (const target of targets) {
        for (let i = 0; i < target.count; i += 1) {
            const t = (i + 0.5) / target.count;
            const sourcePoint = pointOnBlockSurface(model, active.blocks[i % active.blocks.length], t, lineOrdinal);
            const targetPoint = target.kind === 'ground'
                ? new THREE.Vector3(sourcePoint.x, -0.05, sourcePoint.z + (i - target.count / 2) * 0.08)
                : pointOnBlockSurface(model, target.conductor.blocks[i % target.conductor.blocks.length], 1 - t, lineOrdinal + 3);
            const lift = 0.32 + target.weight * 0.72 + (lineOrdinal % 3) * 0.08;
            const side = ((lineOrdinal % 5) - 2) * 0.08;
            const mid = sourcePoint.clone().lerp(targetPoint, 0.5).add(new THREE.Vector3(side, lift, -side));
            drawCurve(sourcePoint, mid, targetPoint, target.kind === 'ground' ? 0x475569 : 0x7c3aed, 0.42 + target.weight * 0.48, lineOrdinal);
            lineOrdinal += 1;
        }
    }
}

function allocateFieldTargets(model, active, couplings) {
    const entries = [];
    for (const conductor of model.conductors) {
        if (conductor.id === active.id || !conductor.blocks[0]) continue;
        const index = matrixIndexForConductor(model, conductor.id);
        const magnitude = Math.abs(couplings[index] || 0);
        if (magnitude > 0) entries.push({ kind: 'conductor', conductor, magnitude });
    }
    const refRow = model.referenceRows.rows.find((row) => row.conductorId === active.id);
    const groundMagnitude = model.hasGround && els.toggles.ground.checked ? Math.abs(refRow?.values?.GROUND || 0) : 0;
    if (groundMagnitude > 0) entries.push({ kind: 'ground', magnitude: groundMagnitude });
    const total = entries.reduce((sum, entry) => sum + entry.magnitude, 0) || 1;
    const maxLines = 26;
    return entries
        .map((entry) => ({
            ...entry,
            weight: entry.magnitude / Math.max(...entries.map((item) => item.magnitude), entry.magnitude),
            count: Math.max(1, Math.round((entry.magnitude / total) * maxLines))
        }))
        .sort((a, b) => b.magnitude - a.magnitude);
}

function drawCurve(p1, p2, p3, color, opacity, ordinal = 0) {
    const curve = new THREE.QuadraticBezierCurve3(p1, p2, p3);
    const points = curve.getPoints(36);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
    line.userData = { kind: 'field-line', curve };
    groups.fieldLines.add(line);
    const marker = makeFieldMarker(color);
    marker.userData = {
        kind: 'field-marker',
        curve,
        phase: (ordinal * 0.137) % 1
    };
    groups.fieldLines.add(marker);
    groups.fieldMarkers.push(marker);
}

function makeFieldMarker(color) {
    const geometry = new THREE.ConeGeometry(0.045, 0.14, 3);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 });
    const marker = new THREE.Mesh(geometry, material);
    marker.rotation.x = Math.PI / 2;
    return marker;
}

function renderAxis(model) {
    if (!els.toggles.axis.checked) return;
    const size = Math.min(2.2, Math.max(1.1, Math.max(windowSize(model).x, windowSize(model).y) * 0.10));
    const origin = new THREE.Vector3(-windowSize(model).x / 2 + 0.5, 0.2, windowSize(model).y / 2 - 0.5);
    addAxisLine(origin, new THREE.Vector3(origin.x + size, origin.y, origin.z), materials.axisX, 'X');
    addAxisLine(origin, new THREE.Vector3(origin.x, origin.y, origin.z - size), materials.axisY, 'Y');
    addAxisLine(origin, new THREE.Vector3(origin.x, origin.y + size, origin.z), materials.axisZ, 'Z');
}

function addAxisLine(from, to, material, label) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), material);
    groups.helpers.add(line);
    addLabel(label, to, 'axis');
}

function renderSidebar() {
    const model = state.model;
    renderSampleInfo(model);
    renderActivation(model);
    renderQuality(model);
    renderMatrix(model);
    renderReferenceTable(model);
    renderBeolTable(model);
    renderMediaTable(model);
    els.hoverInspector.classList.toggle('hidden', !els.toggles.hover.checked);
}

function renderSampleInfo(model) {
    const box = model.windowBox;
    els.sampleInfo.classList.remove('muted');
    els.sampleInfo.innerHTML = infoRows([
        ['Sample ID', model.sampleId],
        ['Dataset', model.dataset.dataset_id],
        ['Split', model.dataset.split],
        ['PDK', model.pdk.name],
        ['Process Node', model.pdk.process_node],
        ['Stack', model.pdk.stack_configuration],
        ['Corner', model.pdk.corner],
        ['Window', `${fmt(box.x_span_um)} x ${fmt(box.y_span_um)} x ${fmt(box.z_span_um)} ${model.units.length}`],
        ['Metal Layer Range', describeWindowMetalRange(model)],
        ['Conductors', model.conductors.length],
        ['Plate Media', model.plateMedia.length]
    ]);
}

function renderActivation(model) {
    els.activatedSelect.innerHTML = model.conductors.map((conductor) => `<option value="${escapeHtml(conductor.id)}">${escapeHtml(conductor.id)}</option>`).join('');
    els.activatedSelect.value = state.activatedId;
    const conductor = model.conductors.find((item) => item.id === state.activatedId);
    const layers = [...new Set((conductor?.blocks || []).map((block) => block.layerRef))].join(', ');
    els.activationInfo.classList.remove('muted');
    els.activationInfo.innerHTML = conductor ? infoRows([
        ['Conductor ID', conductor.id],
        ['Net name', conductor.netName],
        ['Layer', layers],
        ['Block count', conductor.blocks.length],
        ['Voltage', '1 V']
    ]) : 'No conductor selected.';
}

function renderQuality(model) {
    els.qualityInfo.innerHTML = infoRows([
        ['Unit', model.units.capacitance],
        ['Passed', String(model.quality.passed ?? 'unknown')],
        ['Symmetrized', String(model.quality.matrix_was_symmetrized ?? 'unknown')]
    ]);
}

function renderMatrix(model) {
    const order = model.matrixOrder;
    const activeIndex = matrixIndexForConductor(model, state.activatedId);
    let html = '<table><thead><tr><th></th>';
    html += order.map((entry, index) => `<th class="${index === activeIndex ? 'active-cell' : ''}">${escapeHtml(entry.conductorId)}</th>`).join('');
    html += '</tr></thead><tbody>';
    order.forEach((rowEntry, rowIndex) => {
        html += `<tr class="${rowIndex === activeIndex ? 'active-row' : ''}"><th class="${rowIndex === activeIndex ? 'active-cell' : ''}">${escapeHtml(rowEntry.conductorId)}</th>`;
        order.forEach((colEntry, colIndex) => {
            const value = model.matrix[rowIndex]?.[colIndex];
            const diagonal = rowIndex === colIndex ? ' diagonal' : '';
            const active = rowIndex === activeIndex || colIndex === activeIndex ? ' active-cell' : '';
            html += `<td class="matrix-cell${diagonal}${active}" data-row="${rowIndex}" data-col="${colIndex}" title="${escapeHtml(rowEntry.conductorId)} to ${escapeHtml(colEntry.conductorId)}">${fmt(value, 5)}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    els.matrixTable.classList.remove('muted');
    els.matrixTable.innerHTML = html;
    els.matrixTable.querySelectorAll('.matrix-cell').forEach((cell) => {
        cell.addEventListener('mouseenter', () => {
            state.matrixHover = {
                row: Number(cell.dataset.row),
                col: Number(cell.dataset.col)
            };
            highlightMatrixConductors();
        });
        cell.addEventListener('mouseleave', () => {
            state.matrixHover = null;
            highlightMatrixConductors();
        });
    });
}

function renderReferenceTable(model) {
    const refs = model.referenceRows.refs;
    const rows = model.referenceRows.rows;
    if (!rows.length) {
        els.referenceTable.classList.add('muted');
        els.referenceTable.textContent = 'No reference capacitance rows in this sample.';
        return;
    }
    let html = '<table><thead><tr><th>Conductor</th><th>Total</th>';
    html += refs.map((ref) => `<th>${escapeHtml(ref)}</th>`).join('');
    html += '</tr></thead><tbody>';
    rows.forEach((row) => {
        const active = row.conductorId === state.activatedId ? ' class="active-row"' : '';
        html += `<tr${active}><td>${escapeHtml(row.conductorId)}</td><td>${fmt(row.total, 5)}</td>`;
        refs.forEach((ref) => {
            html += `<td>${fmt(row.values[ref], 5)}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    els.referenceTable.classList.remove('muted');
    els.referenceTable.innerHTML = html;
}

function renderBeolTable(model) {
    let html = '<table><thead><tr><th>Name</th><th>Order</th><th>Role</th><th>Z bottom</th><th>Z top</th><th>Thickness</th><th>Window overlap</th><th>Conductors</th></tr></thead><tbody>';
    html += model.beolLayers.map((layer) => {
        const clipped = clipRange(layer.z_bottom, layer.z_top, model.windowBox.z_min, model.windowBox.z_max);
        const overlap = clipped ? `${fmt(clipped.bottom)}..${fmt(clipped.top)}` : 'Outside';
        return `<tr data-layer="${escapeHtml(layer.name)}"><td>${escapeHtml(layer.name)}</td><td>${layer.order}</td><td>${escapeHtml(layer.role)}</td><td>${fmt(layer.z_bottom)}</td><td>${fmt(layer.z_top)}</td><td>${fmt(layer.thickness_um)}</td><td>${overlap}</td><td>${layer.used ? 'Yes' : 'No'}</td></tr>`;
    }).join('');
    html += '</tbody></table>';
    els.beolTable.classList.remove('muted');
    els.beolTable.innerHTML = html;
}

function renderMediaTable(model) {
    let html = '<table><thead><tr><th>Name</th><th>Diel</th><th>Z bottom</th><th>Z top</th><th>Window range</th><th>Thickness</th><th>BEOL refs</th></tr></thead><tbody>';
    html += model.plateMedia.map((medium) => `<tr data-medium="${escapeHtml(medium.name)}"><td>${escapeHtml(medium.name)}</td><td>${fmt(medium.diel)}</td><td>${fmt(medium.z_bottom)}</td><td>${fmt(medium.z_top)}</td><td>${fmt(medium.clipped.bottom)}..${fmt(medium.clipped.top)}</td><td>${fmt(medium.clipped.thickness)}</td><td>${escapeHtml((medium.associated_beol_layer_refs || []).join(', '))}</td></tr>`).join('');
    html += '</tbody></table>';
    els.mediaTable.classList.remove('muted');
    els.mediaTable.innerHTML = html;
}

function onPointerMove(event) {
    if (!state.model || !els.toggles.hover.checked || state.isDragging) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...groups.conductors.children, ...groups.media.children, ...groups.helpers.children], false);
    const conductorHit = hits.find((hit) => hit.object.userData.kind === 'conductor');
    const mediumHit = hits.find((hit) => hit.object.userData.kind === 'medium');
    const point = hits[0]?.point || estimatePlanePoint();
    const context = inspectContext(point, conductorHit?.object.userData, mediumHit?.object.userData);
    renderHoverInspector(context);
}

function inspectContext(point, conductorData, mediumData) {
    const model = state.model;
    const layout = fromScene(model, point);
    const medium = mediumData?.medium || findMediumAtZ(model, layout.z);
    const region = findInterlayerAtZ(model, layout.z);
    if (conductorData?.kind === 'conductor') {
        const { conductor, block } = conductorData;
        return {
            type: 'Conductor',
            rows: [
                ['Conductor ID', conductor.id],
                ['Block ID', block.id],
                ['Net name', conductor.netName],
                ['BEOL Layer', block.layerRef],
                ['Interlayer Region', formatRegion(region)],
                ['Plate Medium', medium?.name || 'None'],
                ['Bounds', boundsText(block.geometry, model.units.length)],
                ['Size', `${fmt(block.geometry.width_um)} x ${fmt(block.geometry.length_um)} x ${fmt(block.geometry.thickness_um)} ${model.units.length}`],
                ['Activation', conductor.id === state.activatedId ? 'Activated at 1 V' : 'Reference conductor']
            ],
            layer: block.layerRef,
            medium: medium?.name
        };
    }
    return {
        type: medium ? 'Plate Medium' : 'Layout Window',
        rows: [
            ['Pointer', `${fmt(layout.x)} x, ${fmt(layout.y)} y, ${fmt(layout.z)} z ${model.units.length}`],
            ['Interlayer Region', formatRegion(region)],
            ['Plate Medium', medium?.name || 'None'],
            ['Dielectric constant', medium?.diel ?? 'N/A'],
            ['Z range', medium ? `${fmt(medium.z_bottom)} to ${fmt(medium.z_top)} ${model.units.length}` : 'N/A']
        ],
        medium: medium?.name
    };
}

function renderHoverInspector(context) {
    els.hoverInspector.classList.remove('hidden');
    els.hoverContent.innerHTML = `<strong>${escapeHtml(context.type)}</strong>${infoRows(context.rows)}`;
    highlightProcessRows(context.layer, context.medium);
}

function highlightProcessRows(layerName, mediumName) {
    els.beolTable.querySelectorAll('tr').forEach((row) => row.classList.toggle('active-row', !!layerName && row.dataset.layer === layerName));
    els.mediaTable.querySelectorAll('tr').forEach((row) => row.classList.toggle('active-row', !!mediumName && row.dataset.medium === mediumName));
}

function highlightMatrixConductors() {
    const ids = new Set();
    if (state.matrixHover) {
        const row = state.model.matrixOrder[state.matrixHover.row];
        const col = state.model.matrixOrder[state.matrixHover.col];
        if (row) ids.add(row.conductorId);
        if (col) ids.add(col.conductorId);
    }
    groups.conductors.children.forEach((mesh) => {
        const id = mesh.userData.conductor.id;
        const active = id === state.activatedId;
        const hovered = ids.has(id);
        mesh.material.emissive = new THREE.Color(hovered ? 0x223355 : 0x000000);
        mesh.material.opacity = active ? 0.96 : hovered ? 0.95 : (els.toggles.transparentConductors.checked ? 0.38 : 0.84);
    });
}

function findMediumAtZ(model, z) {
    return model.plateMedia.find((medium) => z >= medium.clipped.bottom && z <= medium.clipped.top);
}

function findInterlayerAtZ(model, z) {
    const epsilon = 1e-6;
    const direct = model.interlayers.find((region) => z >= region.zBottom - epsilon && z <= region.zTop + epsilon);
    if (direct) return direct;
    if (z >= model.windowBox.z_min - epsilon && z <= model.windowBox.z_max + epsilon) {
        return model.interlayers.reduce((closest, region) => {
            const distance = Math.min(Math.abs(z - region.zBottom), Math.abs(z - region.zTop));
            if (!closest || distance < closest.distance) return { region, distance };
            return closest;
        }, null)?.region;
    }
    return null;
}

function formatRegion(region) {
    if (!region) return 'Outside Layout Window';
    return region.kind === 'above-top' ? region.name : `L${region.index}: ${region.name}`;
}

function describeWindowMetalRange(model) {
    return model.metalLayerRange?.label || 'Window range';
}

function matrixIndexForConductor(model, conductorId) {
    return Math.max(0, model.matrixOrder.findIndex((entry) => entry.conductorId === conductorId));
}

function pointOnBlockSurface(model, block, t, ordinal) {
    const g = block.geometry;
    const faces = ['top', 'right', 'front', 'bottom', 'left', 'back'];
    const face = faces[ordinal % faces.length];
    const u = 0.10 + 0.80 * fractional(t * 1.618 + ordinal * 0.173);
    const v = 0.10 + 0.80 * fractional(t * 2.414 + ordinal * 0.271);
    const x = g.x_min + (g.x_max - g.x_min) * u;
    const y = g.y_min + (g.y_max - g.y_min) * u;
    const z = g.z_bottom + (g.z_top - g.z_bottom) * v;
    switch (face) {
        case 'top':
            return toScene(model, x, g.y_min + (g.y_max - g.y_min) * v, g.z_top);
        case 'bottom':
            return toScene(model, x, g.y_min + (g.y_max - g.y_min) * v, g.z_bottom);
        case 'left':
            return toScene(model, g.x_min, y, z);
        case 'right':
            return toScene(model, g.x_max, y, z);
        case 'front':
            return toScene(model, x, g.y_min, z);
        case 'back':
        default:
            return toScene(model, x, g.y_max, z);
    }
}

function fractional(value) {
    return value - Math.floor(value);
}

function toScene(model, x, y, z) {
    const center = centerOfWindow(model);
    return new THREE.Vector3(
        (x - center.x) * model.scale,
        (z - model.windowBox.z_min) * model.scale,
        -(y - center.y) * model.scale
    );
}

function fromScene(model, point) {
    const center = centerOfWindow(model);
    return {
        x: point.x / model.scale + center.x,
        y: -point.z / model.scale + center.y,
        z: point.y / model.scale + model.windowBox.z_min
    };
}

function estimatePlanePoint() {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, point);
    return point;
}

function centerOfWindow(model) {
    return {
        x: (model.windowBox.x_min + model.windowBox.x_max) / 2,
        y: (model.windowBox.y_min + model.windowBox.y_max) / 2
    };
}

function windowSize(model) {
    return {
        x: Math.max(0.5, (model.windowBox.x_max - model.windowBox.x_min) * model.scale),
        y: Math.max(0.5, (model.windowBox.y_max - model.windowBox.y_min) * model.scale),
        z: Math.max(0.5, (model.windowBox.z_max - model.windowBox.z_min) * model.scale)
    };
}

function fitCameraToModel(force = true) {
    if (!state.model) {
        camera.position.set(8, 7, 10);
        camera.lookAt(0, 0, 0);
        return;
    }
    if (!force && camera.userData.fitted) return;
    const size = windowSize(state.model);
    const radius = Math.max(size.x, size.y, size.z, 4);
    camera.position.set(radius * 0.75, radius * 0.72, radius * 1.05);
    controls.target.set(0, size.z * 0.18, 0);
    camera.lookAt(controls.target);
    controls.update();
    camera.userData.fitted = true;
}

function resizeRenderer() {
    const rect = els.viewport.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

function animate() {
    requestAnimationFrame(animate);
    updateFieldMarkers(performance.now() / 1000);
    controls.update();
    renderer.render(scene, camera);
    updateLabels();
}

function updateFieldMarkers(timeSeconds) {
    for (const marker of groups.fieldMarkers) {
        const curve = marker.userData.curve;
        if (!curve) continue;
        const t = (timeSeconds * 0.22 + marker.userData.phase) % 1;
        const point = curve.getPoint(t);
        const tangent = curve.getTangent(t).normalize();
        marker.position.copy(point);
        marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    }
}

function clearGroup(group) {
    while (group.children.length) {
        const child = group.children.pop();
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) child.material.forEach((mat) => mat.dispose?.());
        else child.material?.dispose?.();
    }
}

function addLabel(text, position, kind) {
    const el = document.createElement('div');
    el.className = `scene-label scene-label-${kind}`;
    el.textContent = text;
    els.labelsLayer.appendChild(el);
    groups.labels.push({ el, position });
}

function clearLabels() {
    els.labelsLayer.innerHTML = '';
    groups.labels = [];
}

function updateLabels() {
    if (!groups.labels.length) return;
    const rect = els.viewport.getBoundingClientRect();
    for (const label of groups.labels) {
        const projected = label.position.clone().project(camera);
        if (projected.z > 1) {
            label.el.style.display = 'none';
            continue;
        }
        label.el.style.display = 'block';
        label.el.style.left = `${(projected.x * 0.5 + 0.5) * rect.width}px`;
        label.el.style.top = `${(-projected.y * 0.5 + 0.5) * rect.height}px`;
    }
}

function showError(message) {
    els.errorPanel.textContent = message;
    els.errorPanel.classList.remove('hidden');
}

function clearError() {
    els.errorPanel.textContent = '';
    els.errorPanel.classList.add('hidden');
}

function infoRows(rows) {
    return rows.filter(([, value]) => value !== undefined && value !== null && value !== '').map(([label, value]) => `<div class="info-row"><span>${escapeHtml(label)}</span><span>${escapeHtml(String(value))}</span></div>`).join('');
}

function boundsText(g, unit) {
    return `x ${fmt(g.x_min)}..${fmt(g.x_max)}, y ${fmt(g.y_min)}..${fmt(g.y_max)}, z ${fmt(g.z_bottom)}..${fmt(g.z_top)} ${unit}`;
}

function fmt(value, digits = 3) {
    if (value === undefined || value === null || Number.isNaN(Number(value))) return '-';
    return Number(value).toFixed(digits).replace(/\.?0+$/, '');
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
