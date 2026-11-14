import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export interface CapacitorRuntimeInfo {
  isNative: boolean;
  platform: 'web' | 'android' | 'ios';
}

export function getCapacitorRuntimeInfo(): CapacitorRuntimeInfo {
  if (typeof window === 'undefined') {
    return { isNative: false, platform: 'web' };
  }
  const isNative = Capacitor.isNativePlatform();
  const rawPlatform = Capacitor.getPlatform();
  const platform =
    rawPlatform === 'android' || rawPlatform === 'ios' ? rawPlatform : 'web';
  return { isNative, platform };
}

export async function initializeCapacitorNativeShell(): Promise<void> {
  const { isNative } = getCapacitorRuntimeInfo();
  if (!isNative) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#081020' });
  } catch {
    // Ignore on platforms where StatusBar API is unavailable
  }
  try {
    await SplashScreen.hide();
  } catch {
    // Ignore if splash screen already auto-hid
  }
}

export function subscribeAndroidBackButton(onBack: () => boolean): () => void {
  if (typeof window === 'undefined') return () => {};
  const { isNative, platform } = getCapacitorRuntimeInfo();
  if (!isNative && platform !== 'android') {
    return () => {};
  }

  let removed = false;
  let cleanupHandle: { remove: () => Promise<void> } | null = null;

  void CapApp.addListener('backButton', () => {
    const handled = onBack();
    if (!handled) {
      void CapApp.exitApp().catch(() => {});
    }
  })
    .then((handle) => {
      if (removed) {
        void handle.remove();
      } else {
        cleanupHandle = handle;
      }
    })
    .catch(() => {});

  return () => {
    removed = true;
    if (cleanupHandle) {
      void cleanupHandle.remove();
    }
  };
}
