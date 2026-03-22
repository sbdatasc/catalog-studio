import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  catalogId: string;
}

export function NoSchemaPublishedBanner({ catalogId }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-16 text-center">
      <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-5">
        <AlertTriangle className="w-7 h-7 text-amber-500" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">No schema published yet</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        Go to Designer Mode to publish your schema before creating entries.
      </p>
      <Button asChild>
        <Link href={`/catalogs/${catalogId}/designer/publish`}>Go to Publish</Link>
      </Button>
    </div>
  );
}
