"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode, returnTo, googleEnabled }: { mode: "login" | "register"; returnTo: string; googleEnabled: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const isRegister = mode === "register";

  async function signInWithGoogle() {
    if (!googleEnabled) return;
    setPending(true);
    setError("");
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: returnTo,
      });
      if (result.error) {
        setError("Connexion Google impossible. Réessayez ou utilisez votre adresse e-mail.");
        setPending(false);
      }
    } catch {
      setError("Le service de compte est momentanément indisponible. Réessayez dans un instant.");
      setPending(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = isRegister
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });

      if (result.error) {
        setError(isRegister
          ? "Impossible de créer ce compte. Vérifiez les informations ou réessayez plus tard."
          : "Adresse e-mail ou mot de passe incorrect.");
        return;
      }
      router.replace(returnTo);
      router.refresh();
    } catch {
      setError("Le service de compte est momentanément indisponible. Réessayez dans un instant.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <div aria-hidden="true" className="auth-side-art">
        <div className="auth-art-circle" />
        <span>✳</span>
        <p>Les meilleures histoires<br />commencent par une adresse.</p>
      </div>
      <section className="auth-card" aria-labelledby="auth-title">
        <Link className="auth-back" href="/">← Retour à l’accueil</Link>
        <div className="eyebrow">CONAKRY GUIDE · LA COMMUNAUTÉ</div>
        <h1 id="auth-title">{isRegister ? <>Les bonnes adresses<br /><em>se partagent.</em></> : <>Heureux de vous<br /><em>revoir.</em></>}</h1>
        <p className="auth-intro">{isRegister ? "Créez votre compte pour noter vos lieux préférés et partager vos découvertes." : "Connectez-vous pour retrouver vos adresses et partager vos expériences."}</p>

        <button
          className="button-google"
          disabled={pending || !googleEnabled}
          onClick={signInWithGoogle}
          title={googleEnabled ? undefined : "La connexion Google n’est pas encore configurée sur ce site."}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 48 48">
            <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15Z" />
            <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.1c-1.8 1.2-4 1.9-6.8 1.9-5.2 0-9.6-3.5-11.2-8.2H5.9V33A20 20 0 0 0 24 44Z" />
            <path fill="#FBBC05" d="M12.8 27.7a12 12 0 0 1 0-7.4V15H5.9a20 20 0 0 0 0 18l6.9-5.3Z" />
            <path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 6 29.5 4 24 4A20 20 0 0 0 5.9 15l6.9 5.3c1.6-4.7 6-8.2 11.2-8.2Z" />
          </svg>
          {pending ? "Redirection vers Google…" : "Continuer avec Google"}
        </button>
        {!googleEnabled ? <p className="auth-google-note">Connexion Google en cours de configuration.</p> : null}
        <div aria-hidden="true" className="auth-divider"><span>ou par e-mail</span></div>

        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <form className="auth-form" onSubmit={submit}>
          {isRegister ? (
            <label htmlFor="name">Votre nom
              <input autoComplete="name" id="name" maxLength={100} onChange={(event) => setName(event.target.value)} placeholder="Comment vous appelle-t-on ?" required value={name} />
            </label>
          ) : null}
          <label htmlFor="email">Adresse e-mail
            <input autoComplete="email" id="email" onChange={(event) => setEmail(event.target.value)} placeholder="vous@exemple.com" required type="email" value={email} />
          </label>
          <label htmlFor="password">Mot de passe
            <span className="password-field">
              <input autoComplete={isRegister ? "new-password" : "current-password"} id="password" maxLength={128} minLength={isRegister ? 8 : undefined} onChange={(event) => setPassword(event.target.value)} placeholder={isRegister ? "8 caractères minimum" : "Votre mot de passe"} required type={visible ? "text" : "password"} value={password} />
              <button aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"} onClick={() => setVisible((current) => !current)} type="button">{visible ? "Masquer" : "Afficher"}</button>
            </span>
          </label>
          <button className="button button-dark auth-submit" disabled={pending} type="submit">
            {pending ? "Un instant…" : isRegister ? "Créer mon compte" : "Me connecter"}
            <span aria-hidden="true">→</span>
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? "Vous avez déjà un compte ? " : "Pas encore de compte ? "}
          <Link href={isRegister ? `/login?next=${encodeURIComponent(returnTo)}` : `/register?next=${encodeURIComponent(returnTo)}`}>
            {isRegister ? "Connectez-vous" : "Créer un compte"}
          </Link>
        </p>
        <small className="auth-security">Votre mot de passe est haché de façon sécurisée et n’est jamais visible par Conakry Guide.</small>
      </section>
    </main>
  );
}
