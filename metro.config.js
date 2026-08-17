const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

// ─── Web-safe module stubs ────────────────────────────────────────────────────
// On web (Vercel build), native-only packages are replaced with empty stubs
// so that `expo export -p web` doesn't fail trying to bundle them.
const nativeOnlyModules = [
  'expo-sqlite',
  '@react-native-async-storage/async-storage',
  'expo-print',
  'expo-sharing',
  'expo-file-system',
  'expo-document-picker',
  'expo-location',
  'expo-notifications',
];

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // On web platform, stub out all native-only modules
  if (platform === 'web' && nativeOnlyModules.includes(moduleName)) {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'src/stubs/native-stub.js'),
    };
  }
  // Fall through to default resolution
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
