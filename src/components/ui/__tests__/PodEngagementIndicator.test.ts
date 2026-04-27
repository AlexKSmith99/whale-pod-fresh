import { calculateEngagement } from '../PodEngagementIndicator';

describe('calculateEngagement', () => {
  const newPod = { created_at: new Date().toISOString(), status: 'awaiting_kickoff' };
  const activePod = { created_at: '2026-01-01T00:00:00Z', status: 'active' };

  it('marks a new pod as hot when ≥2 recent acceptances', () => {
    const { isHot, spiceLevel } = calculateEngagement(newPod, 0, 0, 3, 0);
    expect(isHot).toBe(true);
    expect(spiceLevel).toBe(0); // spice only counts post-kickoff
  });

  it('does not mark a new pod as hot with 0–1 acceptances', () => {
    expect(calculateEngagement(newPod, 0, 0, 0, 0).isHot).toBe(false);
    expect(calculateEngagement(newPod, 0, 0, 1, 0).isHot).toBe(false);
  });

  it('returns spiceLevel 0 for an active pod with no activity', () => {
    expect(calculateEngagement(activePod, 0, 0, 0, 0).spiceLevel).toBe(0);
  });

  it('scales spiceLevel on an active pod by combined activity score', () => {
    expect(calculateEngagement(activePod, 1, 1, 0, 0).spiceLevel).toBe(1); // score 2 → 1
    expect(calculateEngagement(activePod, 2, 2, 0, 1).spiceLevel).toBe(2); // score 5 → 2
    expect(calculateEngagement(activePod, 5, 4, 0, 2).spiceLevel).toBe(3); // score 11 → 3
  });

  it('never sets spiceLevel on a pod that has not kicked off', () => {
    const awaiting = { created_at: '2024-01-01', status: 'awaiting_kickoff' };
    expect(calculateEngagement(awaiting, 10, 10, 10, 10).spiceLevel).toBe(0);
  });
});
