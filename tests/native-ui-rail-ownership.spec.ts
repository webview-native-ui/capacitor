import { afterEach, expect, test, vi } from 'vitest';
import type { NativeUIHandle, NativeUISnapshot } from '../src/native/definitions';

const bridge = vi.hoisted(() => ({
  coveredSnapshots: false,
  configure: vi.fn(async () => ({ supported: true, verticalBars: true, coveredSnapshots: bridge.coveredSnapshots })),
  getWebViewMetrics: vi.fn(async () => ({ radius: 0, verticalBarEdge: 'trailing' })),
  getVerticalBarsGeometry: vi.fn(async () => ({ items: {} })),
  addListener: vi.fn(async () => ({ remove: async () => {} })),
  update: vi.fn(async (snapshot: NativeUISnapshot) => ({ revision: snapshot.revision })),
  clear: vi.fn(async () => {}),
  coveredSnapshot: vi.fn(async () => ({})),
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'ios', isPluginAvailable: () => true },
  registerPlugin: () => bridge,
}));
import { enableNativeUI } from '../src/native';

let shell: NativeUIHandle | undefined;
afterEach(async () => {
  await shell?.destroy();
  shell = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

// Exercise activation's actual availability callback and native source bookkeeping,
// rather than keeping the Web adapter enabled after the native acknowledgement.
test.each([false, true])('nested rail controls stay stable after native ACK (snapshots=%s)', async (snapshots) => {
  bridge.coveredSnapshots = snapshots;
  document.body.innerHTML = `<ion-app class="ios-theme-vertical-bars"><main class="ion-page" id="shell"><ion-tabs><ion-router-outlet><main class="ion-page" id="tab">
    <ion-header><ion-toolbar class="ios"><ion-buttons slot="start"><ion-back-button class="ios hydrated"></ion-back-button></ion-buttons>
    <ion-button class="ios" data-vertical-bars="true">Save</ion-button></ion-toolbar></ion-header>
    </main></ion-router-outlet></ion-tabs></main></ion-app>`;
  const source = document.querySelector<HTMLElement>('ion-back-button')!;
  source.attachShadow({ mode: 'open' }).innerHTML = '<button part="native"><span part="text">Back</span></button>';
  const elements = [...document.querySelectorAll<HTMLElement>('*'), ...source.shadowRoot!.querySelectorAll<HTMLElement>('*')];
  for (const element of elements) {
    element.style.cssText = 'display:block;visibility:visible;opacity:1;transform:none;overflow:visible;color:rgb(0,0,0)';
    element.getBoundingClientRect = () => DOMRect.fromRect({ x: 10, y: 10, width: 100, height: 44 });
  }
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as MediaQueryList);
  shell = await enableNativeUI({ controls: 'verticalOnly' });
  // Only the outer routed shell gets Ionic lifecycle events.
  document.querySelector('#shell')!.dispatchEvent(new CustomEvent('ionViewWillEnter', { bubbles: true }));
  await vi.waitFor(() => expect(source.hasAttribute('data-native-ui-vertical-bars')).toBe(true));
  await vi.waitFor(() => expect(shell!.getStatus().state).toBe('native'));
  const first = [...document.querySelectorAll('ion-app > .ion-cloned-element')];
  const added: Node[] = [];
  const observer = new MutationObserver((records) => added.push(...records.flatMap((record) => Array.from(record.addedNodes))));
  observer.observe(document.querySelector('ion-app')!, { childList: true });
  try {
    for (let n = 0; n < 3; n++) {
      source.title = `updated ${n}`;
      shell.markForCheck();
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }
    expect(source.hasAttribute('data-native-ui-projected')).toBe(true);
    expect(added.filter((node) => node instanceof Element && node.matches('.ion-cloned-element'))).toHaveLength(0);
    expect([...document.querySelectorAll('ion-app > .ion-cloned-element')]).toEqual(first);
    document.querySelector('#shell')!.dispatchEvent(new CustomEvent('ionViewDidEnter', { bubbles: true }));
  } finally {
    observer.disconnect();
  }
});
