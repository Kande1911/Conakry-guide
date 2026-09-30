import { AuthForm } from "@/components/auth-form";

type PageProps = { searchParams: Promise<{ next?: string }> };

export const metadata = {
  title: "Connexion — Conakry Guide",
  description: "Connectez-vous à Conakry Guide pour partager vos avis.",
};

function safeDestination(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/profile";
}

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
  return <AuthForm googleEnabled={googleEnabled} mode="login" returnTo={safeDestination(params.next)} />;
}
