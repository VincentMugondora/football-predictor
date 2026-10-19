import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

interface TabCapsuleIconProps {
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  focused: boolean;
}

function TabCapsuleIcon({ iconName, focused }: TabCapsuleIconProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.capsule, focused ? styles.capsuleActive : null]}>
      <Ionicons
        name={iconName}
        size={20}
        color={focused ? theme.colors.primary : theme.colors.textSecondary}
      />
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
          title: 'Matches',
          tabBarAccessibilityLabel: 'Matches tab',
          tabBarIcon: ({ focused }) => (
            <TabCapsuleIcon
              iconName={focused ? 'home' : 'home-outline'}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="predictions"
        options={{
          title: 'Predictions',
          tabBarAccessibilityLabel: 'Predictions tab',
          tabBarIcon: ({ focused }) => (
            <TabCapsuleIcon
              iconName={focused ? 'stats-chart' : 'stats-chart-outline'}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="favourites"
        options={{
          title: 'Favourites',
          tabBarAccessibilityLabel: 'Favourites tab',
          tabBarIcon: ({ focused }) => (
            <TabCapsuleIcon
              iconName={focused ? 'star' : 'star-outline'}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="bet-log"
        options={{
          title: 'Results',
          tabBarAccessibilityLabel: 'Results and bet log tab',
          tabBarIcon: ({ focused }) => (
            <TabCapsuleIcon
              iconName={focused ? 'trophy' : 'trophy-outline'}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          href: null,
          title: 'Summary',
          tabBarAccessibilityLabel: 'Summary tab',
        }}
      />
    </Tabs>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    tabBar: {
      backgroundColor: theme.colors.background,
      borderTopColor: theme.colors.border,
      borderTopWidth: theme.layout.borderWidth,
      height: 70,
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
  });
}
