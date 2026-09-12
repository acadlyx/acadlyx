interface RecommendationCardProps {
  recommendations: string[];
}

/** Rule-based recommendations list — see docs/PHASE-3.md for what "rule-based" means here. */
export function RecommendationCard({ recommendations }: RecommendationCardProps) {
  if (recommendations.length === 0) {
    return <p className="text-sm text-slate-400">No recommendations right now.</p>;
  }

  return (
    <ul className="space-y-2">
      {recommendations.map((rec, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
          <span
            aria-hidden
            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-acadlyx-primary"
          />
          {rec}
        </li>
      ))}
    </ul>
  );
}
