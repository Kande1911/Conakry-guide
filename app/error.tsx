"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // A digest is safe to report; the error message may contain provider details and stays private.
    if (error.digest) console.error("Application rendering failed", { digest: error.digest });
  }, [error]);

  return (
    <main className="page-container profile-page">
      <div className="profile-empty">
        <span aria-hidden="true">⌁</span>
        <h3>Une erreur est survenue.</h3>
        <p>La page n’a pas pu être chargée. Réessayez dans un instant.</p>
        <button className="button button-dark" onClick={() => reset()} type="button">Réessayer</button>
      </div>
    </main>
  );
}
