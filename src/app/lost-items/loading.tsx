import { ItemListLoading } from "@/components/ItemListShell";

export default function LostItemsLoading() {
  return (
    <ItemListLoading
      title="Lost items"
      description="Everything reported missing on campus, newest first. If you have seen one of these, open it and tell the owner."
      controls={2}
      facets
    />
  );
}
