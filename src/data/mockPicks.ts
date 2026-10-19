import realPicksData from '@/data/realPicks.json';
import { BetRecord, PicksPayload } from '@/data/types';

export const REAL_PICKS_PAYLOAD: PicksPayload = realPicksData as unknown as PicksPayload;

// Kept as an alias so existing repository imports remain compatible
export const MOCK_PICKS_PAYLOAD: PicksPayload = REAL_PICKS_PAYLOAD;

export const INITIAL_SAMPLE_BETS: BetRecord[] = [];
