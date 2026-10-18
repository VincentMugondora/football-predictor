import React, { useMemo } from 'react';
import { KeyboardTypeOptions, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface AppInputProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
  helperText?: string;
  accessibilityLabel?: string;
}

export function AppInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  error,
  helperText,
  accessibilityLabel,
}: AppInputProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, Boolean(error)), [theme, error]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        keyboardType={keyboardType}
        accessibilityLabel={accessibilityLabel ?? label}
      />
      {error ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

function createStyles(theme: AppTheme, hasError: boolean) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.xs,
    },
    label: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.semibold,
    },
    input: {
      minHeight: theme.layout.minTouchTarget,
      backgroundColor: theme.colors.surfaceElevated,
      borderColor: hasError ? theme.colors.danger : theme.colors.border,
      borderWidth: theme.layout.borderWidth,
      borderRadius: theme.radii.banner,
      paddingHorizontal: theme.spacing.md,
      color: theme.colors.textPrimary,
      fontSize: theme.typography.sizes.body,
    },
    errorText: {
      color: theme.colors.danger,
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.medium,
    },
    helperText: {
      color: theme.colors.textMuted,
      fontSize: theme.typography.sizes.caption,
    },
  });
}
