import { Link } from "wouter";
import { CheckCircle2, XCircle } from "lucide-react";
import type { FieldValue } from "@/lib/apiClient";

interface Props {
  field: FieldValue;
  catalogId: string;
  templateId?: string;
}

function formatDate(isoOrDate: string): string {
  try {
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return isoOrDate;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return isoOrDate;
  }
}

function formatNumber(raw: string): string {
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return raw;
  return n.toLocaleString("en", { maximumFractionDigits: 10 });
}

export function AttributeDisplay({ field, catalogId, templateId: _templateId }: Props) {
  const { value, displayValue, attributeType } = field;

  if (value === null || value === "") {
    return <span className="text-muted-foreground italic text-sm">—</span>;
  }

  switch (attributeType) {
    case "string":
    case "text":
      return <span className="text-sm text-foreground whitespace-pre-wrap">{value}</span>;

    case "number":
      return <span className="text-sm text-foreground">{formatNumber(value)}</span>;

    case "boolean":
      return value === "true" ? (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Yes
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground bg-muted border border-border rounded-md px-2 py-0.5">
          <XCircle className="w-3.5 h-3.5" />
          No
        </span>
      );

    case "date":
      return <span className="text-sm text-foreground">{formatDate(value)}</span>;

    case "enum":
      return <span className="text-sm text-foreground">{value}</span>;

    case "reference": {
      const display = displayValue ?? value;
      return (
        <Link
          href={`/catalogs/${catalogId}/operational`}
          className="text-sm text-primary hover:underline"
        >
          {display}
        </Link>
      );
    }

    case "reference_data":
      return <span className="text-sm text-foreground">{displayValue ?? value}</span>;

    default:
      return <span className="text-sm text-foreground">{value}</span>;
  }
}
