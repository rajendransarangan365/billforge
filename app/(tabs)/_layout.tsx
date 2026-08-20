// @ts-nocheck
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '../../src/theme';
import { Platform, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function TabIcon({ name, color, focused }) {
  return (
    <View style={[iconStyles.wrap, focused && iconStyles.wrapActive]}>
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}

const iconStyles = StyleSheet.create({
  wrap: {
    width: 40,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapActive: {
    backgroundColor: Colors.primarySurface,
  },
});

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === 'ios'
    ? 56 + insets.bottom
    : 60 + insets.bottom; // cover gesture nav bar on Android

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarLabelStyle: {
          ...Typography.small,
          fontWeight: '600',
          marginTop: -4,
          marginBottom: 4,
        },
        tabBarStyle: Platform.OS === 'web' ? { display: 'none' } : {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.borderLight,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: 6,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          elevation: 12,
          shadowColor: Colors.shadowMedium,
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 1,
          shadowRadius: 8,
        },
        tabBarItemStyle: {
          paddingTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'grid' : 'grid-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="templates"
        options={{
          title: 'Templates',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'document-text' : 'document-text-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="create-bill"
        options={{
          title: 'New Bill',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'add-circle' : 'add-circle-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Bills',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'receipt' : 'receipt-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="materials"
        options={{
          title: 'Materials',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'cube' : 'cube-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Company',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'business' : 'business-outline'} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
