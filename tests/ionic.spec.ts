import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { Foldable, type BarPlacement, type FoldState } from '@erkamyaman/capacitor-foldable';
import { enableNativeUI, type NativeUIHandle } from '../src/index.js';
import { mountIonicNativeUI, type IonicNativeUIHandle } from '../src/ionic.js';

vi.mock('../src/index.js', () => ({ enableNativeUI: vi.fn() }));
vi.mock('@erkamyaman/capacitor-foldable', () => ({
  Foldable: { addListener: vi.fn(), getBarPlacement: vi.fn(), getReservedRegions: vi.fn(), getFoldState: vi.fn() },
}));

describe('managed Ionic startup', () => {
  let root: HTMLElement;
  let layoutChange: () => void;
  let foldChange: (fold: FoldState) => void;
  const flat: FoldState = { state: 'flat', posture: 'flat', isSeparating: false };
  const half: FoldState = { state: 'half-opened', posture: 'book', isSeparating: true };
  const removeLayout = vi.fn();
  const removeFold = vi.fn();
  const destroy = vi.fn();
  const onLayoutChange = vi.fn();
  const onError = vi.fn();
  let mounts: IonicNativeUIHandle[];
  const mount = (options: Parameters<typeof mountIonicNativeUI>[0] = {}) => {
    const handle = mountIonicNativeUI({ onLayoutChange, onError, ...options });
    mounts.push(handle);
    return handle;
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mounts = [];
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('ios');
    root = document.createElement('ion-app');
    document.body.appendChild(root);
    removeLayout.mockResolvedValue(undefined);
    removeFold.mockResolvedValue(undefined);
    destroy.mockResolvedValue(undefined);
    vi.mocked(Foldable.addListener).mockImplementation(async (event: string, callback: unknown) => {
      if (event === 'foldStateChange') {
        foldChange = callback as typeof foldChange;
        return { remove: removeFold };
      }
      layoutChange = callback as typeof layoutChange;
      return { remove: removeLayout };
    });
    vi.mocked(Foldable.getBarPlacement).mockResolvedValue({ verticalBarEdge: null, inset: 0 });
    vi.mocked(Foldable.getReservedRegions).mockResolvedValue({ regions: [] });
    vi.mocked(Foldable.getFoldState).mockResolvedValue(flat);
    vi.mocked(enableNativeUI).mockResolvedValue({ destroy } as unknown as NativeUIHandle);
  });

  afterEach(async () => {
    await Promise.all(mounts.map((handle) => handle.destroy()));
    root.remove();
    vi.restoreAllMocks();
  });

  it('owns initial layout, native options and teardown without application orchestration', async () => {
    vi.mocked(Foldable.getBarPlacement).mockResolvedValue({ verticalBarEdge: 'trailing', inset: 92 });
    vi.mocked(Foldable.getFoldState).mockResolvedValue(half);
    const handle = mount({ ionic: { verticalBars: { popover: true } } });
    await handle.ready;
    expect(enableNativeUI).toHaveBeenCalledWith({ root, ionic: { verticalBars: { popover: true } } });
    expect(root.style.getPropertyValue('--ios-theme-vertical-bars-native-inset')).toBe('92px');
    expect(onLayoutChange).toHaveBeenLastCalledWith({ verticalBars: true, expandedFold: true });
    const destruction = handle.destroy();
    expect(handle.destroy()).toBe(destruction);
    await destruction;
    expect(removeLayout).toHaveBeenCalledOnce();
    expect(removeFold).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
    expect(onLayoutChange).toHaveBeenLastCalledWith({ verticalBars: false, expandedFold: false });
    expect(root.classList.contains('ios-theme-vertical-bars')).toBe(false);
  });

  it('uses settled reserved regions when the rail edge stays unchanged', async () => {
    vi.mocked(Foldable.getBarPlacement).mockResolvedValue({ verticalBarEdge: 'leading', inset: 76 });
    vi.mocked(Foldable.getReservedRegions).mockResolvedValue({
      regions: [
        { x: 0, y: 0, width: 76, height: 124, kind: 'occlusion', isActive: true, margins: { top: 0, right: 0, bottom: 0, left: 0 } },
      ],
    });
    const handle = mount();
    await handle.ready;
    expect(root.style.getPropertyValue('--ios-theme-vertical-bars-toolbar-top')).toBe('124px');
    vi.mocked(Foldable.getReservedRegions).mockResolvedValue({ regions: [] });
    layoutChange();
    await vi.waitFor(() => expect(root.style.getPropertyValue('--ios-theme-vertical-bars-toolbar-top')).toBe('174px'));
  });

  it('keeps a newer layout event over a delayed initial read', async () => {
    let finish!: (value: BarPlacement) => void;
    vi.mocked(Foldable.getBarPlacement).mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const handle = mount();
    await vi.waitFor(() => expect(Foldable.getBarPlacement).toHaveBeenCalledOnce());
    vi.mocked(Foldable.getBarPlacement).mockResolvedValue({ verticalBarEdge: 'leading', inset: 72 });
    layoutChange();
    await vi.waitFor(() => expect(root.classList.contains('ios-theme-vertical-bars-left')).toBe(true));
    finish({ verticalBarEdge: 'trailing', inset: 84 });
    await handle.ready;
    expect(root.style.getPropertyValue('--ios-theme-vertical-bars-native-inset')).toBe('72px');
  });

  it('keeps a newer posture event over a delayed initial read', async () => {
    let finish!: (value: FoldState) => void;
    vi.mocked(Foldable.getFoldState).mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const handle = mount();
    await vi.waitFor(() => expect(Foldable.getFoldState).toHaveBeenCalledOnce());
    foldChange(half);
    finish(flat);
    await handle.ready;
    expect(onLayoutChange).toHaveBeenLastCalledWith({ verticalBars: false, expandedFold: true });
  });

  it('distinguishes unfolded and ordinary flat displays using the reported hinge', async () => {
    const handle = mount();
    await handle.ready;
    foldChange({ ...flat, hingeBounds: { x: 466, y: 0, width: 0, height: 744 } });
    expect(onLayoutChange).toHaveBeenLastCalledWith({ verticalBars: false, expandedFold: true });
    foldChange(flat);
    expect(onLayoutChange).toHaveBeenLastCalledWith({ verticalBars: false, expandedFold: false });
  });

  it.each(['web', 'android'])('leaves device geometry to the platform on %s', async (platform) => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue(platform);
    const handle = mount();
    await handle.ready;
    expect(Foldable.addListener).not.toHaveBeenCalled();
    expect(Foldable.getBarPlacement).not.toHaveBeenCalled();
    expect(onLayoutChange).toHaveBeenCalledExactlyOnceWith({ verticalBars: false, expandedFold: false });
    expect(enableNativeUI).toHaveBeenCalledOnce();
  });

  it('supports explicit custom layout ownership', async () => {
    const handle = mount({ deviceLayout: false });
    await handle.ready;
    expect(Foldable.addListener).not.toHaveBeenCalled();
    expect(enableNativeUI).toHaveBeenCalledWith({ root });
  });

  it('can be destroyed immediately without starting listeners or native controls', async () => {
    await mount().destroy();
    expect(Foldable.addListener).not.toHaveBeenCalled();
    expect(enableNativeUI).not.toHaveBeenCalled();
  });

  it('removes a subscription that finishes registering after destruction', async () => {
    let finish!: (value: { remove: typeof removeLayout }) => void;
    vi.mocked(Foldable.addListener).mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const handle = mount();
    await vi.waitFor(() => expect(Foldable.addListener).toHaveBeenCalledOnce());
    const destruction = handle.destroy();
    finish({ remove: removeLayout });
    await destruction;
    expect(removeLayout).toHaveBeenCalledOnce();
    expect(enableNativeUI).not.toHaveBeenCalled();
  });

  it('ignores delayed reads and late events after destruction', async () => {
    let finish!: (value: FoldState) => void;
    vi.mocked(Foldable.getFoldState).mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const handle = mount();
    await vi.waitFor(() => expect(Foldable.getFoldState).toHaveBeenCalledOnce());
    const destruction = handle.destroy();
    finish(half);
    await destruction;
    foldChange(half);
    layoutChange();
    expect(root.classList.contains('ios-theme-fold-expanded')).toBe(false);
    expect(enableNativeUI).not.toHaveBeenCalled();
  });

  it('cleans partial startup on errors and allows a new owner', async () => {
    vi.mocked(Foldable.getFoldState).mockRejectedValueOnce(new Error('bridge failed'));
    const failed = mount();
    await expect(failed.ready).rejects.toThrow('bridge failed');
    expect(removeLayout).toHaveBeenCalledOnce();
    expect(removeFold).toHaveBeenCalledOnce();
    const next = mount();
    await next.ready;
    await failed.destroy();
    expect(() => mount()).toThrow('already mounted');
  });

  it('serializes a remount behind pending native startup and teardown', async () => {
    let finish!: (value: NativeUIHandle) => void;
    vi.mocked(enableNativeUI).mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const first = mount();
    await vi.waitFor(() => expect(enableNativeUI).toHaveBeenCalledOnce());
    const destruction = first.destroy();
    const nextDestroy = vi.fn(async () => undefined);
    vi.mocked(enableNativeUI).mockImplementationOnce(async () => {
      expect(destroy).toHaveBeenCalledOnce();
      return { destroy: nextDestroy } as unknown as NativeUIHandle;
    });
    const second = mount();
    finish({ destroy } as unknown as NativeUIHandle);
    await second.ready;
    await destruction;
    expect(enableNativeUI).toHaveBeenCalledTimes(2);
    await first.destroy();
    expect(() => mount()).toThrow('already mounted');
    await second.destroy();
    expect(nextDestroy).toHaveBeenCalledOnce();
  });

  it('does not let an old failed owner replace a newer teardown queue', async () => {
    vi.mocked(Foldable.getFoldState).mockRejectedValueOnce(new Error('initial read failed'));
    const failed = mount();
    await expect(failed.ready).rejects.toThrow('initial read failed');
    const second = mount({ deviceLayout: false });
    await second.ready;
    let finish!: () => void;
    destroy.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)));
    const stopping = second.destroy();
    await vi.waitFor(() => expect(destroy).toHaveBeenCalledOnce());
    await failed.destroy();
    const third = mount({ deviceLayout: false });
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(enableNativeUI).toHaveBeenCalledOnce();
    } finally {
      finish();
      await stopping;
      await third.ready;
    }
    expect(enableNativeUI).toHaveBeenCalledTimes(2);
  });

  it('reports update errors while preserving the current posture', async () => {
    const handle = mount();
    await handle.ready;
    vi.mocked(Foldable.getFoldState).mockRejectedValueOnce(new Error('refresh failed'));
    await expect(handle.refreshLayout()).rejects.toThrow('refresh failed');
    foldChange(half);
    expect(onLayoutChange).toHaveBeenLastCalledWith({ verticalBars: false, expandedFold: true });
  });

  it('requires an existing root and a single owner', async () => {
    root.remove();
    expect(() => mount()).toThrow('connected ion-app');
    document.body.appendChild(root);
    await mount().ready;
    expect(() => mount()).toThrow('already mounted');
  });
});
