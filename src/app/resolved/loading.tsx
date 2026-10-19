import { ItemListLoading } from "@/components/ItemListShell";

export default function ResolvedLoading() {
  return (
    <ItemListLoading
      title="Resolved"
      description="Every report here made it back to its owner, and each card shows how long the reunion took."
      controls={2}
    />
  );
}
