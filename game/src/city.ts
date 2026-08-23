/**
 * The city scene: Babylon 9, phone-first. The SQL district is a short
 * street of four lamp posts, one per drill; the rest of the city sits as
 * dim ambient lamps on the horizon (their real-state wiring is P1 work).
 *
 * Contracts: buildCity() returns handles keyed by drill id; setLampState()
 * moves a lamp between dark / flicker / lit and is the ONLY way state
 * reaches the scene. Real dynamic lights are capped (one per drill lamp
 * plus ambient glow) to hold a phone at 60fps; everything brighter is
 * emissive + glow layer, which is the cheap path.
 */
import {
  Engine, Scene, ArcRotateCamera, Vector3, Color3, Color4,
  MeshBuilder, StandardMaterial, GlowLayer, PointLight, Mesh,
} from '@babylonjs/core';

export type LampState = 'dark' | 'flicker' | 'lit';

export interface CityHandles {
  scene: Scene;
  setLampState: (id: string, s: LampState) => void;
  /** The performed moment: camera drifts to the lamp and it flares bright
   *  before settling to lit. Reduced-motion gets the settled state only. */
  pulseLamp: (id: string) => void;
  onLampTap: (cb: (id: string) => void) => void;
}

const GOLD = new Color3(0.79, 0.66, 0.42);
const GOLD_HI = new Color3(0.91, 0.79, 0.53);
const DIM = new Color3(0.2, 0.19, 0.23);

export interface LampSpec { id: string; row: number; }

export function buildCity(canvas: HTMLCanvasElement, specs: LampSpec[]): CityHandles {
  const engine = new Engine(canvas, true, { adaptToDeviceRatio: true });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.059, 0.051, 0.078, 1);

  const camera = new ArcRotateCamera('cam', -Math.PI / 2, 1.12, 16, new Vector3(0, 1.2, 0), scene);
  camera.lowerRadiusLimit = 9; camera.upperRadiusLimit = 26;
  camera.attachControl(canvas, true);
  camera.useAutoRotationBehavior = true;
  camera.autoRotationBehavior!.idleRotationSpeed = 0.05;

  const glow = new GlowLayer('glow', scene, { blurKernelSize: 48 });
  glow.intensity = 0.9;

  const ground = MeshBuilder.CreateGround('ground', { width: 60, height: 60 }, scene);
  const gmat = new StandardMaterial('gmat', scene);
  gmat.diffuseColor = new Color3(0.075, 0.065, 0.095);
  gmat.specularColor = Color3.Black();
  ground.material = gmat;

  interface Lamp { head: Mesh; mat: StandardMaterial; light: PointLight; state: LampState; phase: number; }
  const lamps = new Map<string, Lamp>();

  const streetCount = specs.filter(s => s.row === 0).length;
  let streetIdx = 0, shelfIdx = 0;
  for (const { id, row } of specs) {
    // row 0: the drill street up front. row 1+: the book shelves behind it,
    // eight smaller lamps per shelf line.
    let x: number, z: number, headY: number, dia: number;
    if (row === 0) {
      x = (streetIdx - (streetCount - 1) / 2) * 3.2; z = 0; headY = 2.85; dia = 0.62; streetIdx++;
    } else {
      x = ((shelfIdx % 8) - 3.5) * 2.0; z = -5 - Math.floor(shelfIdx / 8) * 2.2; headY = 1.9; dia = 0.4; shelfIdx++;
    }
    const post = MeshBuilder.CreateCylinder(`post-${id}`, { height: headY - 0.25, diameter: 0.1 }, scene);
    post.position.set(x, (headY - 0.25) / 2, z);
    const pmat = new StandardMaterial(`pm-${id}`, scene);
    pmat.diffuseColor = new Color3(0.16, 0.14, 0.19); pmat.specularColor = Color3.Black();
    post.material = pmat;

    const head = MeshBuilder.CreateSphere(`lamp-${id}`, { diameter: dia }, scene);
    head.position.set(x, headY, z);
    const mat = new StandardMaterial(`lm-${id}`, scene);
    mat.diffuseColor = DIM; mat.emissiveColor = DIM.scale(0.7); mat.specularColor = Color3.Black();
    head.material = mat;

    const light = new PointLight(`pl-${id}`, head.position.clone(), scene);
    light.diffuse = GOLD; light.intensity = 0; light.range = row === 0 ? 7 : 4;

    // widen the tap target: an invisible sphere around the head
    const hit = MeshBuilder.CreateSphere(`hit-${id}`, { diameter: dia * 2.8 }, scene);
    hit.position.copyFrom(head.position); hit.isVisible = false; hit.isPickable = true;
    head.isPickable = true;

    lamps.set(id, { head, mat, light, state: 'dark', phase: Math.random() * 6.28 });
  }

  // ambient horizon lamps: the rest of the city, dim until P1 wires real state
  for (let i = 0; i < 46; i++) {
    const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * 16;
    const dot = MeshBuilder.CreateSphere(`amb-${i}`, { diameter: 0.16 + Math.random() * 0.14 }, scene);
    dot.position.set(Math.cos(a) * r, 0.4 + Math.random() * 2.2, Math.sin(a) * r);
    const m = new StandardMaterial(`am-${i}`, scene);
    const warm = Math.random() < 0.35;
    m.emissiveColor = warm ? GOLD.scale(0.35 + Math.random() * 0.25) : DIM.scale(0.5);
    m.specularColor = Color3.Black();
    dot.material = m; dot.isPickable = false;
  }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pulse: { lamp: Lamp; until: number } | null = null;
  let focusTarget: Vector3 | null = null;
  scene.onBeforeRenderObservable.add(() => {
    const t = performance.now() / 1000;
    for (const l of lamps.values()) {
      if (l.state === 'flicker' && !reduced) {
        const f = 0.35 + 0.3 * Math.abs(Math.sin(l.phase + t * 2.4));
        l.mat.emissiveColor = GOLD.scale(f);
        l.light.intensity = f * 0.5;
      }
    }
    if (pulse) {
      const left = pulse.until - performance.now();
      if (left <= 0) {
        pulse.lamp.mat.emissiveColor = GOLD_HI.scale(1.0);
        pulse.lamp.light.intensity = 0.85;
        pulse = null;
      } else {
        const k = 1 + (left / 1200) * 2.2; // flare decays to the settled glow
        pulse.lamp.mat.emissiveColor = GOLD_HI.scale(Math.min(2.6, k));
        pulse.lamp.light.intensity = 0.85 * k;
      }
    }
    if (focusTarget) {
      camera.target = Vector3.Lerp(camera.target, focusTarget, 0.06);
      if (Vector3.Distance(camera.target, focusTarget) < 0.05) focusTarget = null;
    }
  });

  let tapCb: (id: string) => void = () => {};
  scene.onPointerDown = (_e, pick) => {
    const name = pick?.pickedMesh?.name || '';
    const m = name.match(/^(?:lamp|hit)-(.+)$/);
    if (m) tapCb(m[1]);
  };

  engine.runRenderLoop(() => scene.render());
  addEventListener('resize', () => engine.resize());

  return {
    scene,
    pulseLamp(id) {
      const l = lamps.get(id); if (!l) return;
      l.state = 'lit';
      focusTarget = l.head.position.clone();
      if (reduced) { l.mat.emissiveColor = GOLD_HI.scale(1.0); l.light.intensity = 0.85; return; }
      pulse = { lamp: l, until: performance.now() + 1200 };
    },
    setLampState(id, s) {
      const l = lamps.get(id); if (!l) return;
      l.state = s;
      if (s === 'dark') { l.mat.emissiveColor = DIM.scale(0.7); l.light.intensity = 0; }
      if (s === 'flicker') { l.mat.emissiveColor = GOLD.scale(0.5); l.light.intensity = 0.3; }
      if (s === 'lit') { l.mat.emissiveColor = GOLD_HI.scale(1.0); l.light.intensity = 0.85; }
    },
    onLampTap(cb) { tapCb = cb; },
  };
}
