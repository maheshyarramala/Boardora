import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPosition,
  BannerAdSize,
} from '@capacitor-community/admob';

// Production AdMob units supplied for Boardora by the app owner.
const BANNER_AD_ID = 'ca-app-pub-4460502069603024/2368437529';
const INTERSTITIAL_AD_ID = 'ca-app-pub-4460502069603024/6116110846';

let initialization: Promise<boolean> | null = null;
let interstitialPrepared = false;
let completedMatchesSinceInterstitial = 0;

export function initializeBoardoraAds(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(false);
  if (initialization) return initialization;

  initialization = (async () => {
    try {
      let consent = await AdMob.requestConsentInfo();
      if (
        consent.isConsentFormAvailable &&
        consent.status === AdmobConsentStatus.REQUIRED
      ) {
        consent = await AdMob.showConsentForm();
      }

      const consentAllowsAds =
        consent.status === AdmobConsentStatus.NOT_REQUIRED ||
        consent.status === AdmobConsentStatus.OBTAINED;
      if (!consentAllowsAds) return false;

      await AdMob.initialize();

      try {
        await AdMob.prepareInterstitial({
          adId: INTERSTITIAL_AD_ID,
          isTesting: false,
        });
        interstitialPrepared = true;
      } catch {
        interstitialPrepared = false;
      }

      return true;
    } catch {
      // Ads must never block offline gameplay or app startup.
      return false;
    }
  })();

  return initialization;
}

export async function showGameHallBanner(): Promise<void> {
  if (!(await initializeBoardoraAds())) return;

  try {
    await AdMob.removeBanner();
    await AdMob.showBanner({
      adId: BANNER_AD_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      // Keep the native banner above Boardora's 64px mobile navigation bar.
      margin: 64,
      isTesting: false,
    });
  } catch {
    // A missing ad is non-fatal; the Game Hall remains fully usable.
  }
}

export async function removeGameHallBanner(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await AdMob.removeBanner();
  } catch {
    // Ignore cleanup errors when the banner was never created.
  }
}

export async function maybeShowPostMatchInterstitial(): Promise<void> {
  if (!(await initializeBoardoraAds())) return;

  completedMatchesSinceInterstitial += 1;
  if (completedMatchesSinceInterstitial < 3) return;
  completedMatchesSinceInterstitial = 0;

  try {
    if (!interstitialPrepared) {
      await AdMob.prepareInterstitial({
        adId: INTERSTITIAL_AD_ID,
        isTesting: false,
      });
      interstitialPrepared = true;
    }

    if (interstitialPrepared) {
      await AdMob.showInterstitial();
      interstitialPrepared = false;
      void AdMob.prepareInterstitial({
        adId: INTERSTITIAL_AD_ID,
        isTesting: false,
      }).then(() => {
        interstitialPrepared = true;
      }).catch(() => {
        interstitialPrepared = false;
      });
    }
  } catch {
    interstitialPrepared = false;
    // Never hold up the user's return to the Game Hall.
  }
}
