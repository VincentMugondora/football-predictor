import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export type AppButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  accessibilityLabel?: string;
  disabled?: boolean;
  compact?: boolean;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  accessibilityLabel,
  disabled = false,
  compact = false,
}: AppButtonProps) {
  const theme = useAppTheme();
  const styles = useMemo(
    () => createStyles(theme, variant, disabled, compact),
    [theme, variant, disabled, compact]
  );

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}>
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}

function createStyles(
  theme: AppTheme,
  variant: AppButtonVariant,
  disabled: boolean,
  compact: boolean
) {
  let bg = theme.colors.primary;
  let textColor = theme.colors.primaryTextOnColor;
  let borderColor = theme.colors.primary;

  if (variant === 'secondary') {
    bg = theme.colors.surfaceElevated;
    textColor = theme.colors.textPrimary;
    borderColor = theme.colors.border;
  } else if (variant === 'danger') {
    bg = theme.colors.dangerMuted;
    textColor = theme.colors.danger;
    borderColor = theme.colors.borderDanger;
  } else if (variant === 'ghost') {
    bg = 'transparent';
    textColor = theme.colors.primary;
    borderColor = theme.colors.borderAccent;
  }

  return StyleSheet.create({
    button: {
      minHeight: theme.layout.minTouchTarget,
      minWidth: theme.layout.minTouchTarget,
      paddingHorizontal: compact ? theme.spacing.md : theme.spacing.lg,
      paddingVertical: compact ? theme.spacing.xs : theme.spacing.sm,
      borderRadius: theme.radii.banner,
      backgroundColor: bg,
      borderColor,
      borderWidth: theme.layout.borderWidth,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: disabled ? 0.5 : 1,
    },
    text: {
      color: textColor,
      fontSize: compact ? theme.typography.sizes.caption : theme.typography.sizes.bodyStrong,
      fontWeight: theme.typography.weights.bold,
    },
  });
}
