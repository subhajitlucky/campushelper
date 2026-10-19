import { ItemListLoading } from "@/components/ItemListShell";

export default function SearchLoading() {
  return (
    <ItemListLoading
      title="Search"
      description="Search every report by title, description, or location — then narrow it down by type, status, or place."
      search
      controls={3}
      facets
    />
  );
}
