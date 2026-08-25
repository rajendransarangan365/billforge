import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, Platform, View, useWindowDimensions } from 'react-native';
import { AuthProvider } from '../src/context/AuthContext';
import { SidebarNav, MinimizedTaskbar } from '../src/components';

import React, { useEffect } from 'react';

export default function RootLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const style = document.createElement('style');
      style.textContent = `
        html, body, #root {
          overflow-x: hidden !important;
          max-width: 100vw !important;
          width: 100% !important;
        }
        * {
          box-sizing: border-box !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" translucent={false} backgroundColor="transparent" />
          <View style={[styles.appContainer, { flexDirection: isDesktop ? 'row' : 'column' }]}>
            <SidebarNav />
            <View style={styles.contentArea}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="select-role" options={{ headerShown: false }} />
                <Stack.Screen name="admin-portal" options={{ headerShown: false }} />
                <Stack.Screen name="owner-login" options={{ headerShown: false }} />
                <Stack.Screen name="owner-register" options={{ headerShown: false }} />
                <Stack.Screen name="customer-login" options={{ headerShown: false }} />
                <Stack.Screen name="customer-register" options={{ headerShown: false }} />
                <Stack.Screen name="driver-login" options={{ headerShown: false }} />
                <Stack.Screen name="customer-marketplace" options={{ headerShown: false }} />
                <Stack.Screen name="driver-portal" options={{ headerShown: false }} />
                <Stack.Screen name="enquiries" options={{ headerShown: false }} />
                <Stack.Screen name="drivers" options={{ headerShown: false }} />
                <Stack.Screen name="reminders" options={{ headerShown: false }} />
                <Stack.Screen name="ledger" options={{ headerShown: false }} />
                <Stack.Screen name="transport-assignment" options={{ headerShown: false }} />
                <Stack.Screen name="earnings" options={{ headerShown: false }} />
                <Stack.Screen name="material-catalog" options={{ headerShown: false }} />
              </Stack>
              <MinimizedTaskbar />
            </View>
          </View>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', overflow: 'hidden' },
  appContainer: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    backgroundColor: '#020617',
    overflow: 'hidden',
  },
  contentArea: {
    flex: 1,
    height: '100%',
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
});
