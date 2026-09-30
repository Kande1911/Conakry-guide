import Link from "next/link";

export function ServiceMessage({ message, title = "Les adresses arrivent bientôt" }: {
  message: string;
  title?: string;
}) {
  return (
    <div className="service-message" role="status">
      <span className="service-message-icon" aria-hidden="true">⌁</span>
      <div>
        <h2>{title}</h2>
        <p>{message}</p>
        <Link href="/establishments">Réessayer <span aria-hidden="true">→</span></Link>
      </div>
    </div>
  );
}
