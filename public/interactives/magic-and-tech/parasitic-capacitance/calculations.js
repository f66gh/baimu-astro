export const CONSTANTS = {
    EPS0_AF_PER_UM: 8.854,
    K_SUB_M2: 3.9,
    K_M1_M2: 3.9,
    CPERIM_SUB: 16,
    CPERIM_M1: 22,
    CCOUP0: 78,
    SIDEWALL_OFFSET: 0.12,
    ALPHA0: 0.012,
    T_M1: 0.2,
    T_M2: 0.3,
    NEIGHBOR_WIDTH: 1.0
};

const EDGE_SAMPLES = 9;
const EPSILON = 0.0001;

function rectFromCenter(cx, cy, width, length) {
    return {
        x0: cx - width / 2,
        x1: cx + width / 2,
        y0: cy - length / 2,
        y1: cy + length / 2,
        width,
        length
    };
}

function overlap1D(a0, a1, b0, b1) {
    return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

function overlapArea(a, b) {
    return overlap1D(a.x0, a.x1, b.x0, b.x1) * overlap1D(a.y0, a.y1, b.y0, b.y1);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function careaDensity(distance, dielectricK) {
    return CONSTANTS.EPS0_AF_PER_UM * dielectricK / Math.max(distance, EPSILON);
}

function alphaFromCarea(carea) {
    return CONSTANTS.ALPHA0 * carea;
}

function fringeFraction(distance, alpha) {
    const x = Math.max(0, distance);
    return clamp((2 / Math.PI) * Math.atan(alpha * x), 0, 1);
}

function outwardIntervalToRect(edge, rect) {
    if (edge.side === 'right') {
        if (rect.x1 < edge.x) return null;
        return {
            near: Math.max(0, rect.x0 - edge.x),
            far: Math.max(0, rect.x1 - edge.x)
        };
    }
    if (edge.side === 'left') {
        if (rect.x0 > edge.x) return null;
        return {
            near: Math.max(0, edge.x - rect.x1),
            far: Math.max(0, edge.x - rect.x0)
        };
    }
    if (edge.side === 'top') {
        if (rect.y1 < edge.y) return null;
        return {
            near: Math.max(0, rect.y0 - edge.y),
            far: Math.max(0, rect.y1 - edge.y)
        };
    }
    if (rect.y0 > edge.y) return null;
    return {
        near: Math.max(0, edge.y - rect.y1),
        far: Math.max(0, edge.y - rect.y0)
    };
}

function edgeOverlapInterval(edge, rect, targetLength) {
    if (edge.axis === 'y') {
        const start = Math.max(-targetLength / 2, rect.y0);
        const end = Math.min(targetLength / 2, rect.y1);
        return { start, end, length: Math.max(0, end - start) };
    }
    const start = Math.max(-targetLength / 2, rect.x0);
    const end = Math.min(targetLength / 2, rect.x1);
    return { start, end, length: Math.max(0, end - start) };
}

function makeTargetEdges(targetRect) {
    return [
        { side: 'right', axis: 'y', x: targetRect.x1, y: 0, length: targetRect.length, normal: { x: 1, y: 0 } },
        { side: 'left', axis: 'y', x: targetRect.x0, y: 0, length: targetRect.length, normal: { x: -1, y: 0 } },
        { side: 'top', axis: 'x', x: 0, y: targetRect.y1, length: targetRect.width, normal: { x: 0, y: 1 } },
        { side: 'bottom', axis: 'x', x: 0, y: targetRect.y0, length: targetRect.width, normal: { x: 0, y: -1 } }
    ];
}

function nearestRightNeighborDistance(edgeY, neighbors, halo) {
    let nearest = null;
    for (const n of neighbors) {
        if (!n.show || n.sep > halo) continue;
        const nStart = n.y - n.length / 2;
        const nEnd = n.y + n.length / 2;
        if (edgeY >= nStart && edgeY <= nEnd && (!nearest || n.sep < nearest.sep)) {
            nearest = n;
        }
    }
    return nearest;
}

function sampleEdgeSubFringe(edge, state, neighbors, alphaSub) {
    let weightedFractionSum = 0;
    for (let i = 0; i < EDGE_SAMPLES; i += 1) {
        const t = EDGE_SAMPLES === 1 ? 0.5 : i / (EDGE_SAMPLES - 1);
        let lateralLimit = state.halo;
        if (edge.side === 'right') {
            const y = -state.L_A / 2 + t * state.L_A;
            const nearest = nearestRightNeighborDistance(y, neighbors, state.halo);
            if (nearest) lateralLimit = nearest.sep;
        }
        weightedFractionSum += fringeFraction(lateralLimit, alphaSub);
    }
    return weightedFractionSum / EDGE_SAMPLES;
}

function computeM1FringeForEdge(edge, m1Rect, state, alphaM1) {
    const outwardInterval = outwardIntervalToRect(edge, m1Rect);
    if (!outwardInterval || outwardInterval.near > state.halo) {
        return null;
    }

    const interval = edgeOverlapInterval(edge, m1Rect, edge.length);
    if (interval.length <= EPSILON) {
        return null;
    }

    const near = clamp(outwardInterval.near, 0, state.halo);
    const far = clamp(outwardInterval.far, 0, state.halo);
    if (far <= near + EPSILON) {
        return null;
    }

    const captureFraction = Math.max(0, fringeFraction(far, alphaM1) - fringeFraction(near, alphaM1));
    const capacitance = CONSTANTS.CPERIM_M1 * interval.length * captureFraction;

    return {
        edge: edge.side,
        distance: (near + far) / 2,
        near,
        far,
        start: interval.start,
        end: interval.end,
        length: interval.length,
        fraction: captureFraction,
        capacitance
    };
}

function buildSidewallSegments(state, neighbors) {
    const endpoints = [-state.L_A / 2, state.L_A / 2];
    for (const n of neighbors) {
        if (!n.show) continue;
        endpoints.push(n.y - n.length / 2, n.y + n.length / 2);
    }

    const sortedEndpoints = [...new Set(endpoints.map(v => Number(v.toFixed(4))))].sort((a, b) => a - b);
    const segments = [];

    for (let i = 0; i < sortedEndpoints.length - 1; i += 1) {
        const segStart = Math.max(sortedEndpoints[i], -state.L_A / 2);
        const segEnd = Math.min(sortedEndpoints[i + 1], state.L_A / 2);
        const segLength = segEnd - segStart;
        if (segLength <= EPSILON) continue;

        const segY = (segStart + segEnd) / 2;
        const nearest = nearestRightNeighborDistance(segY, neighbors, state.halo);
        if (!nearest) continue;

        const cSw = (CONSTANTS.CCOUP0 / (nearest.sep + CONSTANTS.SIDEWALL_OFFSET)) * segLength;
        segments.push({
            index: segments.length + 1,
            neighborId: nearest.id,
            length: segLength,
            sep: nearest.sep,
            c_sw: cSw,
            yStart: segStart,
            yEnd: segEnd
        });
    }

    return segments;
}

export function calculateCapacitance(state) {
    const targetRect = rectFromCenter(0, 0, state.W_A, state.L_A);
    const m1Rect = rectFromCenter(state.x_M1, state.y_M1, state.W_M1, state.L_M1);
    const dSubM2 = state.d_sub_m1 + state.d_m1_m2;
    const areaTarget = state.L_A * state.W_A;
    const areaOverlapM1 = state.show_M1 ? overlapArea(targetRect, m1Rect) : 0;
    const areaUnshielded = Math.max(areaTarget - areaOverlapM1, 0);

    const careaSub = careaDensity(dSubM2, CONSTANTS.K_SUB_M2);
    const careaM1 = careaDensity(state.d_m1_m2, CONSTANTS.K_M1_M2);
    const alphaSub = alphaFromCarea(careaSub);
    const alphaM1 = alphaFromCarea(careaM1);

    const neighbors = [
        { id: 'B1', show: state.show_B1, sep: state.sep_B1, y: state.y_B1, length: state.L_B1 },
        { id: 'B2', show: state.show_B2, sep: state.sep_B2, y: state.y_B2, length: state.L_B2 }
    ];

    const results = {
        C_area_sub: careaSub * areaUnshielded,
        C_area_m1: careaM1 * areaOverlapM1,
        C_fringe_sub: 0,
        C_fringe_m1: 0,
        C_sidewall_total: 0,
        C_total: 0,
        A_overlap_M1: areaOverlapM1,
        A_unshielded: areaUnshielded,
        A_target: areaTarget,
        Carea_sub_density: careaSub,
        Carea_m1_density: careaM1,
        alpha_sub: alphaSub,
        alpha_m1: alphaM1,
        d_sub_m2: dSubM2,
        m1_fringe_edges: [],
        sub_fringe_edges: [],
        sidewall_segments: []
    };

    const targetEdges = makeTargetEdges(targetRect);
    let m1CaptureLength = 0;

    for (const edge of targetEdges) {
        const subFraction = sampleEdgeSubFringe(edge, state, neighbors, alphaSub);
        const subCap = CONSTANTS.CPERIM_SUB * edge.length * subFraction;

        results.sub_fringe_edges.push({
            edge: edge.side,
            length: edge.length,
            fraction: subFraction,
            capacitance: subCap
        });
        results.C_fringe_sub += subCap;

        if (state.show_M1) {
            const m1Fringe = computeM1FringeForEdge(edge, m1Rect, state, alphaM1);
            if (m1Fringe) {
                results.m1_fringe_edges.push(m1Fringe);
                results.C_fringe_m1 += m1Fringe.capacitance;
                m1CaptureLength += m1Fringe.length * m1Fringe.fraction;
            }
        }
    }

    // A nearby metal1 tile captures part of the edge fringe that would otherwise
    // continue toward substrate. This is a teaching approximation, not a field solve.
    const substrateCaptureReduction = CONSTANTS.CPERIM_SUB * m1CaptureLength * 0.55;
    results.C_fringe_sub = Math.max(0, results.C_fringe_sub - substrateCaptureReduction);

    results.sidewall_segments = buildSidewallSegments(state, neighbors);
    results.C_sidewall_total = results.sidewall_segments.reduce((sum, seg) => sum + seg.c_sw, 0);
    results.C_total =
        results.C_area_sub +
        results.C_area_m1 +
        results.C_fringe_sub +
        results.C_fringe_m1 +
        results.C_sidewall_total;

    return results;
}
