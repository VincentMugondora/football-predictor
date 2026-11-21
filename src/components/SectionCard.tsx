import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface SectionCardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  tone?: 'default' | 'hero';
}

/** A rounded card with an optional plain-language question as its title. */
export function SectionCard({ title, subtitle, children, tone = 'default' }: SectionCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, tone), [theme, tone]);
  return (
    <View style={styles.card}>
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

function createStyles(theme: AppTheme, tone: 'default' | 'hero') {
  return StyleSheet.create({
    card: {
      gap: theme.spacing.md,
      padding: 18,
      borderRadius: 18,
      backgroundColor: tone === 'hero' ? theme.colors.surfaceHero : theme.colors.surface,
      borderWidth: theme.layout.borderWidth,
      borderColor: tone === 'hero' ? theme.colors.borderAccent : theme.colors.border,
    },
    header: { gap: 2 },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 17,
      lineHeight: 22,
      fontWeight: theme.typography.weights.bold,
    },
    subtitle: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },
  });
}
