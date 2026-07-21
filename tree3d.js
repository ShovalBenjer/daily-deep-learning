// העץ in three dimensions: three standing steles, ranks light the stones.
// Restraint kept: ink-void, warm gold emissive, one red for the chosen node.
export async function mountTree3D(host, api) {
  const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js');
  const css = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const W = host.clientWidth, H = Math.max(420, Math.min(560, innerHeight * 0.55));
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W, H);
  host.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'width:100%;height:auto;display:block;touch-action:pan-y;cursor:grab';

  const scene = new THREE.Scene();
  const dark = () => document.documentElement.dataset.theme !== 'light';
  const bg = () => new THREE.Color(dark() ? '#101116' : '#efe9da');
  scene.background = bg();
  scene.fog = new THREE.Fog(bg(), 14, 34);

  const camera = new THREE.PerspectiveCamera(46, W / H, 0.1, 100);
  const aspect = W / H;
  camera.position.set(0, 3.2, aspect < 1 ? 21 : 13);
  camera.lookAt(0, 3.6, 0);

  scene.add(new THREE.AmbientLight(0xffffff, dark() ? 0.35 : 0.8));
  const key = new THREE.DirectionalLight(0xfff2dd, dark() ? 1.1 : 0.9);
  key.position.set(4, 8, 6); scene.add(key);
  const ember = new THREE.PointLight(0xc9a86a, 1.4, 18); ember.position.set(0, 2, 5); scene.add(ember);

  const GOLD = new THREE.Color('#c9a86a'), RED = new THREE.Color(css('--red') || '#9e2b25');
  const STONE = () => new THREE.Color(dark() ? '#2a2b33' : '#cfc7b2');
  const root = new THREE.Group(); scene.add(root);

  const label = (text, size = 240) => {
    const c = document.createElement('canvas'); c.width = size * 2; c.height = 64 * 2;
    const x = c.getContext('2d'); x.scale(2, 2);
    x.font = '700 24px "Frank Ruhl Libre", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = dark() ? '#e6e1d4' : '#1a1b21'; x.fillText(text, size / 2, 32);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    s.scale.set(size / 64, 1, 1); return s;
  };

  const pickables = [];
  const treeGap = 6.4;
  api.talents.trees.forEach((tree, ti) => {
    const g = new THREE.Group();
    g.position.x = (ti - 1) * treeGap;
    // the stele
    const stele = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 8.6, 0.9),
      new THREE.MeshStandardMaterial({ color: STONE(), roughness: 0.85, metalness: 0.05 }));
    stele.position.y = 3.6; g.add(stele);
    const tl = label(tree.name, 200); tl.position.set(0, 8.6, 0); g.add(tl);

    tree.tiers.forEach((tier, tj) => {
      tier.nodes.forEach((n, nk) => {
        const d = api.domainOf(n.id);
        const side = nk % 2 === 0 ? -1 : 1;
        const y = 6.6 - tj * 2.5, x = side * 1.55, z = 0.35 * (nk % 2 ? 1 : -1);
        const rank = api.rank(n.id), maxR = api.talents.max_rank;
        const lit = rank / maxR;
        const tablet = new THREE.Mesh(
          new THREE.CylinderGeometry(0.62, 0.62, 0.22, 6),
          new THREE.MeshStandardMaterial({
            color: STONE().lerp(GOLD, lit * 0.55),
            emissive: GOLD.clone(), emissiveIntensity: lit * 0.85,
            roughness: 0.55, metalness: 0.25
          }));
        tablet.rotation.x = Math.PI / 2; tablet.rotation.z = Math.PI / 6;
        tablet.position.set(x, y, z);
        tablet.userData = { treeId: tree.id, node: n, phase: Math.random() * Math.PI * 2, baseY: y };
        g.add(tablet); pickables.push(tablet);
        const nl = label(d.name, 170); nl.position.set(x, y - 0.85, z); nl.scale.multiplyScalar(0.72); g.add(nl);
        // filament to stele
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, y, 0), new THREE.Vector3(x, y, z)]),
          new THREE.LineBasicMaterial({ color: rank > 0 ? GOLD : STONE(), transparent: true, opacity: rank > 0 ? 0.9 : 0.35 }));
        g.add(line);
      });
    });
    root.add(g);
  });

  // interaction: horizontal drag orbits, tap selects
  let dragging = false, px = 0, vel = 0, rotY = 0, moved = 0, selMesh = null;
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  const el = renderer.domElement;
  el.addEventListener('pointerdown', e => { dragging = true; moved = 0; px = e.clientX; el.style.cursor = 'grabbing'; });
  addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - px; px = e.clientX; moved += Math.abs(dx);
    vel = dx * 0.004;
  }, { passive: true });
  addEventListener('pointerup', e => {
    if (!dragging) return; dragging = false; el.style.cursor = 'grab';
    if (moved < 6) {
      const r = el.getBoundingClientRect();
      ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ptr, camera);
      const hit = ray.intersectObjects(pickables)[0];
      if (hit) {
        if (selMesh) selMesh.material.emissive.copy(GOLD);
        selMesh = hit.object;
        selMesh.material.emissive.copy(RED);
        selMesh.material.emissiveIntensity = Math.max(0.6, selMesh.material.emissiveIntensity);
        api.onSelect(selMesh.userData.treeId, selMesh.userData.node);
      }
    }
  });

  let raf = null; const clock = new THREE.Clock();
  function frame() {
    raf = requestAnimationFrame(frame);
    const t = clock.getElapsedTime();
    rotY += vel; vel *= 0.94;
    root.rotation.y = rotY;
    if (!reduced) {
      pickables.forEach(m => { m.position.y = m.userData.baseY + Math.sin(t * 0.7 + m.userData.phase) * 0.06; });
      ember.position.x = Math.sin(t * 0.3) * 4;
    }
    renderer.render(scene, camera);
  }
  frame();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = null; }
    else if (!raf) frame();
  });

  return {
    refresh() {
      pickables.forEach(m => {
        const rank = api.rank(m.userData.node.id), lit = rank / api.talents.max_rank;
        if (m !== selMesh) {
          m.material.color = STONE().lerp(GOLD, lit * 0.55);
          m.material.emissive.copy(GOLD);
        }
        m.material.emissiveIntensity = Math.max(m === selMesh ? 0.6 : 0, lit * 0.85);
      });
    },
    dispose() { cancelAnimationFrame(raf); renderer.dispose(); host.innerHTML = ''; }
  };
}
