# Set up Native UI in an Ionic app

Start with the standard Ionic iOS setup: install the packages, use the theme preset, and start one Native UI runtime. **Vertical Bars is enabled by default**, alongside ordinary controls. A supported device selects rail placement; browsers and devices without a rail keep their Web layout.

Use an existing Ionic application with Capacitor 8. This guide uses the iOS 27 theme's high-level stylesheet and configuration. To keep another Web theme, use [the existing-theme setup](ionic-vertical-bars.md); without Ionic, use [HTML setup](framework-independent.md).

## 1. Install the plugin

```sh
npm install @rdlabo/capacitor-native-ui @rdlabo/ionic-theme-ios27 @erkamyaman/capacitor-foldable
```

Declare Native UI directly in the application so Capacitor discovers its native plugin. Keep the theme, plugin and Foldable as separate dependencies; the theme declares its compatible Native UI peer range. The standard device-layout integration uses Foldable 8.5 or later within version 8.

## 2. Enable the shell

Keep Ionic's base styles. In the global stylesheet, replace separate Ionic dark-palette and iOS theme imports with the single theme entry:

```css
@import '@rdlabo/ionic-theme-ios27/styles/system.css';
```

Pass the theme preset to your existing Ionic initialization, before rendering:

```ts
import { ios27ThemeConfig } from '@rdlabo/ionic-theme-ios27';

const ionicConfig = {
  ...ios27ThemeConfig,
};
```

| Framework         | Existing Ionic initializer                                          |
| ----------------- | ------------------------------------------------------------------- |
| Angular / Ionic 8 | `provideIonicAngular(ionicConfig)` from `@ionic/angular/standalone` |
| Angular / Ionic 9 | `provideIonicAngular(ionicConfig)` from `@ionic/angular`            |
| React             | `setupIonicReact(ionicConfig)` from `@ionic/react`                  |
| Vue               | `app.use(IonicVue, ionicConfig)` with `IonicVue` from `@ionic/vue`  |

The stylesheet includes Vertical Bars layout; the preset includes the Native UI-aware page transition. Do not add a second rail stylesheet or wrap the preset's transition again. See [theme configuration](https://webview-native-ui.com/projects/ionic-theme-ios27/docs/configuration) for manual dark mode and application overrides.

Start Native UI once after the application's `ion-app` mounts:

```ts
import { enableNativeUI } from '@rdlabo/capacitor-native-ui';

const shell = await enableNativeUI();
```

This default call enables ordinary controls **and Vertical Bars**. Do not pass `controls: 'verticalOnly'` for the standard setup. Individual selection, fixed browser placement, extensions and suspension leases are reference APIs, not prerequisites for installation.

### Place startup in your framework's app root

The application bootstrap owns the runtime's lifetime. Device reporting belongs in an application service, theme configuration belongs in the Ionic initializer/global stylesheet, and routed components keep their existing handlers and state. Do not add a second router, projection state or native lifecycle machinery to `AppComponent` or page components.

For Angular, use the [device-layout service](ionic-vertical-bars.md#3-connect-device-placement-and-start-the-controls), then connect both owners in the existing `src/main.ts`:

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { enableNativeUI } from '@rdlabo/capacitor-native-ui';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { VerticalBarsLayoutService } from './app/vertical-bars-layout.service';

void bootstrapApplication(AppComponent, appConfig)
  .then(async (app) => {
    const shell = await enableNativeUI();
    if (app.destroyed) {
      await shell.destroy();
      return;
    }
    app.onDestroy(() => {
      void shell.destroy().catch((error: unknown) => console.error('Native UI cleanup failed', error));
    });
    await app.injector.get(VerticalBarsLayoutService).initialize();
  })
  .catch((error: unknown) => console.error('Application startup failed', error));
```

Merge this into the application's one bootstrap; do not create another bootstrap or another runtime. `AppComponent` still only composes the app shell and router outlet. The service listens before its initial device read, removes its listener on destruction and passes resolved geometry to the theme. Native UI owns native projection, fallback and event forwarding.

React and Vue applications use the same ownership: start once after the app shell mounts, keep device reporting above routed pages, and destroy the returned runtime/remove the device listener when that application owner is disposed. Do not copy Angular's DI service into another framework or introduce a shared module-global lifecycle queue.

## 3. Coordinate navigation

The standard `ios27ThemeConfig` already coordinates native presentation with Ionic navigation, including back gestures. Keep normal Ionic routes and handlers. No application-written `navigate()` wrapper, Web Animation page switch or per-page Native UI startup is needed.

The default Vertical Bars setup includes the device subscription above; it is not a later opt-in step. `layoutChange` plus `resolveVerticalBarsLayout(Foldable)` reports edge, inset and toolbar origin even when a display change leaves edge/inset unchanged. The theme applies Web layout; Native UI determines whether native rail rendering is available. A null device edge restores ordinary layout.

For an existing or custom Web theme, follow [the standalone layout and transition setup](ionic-vertical-bars.md) instead of replacing the theme. Custom animation builders use [the transition adapter](migration.md#native-ui-transition-adapter); this replaces the preset path rather than adding a second coordinator.

## 4. Build, sync, and run

Ordinary native controls require Ionic `>=8.8.1 <10`, Capacitor 8, Xcode 26+ and iOS 26+. Native Vertical Bars additionally require the [supported rail device and OS](vertical-bars.md#native-rendering). Enabling the default rail does not force unsupported hardware to render one.

SwiftPM resolves Engine automatically. For an existing CocoaPods app, install the Engine version required by your installed Native UI package:

```sh
npm install "@webview-native-ui/engine@$(node -p "require('./node_modules/@rdlabo/capacitor-native-ui/package.json').dependencies['@webview-native-ui/engine']")"
```

Add Engine to the existing application target in `ios/App/Podfile`, outside the generated `def capacitor_pods` block:

```ruby
target 'App' do
  capacitor_pods
  pod 'WebViewNativeUIEngine', :path => '../../node_modules/@webview-native-ui/engine'
  # Keep your other application pods here.
end
```

Adjust the path for your project layout and repeat version alignment when upgrading Native UI. This is CocoaPods compatibility setup, not application UI logic.

Build the application's Web assets, then sync:

```sh
npx cap sync ios
```

Rebuild and run in Xcode. Existing supported toolbar actions/tabs should project natively and invoke their original handlers. On a supported rail device, they use Vertical Bars and the content reserves the reported space. Check forward/back navigation, canceled back gestures, a device display change, and Web fallback. A browser preview cannot verify native rendering.

| If you see…                                     | Check…                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| All controls remain on the Web on supported iOS | Direct dependency, startup after mount, Capacitor sync and native rebuild.          |
| Only one control remains on the Web             | Compare its source markup with [supported controls](native-ui.md#supported-markup). |
| A rail device keeps ordinary layout             | Connect the device service and load the matching theme stylesheet.                  |
| Layout fails to update when the display changes | Use `layoutChange` with the resolver, not only an edge/inset event.                 |
| Controls overlap during navigation              | Keep the preset transition or configure exactly one custom transition adapter.      |

## Next steps

- [Keep an existing Web theme](ionic-vertical-bars.md) while retaining the standard Vertical Bars behavior.
- [Configuration reference](configuration.md) for explicit customization and disabling defaults.
- [Supported controls](native-ui.md) and [appearance](appearance.md).
- [Migration](migration.md) for older package names and integration APIs.

## Navigation without the theme

This is an advanced integration for applications that own a different navigation lifecycle, not part of the standard Ionic installation. Keep the application's router as the only navigation owner. Use [the HTML example](https://github.com/webview-native-ui/capacitor-plugin/tree/main/examples/native-ui-html) for a routerless app and [suspension](native-ui.md#custom-overlay-suspension) when the application must explicitly hand presentation back to the Web. Resume only after completion or cancellation has settled; do not copy a second page router into an Ionic app.
