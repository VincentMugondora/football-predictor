import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export type InfoBannerTone = 'info' | 'warning' | 'danger';

export interface InfoBannerProps {
  title: string;
  subtitle?: string;
  tone?: InfoBannerTone;
}

export function InfoBanner({ title, subtitle, tone = 'info' }: InfoBannerProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, tone), [theme, tone]);

  const iconName = tone === 'info' ? 'information-circle-outline' : 'warning-outline';
  const iconColor =
    tone === 'danger'
      ? theme.colors.dangerText
      : tone === 'warning'
        ? theme.colors.warningText
        : theme.colors.primary;

  return (
    <View
      style={styles.banner}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
    >
      <Ionicons name={iconName} size={22} color={iconColor} />
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme, tone: InfoBannerTone) {
  let bg = theme.colors.surfaceBanner;
  let border = theme.colors.borderAccent;

  if (tone === 'warning') {
    bg = theme.colors.surfaceWarningBanner;
    border = theme.colors.borderWarning;
  } else if (tone === 'danger') {
    bg = theme.colors.surfaceDangerBanner;
    border = theme.colors.borderDanger;
  }

  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: bg,
      borderColor: border,
      borderWidth: theme.layout.borderWidth,
      borderRadius: theme.radii.banner,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.md,
    },
    content: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      lineHeight: 21,
      fontWeight: theme.typography.weights.bold,
    },
    subtitle: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },
  });
}
