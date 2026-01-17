/**
 * Loading Screen
 *
 * Simple centered loading indicator.
 * Terminal aesthetic with monospace text.
 */

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <span className="text-sm font-mono text-text-muted">
        loading...
      </span>
    </div>
  );
}
