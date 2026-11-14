import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning';

class HapticsBridge {
  private enabled = true;

  configure(enabled: boolean) {
    this.enabled = enabled;
  }

  trigger(pattern: HapticPattern) {
    if (!this.enabled) return;

    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      switch (pattern) {
        case 'light':
          void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
          return;
        case 'medium':
          void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
          return;
        case 'heavy':
          void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
          return;
        case 'success':
          void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
          return;
        case 'warning':
          void Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
          return;
      }
    }

    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      return;
    }

    switch (pattern) {
      case 'light':
        navigator.vibrate(12);
        break;
      case 'medium':
        navigator.vibrate(24);
        break;
      case 'heavy':
        navigator.vibrate(40);
        break;
      case 'success':
        navigator.vibrate([18, 40, 28]);
        break;
      case 'warning':
        navigator.vibrate([30, 30, 30]);
        break;
    }
  }
}

export const hapticsBridge = new HapticsBridge();
