import { useState } from "react";
import { useLocation } from "wouter";
import { X } from "lucide-react";
import type { EntryLinkInstance } from "@/lib/apiClient";
import { UnlinkConfirmModal } from "./UnlinkConfirmModal";

interface Props {
  link: EntryLinkInstance;
  currentEntryId: string;
  catalogId: string;
  isDiscontinued?: boolean;
}

export function EntryLinkChip({ link, currentEntryId, catalogId, isDiscontinued }: Props) {
  const [, navigate] = useLocation();
  const [showUnlink, setShowUnlink] = useState(false);

  const isFromSide = link.direction === "from";
  const linkedEntryId = isFromSide ? link.toEntryId : link.fromEntryId;
  const linkedEntryName = isFromSide ? link.toEntryName : link.fromEntryName;
  const linkedTemplateId = isFromSide ? link.toTemplateId : link.fromTemplateId;
  const linkedTemplateName = isFromSide ? link.toTemplateName : "";

  function handleChipClick() {
    navigate(`/catalogs/${catalogId}/operational/${linkedTemplateId}/entries/${linkedEntryId}`);
  }

  return (
    <>
      <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-sm hover:bg-muted/50 transition-colors">
        <button
          className="flex items-center gap-1.5 text-left"
          onClick={handleChipClick}
        >
          <span className="font-medium text-foreground truncate max-w-[160px]">
            {linkedEntryName}
          </span>
          {linkedTemplateName && (
            <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">
              {linkedTemplateName}
            </span>
          )}
        </button>
        {!isDiscontinued && (
          <button
            className="ml-1 rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
            onClick={() => setShowUnlink(true)}
            title="Remove link"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {showUnlink && (
        <UnlinkConfirmModal
          link={link}
          currentEntryId={currentEntryId}
          onClose={() => setShowUnlink(false)}
        />
      )}
    </>
  );
}
