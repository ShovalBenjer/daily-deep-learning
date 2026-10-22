/**
 * city.ts behavioral tests on the NullEngine: the scene graph is exercised
 * with no WebGL and no DOM canvas.
 */
import { describe, test, expect, beforeAll } from 'bun:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { StandardMaterial } from '@babylonjs/core';
import { buildCity, type CityHandles } from '../src/city';

function stubBrowser() {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!g['matchMedia']) {
    g['matchMedia'] = () => ({
      matches: false, media: '', onchange: null,
      addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {}, dispatchEvent() { return false; },
    });
  }
  if (!g['requestAnimationFrame']) {
    g['requestAnimationFrame'] = (cb: (t: number) => void) => setTimeout(() => cb(performance.now()), 16);
  }
}

function fakeCanvas(): HTMLCanvasElement {
  return {
    width: 390, height: 844,
    addEventListener() {}, removeEventListener() {},
    style: {},
  } as unknown as HTMLCanvasElement;
}

const SPECS = [
  { id: 'lamp-a', row: 0 }, { id: 'lamp-b', row: 0 },
  { id: 'lamp-c', row: 0 }, { id: 'lamp-d', row: 0 },
];

let city: CityHandles;
beforeAll(() => {
  stubBrowser();
  city = buildCity(fakeCanvas(), SPECS, () => new NullEngine());
});

describe('scene graph', () => {
  test('builds 4 lamps from specs', () => {
    for (const s of SPECS) {
      expect(city.scene.getMeshByName(`lamp-${s.id}`)).not.toBeNull();
      expect(city.scene.getMeshByName(`hit-${s.id}`)).not.toBeNull();
    }
  });

  test("setLampState('lit') changes the lamp material emissive", () => {
    city.setLampState('lamp-a', 'lit');
    const mat = city.scene.getMaterialByName('lm-lamp-a') as StandardMaterial | null;
    expect(mat).not.toBeNull();
    // GOLD_HI (0.91, 0.79, 0.53): the lit emissive, exactly
    expect(mat!.emissiveColor.r).toBeCloseTo(0.91, 5);
    expect(mat!.emissiveColor.g).toBeCloseTo(0.79, 5);
    expect(mat!.emissiveColor.b).toBeCloseTo(0.53, 5);
  });

  test('tap callback fires with the tapped lamp id', () => {
    const tapped: string[] = [];
    city.onLampTap(id => tapped.push(id));
    const pick = { pickedMesh: { name: 'hit-lamp-c' } };
    const handler = city.scene.onPointerDown;
    expect(handler).not.toBeNull();
    (handler as unknown as (e: null, pick: unknown) => void)(null, pick);
    expect(tapped).toEqual(['lamp-c']);
  });
});
