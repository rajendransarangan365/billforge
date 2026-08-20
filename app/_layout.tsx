import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, Platform, View } from 'react-native';
import { AuthProvider } from '../src/context/AuthContext';
import { SidebarNav } from '../src/components';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" translucent={false} backgroundColor="transparent" />
          <View style={styles.appContainer}>
            {Platform.OS === 'web' && <SidebarNav />}
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
                <Stack.Screen name="driver-login" options={{ headerShown: false }} />
                <Stack.Screen name="customer-marketplace" options={{ headerShown: false }} />
                <Stack.Screen name="driver-portal" options={{ headerShown: false }} />
                <Stack.Screen name="enquiries" options={{ headerShown: false }} />
                <Stack.Screen name="drivers" options={{ headerShown: false }} />
                <Stack.Screen name="reminders" options={{ headerShown: false }} />
                <Stack.Screen name="ledger" options={{ headerShown: false }} />
              </Stack>
            </View>
          </View>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  appContainer: {
    flex: 1,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    backgroundColor: '#F8FAFC',
  },
  contentArea: {
    flex: 1,
    height: '100%',
  },
});
