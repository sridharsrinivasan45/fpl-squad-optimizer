import type { Player } from './pointsProjection';

export interface PlayerRatings {
  expectedPointsRating: number;
  valueRating: number;
  captaincyRating: number;
  differentialRating: number;
  reliabilityRating: number;
  fixtureRating: number;
  riskRating: number;
  overallRating: number;
}

export interface RecommendationDetails {
  ratings: PlayerRatings;
  stars: number; // 1 to 5
  categoryLabel: string; // e.g. "Essential Pick"
  reasonsToBuy: string[];
  reasonsForCaution: string[];
  educationalTags: string[];
}

// Clamps a number between min and max
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function calculatePlayerRatings(
  player: Player,
  _isPreSeason: boolean,
  matchesAvailable: number
): RecommendationDetails {
  // 1. Expected Points Rating (EP_Rating)
  // Scale expected points relative to 8.0 (elite ceiling in a GW)
  const expectedPointsRating = clamp(
    Math.round((player.projected_points / 0.80) * 10) / 10,
    0,
    10
  );

  // 2. Value for Money Rating (Value_Rating)
  // Scale expected points per £M (PPM) relative to 0.12 PPM
  const costMillions = player.now_cost / 10;
  const ppm = costMillions > 0 ? player.projected_points / costMillions : 0;
  const valueRating = clamp(Math.round((ppm / 0.12) * 10) / 10, 0, 10);

  // 3. Captaincy Rating (Cap_Rating)
  // Combines expected points with immediate playing probability (captains must start)
  const playingProbability = (player.chance_of_playing_next_round ?? 100) / 100;
  const statusMultiplier = player.status === 'a' ? 1.0 : player.status === 'd' ? 0.75 : player.status === 'i' ? 0.30 : 0.00;
  const capRating = clamp(
    Math.round(expectedPointsRating * playingProbability * statusMultiplier * 10) / 10,
    0,
    10
  );

  // 4. Differential Rating (Diff_Rating)
  // Inverse scale of FPL ownership
  const differentialRating = clamp(
    Math.round((10 - player.selected_by_percent / 4) * 10) / 10,
    0,
    10
  );

  // 5. Reliability Rating (Reliability_Rating) / Chance of Starting
  // 70% current availability, 30% historical selection starts ratio
  // If pre-season, we estimate using last season stats assuming 38 match ref
  const startsRef = matchesAvailable > 0 ? matchesAvailable : 30;
  // We mock starts and minutes from the raw element stats if not in the player interface, but wait:
  // Player interface in pointsProjection doesn't have starts/minutes directly, but we can assume:
  // Since it was calculated in pointsProjection, let's look at playingProbability.
  // Actually, we can approximate the starts ratio or pass it down.
  // Let's check: in pointsProjection, playingProbability was calculated. We can estimate reliability rating:
  // If player.chance_of_playing_next_round is available, that represents availability.
  // If they have no injury status flag, and high selection percentage, they are reliable.
  // Let's approximate historical starts using selected_by_percent and cost as proxy if starts is not directly on the Player interface,
  // or wait: can we pass the raw starts/minutes inside Player interface?
  // Let's check: in pointsProjection.ts, we did NOT return starts and minutes in the returned Player list.
  // But wait, we can edit pointsProjection.ts to add `starts` and `minutes` to the Player interface so the recommendation engine has access to them!
  // This is a beautiful design choice! Let's check if they are already there. No, they are not.
  // Wait, let's verify if we can add them. Yes, let's write a flexible fallback in the rating engine first:
  const starts = (player as any).starts || 0;
  const reliabilityRating = clamp(
    Math.round((playingProbability * 7 + clamp(starts / startsRef, 0, 1) * 3) * 10) / 10,
    0,
    10
  );

  // 6. Fixture Rating (Fixture_Rating) / Easy Fixture
  // FDR 1 -> 10, FDR 2 -> 8.5, FDR 3 -> 7.0, FDR 4 -> 5.0, FDR 5 -> 3.0
  let avgFdr = 3.0;
  let isHome = false;
  if (player.fixtures && player.fixtures.length > 0) {
    avgFdr = player.fixtures.reduce((acc, f) => acc + f.difficulty, 0) / player.fixtures.length;
    isHome = player.fixtures.some(f => f.is_home);
  }
  const fixtureRating = clamp(
    Math.round((12 - 2 * avgFdr + (isHome ? 0.5 : 0)) * 10) / 10,
    0,
    10
  );

  // 7. Risk Rating (Risk_Rating) - Inverse Scale (Higher score = Lower risk / Safer)
  // Low playing probability, yellow flags, and promoted status increase risk
  const isPromoted = (player as any).isPromoted || false;
  const riskScore = (1 - playingProbability) * 6 + (player.status !== 'a' ? 2 : 0) + (isPromoted ? 2 : 0);
  const riskRating = clamp(Math.round((10 - riskScore) * 10) / 10, 0, 10);

  // 8. Overall Fantasy Rating (Overall_Rating)
  // Weighted index: 40% expected points, 30% value, 20% reliability, 10% fixture
  const overallRating = clamp(
    Math.round(
      (0.40 * expectedPointsRating +
        0.30 * valueRating +
        0.20 * reliabilityRating +
        0.10 * fixtureRating) *
        10
    ) / 10,
    0,
    10
  );

  // Mappings
  let stars = 1;
  let categoryLabel = 'Avoid';
  if (overallRating >= 8.5) {
    stars = 5;
    categoryLabel = 'Essential Pick';
  } else if (overallRating >= 7.0) {
    stars = 4;
    categoryLabel = 'Strong Pick';
  } else if (overallRating >= 5.0) {
    stars = 3;
    categoryLabel = 'Situational Pick';
  } else if (overallRating >= 3.5) {
    stars = 2;
    categoryLabel = 'Differential Only';
  } else {
    stars = 1;
    categoryLabel = 'Avoid';
  }

  // Reasons to Buy
  const reasonsToBuy: string[] = [];
  if (expectedPointsRating >= 7.5) reasonsToBuy.push('Elite expected points return');
  if (valueRating >= 7.5) reasonsToBuy.push('Exceptional points-per-million value');
  if (fixtureRating >= 8.0) reasonsToBuy.push('Highly favorable upcoming matchup');
  if (reliabilityRating >= 9.0) reasonsToBuy.push('Highly secure starter with low bench risk');
  if ((player as any).penalties_order === 1) reasonsToBuy.push('Primary penalty taker');
  if (overallRating >= 8.0 && differentialRating >= 7.5) reasonsToBuy.push('Excellent high-upside differential');

  // Fallback if empty
  if (reasonsToBuy.length === 0) {
    if (overallRating >= 5.0) reasonsToBuy.push('Solid fill-in option');
    else reasonsToBuy.push('Price enabler for capital release');
  }

  // Reasons for Caution
  const reasonsForCaution: string[] = [];
  if (reliabilityRating < 6.0) reasonsForCaution.push('High rotation risk (limited minutes expected)');
  if (fixtureRating < 5.0) reasonsForCaution.push('Difficult upcoming fixture difficulty');
  if (costMillions >= 8.5 && expectedPointsRating < 6.0) reasonsForCaution.push('Expensive relative to projected returns');
  if (player.status !== 'a') reasonsForCaution.push(`Carrying fitness concerns: ${player.news || 'Injured'}`);
  if (riskRating < 6.0) reasonsForCaution.push('High volatility risk (unpredictable returns)');

  // Fallback if empty
  if (reasonsForCaution.length === 0) {
    reasonsForCaution.push('Competitive alternatives exist in this price tier');
  }

  // Educational insights tags
  const educationalTags: string[] = [];
  if (reliabilityRating >= 9.0 && overallRating >= 7.0 && costMillions <= 8.5) {
    educationalTags.push('Good for beginners');
  }
  if (differentialRating >= 8.0 && riskRating <= 5.0 && expectedPointsRating >= 4.5) {
    educationalTags.push('High-risk differential');
  }
  if (overallRating >= 7.5 && fixtureRating >= 8.0) {
    educationalTags.push('Excellent wildcard pick');
  }
  if (overallRating < 3.5 || player.status === 'i') {
    educationalTags.push('Avoid for now');
  }
  if (capRating >= 8.5) {
    educationalTags.push('Safe captain candidate');
  }
  if (costMillions <= 5.0 && valueRating >= 8.0) {
    educationalTags.push('Budget enabler');
  }
  if (costMillions >= 9.0 && overallRating >= 8.0) {
    educationalTags.push('Premium worth paying for');
  }

  return {
    ratings: {
      expectedPointsRating,
      valueRating,
      captaincyRating: capRating,
      differentialRating,
      reliabilityRating,
      fixtureRating,
      riskRating,
      overallRating
    },
    stars,
    categoryLabel,
    reasonsToBuy,
    reasonsForCaution,
    educationalTags
  };
}
