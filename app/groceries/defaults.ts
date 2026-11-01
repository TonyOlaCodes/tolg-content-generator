// Creates the structural defaults only: one default supermarket, one default list, and settings.
// No foods, quantities, prices or meals are ever invented.
import { commit } from "@/groceries/store";
import { DEFAULT_LIST_NAME, DEFAULT_SHOP_NAME, type Snapshot } from "@/groceries/model";
import { newId } from "@/groceries/actions";

export async function ensureDefaults(): Promise<void> {
  await commit((s: Snapshot) => {
    if (s.settings) return { ops: [] };
    const shopId = newId();
    const listId = newId();
    const now = new Date().toISOString();
    return {
      ops: [
        { store: "shops", put: { id: shopId, name: DEFAULT_SHOP_NAME, version: 1 } },
        { store: "lists", put: { id: listId, name: DEFAULT_LIST_NAME, shopId, createdAt: now, finishedAt: null, version: 1 } },
        {
          store: "settings",
          put: { id: "main", defaultShopId: shopId, activeListId: listId, routine: [], version: 1 },
        },
      ],
    };
  });
}
