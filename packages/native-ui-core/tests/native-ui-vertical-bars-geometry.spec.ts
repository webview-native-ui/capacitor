import { afterEach, expect, test } from 'vitest';
import {
  alignVerticalBarClone,
  rememberVerticalBarFrame,
  placeModalRailTarget,
  removeEmptyModalRailSlot,
} from '../src/native/shared/vertical-bars-geometry';

afterEach(() => document.body.replaceChildren());

for (const border of [0, 1 / 3, 1]) {
  test(`rail fallback preserves viewport coordinates with a ${border}px group border`, () => {
    const parent = document.createElement('div');
    const source = document.createElement('ion-button');
    const clone = document.createElement('ion-button');
    parent.style.border = `${border}px solid black`;
    parent.append(clone);
    document.body.append(parent, source);
    parent.getBoundingClientRect = () => DOMRect.fromRect({ x: 394, y: 170, width: 48, height: 100 });
    rememberVerticalBarFrame(source, { x: 394, y: 222, width: 48, height: 48 });
    alignVerticalBarClone(clone, source, parent);
    expect(394 + border + parseFloat(clone.style.left)).toBeCloseTo(394, 5);
    expect(170 + border + parseFloat(clone.style.top)).toBeCloseTo(222, 5);
    expect(clone.style.width).toBe('48px');
    expect(clone.style.height).toBe('48px');
  });
}

for (const themed of [false, true]) {
  test(`modal rail only moves inert targets when theme metrics=${themed}`, () => {
    const modal = document.createElement('ion-modal');
    modal.attachShadow({ mode: 'open' }).innerHTML =
      '<div role="dialog" aria-modal="true" style="transform:translateY(100px)"><slot></slot></div>';
    const dialog = modal.shadowRoot!.querySelector('[role="dialog"]')!;
    const target = document.createElement('ion-button');
    target.style.cssText = 'position:absolute;top:174px';
    modal.append(target);
    document.body.append(modal);
    if (themed) modal.style.setProperty('--ios-theme-vertical-bars-modal-toolbar-top', '32px');

    placeModalRailTarget(target, modal);
    expect(target.assignedSlot?.parentElement).toBe(dialog);
    expect(target.style.top).toBe('174px');
    target.inert = true;
    placeModalRailTarget(target, modal);
    if (themed) expect(target.assignedSlot?.parentNode).toBe(modal.shadowRoot);
    else {
      expect(target.assignedSlot?.parentElement).toBe(dialog);
      expect(target.style.top).toBe('174px');
    }

    target.remove();
    removeEmptyModalRailSlot(modal);
    expect(modal.shadowRoot!.querySelector('slot[data-native-ui-projection-node]')).toBeNull();
  });
}
