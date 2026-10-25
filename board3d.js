// board3d.js — Three.js 3D 보드, 동물 말, cannon.js 물리 주사위
// game.js의 GROUPS, tollOf 등을 사용합니다.
'use strict';

const Board3D = (() => {
  const FONT = "'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR','Noto Sans CJK KR',sans-serif";
  const TOP = 0.1;      // 칸 윗면 높이
  const DIE = 0.62;     // 주사위 한 변
  const WALL = 4.4;     // 주사위가 굴러다니는 안쪽 영역 경계
  const SLOTS = [[-0.22, -0.12], [0.22, -0.12], [0, -0.32], [0, 0.1]]; // 칸 안 말 위치 (가로, 안쪽방향)
  // 판 가로 늘림 비율: 가로로 긴 화면이면 판도 가로로 넓은 직사각형으로 만들어 화면을 꽉 채움 (init에서 정함)
  let SX = 1;

  let renderer, scene, camera, canvas, clock, raycaster;
  let world;
  const tiles = [];
  const bldMeshes = [];
  const tokens = {};
  const tweens = [];
  const dice = [];
  let choosing = false;
  let throwArmed = null;
  let handlers = {};
  let time = 0;
  const cam = { az: 0, el: 0.98, zoom: 1 };
  const target = new THREE.Vector3(0, 0, 0.35);
  const matCache = {};

  // ───────── 좌표 ─────────
  function gridPos(i) {
    if (i <= 10) return { r: 11, c: 11 - i };
    if (i <= 20) return { r: 11 - (i - 10), c: 1 };
    if (i <= 30) return { r: 1, c: 1 + (i - 20) };
    return { r: 1 + (i - 30), c: 11 };
  }
  function tileFrame(i) {
    const { r, c } = gridPos(i);
    const x = (c - 6) * SX, z = r - 6;
    let inward;
    if (i % 10 === 0) inward = new THREE.Vector3(-Math.sign(x), 0, -Math.sign(z)).normalize();
    else if (r === 1 || r === 11) inward = new THREE.Vector3(0, 0, -Math.sign(z));
    else inward = new THREE.Vector3(-Math.sign(x), 0, 0);
    const tangent = new THREE.Vector3(inward.z, 0, -inward.x);
    return { center: new THREE.Vector3(x, 0, z), inward, tangent };
  }
  function slotPos(idx, pid) {
    const t = tiles[idx];
    const [a, b] = SLOTS[pid % SLOTS.length];
    return t.center.clone()
      .add(t.tangent.clone().multiplyScalar(a))
      .add(t.inward.clone().multiplyScalar(b * (Math.abs(t.inward.x) > 0.9 ? SX : 1)))
      .setY(TOP);
  }

  // ───────── 공용 도형 ─────────
  function mat(color, opts = {}) {
    const key = color + JSON.stringify(opts);
    if (!matCache[key]) matCache[key] = new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true, ...opts });
    return matCache[key];
  }
  function shadow(m) { m.castShadow = true; m.receiveShadow = true; return m; }
  function sph(r, color, s, p, rot) {
    const m = shadow(new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat(color)));
    if (s) m.scale.set(...s);
    if (p) m.position.set(...p);
    if (rot) m.rotation.set(...rot);
    return m;
  }
  function cyl(rt, rb, h, color, p, rot, seg = 10) {
    const m = shadow(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color)));
    if (p) m.position.set(...p);
    if (rot) m.rotation.set(...rot);
    return m;
  }
  function cone(r, h, color, p, rot, seg = 8) {
    const m = shadow(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color)));
    if (p) m.position.set(...p);
    if (rot) m.rotation.set(...rot);
    return m;
  }
  function box(w, h, d, color, p, rot) {
    const m = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)));
    if (p) m.position.set(...p);
    if (rot) m.rotation.set(...rot);
    return m;
  }

  // ───────── 동물 말 (앞쪽 = +z) ─────────
  const ANIMALS = {
    kangaroo() {
      const g = new THREE.Group(), tan = '#b5652a', belly = '#e8c495';
      g.add(sph(0.3, tan, [0.85, 1.25, 0.9], [0, 0.55, -0.02], [-0.25, 0, 0]));
      g.add(sph(0.22, belly, [0.8, 1.1, 0.6], [0, 0.52, 0.12]));
      g.add(sph(0.16, tan, [0.9, 1, 1.15], [0, 1.0, 0.1]));
      g.add(sph(0.08, tan, [1, 0.9, 1.3], [0, 0.96, 0.26]));
      g.add(sph(0.03, '#2a1d14', null, [0, 0.98, 0.36]));
      for (const s of [-1, 1]) {
        g.add(cone(0.06, 0.24, tan, [s * 0.08, 1.2, 0.04], [0, 0, -s * 0.2]));
        g.add(sph(0.025, '#111', null, [s * 0.07, 1.05, 0.22]));
        g.add(sph(0.15, tan, [0.8, 1.1, 1.3], [s * 0.17, 0.25, 0]));
        g.add(box(0.09, 0.06, 0.36, tan, [s * 0.17, 0.03, 0.12]));
        g.add(cyl(0.03, 0.025, 0.26, tan, [s * 0.12, 0.62, 0.2], [-0.9, 0, 0]));
      }
      g.add(cyl(0.09, 0.03, 0.62, tan, [0, 0.22, -0.4], [-0.85, 0, 0]));
      return g;
    },
    deer() {
      const g = new THREE.Group(), br = '#8a4b1f', lt = '#efe0c8', ant = '#e3cfa3';
      g.add(sph(0.3, br, [0.75, 0.7, 1.35], [0, 0.62, 0]));
      g.add(sph(0.2, lt, [0.7, 0.6, 1.1], [0, 0.52, 0.03]));
      for (const s of [-1, 1]) {
        for (const f of [-1, 1]) {
          g.add(cyl(0.035, 0.03, 0.5, br, [s * 0.13, 0.25, f * 0.25]));
          g.add(cyl(0.035, 0.035, 0.05, '#3a2a1e', [s * 0.13, 0.02, f * 0.25]));
        }
        g.add(cone(0.05, 0.15, br, [s * 0.13, 1.16, 0.37], [0, 0, -s * 1.1]));
        g.add(sph(0.022, '#111', null, [s * 0.075, 1.12, 0.5]));
        // 뿔
        g.add(cyl(0.018, 0.024, 0.32, ant, [s * 0.08, 1.33, 0.37], [0, 0, -s * 0.35]));
        g.add(cyl(0.015, 0.015, 0.16, ant, [s * 0.16, 1.43, 0.37], [0, 0, -s * 1.1]));
        g.add(cyl(0.015, 0.015, 0.14, ant, [s * 0.1, 1.4, 0.44], [0.8, 0, 0]));
      }
      g.add(cyl(0.07, 0.09, 0.36, br, [0, 0.88, 0.3], [0.5, 0, 0]));
      g.add(sph(0.13, br, [0.85, 0.9, 1.3], [0, 1.08, 0.42]));
      g.add(sph(0.07, '#8a5530', [1, 0.9, 1.1], [0, 1.03, 0.57]));
      g.add(sph(0.03, '#1a1a1a', null, [0, 1.05, 0.64]));
      g.add(sph(0.05, lt, [1, 1.3, 1], [0, 0.72, -0.4]));
      for (const [x, z] of [[-0.1, -0.1], [0.08, 0.05], [-0.05, 0.15], [0.1, -0.2]]) {
        g.add(sph(0.03, '#f5ead8', [1, 0.5, 1], [x, 0.82, z]));
      }
      return g;
    },
    wolf() {
      const g = new THREE.Group(), gr = '#5f6873', lt = '#d7dbe0';
      g.add(sph(0.3, gr, [0.75, 0.72, 1.35], [0, 0.55, 0]));
      g.add(sph(0.18, lt, [0.8, 0.9, 0.7], [0, 0.52, 0.3]));
      for (const s of [-1, 1]) {
        for (const f of [-1, 1]) g.add(cyl(0.045, 0.04, 0.42, gr, [s * 0.13, 0.21, f * 0.24]));
        g.add(cone(0.06, 0.17, gr, [s * 0.09, 0.98, 0.38]));
        g.add(sph(0.025, '#e0a800', null, [s * 0.07, 0.86, 0.55]));
      }
      g.add(sph(0.16, gr, [1, 0.9, 1], [0, 0.8, 0.42]));
      g.add(cone(0.08, 0.25, gr, [0, 0.76, 0.62], [Math.PI / 2, 0, 0]));
      g.add(sph(0.06, lt, [1, 0.6, 1.8], [0, 0.7, 0.56]));
      g.add(sph(0.03, '#111', null, [0, 0.77, 0.74]));
      g.add(cone(0.08, 0.46, gr, [0, 0.42, -0.55], [-2.1, 0, 0]));
      return g;
    },
    hippo() {
      const g = new THREE.Group(), bd = '#8c7d9a', pk = '#e7a3a8';
      g.add(sph(0.4, bd, [0.95, 0.75, 1.25], [0, 0.42, 0]));
      for (const s of [-1, 1]) {
        for (const f of [-1, 1]) g.add(cyl(0.1, 0.1, 0.22, bd, [s * 0.2, 0.11, f * 0.25]));
        g.add(sph(0.03, '#3a2f44', null, [s * 0.07, 0.55, 0.8]));
        g.add(sph(0.06, bd, null, [s * 0.11, 0.68, 0.5]));
        g.add(sph(0.03, '#111', null, [s * 0.11, 0.71, 0.55]));
        g.add(sph(0.045, bd, [1, 1.3, 0.6], [s * 0.15, 0.73, 0.4]));
      }
      g.add(sph(0.24, bd, [1, 0.85, 1.1], [0, 0.5, 0.48]));
      g.add(sph(0.2, bd, [1.25, 0.75, 0.9], [0, 0.43, 0.66]));
      g.add(sph(0.16, pk, [1.3, 0.25, 0.9], [0, 0.36, 0.68]));
      g.add(cyl(0.02, 0.01, 0.12, bd, [0, 0.45, -0.5], [-0.8, 0, 0]));
      return g;
    },
  };
  const ANIMAL_SCALE = { kangaroo: 0.4, deer: 0.4, wolf: 0.42, hippo: 0.41 };

  function makeToken(kind, color) {
    const g = new THREE.Group();
    g.add(cyl(0.42, 0.46, 0.08, color, [0, 0.04, 0], null, 24));
    const body = ANIMALS[kind]();
    body.position.y = 0.08;
    g.add(body);
    g.scale.setScalar(ANIMAL_SCALE[kind]);
    return g;
  }

  // ───────── 건물 ─────────
  function makeBuilding(level, color) {
    const g = new THREE.Group();
    if (level === 1) {
      g.add(box(0.2, 0.15, 0.18, '#fafafa', [0, 0.075, 0]));
      g.add(cone(0.17, 0.13, color, [0, 0.215, 0], [0, Math.PI / 4, 0], 4));
    } else if (level === 2) {
      g.add(box(0.22, 0.42, 0.22, '#eceff1', [0, 0.21, 0]));
      g.add(box(0.24, 0.05, 0.24, color, [0, 0.445, 0]));
      for (const y of [0.12, 0.22, 0.32]) g.add(box(0.225, 0.04, 0.16, '#90caf9', [0, y, 0]));
    } else if (level === 3) {
      g.add(box(0.3, 0.6, 0.26, '#fff8e1', [0, 0.3, 0]));
      g.add(box(0.32, 0.06, 0.28, color, [0, 0.63, 0]));
      for (const y of [0.15, 0.27, 0.39, 0.51]) g.add(box(0.305, 0.045, 0.2, '#ffcc80', [0, y, 0]));
      g.add(cyl(0.008, 0.008, 0.2, '#555', [0.1, 0.76, 0]));
      g.add(box(0.1, 0.06, 0.01, color, [0.15, 0.83, 0]));
    }
    return g;
  }
  function setBuilding(idx, level, owner) {
    if (bldMeshes[idx]) { scene.remove(bldMeshes[idx]); bldMeshes[idx] = null; }
    if (!level || !owner) return;
    const t = tiles[idx];
    const g = makeBuilding(level, owner.color);
    // 색 띠(안쪽 가장자리) 근처에 세움. 좌우 줄 칸은 가로로 넓으니 그만큼 더 안쪽
    const off = (Math.abs(t.inward.x) > 0.9 ? 0.47 * SX : 0.47) - 0.18;
    g.position.copy(t.center).add(t.inward.clone().multiplyScalar(off)).setY(TOP);
    g.rotation.y = Math.atan2(t.inward.x, t.inward.z);
    scene.add(g);
    bldMeshes[idx] = g;
    g.scale.setScalar(0.01);
    // easeOutBack: 살짝 튀어오르며 커짐
    tween(400, k => g.scale.setScalar(Math.max(0.01, 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2))));
  }

  // ───────── 칸 텍스처 ─────────
  function drawTile(i, cell, owner) {
    // 칸 그림은 가로 W × 세로 H (판을 가로로 늘리면 W도 늘어남)
    const t = tiles[i], ctx = t.ctx, W = ctx.canvas.width, H = ctx.canvas.height;
    const bg = { start: '#ffe9a8', island: '#ffe9a8', fund: '#ffe9a8', space: '#ffe9a8', key: '#fff3c4', tax: '#e3f2fd' }[cell.type] || '#f6f1e4';
    ctx.globalAlpha = 1;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    if (owner) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = owner.color;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    let box = { x: 0, y: 0, w: W, h: H };
    if (cell.type === 'city' || cell.type === 'tour') {
      const B = 58, ix = Math.round(t.inward.x), iz = Math.round(t.inward.z);
      ctx.fillStyle = cell.type === 'city' ? GROUPS[cell.group].color : '#90a4ae';
      if (iz < 0) { ctx.fillRect(0, 0, W, B); box = { x: 0, y: B, w: W, h: H - B }; }
      else if (iz > 0) { ctx.fillRect(0, H - B, W, B); box = { x: 0, y: 0, w: W, h: H - B }; }
      else if (ix > 0) { ctx.fillRect(W - B, 0, B, H); box = { x: 0, y: 0, w: W - B, h: H }; }
      else { ctx.fillRect(0, 0, B, H); box = { x: B, y: 0, w: W - B, h: H }; }
    }
    if (owner) {
      ctx.strokeStyle = owner.color;
      ctx.lineWidth = 22;
      ctx.strokeRect(11, 11, W - 22, H - 22);
    }
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fit = (text, size, weight, maxW) => {
      do { ctx.font = `${weight} ${size}px ${FONT}`; size -= 2; } while (ctx.measureText(text).width > maxW && size > 18);
    };
    ctx.fillStyle = '#1d2433';
    if (cell.icon) {
      ctx.font = `92px ${FONT}`;
      ctx.fillText(cell.icon, cx, cy - 28);
      fit(cell.short, 42, 'bold', box.w - 24);
      ctx.fillText(cell.short, cx, cy + 62);
    } else {
      if (cell.type === 'tour') { ctx.font = `46px ${FONT}`; ctx.fillText('✈️', cx, cy - 52); }
      fit(cell.short, 50, 'bold', box.w - 26);
      ctx.fillText(cell.short, cx, cy - (cell.type === 'tour' ? 0 : 20));
      const sub = owner ? `통행료 ${tollOf(cell)}만` : `${cell.price}만`;
      ctx.fillStyle = owner ? '#1d2433' : '#5b6170';
      fit(sub, 36, owner ? 'bold' : '600', box.w - 26);
      ctx.fillText(sub, cx, cy + (cell.type === 'tour' ? 48 : 34));
    }
    t.tex.needsUpdate = true;
  }

  function centerTexture() {
    const c = document.createElement('canvas');
    c.width = Math.round(1024 * SX);
    c.height = 1024;
    const ctx = c.getContext('2d');
    const mx = c.width / 2;
    const g = ctx.createRadialGradient(mx, 450, 60, mx, 512, 720 * SX);
    g.addColorStop(0, '#2a5ca8');
    g.addColorStop(1, '#0d2244');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, 1024);
    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    ctx.lineWidth = 3;
    for (let r = 120; r < 700 * SX; r += 90) { ctx.beginPath(); ctx.arc(mx, 512, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tg = ctx.createLinearGradient(mx - 312, 0, mx + 312, 0);
    tg.addColorStop(0, '#ffd54f');
    tg.addColorStop(1, '#ff8a65');
    ctx.fillStyle = tg;
    ctx.font = `900 118px ${FONT}`;
    ctx.fillText('BLUE MARBLE', mx, 300);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.font = `bold 58px ${FONT}`;
    ctx.fillText('부 루 마 블', mx, 400);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  // ───────── 주사위 ─────────
  const PIP_POS = {
    1: [[0.5, 0.5]], 2: [[0.27, 0.27], [0.73, 0.73]], 3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
    4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
    5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
    6: [[0.27, 0.22], [0.73, 0.22], [0.27, 0.5], [0.73, 0.5], [0.27, 0.78], [0.73, 0.78]],
  };
  function dieTexture(n) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 20, 64, 64, 95);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.8, '#f3f3f3');
    g.addColorStop(1, '#cfd3da');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    for (const [x, y] of PIP_POS[n]) {
      ctx.beginPath();
      ctx.arc(x * 128, y * 128, n === 1 ? 17 : 11.5, 0, Math.PI * 2);
      ctx.fillStyle = n === 1 ? '#d32f2f' : '#1d2433';
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }
  // BoxGeometry 면 순서: +x, -x, +y, -y, +z, -z (마주보는 면 합 = 7)
  const FACE_VALUES = [3, 4, 1, 6, 2, 5];
  const FACE_AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(a => new THREE.Vector3(...a));

  function topFace(q) {
    const quat = new THREE.Quaternion(q.x, q.y, q.z, q.w);
    let best = 0, bestY = -2;
    FACE_AXES.forEach((a, k) => {
      const y = a.clone().applyQuaternion(quat).y;
      if (y > bestY) { bestY = y; best = k; }
    });
    return { value: FACE_VALUES[best], flat: bestY > 0.9 };
  }

  function setupPhysics() {
    world = new CANNON.World();
    world.gravity.set(0, -38, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 12;
    const floorMat = new CANNON.Material('floor');
    const wallMat = new CANNON.Material('wall');
    const diceMat = new CANNON.Material('dice');
    world.addContactMaterial(new CANNON.ContactMaterial(floorMat, diceMat, { friction: 0.3, restitution: 0.35 }));
    world.addContactMaterial(new CANNON.ContactMaterial(wallMat, diceMat, { friction: 0.05, restitution: 0.55 }));
    world.addContactMaterial(new CANNON.ContactMaterial(diceMat, diceMat, { friction: 0.2, restitution: 0.4 }));

    const floor = new CANNON.Body({ mass: 0, material: floorMat });
    floor.addShape(new CANNON.Plane());
    floor.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    floor.position.set(0, 0.02, 0);
    world.addBody(floor);
    const walls = [
      [new CANNON.Vec3(-WALL * SX, 0, 0), Math.PI / 2],
      [new CANNON.Vec3(WALL * SX, 0, 0), -Math.PI / 2],
      [new CANNON.Vec3(0, 0, -WALL), 0],
      [new CANNON.Vec3(0, 0, WALL), Math.PI],
    ];
    for (const [pos, ang] of walls) {
      const w = new CANNON.Body({ mass: 0, material: wallMat });
      w.addShape(new CANNON.Plane());
      w.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), ang);
      w.position.copy(pos);
      world.addBody(w);
    }

    const mats = FACE_VALUES.map(v => new THREE.MeshStandardMaterial({ map: dieTexture(v), roughness: 0.35 }));
    for (let k = 0; k < 2; k++) {
      const mesh = shadow(new THREE.Mesh(new THREE.BoxGeometry(DIE, DIE, DIE), mats));
      const h = DIE / 2;
      const body = new CANNON.Body({ mass: 1, material: diceMat, linearDamping: 0.12, angularDamping: 0.12 });
      body.addShape(new CANNON.Box(new CANNON.Vec3(h, h, h)));
      body.position.set(k ? 0.5 : -0.5, h + 0.02, 1.6);
      if (k) body.quaternion.setFromEuler(0, 0.4, 0);
      let lastHit = -10;
      body.addEventListener('collide', e => {
        if (!recording || simFrame - lastHit < 3) return;
        const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
        if (v < 0.8) return;
        lastHit = simFrame;
        recording.push([simFrame, +v.toFixed(2), e.body.mass > 0 ? 1.35 : 1]);
      });
      world.addBody(body);
      scene.add(mesh);
      dice.push({ mesh, body });
    }
    syncDice();
  }

  function syncDice() {
    for (const d of dice) {
      d.mesh.position.copy(d.body.position);
      d.mesh.quaternion.copy(d.body.quaternion);
    }
  }

  function forwardVec() {
    return new THREE.Vector3(target.x - camera.position.x, 0, target.z - camera.position.z).normalize();
  }

  function throwDice(opt) {
    let dir;
    if (opt && opt.dir) dir = opt.dir.clone();
    else dir = forwardVec().applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 0.7);
    dir.y = 0;
    dir.normalize();
    const power = (opt && opt.power) || 9 + Math.random() * 4;
    const perp = new THREE.Vector3(dir.z, 0, -dir.x);
    const rnd = (a, b) => a + Math.random() * (b - a);
    dice.forEach((d, k) => {
      const s = dir.clone().multiplyScalar(-3.1).add(perp.clone().multiplyScalar(k ? 0.45 : -0.45));
      d.body.position.set(s.x, rnd(2.0, 2.5), s.z);
      d.body.quaternion.setFromEuler(rnd(0, 6.3), rnd(0, 6.3), rnd(0, 6.3));
      d.body.velocity.set(dir.x * power + rnd(-1, 1), rnd(1.5, 3.5), dir.z * power + rnd(-1, 1));
      d.body.angularVelocity.set(rnd(-18, 18), rnd(-18, 18), rnd(-18, 18));
      if (d.body.wakeUp) d.body.wakeUp();
    });
  }

  // 던지기를 물리로 즉시 끝까지 계산해 궤적을 녹화함.
  // 온라인에서는 이 녹화를 모든 폰에 보내 똑같이 재생하므로 화면과 결과가 일치함
  let recording = null, simFrame = 0;
  function simulateThrow(opt) {
    throwDice(opt);
    const frames = [], hits = [];
    recording = hits;
    let still = 0, nudges = 0;
    for (simFrame = 0; simFrame < 480; simFrame++) {
      world.step(1 / 60);
      const fr = [];
      for (const d of dice) {
        const p = d.body.position, q = d.body.quaternion;
        fr.push(+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3), +q.x.toFixed(4), +q.y.toFixed(4), +q.z.toFixed(4), +q.w.toFixed(4));
      }
      frames.push(fr);
      const moving = dice.some(d => d.body.velocity.norm() > 0.06 || d.body.angularVelocity.norm() > 0.12);
      still = moving ? 0 : still + 1;
      if (still > 18 && simFrame > 36) {
        const cocked = dice.filter(d => !topFace(d.body.quaternion).flat);
        if (cocked.length && nudges < 3) {
          // 모서리로 기대 선 주사위는 살짝 튕겨서 다시 눕힘
          nudges++;
          still = 0;
          for (const d of cocked) {
            d.body.velocity.set((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2);
            d.body.angularVelocity.set((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8);
          }
          continue;
        }
        break;
      }
    }
    recording = null;
    return { frames, hits, result: dice.map(d => topFace(d.body.quaternion).value) };
  }

  let playing = null;
  function playRecording(rec) {
    return new Promise(resolve => {
      Sound.rattle();
      setTimeout(() => { playing = { rec, t: 0, hit: 0, resolve }; }, 330);
    });
  }
  function stepPlayback(dt) {
    const pl = playing, frames = pl.rec.frames;
    pl.t += dt;
    const f = Math.min(frames.length - 1, Math.floor(pl.t * 60));
    const fr = frames[f];
    dice.forEach((d, k) => {
      const o = k * 7;
      d.mesh.position.set(fr[o], fr[o + 1], fr[o + 2]);
      d.mesh.quaternion.set(fr[o + 3], fr[o + 4], fr[o + 5], fr[o + 6]);
    });
    const hits = pl.rec.hits;
    while (pl.hit < hits.length && hits[pl.hit][0] <= f) {
      Sound.click(hits[pl.hit][1], hits[pl.hit][2]);
      pl.hit++;
    }
    if (f === frames.length - 1) {
      playing = null;
      pl.resolve(pl.rec.result);
    }
  }

  // 혼자 할 때: 계산 후 바로 재생
  function rollDice(opt) {
    return playRecording(simulateThrow(opt));
  }

  // ───────── 돈 이동 연출 (지폐 + 금액 표시) ─────────
  let billGeo, billMats;
  function billTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#9ccc9c';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#3e7b4a';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 240, 112);
    ctx.fillStyle = '#d9efd2';
    ctx.beginPath();
    ctx.ellipse(70, 64, 34, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2e6b3a';
    ctx.font = `900 40px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('만원', 170, 52);
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText('10000', 170, 90);
    ctx.font = `bold 34px ${FONT}`;
    ctx.fillText('₩', 70, 66);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }
  // 'bank'는 보드 위 하늘, 'fund'는 사회복지기금 칸, 't12'는 12번 칸, 숫자는 플레이어 말 위치
  function anchorPos(src) {
    if (typeof src === 'number' && tokens[src]) return tokens[src].group.position.clone().setY(TOP + 0.35);
    if (src === 'fund') return tiles[20].center.clone().setY(TOP + 0.25);
    if (typeof src === 'string' && src[0] === 't' && tiles[+src.slice(1)]) return tiles[+src.slice(1)].center.clone().setY(TOP + 0.25);
    return new THREE.Vector3(0, 3.2, 0.5);
  }
  function floatLabel(pos, text, color) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = `900 64px ${FONT}`;
    c.width = Math.max(256, Math.ceil(ctx.measureText(text).width) + 40);
    c.height = 96;
    ctx.font = `900 64px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(0,0,0,.65)';
    ctx.strokeText(text, c.width / 2, 48);
    ctx.fillStyle = color;
    ctx.fillText(text, c.width / 2, 48);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.renderOrder = 10;
    sp.scale.set(0.49 * c.width / 96, 0.49, 1);
    const start = pos.clone().setY(pos.y + 0.5);
    sp.position.copy(start);
    scene.add(sp);
    tween(1300, k => {
      sp.position.y = start.y + k * 0.9;
      sp.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    }).then(() => { scene.remove(sp); tex.dispose(); sp.material.dispose(); });
  }
  // 지폐가 from에서 to로 팔랑이며 날아감. 마지막 지폐가 도착하면 끝남
  function moneyFlow(from, to, amount) {
    if (!amount || amount <= 0) return Promise.resolve();
    if (!billGeo) {
      billGeo = new THREE.BoxGeometry(0.56, 0.01, 0.28);
      const face = new THREE.MeshStandardMaterial({ map: billTexture(), roughness: 0.8, side: THREE.DoubleSide });
      const edge = new THREE.MeshStandardMaterial({ color: '#7fb07f' });
      billMats = [edge, edge, face, face, edge, edge];
    }
    const a = anchorPos(from), b = anchorPos(to);
    const n = Math.min(8, 2 + Math.floor(amount / 12));
    if (typeof from === 'number') floatLabel(a, `-${amount}만`, '#ff8a80');
    setTimeout(() => { if (typeof to === 'number') floatLabel(b, `+${amount}만`, '#b9f6ca'); }, 450);
    Sound.bills();
    const jobs = [];
    for (let i = 0; i < n; i++) {
      jobs.push(new Promise(res => setTimeout(res, i * 75)).then(() => {
        const bill = new THREE.Mesh(billGeo, billMats);
        bill.castShadow = true;
        scene.add(bill);
        const spread = () => new THREE.Vector3((Math.random() - 0.5) * 0.35, 0, (Math.random() - 0.5) * 0.35);
        const s = a.clone().add(spread()), e = b.clone().add(spread());
        const h = 0.9 + a.distanceTo(b) * 0.12;
        const yaw = Math.atan2(e.x - s.x, e.z - s.z);
        const phase = Math.random() * 6.3;
        return tween(700, k => {
          bill.position.lerpVectors(s, e, k);
          bill.position.y += Math.sin(Math.PI * k) * h;
          // 종이가 공기를 타며 흔들리는 느낌
          bill.rotation.set(Math.sin(k * 14 + phase) * 0.6, yaw + Math.sin(k * 9 + phase) * 0.5, Math.cos(k * 11 + phase) * 0.45);
        }).then(() => scene.remove(bill));
      }));
    }
    return Promise.all(jobs);
  }

  // ───────── 도착 칸 미리 반짝이기 ─────────
  let starTex, ringGeo;
  function makeStarTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,236,150,.9)');
    g.addColorStop(1, 'rgba(255,200,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    // 십자 빛줄기
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath();
    ctx.moveTo(32, 0); ctx.lineTo(35, 29); ctx.lineTo(64, 32); ctx.lineTo(35, 35);
    ctx.lineTo(32, 64); ctx.lineTo(29, 35); ctx.lineTo(0, 32); ctx.lineTo(29, 29);
    ctx.closePath();
    ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    return tex;
  }
  function sparkTile(idx, ms = 900) {
    const t = tiles[idx];
    if (!t || ms <= 0) return Promise.resolve();
    if (!starTex) { starTex = makeStarTexture(); ringGeo = new THREE.RingGeometry(0.34, 0.47, 40); }
    Sound.sparkle();
    const group = new THREE.Group();
    group.position.copy(t.center).setY(TOP + 0.02);
    scene.add(group);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffd54f', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
    // 위로 솟는 금빛 기둥
    const beamMat = new THREE.MeshBasicMaterial({ color: '#ffe082', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 1.6, 24, 1, true), beamMat);
    beam.position.y = 0.8;
    group.add(beam);
    const stars = [];
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      const a = (i / 14) * Math.PI * 2;
      sp.userData = { a, r: 0.25 + Math.random() * 0.3, speed: 0.8 + Math.random() * 1.2, phase: Math.random() * 6.3 };
      group.add(sp);
      stars.push(sp);
    }
    return tween(ms, k => {
      t.flash = 0.9 * Math.abs(Math.sin(k * Math.PI * 3));
      const fade = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      ring.scale.setScalar(0.8 + 0.4 * Math.sin(k * Math.PI * 3) ** 2);
      ringMat.opacity = fade;
      beam.scale.y = Math.min(1, k * 5);
      beam.position.y = 0.8 * beam.scale.y;
      beamMat.opacity = fade * (0.35 + 0.2 * Math.sin(k * Math.PI * 6));
      for (const sp of stars) {
        const u = sp.userData;
        const ang = u.a + k * 2.5;
        sp.position.set(Math.cos(ang) * u.r, 0.15 + k * u.speed, Math.sin(ang) * u.r);
        const tw = 0.5 + 0.5 * Math.sin(k * 20 + u.phase);
        sp.scale.setScalar(0.22 + 0.3 * tw);
        sp.material.opacity = fade * (0.5 + 0.5 * tw);
      }
    }).then(() => {
      t.flash = 0;
      scene.remove(group);
      ringMat.dispose();
      beamMat.dispose();
      beam.geometry.dispose();
      for (const sp of stars) sp.material.dispose();
    });
  }

  // ───────── 트윈 ─────────
  function tween(ms, fn) {
    return new Promise(res => {
      if (ms <= 0) { fn(1); res(); return; }
      tweens.push({ t: 0, dur: ms / 1000, fn, res });
    });
  }
  function stepTweens(dt) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(k);
      if (k >= 1) { tweens.splice(i, 1); tw.res(); }
    }
  }

  // ───────── 카메라 / 입력 ─────────
  function placeCamera(dist) {
    camera.position.set(
      target.x + Math.sin(cam.az) * Math.cos(cam.el) * dist,
      Math.sin(cam.el) * dist,
      target.z + Math.cos(cam.az) * Math.cos(cam.el) * dist);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }
  // 보드 네 모서리가 화면 안에 꼭 맞게 들어오는 거리 (이분 탐색)
  let fitKey = '', fitDist = 16, fitShift = 0;
  const corners = () => [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => new THREE.Vector3(sx * (5.5 * SX + 0.3), 0, sz * 5.8));
  function fitDistance() {
    const key = `${cam.az.toFixed(3)}|${cam.el.toFixed(3)}|${camera.aspect.toFixed(3)}`;
    if (key === fitKey) return fitDist;
    camera.clearViewOffset();
    let lo = 4, hi = 60;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      placeCamera(mid);
      const fits = corners().every(c => {
        const p = c.clone().project(camera);
        return Math.abs(p.x) < 0.98 && Math.abs(p.y) < 0.985;
      });
      if (fits) hi = mid; else lo = mid;
    }
    fitKey = key;
    fitDist = hi;
    // 가로 화면: 판을 왼쪽 끝에 붙여서 왼쪽 여백이 남지 않게 (남는 공간은 오른쪽으로)
    fitShift = 0;
    placeCamera(hi);
    const xs = corners().map(c => c.clone().project(camera).x);
    const w = canvas.clientWidth;
    if (camera.aspect > 1.2) fitShift = Math.max(0, (Math.min(...xs) + 0.98) / 2 * w);
    // 판 오른쪽 끝의 화면 위치(px)를 CSS로 알려줌 → 자세히 보기 창을 판 옆 빈 공간에 맞춰 염
    const right = Math.round((Math.max(...xs) + 1) / 2 * w - fitShift);
    document.documentElement.style.setProperty('--board-right', `${right}px`);
    return hi;
  }
  function updateCamera() {
    const dist = fitDistance();
    placeCamera(dist * cam.zoom);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (fitShift > 0 && cam.zoom >= 1) camera.setViewOffset(w, h, fitShift, 0, w, h);
    else camera.clearViewOffset();
  }

  let userTilted = false; // 사용자가 직접 기울기를 바꿨으면 자동 조정 안 함
  // 가로 화면 카메라 기울기: 거의 위에서 내려다봐서 먼 쪽(위쪽) 도시도 가까운 쪽만큼 잘 보이게
  const LANDSCAPE_EL = 1.33;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // 가로로 넓은 화면에서는 조금 더 위에서 내려다봐서 판이 화면 높이를 꽉 채우게
    if (!userTilted) cam.el = camera.aspect > 1.2 ? LANDSCAPE_EL : 0.98;
  }

  function setupInput() {
    const pointers = new Map();
    let down = null, pinch = null;
    const pinchDist = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y) || 1;
    };
    canvas.addEventListener('pointerdown', e => {
      Sound.ensure();
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        down = { x: e.clientX, y: e.clientY, t: performance.now(), lx: e.clientX, ly: e.clientY, moved: false };
      } else if (pointers.size === 2) {
        pinch = { d: pinchDist(), zoom: cam.zoom };
        down = null;
      }
    });
    canvas.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) {
        cam.zoom = Math.min(1.5, Math.max(0.55, pinch.zoom * pinch.d / pinchDist()));
        return;
      }
      if (!down) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down.moved = true;
      if (down.moved && !throwArmed) {
        userTilted = true;
        cam.az -= (e.clientX - down.lx) * 0.008;
        cam.el = Math.min(1.4, Math.max(0.55, cam.el + (e.clientY - down.ly) * 0.005));
      }
      down.lx = e.clientX;
      down.ly = e.clientY;
    });
    const up = e => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      const dist = Math.hypot(dx, dy), ms = Math.max(1, performance.now() - down.t);
      if (!down.moved) {
        tap(e);
      } else if (throwArmed && dist > 40) {
        const f = forwardVec();
        const right = new THREE.Vector3(-f.z, 0, f.x);
        const dir = right.multiplyScalar(dx).add(f.multiplyScalar(-dy));
        const power = Math.min(15, Math.max(7, dist / ms * 8));
        const cb = throwArmed;
        throwArmed = null;
        cb({ dir, power });
      }
      down = null;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); down = null; pinch = null; });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      cam.zoom = Math.min(1.5, Math.max(0.55, cam.zoom * (1 + e.deltaY * 0.001)));
    }, { passive: false });
  }

  function tap(e) {
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(tiles.map(t => t.top))[0];
    if (hit && handlers.onTileTap) handlers.onTileTap(hit.object.userData.idx);
  }

  // ───────── 메인 루프 ─────────
  let lastFrame = 0;
  function loop() {
    requestAnimationFrame(loop);
    tick();
  }
  function tick() {
    lastFrame = performance.now();
    // 프레임이 밀려도 애니메이션은 실제 시간을 따라감 (물리는 미리 계산해 두므로 큰 dt도 안전)
    const dt = Math.min(clock.getDelta(), 0.5);
    time += dt;
    stepTweens(dt);
    if (playing) stepPlayback(dt);
    for (const id in tokens) {
      const tok = tokens[id];
      if (tok.moving) continue;
      tok.group.position.y = TOP + (tok.current ? Math.abs(Math.sin(time * 3.2)) * 0.12 : 0);
    }
    const glow = choosing ? 0.25 + 0.2 * Math.sin(time * 6) : 0;
    for (const t of tiles) t.top.material.emissiveIntensity = Math.max(t.space ? 0 : glow, t.flash || 0);
    updateCamera();
    renderer.render(scene, camera);
  }

  // ───────── 공개 API ─────────
  return {
    init(canvasEl, cells, h) {
      canvas = canvasEl;
      handlers = h;
      // 가로로 긴 화면이면 판을 아주 살짝만 가로로 늘림 (가로:세로 ≈ 1.25:1)
      SX = canvas.clientWidth / Math.max(1, canvas.clientHeight) > 1.3 ? 1.25 : 1;
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      scene = new THREE.Scene();
      scene.background = new THREE.Color('#0d1a30');
      camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
      clock = new THREE.Clock();
      raycaster = new THREE.Raycaster();

      scene.add(new THREE.HemisphereLight('#e3ecff', '#2c2c44', 0.85));
      const sun = new THREE.DirectionalLight('#fff3e0', 0.95);
      sun.position.set(5, 12, 6);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -7 * SX, right: 7 * SX, top: 7, bottom: -7, near: 1, far: 30 });
      sun.shadow.bias = -0.0005;
      scene.add(sun);

      const base = new THREE.Mesh(new THREE.BoxGeometry(11 * SX + 0.6, 0.4, 11.6), new THREE.MeshStandardMaterial({ color: '#1b2c4a', roughness: 0.6 }));
      base.position.y = -0.2;
      base.receiveShadow = true;
      scene.add(base);
      const center = new THREE.Mesh(new THREE.PlaneGeometry(9 * SX, 9), new THREE.MeshStandardMaterial({ map: centerTexture(), roughness: 0.9 }));
      center.rotation.x = -Math.PI / 2;
      center.position.y = 0.02;
      center.receiveShadow = true;
      scene.add(center);

      const sideMat = new THREE.MeshStandardMaterial({ color: '#d9cfb8', roughness: 0.8 });
      const aniso = renderer.capabilities.getMaxAnisotropy();
      for (const cell of cells) {
        const f = tileFrame(cell.idx);
        const block = new THREE.Mesh(new THREE.BoxGeometry(0.96 * SX, 0.1, 0.96), sideMat);
        block.position.copy(f.center).setY(0.05);
        block.receiveShadow = true;
        scene.add(block);
        const cv = document.createElement('canvas');
        cv.width = Math.round(256 * SX);
        cv.height = 256;
        const tex = new THREE.CanvasTexture(cv);
        tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = aniso;
        const top = new THREE.Mesh(new THREE.PlaneGeometry(0.94 * SX, 0.94),
          new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, emissive: new THREE.Color('#ffd54f'), emissiveIntensity: 0 }));
        top.rotation.x = -Math.PI / 2;
        top.position.copy(f.center).setY(TOP + 0.001);
        top.receiveShadow = true;
        top.userData.idx = cell.idx;
        scene.add(top);
        tiles[cell.idx] = { ...f, top, ctx: cv.getContext('2d'), tex, key: null, space: cell.type === 'space' };
        drawTile(cell.idx, cell, null);
      }

      setupPhysics();
      setupInput();
      new ResizeObserver(resize).observe(canvas);
      resize();
      loop();
      // 화면 갱신(requestAnimationFrame)이 멈춰도 주사위·이동이 끝까지 진행되도록 보조 타이머
      setInterval(() => { if (performance.now() - lastFrame > 200) tick(); }, 50);
    },

    initTokens(players) {
      for (const p of players) {
        if (tokens[p.id]) continue; // 이미 있는 말은 그대로 (온라인 재접속 시)
        const g = makeToken(p.animal, p.color);
        g.position.copy(slotPos(p.pos, p.id));
        g.rotation.y = -Math.PI / 2;
        scene.add(g);
        tokens[p.id] = { group: g, idx: p.pos, moving: false, current: false };
      }
    },

    sync(game) {
      for (const c of game.cells) {
        const owner = c.owner !== null ? game.players[c.owner] : null;
        const key = `${c.owner}|${c.level}|${owner ? tollOf(c) : ''}`;
        const t = tiles[c.idx];
        if (t.key === key) continue;
        const levelChanged = !t.key || t.key.split('|')[1] !== String(c.level) || t.key.split('|')[0] !== String(c.owner);
        t.key = key;
        drawTile(c.idx, c, owner);
        if (levelChanged) setBuilding(c.idx, c.level, owner);
      }
      for (const p of game.players) {
        const tok = tokens[p.id];
        if (!tok) continue;
        tok.group.visible = !p.bankrupt;
        tok.current = game.current === p;
        if (!tok.moving && !tok.queued && tok.idx !== p.pos) {
          tok.group.position.copy(slotPos(p.pos, p.id));
          tok.idx = p.pos;
        }
      }
    },

    // 한 칸 점프. 연달아 들어오면 차례대로 이어서 뜀 (온라인에서 메시지가 몰려 와도 순서 유지)
    hop(p, idx, ms) {
      const tok = tokens[p.id];
      if (!tok) return Promise.resolve();
      tok.queued = (tok.queued || 0) + 1;
      const run = () => {
        const from = tok.group.position.clone().setY(TOP);
        const to = slotPos(idx, p.id);
        tok.moving = true;
        tok.group.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
        const height = 0.35 + Math.min(1.5, from.distanceTo(to) * 0.15);
        return tween(ms, k => {
          tok.group.position.lerpVectors(from, to, k);
          tok.group.position.y = TOP + Math.sin(Math.PI * k) * height;
        }).then(() => {
          tok.idx = idx;
          tok.moving = false;
          tok.queued--;
          if (ms > 0) Sound.step();
        });
      };
      tok.chain = (tok.chain || Promise.resolve()).then(run);
      return tok.chain;
    },

    simulateThrow,
    playRecording,
    rollDice,
    moneyFlow,
    sparkTile,
    // 칸 위에 글자 띄우기 (예: 매각 +15만)
    tileLabel(idx, text, color) { if (tiles[idx]) floatLabel(tiles[idx].center.clone().setY(TOP + 0.3), text, color); },
    // 카메라 직접 조정 (확대 정도, 회전, 바라보는 지점)
    setView({ zoom, az, el, x, z } = {}) {
      if (zoom !== undefined) cam.zoom = zoom;
      if (az !== undefined) cam.az = az;
      if (el !== undefined) cam.el = el;
      if (x !== undefined) target.x = x;
      if (z !== undefined) target.z = z;
      fitKey = '';
      updateCamera();
      renderer.render(scene, camera);
    },
    setChoosing(v) { choosing = v; },
    armThrow(cb) { throwArmed = cb; },
    disarmThrow() { throwArmed = null; },
  };
})();
