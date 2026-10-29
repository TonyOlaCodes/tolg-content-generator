import AppShell from "@/components/AppShell";

/**
 * Share link: /join/ABC123 drops the player straight into the lobby (the client
 * asks for a nickname first if it does not know one yet).
 */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <AppShell initialCode={code.toUpperCase()} />;
}
