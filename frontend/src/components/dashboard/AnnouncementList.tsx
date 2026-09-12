interface ListItem {
  id: string;
  title: string;
  meta: string;
}

interface AnnouncementListProps {
  items: ListItem[];
  emptyLabel?: string;
}

/**
 * Generic "title + meta line" list. Used for both Announcements
 * (meta = postedLabel) and Upcoming events (meta = whenLabel) so the
 * two visually-identical sections share one component.
 */
export function AnnouncementList({ items, emptyLabel = "Nothing here yet." }: AnnouncementListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id}>
          <p className="text-sm font-medium text-slate-800">{item.title}</p>
          <p className="text-xs text-slate-400">{item.meta}</p>
        </li>
      ))}
    </ul>
  );
}
