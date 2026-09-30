interface RecommendationCardProps {
  recommendations: string[];
}

export function RecommendationCard({
  recommendations,
}: RecommendationCardProps) {
  const visibleRecommendations =
    recommendations.filter(
      (recommendation) =>
        typeof recommendation === "string" &&
        recommendation.trim().length > 0,
    );

  if (visibleRecommendations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5">
        <p className="text-sm font-medium text-slate-500">
          No recommendations right now.
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-400">
          New recommendations will appear when relevant
          dashboard conditions are detected.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {visibleRecommendations.map(
        (recommendation, index) => (
          <li
            key={`${recommendation}-${index}`}
            className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3 text-sm leading-6 text-slate-700"
          >
            <span
              aria-hidden="true"
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-acadlyx-primary"
            />

            <span className="min-w-0">
              {recommendation}
            </span>
          </li>
        ),
      )}
    </ul>
  );
}
