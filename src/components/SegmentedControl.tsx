import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  accessibilityLabel?: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

/** Equal-width tabs in a rounded track; the selected tab is lime. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.track} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.segment, selected ? styles.segmentActive : null]}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
          >
            <Text
              style={[styles.label, selected ? styles.labelActive : null]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    track: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
      padding: theme.spacing.xs,
      borderRadius: 14,
      backgroundColor: theme.colors.surface,
      borderWidth: theme.layout.borderWidth,
      borderColor: theme.colors.border,
    },
    segment: {
      flex: 1,
      minHeight: theme.layout.minTouchTarget - 4,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.sm,
    },
    segmentActive: {
      backgroundColor: theme.colors.primary,
    },
    label: {
      color: theme.colors.textSecondary,
      fontSize: 15,
      fontWeight: theme.typography.weights.medium,
    },
    labelActive: {
      color: theme.colors.primaryTextOnColor,
      fontWeight: theme.typography.weights.bold,
    },
  });
}
