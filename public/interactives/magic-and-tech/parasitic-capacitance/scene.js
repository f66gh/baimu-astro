import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONSTANTS } from './calculations.js';

export class CapacitanceScene {
    constructor(containerId, labelsContainerId) {
        this.container = document.getElementById(containerId);
        this.labelsContainer = document.getElementById(labelsContainerId);
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xe5e5ea);
        
        const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDark) {
            this.scene.background = new THREE.Color(0x2c2c2e);
        }

        this.camera = new THREE.PerspectiveCamera(45, this.container.clientWidth / this.container.clientHeight, 0.1, 100);
        this.camera.position.set(10, 10, 15);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 10, 5);
        this.scene.add(dirLight);

        // Materials
        this.matSubstrate = new THREE.MeshLambertMaterial({ color: 0x555555, transparent: true, opacity: 0.8 });
        this.matM1 = new THREE.MeshLambertMaterial({ color: 0x88bbff, transparent: true, opacity: 0.9 });
        this.matM2_Target = new THREE.MeshLambertMaterial({ color: 0xffaa00, transparent: true, opacity: 0.95 });
        this.matM2_Neighbor = new THREE.MeshLambertMaterial({ color: 0xffaa00, transparent: true, opacity: 0.4 });
        
        this.matHalo = new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false });

        this.lineMatArea = new THREE.LineBasicMaterial({ color: 0xffcc00, linewidth: 2 });
        this.lineMatFringe = new THREE.LineBasicMaterial({ color: 0xaa55ff, linewidth: 2 });
        this.lineMatSidewall = new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2 });

        // Objects
        this.substrate = new THREE.Mesh(new THREE.BoxGeometry(20, 0.5, 20), this.matSubstrate);
        this.substrate.position.y = -0.25;
        this.scene.add(this.substrate);
        
        this.m1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.matM1);
        this.scene.add(this.m1);
        
        this.m2A = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.matM2_Target);
        this.scene.add(this.m2A);
        
        this.m2B1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.matM2_Neighbor);
        this.scene.add(this.m2B1);
        
        this.m2B2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.matM2_Neighbor);
        this.scene.add(this.m2B2);
        
        this.halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.matHalo);
        this.halo.rotation.x = -Math.PI / 2;
        this.scene.add(this.halo);

        this.linesGroup = new THREE.Group();
        this.scene.add(this.linesGroup);

        this.labels = [];

        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        this.animate = this.animate.bind(this);
        this.animate();
    }

    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        requestAnimationFrame(this.animate);
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
        this.updateLabelsPosition();
    }

    setView(viewName) {
        if (viewName === 'top') {
            this.camera.position.set(0, 20, 0);
        } else if (viewName === 'cross') {
            this.camera.position.set(0, 2, 15);
        } else if (viewName === '3d') {
            this.camera.position.set(10, 10, 15);
        }
        this.camera.lookAt(0, 0, 0);
        this.controls.target.set(0, 0, 0);
    }

    clearLabels() {
        this.labelsContainer.innerHTML = '';
        this.labels = [];
    }

    addLabel(text, position, isIgnored = false) {
        const el = document.createElement('div');
        el.className = 'html-label' + (isIgnored ? ' ignored' : '');
        el.textContent = text;
        this.labelsContainer.appendChild(el);
        this.labels.push({ el, position });
    }

    updateLabelsPosition() {
        const tempV = new THREE.Vector3();
        this.labels.forEach(label => {
            tempV.copy(label.position);
            tempV.project(this.camera);
            
            const x = (tempV.x *  .5 + .5) * this.container.clientWidth;
            const y = (tempV.y * -.5 + .5) * this.container.clientHeight;
            
            if (tempV.z > 1) { // Behind camera
                label.el.style.display = 'none';
            } else {
                label.el.style.display = 'block';
                label.el.style.left = `${x}px`;
                label.el.style.top = `${y}px`;
            }
        });
    }

    update(state, calcResults) {
        this.clearLabels();
        
        // Z axis in 3D maps to Y in 2D layout (length)
        // X axis in 3D maps to X in 2D layout (width)
        // Y axis in 3D maps to Z in 2D layout (height/thickness)
        
        const z_sub = 0;
        const z_m1 = state.d_sub_m1;
        const z_m2 = z_m1 + state.d_m1_m2;
        const tM1 = CONSTANTS.T_M1;
        const tM2 = CONSTANTS.T_M2;
        const neighborWidth = CONSTANTS.NEIGHBOR_WIDTH;
        
        // Update M2 Target
        this.m2A.scale.set(state.W_A, tM2, state.L_A);
        this.m2A.position.set(0, z_m2 + tM2/2, 0);
        this.addLabel("M2_A Target", new THREE.Vector3(0, z_m2 + tM2 + 0.2, 0));
        
        // Update M1
        this.m1.visible = state.show_M1;
        if (state.show_M1) {
            this.m1.scale.set(state.W_M1, tM1, state.L_M1);
            this.m1.position.set(state.x_M1, z_m1 + tM1/2, -state.y_M1);
            this.addLabel("M1 tile", new THREE.Vector3(state.x_M1, z_m1 + tM1 + 0.2, -state.y_M1));
        }

        // Substrate label
        this.addLabel("Substrate", new THREE.Vector3(-8, 0.2, 8));

        // Update Neighbors
        const updateNeighbor = (mesh, show, W_A, sep, y, L, name) => {
            mesh.visible = show;
            if (show) {
                const xPos = W_A/2 + sep + neighborWidth/2;
                mesh.scale.set(neighborWidth, tM2, L);
                mesh.position.set(xPos, z_m2 + tM2/2, -y); // Note: -y because 3D Z is -2D Y
                
                let isIgnored = sep > state.halo;
                let labelText = name;
                if (isIgnored) labelText += " (Ignored)";
                this.addLabel(labelText, new THREE.Vector3(xPos, z_m2 + tM2 + 0.2, -y), isIgnored);
            }
        };

        updateNeighbor(this.m2B1, state.show_B1, state.W_A, state.sep_B1, state.y_B1, state.L_B1, "M2_B1");
        updateNeighbor(this.m2B2, state.show_B2, state.W_A, state.sep_B2, state.y_B2, state.L_B2, "M2_B2");

        // Shared halo
        this.halo.visible = state.show_halo;
        if (state.show_halo) {
            this.halo.scale.set(state.W_A + 2*state.halo, state.L_A + 2*state.halo, 1);
            this.halo.position.set(0, z_m2 - 0.05, 0);
            this.addLabel("shared halo", new THREE.Vector3(state.W_A/2 + state.halo, z_m2 + 0.1, -state.L_A/2));
        }

        // Field Lines
        // Clear old lines
        while(this.linesGroup.children.length > 0){ 
            this.linesGroup.remove(this.linesGroup.children[0]); 
        }

        const createLine = (pts, mat) => {
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            const line = new THREE.Line(geo, mat);
            this.linesGroup.add(line);
        };

        const createCurve = (p1, p2, p3, mat) => {
            const curve = new THREE.QuadraticBezierCurve3(p1, p2, p3);
            const pts = curve.getPoints(10);
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            const line = new THREE.Line(geo, mat);
            this.linesGroup.add(line);
        };

        const sidePoint = (side, coordinate = 0) => {
            if (side === 'right') return new THREE.Vector3(state.W_A/2, z_m2 + tM2/2, -coordinate);
            if (side === 'left') return new THREE.Vector3(-state.W_A/2, z_m2 + tM2/2, -coordinate);
            if (side === 'top') return new THREE.Vector3(coordinate, z_m2 + tM2/2, -state.L_A/2);
            return new THREE.Vector3(coordinate, z_m2 + tM2/2, state.L_A/2);
        };

        const pointOnM1ForEdge = (edgeName, distance, coordinate) => {
            if (edgeName === 'right') return new THREE.Vector3(state.W_A/2 + distance, z_m1 + tM1, -coordinate);
            if (edgeName === 'left') return new THREE.Vector3(-state.W_A/2 - distance, z_m1 + tM1, -coordinate);
            if (edgeName === 'top') return new THREE.Vector3(coordinate, z_m1 + tM1, -state.L_A/2 - distance);
            return new THREE.Vector3(coordinate, z_m1 + tM1, state.L_A/2 + distance);
        };

        // 1. Area Lines
        if (state.show_area_lines) {
            const step = 0.5;
            for(let x = -state.W_A/2 + 0.25; x < state.W_A/2; x += step) {
                for(let z = -state.L_A/2 + 0.25; z < state.L_A/2; z += step) {
                    let hitM1 = false;
                    if (state.show_M1) {
                        const y2d = -z;
                        if (
                            x >= state.x_M1 - state.W_M1/2 &&
                            x <= state.x_M1 + state.W_M1/2 &&
                            y2d >= state.y_M1 - state.L_M1/2 &&
                            y2d <= state.y_M1 + state.L_M1/2
                        ) {
                            hitM1 = true;
                        }
                    }
                    
                    const pTop = new THREE.Vector3(x, z_m2, z);
                    const pBot = hitM1 ? new THREE.Vector3(x, z_m1 + tM1, z) : new THREE.Vector3(x, 0, z);
                    createLine([pTop, pBot], this.lineMatArea);
                }
            }
        }

        // 2. Fringe Lines. Substrate lines show the remaining uncollected field;
        // M1 lines are drawn even when M1 is near an edge without area overlap.
        if (state.show_fringe_lines) {
            const drawFringeToSub = (startX, startZ, dirX, dirZ, span = 1.0) => {
                const p1 = new THREE.Vector3(startX, z_m2 + tM2/2, startZ);
                const p2 = new THREE.Vector3(startX + dirX * span * 0.66, z_m2 + tM2/2, startZ + dirZ * span * 0.66);
                const p3 = new THREE.Vector3(startX + dirX * span, 0, startZ + dirZ * span);
                createCurve(p1, p2, p3, this.lineMatFringe);
            };

            // Left edge
            for(let z = -state.L_A/2; z <= state.L_A/2; z += 1.0) drawFringeToSub(-state.W_A/2, z, -1, 0, Math.min(state.halo, 1.8));
            // Top/Bottom edges
            for(let x = -state.W_A/2; x <= state.W_A/2; x += 1.0) {
                drawFringeToSub(x, -state.L_A/2, 0, -1, Math.min(state.halo, 1.8));
                drawFringeToSub(x, state.L_A/2, 0, 1, Math.min(state.halo, 1.8));
            }
            
            // Right edge (affected by shielding)
            for(let z = -state.L_A/2 + 0.2; z <= state.L_A/2; z += 0.5) {
                // Check if this z is heavily shielded
                let shielded = false;
                calcResults.sidewall_segments.forEach(seg => {
                    // Note: 3D Z maps to -Y in 2D layout. So seg.yStart is -seg.yEnd in 3D.
                    // Actually, let's keep 3D Z = 2D -Y or just use Z = Y.
                    // Wait, earlier I did position.set(x, y, -y_2d).
                    // So 3D z = -2D y.
                    let y_2d = -z;
                    if (y_2d >= seg.yStart && y_2d <= seg.yEnd) {
                        if (seg.sep < state.halo * 0.8) {
                            shielded = true;
                        }
                    }
                });
                
                if (!shielded) {
                    drawFringeToSub(state.W_A/2, z, 1, 0, Math.min(state.halo, 1.8));
                }
            }

            calcResults.m1_fringe_edges.forEach(edge => {
                const samples = Math.max(2, Math.min(6, Math.ceil(edge.length)));
                for (let i = 0; i < samples; i += 1) {
                    const t = samples === 1 ? 0.5 : i / (samples - 1);
                    const samplePosition = edge.start + t * edge.length;
                    const p1 = sidePoint(edge.edge, samplePosition);
                    const p3 = pointOnM1ForEdge(edge.edge, edge.distance, samplePosition);
                    const p2 = new THREE.Vector3(
                        (p1.x + p3.x) / 2,
                        z_m1 + (z_m2 - z_m1) * 0.55,
                        (p1.z + p3.z) / 2
                    );
                    createCurve(p1, p2, p3, this.lineMatFringe);
                }
                this.addLabel(
                    `M1 fringe ${edge.edge}`,
                    pointOnM1ForEdge(edge.edge, edge.distance, 0).add(new THREE.Vector3(0, 0.25, 0))
                );
            });
        }

        // 3. Sidewall Lines
        if (state.show_sidewall_lines) {
            calcResults.sidewall_segments.forEach(seg => {
                const zCenter = -(seg.yStart + seg.yEnd) / 2; // Map 2D Y to 3D Z
                const xStart = state.W_A/2;
                const xEnd = xStart + seg.sep;
                
                for(let z = -seg.yEnd + 0.2; z <= -seg.yStart - 0.1; z += 0.4) {
                    const p1 = new THREE.Vector3(xStart, z_m2 + tM2/2, z);
                    const p2 = new THREE.Vector3(xEnd, z_m2 + tM2/2, z);
                    createLine([p1, p2], this.lineMatSidewall);
                }
                
                // Add label for segment
                this.addLabel(`Seg ${seg.index} (${seg.neighborId})`, new THREE.Vector3((xStart+xEnd)/2, z_m2 + tM2/2 + 0.3, zCenter));
            });
        }
    }
}
