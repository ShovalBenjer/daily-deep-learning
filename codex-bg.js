// The living layer: a slow drift of gold and violet motes behind the codex.
// Restrained on purpose: one draw call, DPR-capped, paused when hidden,
// absent entirely under prefers-reduced-motion.
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  import('https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js').then(THREE => {
    const canvas = document.getElementById('codexbg');
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x151320, 0.055);
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 100);
    camera.position.z = 16;

    const N = 420;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), seed = new Float32Array(N);
    const palette = [
      new THREE.Color(0xc9a86a), new THREE.Color(0xc9a86a), new THREE.Color(0xc9a86a), // gold, weighted
      new THREE.Color(0xa98fd6),  // oracle violet
      new THREE.Color(0x7fa3dc),  // warden blue
      new THREE.Color(0xcd9273)   // architect copper
    ];
    for (let i = 0; i < N; i++) {
      const r = 7 + Math.random() * 16, th = Math.random() * Math.PI * 2, y = (Math.random() - 0.5) * 26;
      pos[i * 3] = Math.cos(th) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(th) * r - 6;
      const c = palette[(Math.random() * palette.length) | 0];
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      seed[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.09, vertexColors: true, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    const themeOpacity = () =>
      mat.opacity = document.documentElement.dataset.theme === 'light' ? 0.3 : 0.8;
    new MutationObserver(themeOpacity)
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    themeOpacity();

    let px = 0, py = 0, tx = 0, ty = 0;
    addEventListener('pointermove', e => {
      tx = (e.clientX / innerWidth - 0.5) * 0.9;
      ty = (e.clientY / innerHeight - 0.5) * 0.6;
    }, { passive: true });

    const resize = () => {
      renderer.setSize(innerWidth, innerHeight, false);
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    };
    addEventListener('resize', resize); resize();

    const p = geo.attributes.position;
    let raf = null;
    const tick = t => {
      raf = requestAnimationFrame(tick);
      const s = t * 0.001;
      points.rotation.y = s * 0.016;
      for (let i = 0; i < N; i++) p.array[i * 3 + 1] += Math.sin(s * 0.5 + seed[i]) * 0.0022;
      p.needsUpdate = true;
      px += (tx - px) * 0.03; py += (ty - py) * 0.03;
      camera.position.x = px * 1.6;
      camera.position.y = -py * 1.2 - scrollY * 0.0012;
      camera.lookAt(0, camera.position.y * 0.6, -4);
      renderer.render(scene, camera);
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = null; }
      else if (!raf) raf = requestAnimationFrame(tick);
    });
    raf = requestAnimationFrame(tick);
  }).catch(() => { /* the codex works without its living layer */ });
}
