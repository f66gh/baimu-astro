export const CONSTANTS = {
    SIDEHALO: 8,
    FRINGE_MULT: 0.02,
    C_AREA_M2_SUB: 17.5,
    C_OVERLAP_M2_M1: 133.86,
    C_PERIM_M2_SUB: 37.76,
    C_SIDEOVERLAP_M2_TO_M1: 67.05,
    C_SIDEWALL_M2: 50,
    SIDEWALL_OFFSET: 0.3,
    T_M1: 0.22,
    T_M2: 0.32,
    VISUAL_D_SUB_M1: 1.25,
    VISUAL_D_M1_M2: 1.65,
    NEIGHBOR_WIDTH: 1.0
};

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

function multFromOverlapCap(capValue) {
    return capValue * CONSTANTS.FRINGE_MULT;
}

function fringeFraction(distance, mult) {
    const x = Math.max(0, distance);
    return clamp((2 / Math.PI) * Math.atan(mult * x), 0, 1);
}

function fringeWindowFraction(near, far, mult) {
    return Math.max(0, fringeFraction(far, mult) - fringeFraction(near, mult));
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

function computeM2ToM1FringeForEdge(edge, m1Rect, state, multM1, multSub) {
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

    const couplingFraction = fringeWindowFraction(near, far, multM1);
    const substrateFraction = fringeWindowFraction(near, far, multSub);
    const capacitance = CONSTANTS.C_SIDEOVERLAP_M2_TO_M1 * interval.length * couplingFraction;
    const substrateRemoval = CONSTANTS.C_PERIM_M2_SUB * interval.length * substrateFraction;

    return {
        edge: edge.side,
        distance: (near + far) / 2,
        near,
        far,
        start: interval.start,
        end: interval.end,
        length: interval.length,
        fraction: couplingFraction,
        substrateFraction,
        capacitance,
        substrateRemoval
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

        const cSw = (CONSTANTS.C_SIDEWALL_M2 / (nearest.sep + CONSTANTS.SIDEWALL_OFFSET)) * segLength;
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
    const areaTarget = state.L_A * state.W_A;
    const perimeterTarget = 2 * (state.L_A + state.W_A);
    const areaOverlapM1 = state.show_M1 ? overlapArea(targetRect, m1Rect) : 0;
    const areaUnshielded = Math.max(areaTarget - areaOverlapM1, 0);
    const multM2Sub = multFromOverlapCap(CONSTANTS.C_AREA_M2_SUB);
    const multM2M1 = multFromOverlapCap(CONSTANTS.C_OVERLAP_M2_M1);

    const neighbors = [
        { id: 'B1', show: state.show_B1, sep: state.sep_B1, y: state.y_B1, length: state.L_B1 },
        { id: 'B2', show: state.show_B2, sep: state.sep_B2, y: state.y_B2, length: state.L_B2 }
    ];

    const results = {
        C_area_sub: CONSTANTS.C_AREA_M2_SUB * areaUnshielded,
        C_area_m1: CONSTANTS.C_OVERLAP_M2_M1 * areaOverlapM1,
        C_fringe_sub_base: CONSTANTS.C_PERIM_M2_SUB * perimeterTarget,
        C_fringe_sub_removed: 0,
        C_fringe_sub: 0,
        C_fringe_m1: 0,
        C_sidewall_total: 0,
        C_total: 0,
        A_overlap_M1: areaOverlapM1,
        A_unshielded: areaUnshielded,
        A_target: areaTarget,
        P_target: perimeterTarget,
        Carea_sub_density: CONSTANTS.C_AREA_M2_SUB,
        Carea_m1_density: CONSTANTS.C_OVERLAP_M2_M1,
        mult_sub: multM2Sub,
        mult_m1: multM2M1,
        halo: state.halo,
        m1_fringe_edges: [],
        sub_fringe_edges: [],
        sidewall_segments: []
    };

    const targetEdges = makeTargetEdges(targetRect);

    for (const edge of targetEdges) {
        results.sub_fringe_edges.push({
            edge: edge.side,
            length: edge.length,
            fraction: 1,
            capacitance: CONSTANTS.C_PERIM_M2_SUB * edge.length
        });

        if (state.show_M1) {
            const m1Fringe = computeM2ToM1FringeForEdge(edge, m1Rect, state, multM2M1, multM2Sub);
            if (m1Fringe) {
                results.m1_fringe_edges.push(m1Fringe);
                results.C_fringe_m1 += m1Fringe.capacitance;
                results.C_fringe_sub_removed += m1Fringe.substrateRemoval;
            }
        }
    }

    results.C_fringe_sub = Math.max(0, results.C_fringe_sub_base - results.C_fringe_sub_removed);
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
