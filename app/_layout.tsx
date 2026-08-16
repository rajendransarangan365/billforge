import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { AuthProvider } from '../src/context/AuthContext';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" translucent={false} backgroundColor="transparent" />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="select-role" options={{ headerShown: false }} />
            <Stack.Screen name="owner-login" options={{ headerShown: false }} />
            <Stack.Screen name="customer-login" options={{ headerShown: false }} />
            <Stack.Screen name="driver-login" options={{ headerShown: false }} />
            <Stack.Screen name="customer-marketplace" options={{ headerShown: false }} />
            <Stack.Screen name="quarry-marketplace" options={{ headerShown: false }} />
            <Stack.Screen name="driver-marketplace" options={{ headerShown: false }} />
            <Stack.Screen name="driver-portal" options={{ headerShown: false }} />
            <Stack.Screen name="enquiries" options={{ headerShown: false }} />
            <Stack.Screen name="drivers" options={{ headerShown: false }} />
            <Stack.Screen name="live-tracking" options={{ headerShown: false }} />
            <Stack.Screen name="reminders" options={{ headerShown: false }} />
            <Stack.Screen name="ledger" options={{ headerShown: false }} />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
