import { Capacitor } from '@capacitor/core';
import { nativeUIPlugin as plugin } from './host.js';
import type { PluginListenerHandle } from '@capacitor/core';

/** Material color roles, resolved by Android for one brightness. */
export interface MaterialColorScheme {
  primary: string;
  secondary: string;
  tertiary: string;
  error: string;
  surface: string;
  onSurface: string;
}

export type DynamicColorScheme =
  | { available: false; systemDark: boolean }
  | { available: true; systemDark: boolean; light: MaterialColorScheme; dark: MaterialColorScheme };

export interface DynamicColorPlugin {
  getDynamicColorScheme(): Promise<DynamicColorScheme>;
  addListener(name: 'dynamicColorSchemeChange', listener: () => void): Promise<PluginListenerHandle>;
}

/** Independent of Native UI projection. No wallpaper or storage permission needed. */
export const getDynamicColorScheme = (): Promise<DynamicColorScheme> => {
  if (Capacitor.getPlatform() !== 'android') {
    return Promise.resolve({ available: false, systemDark: globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false });
  }
  return plugin.getDynamicColorScheme();
};

/** Invalidates the cached schemes after native resume or configuration changes. */
export const addDynamicColorListener = async (listener: () => void): Promise<PluginListenerHandle> => {
  if (Capacitor.getPlatform() !== 'android') return { remove: async () => {} };
  return plugin.addListener('dynamicColorSchemeChange', listener);
};
