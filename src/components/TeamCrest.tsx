import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppTheme, useAppTheme } from '@/theme/useAppTheme';

interface ClubColors {
  bg: string;
  border: string;
  text: string;
  shortCode: string;
}

const CLUB_PALETTE: Record<string, ClubColors> = {
  Arsenal: { bg: '#EF0107', border: '#D4AF37', text: '#FFFFFF', shortCode: 'ARS' },
  Liverpool: { bg: '#FFFFFF', border: '#C8102E', text: '#C8102E', shortCode: 'LFC' },
  Chelsea: { bg: '#034694', border: '#DBA111', text: '#FFFFFF', shortCode: 'CHE' },
  Tottenham: { bg: '#FFFFFF', border: '#132257', text: '#132257', shortCode: 'TOT' },
  Everton: { bg: '#003399', border: '#FFFFFF', text: '#FFFFFF', shortCode: 'EVE' },
  'Aston Villa': { bg: '#670E36', border: '#95BFE5', text: '#95BFE5', shortCode: 'AVL' },
  Barcelona: { bg: '#A50044', border: '#EDBB00', text: '#EDBB00', shortCode: 'FCB' },
  Sevilla: { bg: '#D4021D', border: '#FFFFFF', text: '#FFFFFF', shortCode: 'SEV' },
  Inter: { bg: '#010E80', border: '#2E6DF6', text: '#FFFFFF', shortCode: 'INT' },
  Roma: { bg: '#8E1F2F', border: '#F0BC42', text: '#F0BC42', shortCode: 'ROM' },
  'Man City': { bg: '#6CABDD', border: '#1C2C5B', text: '#1C2C5B', shortCode: 'MCI' },
  Newcastle: { bg: '#241F20', border: '#FFFFFF', text: '#FFFFFF', shortCode: 'NEW' },
  Milan: { bg: '#FB090B', border: '#111111', text: '#FFFFFF', shortCode: 'ACM' },
  Napoli: { bg: '#12A0D7', border: '#FFFFFF', text: '#FFFFFF', shortCode: 'NAP' },
  'Real Madrid': { bg: '#FEBE10', border: '#00529F', text: '#00529F', shortCode: 'RMA' },
  Valencia: { bg: '#FF6600', border: '#111111', text: '#FFFFFF', shortCode: 'VAL' },
  'Atlético Madrid': {
    bg: '#CB3524',
    border: '#272E61',
    text: '#FFFFFF',
    shortCode: 'ATM',
  },
  'Bayern Munich': {
    bg: '#DC052D',
    border: '#FFFFFF',
    text: '#FFFFFF',
    shortCode: 'BAY',
  },
  Dortmund: { bg: '#FDE100', border: '#111111', text: '#111111', shortCode: 'BVB' },
};

function getClubIdentity(teamName: string): ClubColors {
  const known = CLUB_PALETTE[teamName];
  if (known) {
    return known;
  }
  const clean = teamName.trim().toUpperCase();
  const shortCode = clean.slice(0, 3) || 'FC';
  return {
    bg: '#1E293B',
    border: '#64748B',
    text: '#F8FAFC',
    shortCode,
  };
}

export interface TeamCrestProps {
  teamName: string;
  size?: 'sm' | 'lg';
}

export function TeamCrest({ teamName, size = 'sm' }: TeamCrestProps) {
  const theme = useAppTheme();
  const identity = getClubIdentity(teamName);
  const styles = useMemo(
    () => createStyles(theme, identity, size),
    [theme, identity, size]
  );

  return (
    <View
      style={styles.shield}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={`${teamName} club crest`}
    >
      <Text style={styles.code}>{identity.shortCode}</Text>
    </View>
  );
}

function createStyles(theme: AppTheme, identity: ClubColors, size: 'sm' | 'lg') {
  const dimension =
    size === 'lg' ? theme.layout.crestSizeLarge : theme.layout.crestSizeSmall;
  const fontSize =
    size === 'lg' ? theme.typography.sizes.bodyStrong : theme.typography.sizes.badge;

  return StyleSheet.create({
    shield: {
      width: dimension,
      height: dimension,
      borderRadius: size === 'lg' ? theme.radii.card : theme.radii.pill,
      backgroundColor: identity.bg,
      borderColor: identity.border,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    code: {
      color: identity.text,
      fontSize,
      fontWeight: theme.typography.weights.bold,
      letterSpacing: 0.5,
    },
  });
}
