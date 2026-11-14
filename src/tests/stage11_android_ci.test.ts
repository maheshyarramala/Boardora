import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { audioEngine } from '../platform/audio';
import { getCapacitorRuntimeInfo } from '../platform/capacitorBridge';
import { hapticsBridge } from '../platform/haptics';

describe('Stage 11: Capacitor Android, Workflows & Offline Platform Bridge', () => {
  it('configures capacitor.config.json with production appId, appName, and HTTPS scheme', () => {
    const capConfigRaw = readFileSync(
      path.resolve(process.cwd(), 'capacitor.config.json'),
      'utf8'
    );
    const capConfig = JSON.parse(capConfigRaw) as {
      appId: string;
      appName: string;
      webDir: string;
      server?: { androidScheme?: string };
      plugins?: { SplashScreen?: { backgroundColor?: string } };
    };
    expect(capConfig.appId).toBe('com.boardora.teninone');
    expect(capConfig.appName).toBe('BOARDORA');
    expect(capConfig.webDir).toBe('dist');
    expect(capConfig.server?.androidScheme).toBe('https');
    expect(capConfig.plugins?.SplashScreen?.backgroundColor).toBe('#08172F');
  });

  it('enforces minimal AndroidManifest permissions and orientation/cutout config', () => {
    const manifestPath = path.resolve(
      process.cwd(),
      'android/app/src/main/AndroidManifest.xml'
    );
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = readFileSync(manifestPath, 'utf8');

    expect(manifest).toContain('android.permission.INTERNET');
    expect(manifest).toContain('android.permission.ACCESS_NETWORK_STATE');
    expect(manifest).toContain('android.permission.VIBRATE');
    expect(manifest).toContain('android:usesCleartextTraffic="false"');
    expect(manifest).toContain('orientation|keyboardHidden|keyboard|screenSize');

    // No invasive permissions
    expect(manifest).not.toContain('android.permission.CAMERA');
    expect(manifest).not.toContain('android.permission.RECORD_AUDIO');
    expect(manifest).not.toContain('android.permission.ACCESS_FINE_LOCATION');
    expect(manifest).not.toContain('android.permission.READ_CONTACTS');
  });

  it('configures CI, Debug APK, and secret-signed Release GitHub Actions workflows', () => {
    const ci = readFileSync(path.resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
    const androidBuild = readFileSync(
      path.resolve(process.cwd(), '.github/workflows/android-build.yml'),
      'utf8'
    );
    const release = readFileSync(
      path.resolve(process.cwd(), '.github/workflows/release.yml'),
      'utf8'
    );

    expect(ci).toContain('npm ci');
    expect(ci).toContain('npm run lint');
    expect(ci).toContain('npm test');
    expect(ci).toContain('npm run build');

    expect(androidBuild).toContain('gradle/actions/setup-gradle');
    expect(androidBuild).toContain('./gradlew assembleDebug');
    expect(androidBuild).toContain('actions/upload-artifact@v4');

    expect(release).toContain("- 'v*'");
    expect(release).toContain('secrets.ANDROID_KEYSTORE_BASE64');
    expect(release).toContain('secrets.ANDROID_KEYSTORE_PASSWORD');
    expect(release).toContain('secrets.ANDROID_KEY_ALIAS');
    expect(release).toContain('secrets.ANDROID_KEY_PASSWORD');
    expect(release).toContain('./gradlew assembleRelease bundleRelease');
  });

  it('gracefully runs platform audio, haptics, and Capacitor detection outside native Android', () => {
    const runtime = getCapacitorRuntimeInfo();
    expect(runtime.platform).toBe('web');
    expect(runtime.isNative).toBe(false);

    expect(() => {
      hapticsBridge.configure(true);
      hapticsBridge.trigger('light');
      hapticsBridge.trigger('success');
      audioEngine.configure({
        soundEnabled: true,
        soundVolume: 0.5,
        sfxVolume: 0.7,
        musicEnabled: false,
        musicVolume: 0.3,
      });
      audioEngine.play('ui-click');
    }).not.toThrow();
  });
});
