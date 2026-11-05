import type { Frame, NativeUIVerticalBarFrame } from '../definitions.js';

const measurements = new WeakMap<Element, { frame: Frame; viewport: string }>();
const viewport = (element: Element) => {
  const win = element.ownerDocument.defaultView!;
  const classes = element.closest('ion-app')?.classList;
  return `${win.innerWidth}:${win.innerHeight}:${classes?.contains('ios-theme-vertical-bars')}:${classes?.contains('ios-theme-vertical-bars-left')}`;
};

export const validVerticalBarFrame = (frame: Frame) =>
  [frame.x, frame.y, frame.width, frame.height].every(Number.isFinite) && frame.width > 0 && frame.height > 0;

export const forgetVerticalBarFrame = (element: Element) => measurements.delete(element);

export const rememberVerticalBarFrame = (element: Element, frame: Frame) => {
  if (validVerticalBarFrame(frame)) measurements.set(element, { frame, viewport: viewport(element) });
};

export const verticalBarFrame = (element: Element): Frame | undefined => {
  const saved = measurements.get(element);
  return saved?.viewport === viewport(element) ? saved.frame : undefined;
};

const modalRailSlot = 'native-ui-vertical-bars';

/** Keep rail targets inside their modal, outside Ionic's transformed content wrapper. */
export const placeModalRailTarget = (target: HTMLElement, surface: HTMLElement) => {
  if (!surface.matches('ion-modal') || !surface.shadowRoot) return;
  if (!surface.shadowRoot.querySelector(`slot[name="${modalRailSlot}"]`)) {
    const slot = surface.ownerDocument.createElement('slot');
    slot.name = modalRailSlot;
    slot.setAttribute('data-native-ui-projection-node', '');
    surface.shadowRoot.append(slot);
  }
  target.slot = modalRailSlot;
  target.style.position = 'fixed';
  // The theme's local top already clamps at the reserved toolbar boundary.
  // Convert it to viewport coordinates without inheriting the wrapper transform.
  target.style.top =
    'calc(var(--ios-theme-vertical-bars-modal-toolbar-top) + var(--ios-theme-vertical-bars-modal-offset-top, 0px) + var(--ios-theme-vertical-bars-toolbar-offset, 0px))';
};

export const removeEmptyModalRailSlot = (surface: HTMLElement) => {
  const slot = surface.shadowRoot?.querySelector<HTMLSlotElement>(`slot[name="${modalRailSlot}"][data-native-ui-projection-node]`);
  if (slot && !slot.assignedElements().length) slot.remove();
};

/** Convert the native viewport rectangle into the clone's positioning container. */
export const alignVerticalBarClone = (clone: HTMLElement, source: Element, parent: HTMLElement) => {
  const frame = verticalBarFrame(source);
  if (!frame) return;
  const origin = parent.getBoundingClientRect();
  const parentStyle = parent.ownerDocument.defaultView!.getComputedStyle(parent);
  // clientLeft/clientTop round subpixel glass borders to whole CSS pixels.
  const borderLeft = parseFloat(parentStyle.borderLeftWidth) || 0;
  const borderTop = parseFloat(parentStyle.borderTopWidth) || 0;
  // Absolute children use the padding edge, not the outer edge of a glass group.
  Object.assign(clone.style, {
    position: 'absolute',
    left: `${frame.x - origin.left - borderLeft}px`,
    top: `${frame.y - origin.top - borderTop}px`,
    right: 'auto',
    bottom: 'auto',
    width: `${frame.width}px`,
    height: `${frame.height}px`,
    minWidth: `${frame.width}px`,
    maxWidth: `${frame.width}px`,
    minHeight: `${frame.height}px`,
    maxHeight: `${frame.height}px`,
    margin: '0',
    boxSizing: 'border-box',
  });
};

export const alignVerticalTabBar = (
  tabBar: HTMLElement,
  frame: NativeUIVerticalBarFrame,
  items: Map<HTMLElement, NativeUIVerticalBarFrame>,
): (() => void) => {
  const doc = tabBar.ownerDocument;
  const style = doc.createElement('style');
  const token = `rail-${Math.random().toString(36).slice(2)}`;
  const selector = `[data-native-rail-geometry="${token}"]`;
  const origin = (tabBar.offsetParent as HTMLElement | null)?.getBoundingClientRect() ?? { left: 0, top: 0 };
  tabBar.setAttribute('data-native-rail-geometry', token);
  // Preserve the measured shape. Only older binaries need the capsule fallback.
  const radius = (rect: NativeUIVerticalBarFrame) =>
    Number.isFinite(rect.cornerRadius) && rect.cornerRadius! >= 0 ? rect.cornerRadius! : Math.min(rect.width, rect.height) / 2;
  const box = (rect: NativeUIVerticalBarFrame, x: number, y: number) =>
    `position:absolute!important;left:${rect.x - x}px!important;top:${rect.y - y}px!important;right:auto!important;bottom:auto!important;width:${rect.width}px!important;min-width:${rect.width}px!important;max-width:${rect.width}px!important;height:${rect.height}px!important;min-height:${rect.height}px!important;max-height:${rect.height}px!important;margin:0!important;padding:0!important;box-sizing:border-box!important;border-radius:${radius(rect)}px!important;`;
  style.textContent =
    `${selector}{${box(frame, origin.left, origin.top)}}` +
    [...items]
      .map(([element, rect]) => {
        const index = Array.from(tabBar.children).indexOf(element) + 1;
        return `${selector}>:nth-child(${index}){${box(rect, frame.x, frame.y)}}${selector}>:nth-child(${index})::part(native){min-height:0!important}`;
      })
      .join('');
  doc.head.append(style);
  const win = doc.defaultView!;
  const measuredViewport = viewport(tabBar);
  const stop = () => {
    observer.disconnect();
    win.removeEventListener('resize', stop);
    style.remove();
    if (tabBar.getAttribute('data-native-rail-geometry') === token) tabBar.removeAttribute('data-native-rail-geometry');
  };
  const observer = new MutationObserver((records) => {
    if (viewport(tabBar) !== measuredViewport || records.some((record) => record.type === 'childList')) stop();
  });
  observer.observe(tabBar, { childList: true });
  const app = tabBar.closest('ion-app');
  if (app) observer.observe(app, { attributes: true, attributeFilter: ['class'] });
  win.addEventListener('resize', stop);
  return stop;
};
