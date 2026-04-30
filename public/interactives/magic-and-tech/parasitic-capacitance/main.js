import { CapacitanceScene } from './scene.js';
import { CONSTANTS, calculateCapacitance } from './calculations.js';

let scene;
let state = {};

function init() {
    scene = new CapacitanceScene('viewport-container', 'labels-container');
    
    bindControls();
    bindViewButtons();
    
    updateStateFromUI();
}

function bindControls() {
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', (e) => {
            if (e.target.type === 'range') {
                document.getElementById('disp-' + e.target.id.replace('inp-', '')).textContent = parseFloat(e.target.value).toFixed(2);
            }
            updateStateFromUI();
        });
        
        // Initialize displays
        if (input.type === 'range') {
            const disp = document.getElementById('disp-' + input.id.replace('inp-', ''));
            if (disp) disp.textContent = parseFloat(input.value).toFixed(2);
        }
    });
}

function bindViewButtons() {
    document.getElementById('btn-top-view').addEventListener('click', () => scene.setView('top'));
    document.getElementById('btn-cross-view').addEventListener('click', () => scene.setView('cross'));
    document.getElementById('btn-3d-view').addEventListener('click', () => scene.setView('3d'));
    document.getElementById('btn-reset-view').addEventListener('click', () => scene.setView('3d'));
}

function updateStateFromUI() {
    state = {
        // Geometry
        L_A: parseFloat(document.getElementById('inp-L_A').value),
        W_A: parseFloat(document.getElementById('inp-W_A').value),
        L_M1: parseFloat(document.getElementById('inp-L_M1').value),
        W_M1: parseFloat(document.getElementById('inp-W_M1').value),
        x_M1: parseFloat(document.getElementById('inp-x_M1').value),
        y_M1: parseFloat(document.getElementById('inp-y_M1').value),
        
        // Distances
        d_sub_m1: parseFloat(document.getElementById('inp-d_sub_m1').value),
        d_m1_m2: parseFloat(document.getElementById('inp-d_m1_m2').value),

        // Shared halo
        halo: parseFloat(document.getElementById('inp-halo').value),
        
        // Neighbors
        show_B1: document.getElementById('show-B1').checked,
        sep_B1: parseFloat(document.getElementById('inp-sep_B1').value),
        y_B1: parseFloat(document.getElementById('inp-y_B1').value),
        L_B1: parseFloat(document.getElementById('inp-L_B1').value),
        
        show_B2: document.getElementById('show-B2').checked,
        sep_B2: parseFloat(document.getElementById('inp-sep_B2').value),
        y_B2: parseFloat(document.getElementById('inp-y_B2').value),
        L_B2: parseFloat(document.getElementById('inp-L_B2').value),
        
        // Visibility
        show_M1: document.getElementById('show-M1').checked,
        show_area_lines: document.getElementById('show-area-lines').checked,
        show_fringe_lines: document.getElementById('show-fringe-lines').checked,
        show_sidewall_lines: document.getElementById('show-sidewall-lines').checked,
        show_halo: document.getElementById('show-halo').checked
    };
    
    // Calculate
    const results = calculateCapacitance(state);
    
    // Update Results UI
    document.getElementById('val-c-area-sub').textContent = results.C_area_sub.toFixed(2);
    document.getElementById('val-c-area-m1').textContent = results.C_area_m1.toFixed(2);
    document.getElementById('val-c-fringe-sub').textContent = results.C_fringe_sub.toFixed(2);
    document.getElementById('val-c-fringe-m1').textContent = results.C_fringe_m1.toFixed(2);
    document.getElementById('val-c-sidewall-total').textContent = results.C_sidewall_total.toFixed(2);
    document.getElementById('val-c-total').textContent = results.C_total.toFixed(2);
    
    updateSidewallTable(results.sidewall_segments);
    updateFormulaPanel(results);
    
    // Update Scene
    scene.update(state, results);
}

function updateFormulaPanel(results) {
    const set = (id, value, digits = 2) => {
        const el = document.getElementById(id);
        if (el) el.textContent = Number(value).toFixed(digits);
    };

    set('formula-eps0', CONSTANTS.EPS0_AF_PER_UM, 3);
    set('formula-k-sub', CONSTANTS.K_SUB_M2, 2);
    set('formula-k-m1', CONSTANTS.K_M1_M2, 2);
    set('formula-cperim-sub', CONSTANTS.CPERIM_SUB, 2);
    set('formula-cperim-m1', CONSTANTS.CPERIM_M1, 2);
    set('formula-ccoup0', CONSTANTS.CCOUP0, 2);
    set('formula-offset', CONSTANTS.SIDEWALL_OFFSET, 2);
    set('formula-alpha0', CONSTANTS.ALPHA0, 3);
    set('formula-t-m2', CONSTANTS.T_M2, 2);
    set('formula-d-sub-m2', results.d_sub_m2, 2);
    set('formula-carea-sub', results.Carea_sub_density, 2);
    set('formula-alpha-sub', results.alpha_sub, 3);
    set('formula-carea-m1', results.Carea_m1_density, 2);
    set('formula-alpha-m1', results.alpha_m1, 3);
    set('formula-overlap', results.A_overlap_M1, 2);
    set('formula-unshielded', results.A_unshielded, 2);
}

function updateSidewallTable(segments) {
    const tbody = document.querySelector('#sidewall-table tbody');
    tbody.innerHTML = '';
    
    if (segments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No valid opposing edges in halo</td></tr>';
        return;
    }
    
    segments.forEach(seg => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${seg.index}</td>
            <td>${seg.neighborId}</td>
            <td>${seg.length.toFixed(2)}</td>
            <td>${seg.sep.toFixed(2)}</td>
            <td>${seg.c_sw.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Start app
window.onload = init;
