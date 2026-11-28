/** Avoid flashing placeholder dashboard cards while admin routes stream. */
export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite" className="sr-only">
      Loading admin page…
    </div>
  );
}
