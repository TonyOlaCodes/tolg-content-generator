import { MediaLibrary } from "@/components/media/media-library";
import { getTagsAction } from "@/server/actions/tags";

export default async function MediaPage() {
  const tags = await getTagsAction();

  return (
    <MediaLibrary
      initialTags={tags.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        category: t.category,
        isSystem: t.isSystem,
      }))}
    />
  );
}
