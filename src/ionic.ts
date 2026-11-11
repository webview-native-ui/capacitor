import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { enableNativeUI, type NativeUIHandle, type NativeUIOptions } from './index.js';
import { resolveVerticalBarsLayout } from './native-integration/index.js';

export interface IonicDeviceLayoutState {
  readonly verticalBars: boolean;
  readonly expandedFold: boolean;
}

export interface IonicNativeUIOptions extends NativeUIOptions {
  /** Defaults to the mounted ion-app. Call this API after the root is connected. */
  root?: HTMLElement;
  /** Manage Foldable placement and posture on iOS. Defaults to true. */
  deviceLayout?: boolean;
  /** Initial/changed layout, followed by the idle state on teardown. */
  onLayoutChange?: (state: IonicDeviceLayoutState) => void;
  /** Errors from device-change handlers. Initialization failures reject ready. */
  onError?: (error: unknown) => void;
}

export interface IonicNativeUIHandle {
  /** Device layout is applied and the Native UI runtime has started. */
  readonly ready: Promise<void>;
  refreshLayout(): Promise<void>;
  /** Safe during initialization and safe to call more than once. */
  destroy(): Promise<void>;
}

const owners = new WeakMap<Document, IonicNativeUIHandle>();
const pending = new WeakMap<Document, Promise<void>>();

/**
 * Own one Ionic application's device layout and Native UI lifecycle.
 * The ordinary root entry remains available for applications owning their own integration.
 */
export function mountIonicNativeUI(options: IonicNativeUIOptions = {}): IonicNativeUIHandle {
  const { deviceLayout = true, onLayoutChange, onError = console.error, ...nativeOptions } = options;
  const root = options.root ?? document.querySelector<HTMLElement>('ion-app');
  if (!root?.isConnected || root.ownerDocument !== document) throw new Error('A connected ion-app root is required');
  const doc = root.ownerDocument;
  if (owners.has(doc)) throw new Error('Ionic Native UI is already mounted; destroy its owner before mounting again');

  let stopped = false;
  let runtime: NativeUIHandle | undefined;
  let resetLayout: (() => void) | undefined;
  let refresh = async (): Promise<void> => {};
  let lastState: IonicDeviceLayoutState | undefined;
  const listeners: PluginListenerHandle[] = [];
  const notifyLayout = () => {
    const state = {
      verticalBars: root.classList.contains('ios-theme-vertical-bars'),
      expandedFold: root.classList.contains('ios-theme-fold-expanded'),
    };
    if (state.verticalBars === lastState?.verticalBars && state.expandedFold === lastState?.expandedFold) return;
    lastState = state;
    onLayoutChange?.(state);
  };
  let cleanup: Promise<void> | undefined;
  const dispose = () =>
    (cleanup ??= (async () => {
      for (const listener of listeners.splice(0)) await listener.remove().catch(onError);
      await runtime?.destroy().catch(onError);
      resetLayout?.();
      notifyLayout();
    })());

  const previous = pending.get(doc);
  const ready = (async () => {
    await previous;
    if (stopped) return;
    if (deviceLayout && Capacitor.getPlatform() === 'ios') {
      const [{ Foldable }, { setVerticalBarsLayout, applyFoldStateClasses }] = await Promise.all([
        import('@erkamyaman/capacitor-foldable'),
        import('@rdlabo/ionic-theme-ios27'),
      ]);
      if (stopped) return;
      resetLayout = () => {
        setVerticalBarsLayout({ edge: null }, root);
        applyFoldStateClasses(root, { state: 'flat' });
      };
      let layoutRevision = 0;
      let foldRevision = 0;
      const applyFold = (fold: Awaited<ReturnType<typeof Foldable.getFoldState>>) => {
        if (stopped) return;
        applyFoldStateClasses(root, fold);
        notifyLayout();
      };
      const updateLayout = async () => {
        if (stopped) return;
        const revision = ++layoutRevision;
        const layout = await resolveVerticalBarsLayout(Foldable);
        if (stopped || revision !== layoutRevision) return;
        setVerticalBarsLayout(layout, root);
        notifyLayout();
      };
      const updateFold = async () => {
        if (stopped) return;
        const revision = ++foldRevision;
        const fold = await Foldable.getFoldState();
        if (revision === foldRevision) applyFold(fold);
      };
      refresh = async () => {
        await Promise.all([updateLayout(), updateFold()]);
      };
      // Subscribe first; newer events must win over in-flight initial reads.
      listeners.push(await Foldable.addListener('layoutChange', () => void updateLayout().catch(onError)));
      if (stopped) return;
      listeners.push(
        await Foldable.addListener('foldStateChange', (fold) => {
          foldRevision++;
          applyFold(fold);
        }),
      );
      if (stopped) return;
      await refresh();
    }
    if (stopped) return;
    notifyLayout();
    if (!stopped) runtime = await enableNativeUI({ ...nativeOptions, root });
  })().catch(async (error: unknown) => {
    stopped = true;
    if (owners.get(doc) === handle) owners.delete(doc);
    await dispose();
    throw error;
  });

  let destruction: Promise<void> | undefined;
  const handle: IonicNativeUIHandle = {
    ready,
    async refreshLayout() {
      await ready;
      if (!stopped) await refresh();
    },
    destroy() {
      if (!destruction) {
        stopped = true;
        destruction = ready.catch(() => {}).then(dispose);
        if (owners.get(doc) === handle) {
          owners.delete(doc);
          pending.set(doc, destruction);
        }
      }
      return destruction;
    },
  };
  owners.set(doc, handle);
  pending.set(
    doc,
    ready.catch(() => {}),
  );
  return handle;
}
