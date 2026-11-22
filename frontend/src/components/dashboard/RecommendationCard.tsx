interface RecommendationCardProps {
  recommendations: string[];
}

export function RecommendationCard({ recommendations }: RecommendationCardProps) {
  const visibleRecommendations = recommendations.filter(
    (recommendation) =>
      typeof recommendation === "string" &&
      recommendation.trim().length > 0,
  );

  if (visibleRecommendations.length === 0) {
    return (
      <p className="border-y border-slate-200 py-4 text-sm leading-6 text-slate-600">
        No recommendations right now. New recommendations will appear when relevant dashboard conditions are detected.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-200 border-y border-slate-200">
      {visibleRecommendations.map((recommendation, index) => (
        <li
          key={recommendation + "-" + index}
          className="border-l-2 border-emerald-700 py-3 pl-4 text-sm leading-6 text-slate-700"
        >
          {recommendation}
        </li>
      ))}
    </ul>
  );
}
