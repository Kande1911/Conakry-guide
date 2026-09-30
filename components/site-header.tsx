"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M16 27s9-8.2 9-15a9 9 0 1 0-18 0c0 6.8 9 15 9 15Z" fill="currentColor" />
        <circle cx="16" cy="12" r="3" fill="#f5f1e8" />
      </svg>
    </span>
  );
}

export function SiteHeader() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="brand" href="/" aria-label="Conakry Guide, accueil">
          <BrandMark />
          <span>Conakry<span className="brand-light">Guide</span></span>
        </Link>

        <nav className="primary-nav" aria-label="Navigation principale">
          <Link href="/establishments">Explorer</Link>
          <Link href="/establishments?sort=rating">Les mieux notés</Link>
          {session?.user.role === "admin" ? <Link href="/admin">Modération</Link> : null}
        </nav>

        <div className="header-actions">
          {isPending ? (
            <span className="header-loading" aria-label="Chargement du compte" />
          ) : session ? (
            <>
              <Link className="header-profile" href="/profile" title={session.user.name}>
                <span className="avatar-mini">{session.user.name.slice(0, 1).toUpperCase()}</span>
                <span className="header-profile-name">Mon espace</span>
              </Link>
              <button className="header-signout" onClick={handleSignOut} type="button">
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <Link className="header-login" href="/login">Connexion</Link>
              <Link className="button button-small button-dark" href="/register">Créer un compte</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
