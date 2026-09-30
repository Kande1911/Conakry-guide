type SummaryForRanking = {
  average: number | null;
  count: number;
};

/** Bayesian community score keeps a single high rating from dominating the list. */
export function rankRecommendedEstablishments<T extends { id: string }>(
  establishments: T[],
  summaries: Record<string, SummaryForRanking>,
): T[] {
  const reviewed = establishments.filter((establishment) => (summaries[establishment.id]?.count ?? 0) > 0);
  const totalRatings = reviewed.reduce((total, establishment) => total + summaries[establishment.id].count, 0);
  const communityAverage = totalRatings
    ? reviewed.reduce((total, establishment) => {
        const summary = summaries[establishment.id];
        return total + (summary.average ?? 0) * summary.count;
      }, 0) / totalRatings
    : 0;
  const priorWeight = 3;

  return [...reviewed].sort((left, right) => {
    const leftSummary = summaries[left.id];
    const rightSummary = summaries[right.id];
    const leftScore = ((leftSummary.count * (leftSummary.average ?? 0)) + (priorWeight * communityAverage)) /
      (leftSummary.count + priorWeight);
    const rightScore = ((rightSummary.count * (rightSummary.average ?? 0)) + (priorWeight * communityAverage)) /
      (rightSummary.count + priorWeight);
    return rightScore - leftScore || rightSummary.count - leftSummary.count;
  });
}
