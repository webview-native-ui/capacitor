# Native UI Core

Private workspace inside capacitor-plugin containing host-independent DOM synchronization and native rendering. Capacitor remains the primary supported host; this boundary permits future adapters without duplicating renderers.

Run `npm ci`, `npm run build`, and `npm test` at the repository root. The plugin build embeds this workspace into its distribution; Core requires no separate publication. Edit native sources here and run `npm run sync:core` at the root to update the committed native copies used by SwiftPM and Android.

`npm run check:boundary --workspace @webview-native-ui/core` checks for host SDK imports. Swift tests use the NativeUICore scheme; Android tests use this workspace's Gradle project.
