import 'expo-sqlite/localStorage/install';

import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

// Optional app lock: a 4-digit PIN (salted SHA-256 in the secure store) plus fingerprint/Face ID if available.
// Device-only. Not offered on web, which has no secure store.

export const LOCK_SUPPORTED = Platform.OS !== 'web';
export const PIN_LENGTH = 4;

const PIN_KEY = 'flowku.pin';
const SETTINGS_KEY = 'flowku.lock';
const RELOCK_AFTER_MS = 60_000; // back from the background after a minute -> locked again
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30_000;

export type LockSettings = { enabled: boolean; biometric: boolean };

function readSettings(): LockSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { enabled: false, biometric: false, ...JSON.parse(raw) } : { enabled: false, biometric: false };
  } catch {
    return { enabled: false, biometric: false };
  }
}

// --- observable state -------------------------------------------------------------------------------------

let settings = LOCK_SUPPORTED ? readSettings() : { enabled: false, biometric: false };
let locked = settings.enabled; // a cold start opens locked
let failed = 0;
let blockedUntil = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useLockSettings() {
  return useSyncExternalStore(subscribe, () => settings, () => settings);
}

export function useLocked() {
  return useSyncExternalStore(subscribe, () => locked, () => false);
}

function saveSettings(next: LockSettings) {
  settings = next;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // The PIN itself is in the secure store; losing this flag only means no lock next start.
  }
  emit();
}

// Relock after the app has been in the background for a while.
if (LOCK_SUPPORTED) {
  let backgroundAt = 0;
  AppState.addEventListener('change', (state) => {
    if (state === 'background') backgroundAt = Date.now();
    if (state === 'active' && settings.enabled && backgroundAt && Date.now() - backgroundAt > RELOCK_AFTER_MS) {
      locked = true;
      emit();
    }
  });
}

// --- PIN --------------------------------------------------------------------------------------------------

async function hash(pin: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

/** Turns the lock on with a new PIN (also used to change it). */
export async function enableLock(pin: string, biometric: boolean) {
  const salt = Crypto.randomUUID();
  await SecureStore.setItemAsync(PIN_KEY, JSON.stringify({ salt, hash: await hash(pin, salt) }));
  failed = 0;
  saveSettings({ enabled: true, biometric });
}

export async function disableLock() {
  await SecureStore.deleteItemAsync(PIN_KEY);
  locked = false;
  saveSettings({ enabled: false, biometric: false });
}

export function setBiometric(biometric: boolean) {
  saveSettings({ ...settings, biometric });
}

/** Seconds left before another attempt is allowed, 0 when free to try. */
export function cooldownLeft() {
  return Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000));
}

export type PinCheck = 'ok' | 'wrong' | 'blocked';

/** Checks a PIN; unlocks on success. After 5 misses, further tries wait 30 seconds. */
export async function checkPin(pin: string): Promise<PinCheck> {
  if (cooldownLeft() > 0) return 'blocked';
  const raw = await SecureStore.getItemAsync(PIN_KEY);
  if (!raw) {
    // Secure store was cleared (e.g. biometrics changed): nothing to check against, so drop the lock.
    await disableLock();
    return 'ok';
  }
  const stored = JSON.parse(raw) as { salt: string; hash: string };
  if ((await hash(pin, stored.salt)) === stored.hash) {
    failed = 0;
    unlock();
    return 'ok';
  }
  failed++;
  if (failed >= MAX_ATTEMPTS) {
    failed = 0;
    blockedUntil = Date.now() + COOLDOWN_MS;
    return 'blocked';
  }
  return 'wrong';
}

function unlock() {
  locked = false;
  emit();
}

// --- biometrics -------------------------------------------------------------------------------------------

/** "Sidik jari" / "Face ID" when the device has one set up, else null. */
export async function biometricLabel() {
  if (!LOCK_SUPPORTED) return null;
  const [hardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  if (!hardware || !enrolled) return null;
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  return types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) &&
    !types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
    ? 'Face ID'
    : 'Sidik jari';
}

/** Prompts for fingerprint/Face ID; unlocks on success. The PIN pad stays as the fallback. */
export async function unlockWithBiometric() {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Buka Flowku',
    cancelLabel: 'Pakai PIN',
    disableDeviceFallback: true,
  });
  if (result.success) unlock();
  return result.success;
}
