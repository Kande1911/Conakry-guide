import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-about">
          <Link className="footer-brand" href="/">Conakry Guide</Link>
          <p>Les bonnes adresses de Conakry, partagées par ceux qui les connaissent.</p>
        </div>
        <nav aria-label="Liens de pied de page" className="footer-nav">
          <Link href="/establishments">Explorer les établissements</Link>
          <Link href="/establishments?sort=popular">Les plus commentés</Link>
          <Link href="/establishments?sort=rating">Les mieux notés</Link>
          <Link href="/register">Rejoindre la communauté</Link>
        </nav>
        <small>© Conakry Guide</small>
      </div>
    </footer>
  );
}
