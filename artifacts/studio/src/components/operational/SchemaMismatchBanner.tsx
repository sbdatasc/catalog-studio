import { AlertTriangle } from "lucide-react";

export function SchemaMismatchBanner() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
      <p className="text-sm">
        This entry was created with an earlier schema version. New fields are shown below.
      </p>
    </div>
  );
}
