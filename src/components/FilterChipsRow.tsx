import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

export interface FilterChipsRowProps {
  options: readonly string[];
  selected: string;
  onSelect: (option: string) => void;
}

export function FilterChipsRow({ options, selected, onSelect }: FilterChipsRowProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {options.map((option) => {
          const isActive = option === selected;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.chip, isActive ? styles.chipActive : styles.chipInactive]}
              onPress={() => onSelect(option)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Filter by ${option}`}>
              <Text
                style={[
                  styles.chipText,
                  isActive ? styles.chipTextActive : styles.chipTextInactive,
                ]}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrapper: {
      marginVertical: theme.spacing.xs,
    },
    scrollContent: {
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    chip: {
      minHeight: theme.layout.minTouchTarget,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: theme.layout.borderWidth,
    },
    chipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    chipInactive: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
    },
    chipText: {
      fontSize: theme.typography.sizes.body,
      fontWeight: theme.typography.weights.semibold,
    },
    chipTextActive: {
      color: theme.colors.primaryTextOnColor,
    },
    chipTextInactive: {
      color: theme.colors.textPrimary,
    },
  });
}
