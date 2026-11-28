/**
 * Keep route transitions visually quiet.
 *
 * The former full-screen fallback recreated a blue dashboard shell between
 * every route. The active page remains responsible for its own content;
 * assistive technology still receives a loading announcement.
 */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="sr-only">
      Loading page…
    </div>
  );
}
