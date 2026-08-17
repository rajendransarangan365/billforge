// @ts-nocheck
/**
 * Platform-safe storage wrapper.
 * Uses localStorage on web (Vercel), AsyncStorage on native (Android/iOS).
 */
import { Platform } from 'react-native';

let AsyncStorageLib: any = null;
if (Platform.OS !== 'web') {
  try {
    AsyncStorageLib = require('@react-native-async-storage/async-storage').default;
  } catch (e) {}
}

export const Storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try { return localStorage.getItem(key); } catch { return null; }
    }
    if (AsyncStorageLib) return AsyncStorageLib.getItem(key);
    return null;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.setItem(key, value); } catch {}
      return;
    }
    if (AsyncStorageLib) await AsyncStorageLib.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.removeItem(key); } catch {}
      return;
    }
    if (AsyncStorageLib) await AsyncStorageLib.removeItem(key);
  },
};
