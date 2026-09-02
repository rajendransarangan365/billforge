import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StorageSettings {
  baseFolderName: string;        // default: 'Billing'
  organizeByParty: boolean;      // default: false (true -> Billing/PartyName/)
  androidSafUri: string | null;  // Android Storage Access Framework directory URI
  androidSafName: string | null; // Friendly name of selected folder (e.g. "Documents/Billing")
}

const STORAGE_SETTINGS_KEY = 'bf_storage_settings_v1';

export const DEFAULT_STORAGE_SETTINGS: StorageSettings = {
  baseFolderName: 'Billing',
  organizeByParty: true,
  androidSafUri: null,
  androidSafName: null,
};

/**
 * Load saved storage settings.
 */
export async function getStorageSettings(): Promise<StorageSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_STORAGE_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error('Error reading storage settings:', error);
  }
  return DEFAULT_STORAGE_SETTINGS;
}

/**
 * Save storage settings.
 */
export async function saveStorageSettings(settings: Partial<StorageSettings>): Promise<StorageSettings> {
  try {
    const current = await getStorageSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Error saving storage settings:', error);
    return DEFAULT_STORAGE_SETTINGS;
  }
}

/**
 * Sanitize a string for safe filesystem folder or filename usage.
 */
export function sanitizeFileSystemName(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // Remove illegal chars
    .replace(/\s+/g, '_')                  // Replace spaces with underscore
    .replace(/_+/g, '_');                   // Collapse multiple underscores
}

/**
 * Generate formatted timestamp: DDMMYYYY_HHMMSS (e.g. 02Sep2026_193400)
 */
export function generatePdfTimestamp(date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  const secs = String(date.getSeconds()).padStart(2, '0');

  return `${day}${month}${year}_${hours}${mins}${secs}`;
}

/**
 * Generate standard filename: PartyName_BillNumber_Timestamp.pdf
 */
export function generateBillPdfFileName(partyName: string, billNumber: string, date: Date = new Date()): string {
  const cleanParty = sanitizeFileSystemName(partyName) || 'Customer';
  const cleanBillNo = sanitizeFileSystemName(billNumber) || 'Bill';
  const timestamp = generatePdfTimestamp(date);
  return `${cleanParty}_${cleanBillNo}_${timestamp}.pdf`;
}

/**
 * Android SAF: Prompt user to select a folder on device to save bills.
 */
export async function pickAndroidStorageDirectory(): Promise<{ success: boolean; uri?: string; name?: string; error?: string }> {
  if (Platform.OS !== 'android') {
    return { success: false, error: 'Storage Access Framework is only available on Android.' };
  }

  try {
    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (permissions.granted) {
      const uri = permissions.directoryUri;
      // Decode URI to extract friendly folder name
      let friendlyName = 'Selected Folder';
      try {
        const decoded = decodeURIComponent(uri);
        const parts = decoded.split(':');
        if (parts.length > 1) {
          friendlyName = parts[parts.length - 1] || 'Internal Storage';
        }
      } catch {}

      await saveStorageSettings({ androidSafUri: uri, androidSafName: friendlyName });
      return { success: true, uri, name: friendlyName };
    } else {
      return { success: false, error: 'Directory permission was not granted.' };
    }
  } catch (error: any) {
    console.error('Error picking Android directory:', error);
    return { success: false, error: error.message || 'Failed to select directory.' };
  }
}

/**
 * Save a generated PDF into the configured folder.
 * Supports:
 * 1. Android Storage Access Framework (SAF) if user picked a directory.
 * 2. Native FileSystem (Documents/Billing or Documents/Billing/PartyName).
 * 3. Web download.
 */
export async function savePdfToStorageDestination({
  tempUri,
  partyName = '',
  billNumber = '',
}: {
  tempUri: string;
  partyName?: string;
  billNumber?: string;
}): Promise<string> {
  const fileName = generateBillPdfFileName(partyName, billNumber);
  const settings = await getStorageSettings();
  const baseFolder = sanitizeFileSystemName(settings.baseFolderName || 'Billing') || 'Billing';
  const partyFolder = sanitizeFileSystemName(partyName);

  if (Platform.OS === 'web') {
    // Web automatic download trigger
    try {
      if (tempUri && (tempUri.startsWith('blob:') || tempUri.startsWith('data:'))) {
        const a = document.createElement('a');
        a.href = tempUri;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e) {
      console.error('Web PDF download trigger error:', e);
    }
    return tempUri;
  }

  // Android Storage Access Framework (SAF) Custom Selected Directory
  if (Platform.OS === 'android' && settings.androidSafUri) {
    try {
      let targetDirUri = settings.androidSafUri;

      // If organize by party is enabled, create/find subfolder for party
      if (settings.organizeByParty && partyFolder) {
        try {
          // Check if party subfolder exists or create it
          targetDirUri = await FileSystem.StorageAccessFramework.makeDirectoryAsync(
            settings.androidSafUri,
            partyFolder
          );
        } catch (e) {
          // Subdirectory might already exist, fallback to root targetDirUri
          targetDirUri = settings.androidSafUri;
        }
      }

      // Read temp PDF file as Base64
      const fileBase64 = await FileSystem.readAsStringAsync(tempUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Create file in SAF directory
      const newFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
        targetDirUri,
        fileName,
        'application/pdf'
      );

      // Write base64 content
      await FileSystem.writeAsStringAsync(newFileUri, fileBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log(`[PDF Saved SAF] File saved via SAF to: ${newFileUri}`);
      return newFileUri;
    } catch (safError) {
      console.warn('SAF save failed, falling back to standard FileSystem:', safError);
    }
  }

  // Standard FileSystem fallback (iOS, Android without SAF)
  try {
    let targetDir = `${FileSystem.documentDirectory}${baseFolder}/`;
    if (settings.organizeByParty && partyFolder) {
      targetDir = `${targetDir}${partyFolder}/`;
    }

    const dirInfo = await FileSystem.getInfoAsync(targetDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
    }

    const destinationUri = `${targetDir}${fileName}`;
    await FileSystem.copyAsync({ from: tempUri, to: destinationUri });
    console.log(`[PDF Saved] File saved to: ${destinationUri}`);
    return destinationUri;
  } catch (err) {
    console.error('Error saving to FileSystem directory:', err);
    return tempUri;
  }
}
