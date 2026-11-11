# Managed Ionic startup and device layout

Use `mountIonicNativeUI` when an Ionic application wants standard device layout and
Native UI together. It owns Foldable subscriptions, initial placement and posture,
theme updates, stale-read protection, and teardown. Keep the ordinary
`enableNativeUI` API when the application owns a custom integration.

Install the optional peers alongside the Capacitor plugin:

```sh
npm install @rdlabo/capacitor-native-ui @rdlabo/ionic-theme-ios27 @erkamyaman/capacitor-foldable
npx cap sync
```

Keep the existing Ionic/theme CSS and navigation configuration. This API does not
load stylesheets or choose an application theme. Import `vertical-bars.css` when
using the vertical rail. Foldable 8.5.1+ and iOS 27.1+ supply the settled geometry;
ordinary iPhones retain horizontal layout. Android and Web start the normal
Native UI runtime without reading iOS geometry or loading the optional peers.

Call once after `ion-app` is mounted:

```ts
import { mountIonicNativeUI } from '@rdlabo/capacitor-native-ui/ionic';

const ui = mountIonicNativeUI({
  ionic: { verticalBars: { popover: true } },
  onLayoutChange: ({ verticalBars, expandedFold }) => {
    // Optional application-specific state, such as a ledger or sidebar signal.
  },
  onError: console.error,
});
await ui.ready;

// On application teardown, including when ready is still pending:
await ui.destroy();
```

The handle is available synchronously so teardown can be registered immediately.
`ready` rejects if initialization fails; partial subscriptions/runtime are cleaned
up first. Native projection can still finish after the handle is ready.
`destroy()` is idempotent and waits for any pending startup resource before
releasing it. A new mount after requesting destruction waits for that teardown.
There is one managed owner per document; mounting a second owner without first
requesting destruction throws.

`onLayoutChange` receives the initial state and changes to the two flags. The idle
state is reported when managed layout is cleared during teardown. It reports Web
layout, not whether native controls have finished projection. Late device events
and initial responses cannot update the destroyed owner. Application callbacks
should not throw.

Native UI options are forwarded unchanged, including explicit control selection.
`root` defaults to the connected `ion-app`; supply a connected root explicitly
when needed. `deviceLayout: false` skips device/theme integration for custom
layout owners. `refreshLayout()` optionally rereads placement/posture; settled
layout and fold events already update automatically. Automatic update failures
reach `onError`, while explicit refresh failures reject the returned promise.

## Angular application root

```ts
const destroyRef = inject(DestroyRef);
afterNextRender(() => {
  const ui = mountIonicNativeUI();
  destroyRef.onDestroy(() => void ui.destroy().catch(console.error));
  void ui.ready.catch(console.error);
});
```

No application-level startup queue, disposed flag, revision counter, or Foldable
listener registry is needed.
