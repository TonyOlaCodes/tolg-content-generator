import { ConnectionsClient } from "@/components/connections/connections-client";
import { getConnectionsAction } from "@/server/actions/settings";

export default async function ConnectionsPage() {
  const data = await getConnectionsAction();

  return (
    <ConnectionsClient
      connections={data.connections.map((c) => ({
        ...c,
        lastVerifiedAt: c.lastVerifiedAt
          ? c.lastVerifiedAt.toISOString()
          : null,
      }))}
      envStatus={data.envStatus}
    />
  );
}
