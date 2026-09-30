import { AuthForm } from "@/components/auth-form";

type PageProps = { searchParams: Promise<{ next?: string }> };

export const metadata = {
  title: "Créer un compte — Conakry Guide",
  description: "Rejoignez Conakry Guide et partagez vos adresses préférées.",
};

function safeDestination(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/profile";
}

export default async function RegisterPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
  return <AuthForm googleEnabled={googleEnabled} mode="register" returnTo={safeDestination(params.next)} />;
}
