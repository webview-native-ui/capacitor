import { Capacitor, registerPlugin } from '@capacitor/core';
import { installNativeUIHost } from '@webview-native-ui/core/host';
import type { NativeUIPlugin } from '@webview-native-ui/core/native/definitions';

installNativeUIHost({
  plugin: registerPlugin<NativeUIPlugin>('NativeUI'),
  getPlatform: () => Capacitor.getPlatform(),
  isPluginAvailable: (name) => Capacitor.isPluginAvailable(name),
});
