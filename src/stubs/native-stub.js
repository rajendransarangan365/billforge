/**
 * Native-only module stub for web platform.
 * All native packages resolve to this file during `expo export -p web`.
 * Configured with __esModule: true to prevent Babel/Metro interop wildcard errors.
 */

const nativeStub = {
  __esModule: true,

  // AsyncStorage interface
  getItem: () => Promise.resolve(null),
  setItem: () => Promise.resolve(),
  removeItem: () => Promise.resolve(),
  clear: () => Promise.resolve(),
  getAllKeys: () => Promise.resolve([]),
  multiGet: () => Promise.resolve([]),
  multiSet: () => Promise.resolve(),

  // expo-sqlite interface
  openDatabaseAsync: () => Promise.resolve({
    execAsync: () => Promise.resolve(),
    runAsync: () => Promise.resolve({ rowsAffected: 0, lastInsertRowId: 0 }),
    getAllAsync: () => Promise.resolve([]),
    getFirstAsync: () => Promise.resolve(null),
    closeAsync: () => Promise.resolve(),
    withTransactionAsync: (fn) => fn ? fn() : Promise.resolve(),
  }),
  openDatabaseSync: () => ({
    execSync: () => {},
    runSync: () => ({ rowsAffected: 0, lastInsertRowId: 0 }),
    getAllSync: () => [],
    getFirstSync: () => null,
    closeSync: () => {},
    withTransactionSync: (fn) => fn ? fn() : undefined,
  }),
  useSQLiteContext: () => null,
  SQLiteProvider: ({ children }) => children,

  // expo-location interface
  requestForegroundPermissionsAsync: () => Promise.resolve({ status: 'denied' }),
  requestBackgroundPermissionsAsync: () => Promise.resolve({ status: 'denied' }),
  getCurrentPositionAsync: () => Promise.resolve({ coords: { latitude: 0, longitude: 0, accuracy: 0 } }),
  watchPositionAsync: () => Promise.resolve({ remove: () => {} }),
  Accuracy: { Balanced: 3, High: 4, Highest: 5 },

  // expo-document-picker
  getDocumentAsync: () => Promise.resolve({ canceled: true, assets: [] }),

  // expo-print
  printAsync: () => Promise.resolve(),
  printToFileAsync: () => Promise.resolve({ uri: '' }),

  // expo-sharing
  shareAsync: () => Promise.resolve(),
  isAvailableAsync: () => Promise.resolve(false),

  // expo-file-system
  readAsStringAsync: () => Promise.resolve(''),
  writeAsStringAsync: () => Promise.resolve(),
  deleteAsync: () => Promise.resolve(),
  getInfoAsync: () => Promise.resolve({ exists: false }),
  copyAsync: () => Promise.resolve(),
  documentDirectory: '/documents/',
  cacheDirectory: '/cache/',
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },

  // expo-notifications
  requestPermissionsAsync: () => Promise.resolve({ status: 'denied' }),
  scheduleNotificationAsync: () => Promise.resolve(''),
  setNotificationHandler: () => {},
  addNotificationReceivedListener: () => ({ remove: () => {} }),
  addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3 },
};

// Set default export to point back to the stub object itself
nativeStub.default = nativeStub;

module.exports = nativeStub;
