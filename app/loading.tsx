export default function Loading() {
  return (
    <main aria-label="Chargement de la page" className="page-container">
      <div className="profile-skeleton" />
      <div className="establishment-grid loading-card-grid">
        <span /><span /><span />
      </div>
    </main>
  );
}
