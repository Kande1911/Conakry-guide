import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-container profile-page">
      <div className="profile-empty">
        <span aria-hidden="true">⌕</span>
        <h3>Cette adresse est introuvable.</h3>
        <p>Elle a peut-être changé de nom ou n’est plus disponible dans le carnet.</p>
        <Link className="button button-dark" href="/establishments">Explorer les adresses</Link>
      </div>
    </main>
  );
}
