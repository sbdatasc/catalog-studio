import { Pencil, Trash2, List } from "lucide-react";
import { Link } from "wouter";
import { type ReferenceDataset } from "@/lib/apiClient";
import { Badge } from "@/components/ui/badge";

interface Props {
  dataset: ReferenceDataset;
  onEdit: (dataset: ReferenceDataset) => void;
  onDelete: (dataset: ReferenceDataset) => void;
}

export function ReferenceDatasetCard({ dataset, onEdit, onDelete }: Props) {
  return (
    <div
      className="group relative flex flex-col bg-card rounded-xl border border-border p-5 hover-elevate transition-all duration-200"
      data-testid={`card-dataset-${dataset.id}`}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <Link
          href={`/designer/reference-data/${dataset.id}`}
          className="flex-1 min-w-0"
          data-testid={`link-dataset-${dataset.id}`}
        >
          <h3 className="font-display font-semibold text-foreground text-lg truncate hover:text-primary transition-colors cursor-pointer">
            {dataset.name}
          </h3>
        </Link>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(dataset); }}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            data-testid={`button-edit-dataset-${dataset.id}`}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(dataset); }}
            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            data-testid={`button-delete-dataset-${dataset.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Link href={`/designer/reference-data/${dataset.id}`} className="flex-1">
        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px] leading-relaxed cursor-pointer">
          {dataset.description ? (
            dataset.description
          ) : (
            <span className="italic opacity-70">No description</span>
          )}
        </p>
      </Link>

      <div className="mt-5 pt-4 border-t border-border/50 flex items-center gap-2">
        <Badge variant="secondary" className="gap-1 font-normal text-xs">
          <List className="w-3 h-3" />
          {dataset.valueCount} {dataset.valueCount === 1 ? "value" : "values"}
        </Badge>
      </div>
    </div>
  );
}
