export default function Loading() {
  return (
    <div className="flex min-h-[40vh] w-full items-center justify-center" aria-live="polite" aria-busy="true">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
