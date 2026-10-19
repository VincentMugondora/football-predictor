import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface AppHeaderProps {
  title?: string;
  showBack?: boolean;
  onSearchPress?: () => void;
  isSearchActive?: boolean;
}

export function AppHeader({
  title,
  showBack = false,
  onSearchPress,
  isSearchActive = false,
}: AppHeaderProps) {
  const theme = useAppTheme();
  const styles = useMemo(
    () => createStyles(theme, isSearchActive),
    [theme, isSearchActive]
  );

  const handleOpenSettings = () => {
    router.push('/settings');
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  if (showBack) {
    return (
      <View style={styles.detailHeader}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.detailTitle} numberOfLines={1}>
          {title}
        </Text>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleOpenSettings}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.brandHeader}>
      <View style={styles.brandTitleGroup}>
        <Text style={styles.brandTitle} accessibilityRole="header">
          Match<Text style={styles.brandTitleAccent}>Sense</Text>
        </Text>
        <Text style={styles.brandSubtitle}>FOOTBALL PREDICTIONS</Text>
      </View>
      <View style={styles.actionsRow}>
        {onSearchPress ? (
          <TouchableOpacity
            style={[styles.iconButton, isSearchActive ? styles.iconButtonActive : null]}
            onPress={onSearchPress}
            accessibilityRole="button"
            accessibilityLabel="Toggle search matches"
          >
            <Ionicons
              name="search"
              size={22}
              color={isSearchActive ? theme.colors.primary : theme.colors.textPrimary}
            />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleOpenSettings}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme, isSearchActive: boolean) {
  return StyleSheet.create({
    brandHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
    },
    brandTitleGroup: {
      flex: 1,
      gap: 1,
    },
    brandTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.brandTitle,
      lineHeight: theme.typography.lineHeights.brandTitle,
      fontWeight: theme.typography.weights.bold,
      letterSpacing: -0.3,
    },
    brandTitleAccent: {
      color: theme.colors.primary,
    },
    brandSubtitle: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.badge,
      lineHeight: theme.typography.lineHeights.badge,
      fontWeight: theme.typography.weights.semibold,
      letterSpacing: 1.8,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xxs,
    },
    detailHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.xs,
      gap: theme.spacing.sm,
    },
    detailTitle: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.screenTitle,
      lineHeight: theme.typography.lineHeights.screenTitle,
      fontWeight: theme.typography.weights.semibold,
    },
    iconButton: {
      minWidth: theme.layout.minTouchTarget,
      minHeight: theme.layout.minTouchTarget,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconButtonActive: {
      backgroundColor: isSearchActive ? theme.colors.primaryMuted : 'transparent',
    },
  });
}
