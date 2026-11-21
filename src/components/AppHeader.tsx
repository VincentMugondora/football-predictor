import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onSearchPress?: () => void;
  isSearchActive?: boolean;
  /** Hide the settings button (e.g. on the Settings screen itself). */
  hideSettings?: boolean;
  right?: React.ReactNode;
}

export function AppHeader({
  title,
  subtitle,
  showBack = false,
  onSearchPress,
  isSearchActive = false,
  hideSettings = false,
  right,
}: AppHeaderProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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

  const settingsButton = hideSettings ? null : (
    <TouchableOpacity
      style={styles.iconButton}
      onPress={handleOpenSettings}
      accessibilityRole="button"
      accessibilityLabel="Open settings"
    >
      <Ionicons name="options-outline" size={20} color={theme.colors.textPrimary} />
    </TouchableOpacity>
  );

  if (showBack) {
    return (
      <View style={styles.detailHeader}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.detailTitles}>
          <Text style={styles.detailTitle} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.detailSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ?? settingsButton}
      </View>
    );
  }

  return (
    <View style={styles.brandHeader}>
      <View style={styles.brandGroup}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>M</Text>
        </View>
        <View>
          <Text style={styles.brandTitle} accessibilityRole="header">
            Match<Text style={styles.brandTitleAccent}>Sense</Text>
          </Text>
          <Text style={styles.brandSubtitle}>FOOTBALL PREDICTIONS</Text>
        </View>
      </View>
      <View style={styles.actionsRow}>
        {onSearchPress ? (
          <TouchableOpacity
            style={[styles.iconButton, isSearchActive ? styles.iconButtonActive : null]}
            onPress={onSearchPress}
            accessibilityRole="button"
            accessibilityState={{ selected: isSearchActive }}
            accessibilityLabel="Toggle search matches"
          >
            <Ionicons
              name={isSearchActive ? 'close' : 'search'}
              size={20}
              color={isSearchActive ? theme.colors.primary : theme.colors.textPrimary}
            />
          </TouchableOpacity>
        ) : null}
        {right}
        {settingsButton}
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    brandHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.md,
    },
    brandGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    brandMark: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandMarkText: {
      color: theme.colors.primaryTextOnColor,
      fontSize: 20,
      fontWeight: '900',
    },
    brandTitle: {
      color: theme.colors.textPrimary,
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
    },
    brandTitleAccent: {
      color: theme.colors.primary,
    },
    brandSubtitle: {
      color: theme.colors.textMuted,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: theme.typography.weights.bold,
      letterSpacing: 0.8,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    detailHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.md,
    },
    detailTitles: {
      flex: 1,
    },
    detailTitle: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      lineHeight: 24,
      fontWeight: theme.typography.weights.bold,
    },
    detailSubtitle: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    iconButton: {
      width: theme.layout.minTouchTarget,
      height: theme.layout.minTouchTarget,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconButtonActive: {
      backgroundColor: theme.colors.primaryMuted,
    },
  });
}
