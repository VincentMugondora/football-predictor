import { Tabs } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

interface TabCapsuleIconProps {
  glyph: string;
  focused: boolean;
}

function TabCapsuleIcon({ glyph, focused }: TabCapsuleIconProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.capsule, focused ? styles.capsuleActive : null]}>
      <Text style={[styles.glyph, focused ? styles.glyphActive : styles.glyphInactive]}>
        {glyph}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Picks',
          tabBarAccessibilityLabel: 'Picks tab',
          tabBarIcon: ({ focused }) => <TabCapsuleIcon glyph="⚽" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="bet-log"
        options={{
          title: 'Bet log',
          tabBarAccessibilityLabel: 'Bet log tab',
          tabBarIcon: ({ focused }) => <TabCapsuleIcon glyph="🏆" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: 'Summary',
          tabBarAccessibilityLabel: 'Summary tab',
          tabBarIcon: ({ focused }) => <TabCapsuleIcon glyph="▮▮▮" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    tabBar: {
      backgroundColor: theme.colors.surface,
      borderTopColor: theme.colors.border,
      borderTopWidth: theme.layout.borderWidth,
      height: 68,
      paddingTop: theme.spacing.xs,
      paddingBottom: theme.spacing.sm,
    },
    tabLabel: {
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.semibold,
      marginTop: theme.spacing.xxs,
    },
    capsule: {
      width: theme.layout.tabCapsuleWidth,
      height: theme.layout.tabCapsuleHeight,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    capsuleActive: {
      backgroundColor: theme.colors.primaryMuted,
    },
    glyph: {
      fontSize: theme.typography.sizes.sectionTitle,
      fontWeight: theme.typography.weights.bold,
    },
    glyphActive: {
      color: theme.colors.primary,
    },
    glyphInactive: {
      color: theme.colors.textSecondary,
    },
  });
}
