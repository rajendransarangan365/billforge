import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        {/* translucent=true lets Android draw under the status bar;
            style="dark" means dark icons on the translucent bar */}
        <StatusBar style="dark" translucent={false} backgroundColor="transparent" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="template-detail"
            options={{ headerShown: false, presentation: 'card' }}
          />
          <Stack.Screen
            name="bill-form"
            options={{ headerShown: false, presentation: 'card' }}
          />
          <Stack.Screen
            name="bill-preview"
            options={{ headerShown: false, presentation: 'card' }}
          />
          <Stack.Screen
            name="customers"
            options={{ headerShown: false, presentation: 'card' }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
