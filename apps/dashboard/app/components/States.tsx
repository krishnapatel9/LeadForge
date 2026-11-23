"use client";

/** Prototype-style empty / error / loading blocks, shared by every page. */

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="empty" role="status">
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty" role="alert">
      {message}
      {onRetry && (
        <>
          <br />
          <br />
          <button className="btn" type="button" onClick={onRetry}>
            Try again
          </button>
        </>
      )}
    </div>
  );
}
