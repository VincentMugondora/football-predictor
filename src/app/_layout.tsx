import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

import { useAppTheme } from '@/theme/useAppTheme';

export default function RootLayout() {
  const theme = useAppTheme();

  return (
    <>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="match/[id]" />
        <Stack.Screen
          name="settings"
          options={{
            presentation: 'modal',
          }}
        />
      </Stack>
    </>
  );
}
