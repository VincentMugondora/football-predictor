import { MOCK_PICKS_PAYLOAD } from '@/data/mockPicks';
import { MatchPick, PicksPayload, PicksRepository } from '@/data/types';

class LocalMockPicksRepository implements PicksRepository {
  async getPicks(): Promise<PicksPayload> {
    return MOCK_PICKS_PAYLOAD;
  }

  getMatchById(id: string): MatchPick | undefined {
    return MOCK_PICKS_PAYLOAD.matches.find((match) => match.id === id);
  }
}

export const picksRepository = new LocalMockPicksRepository();
