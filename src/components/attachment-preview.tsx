import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type PreviewItem = {
  name: string;
  meta?: string;
  /** object URL / data URL. Kosong = tidak bisa preview. */
  url?: string;
  mime?: string;
};

function previewKind(mime = "", name = ""): "image" | "video" | "audio" | "doc" | "other" {
  if (mime.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(name)) return "image";
  if (mime.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(name)) return "video";
  if (mime.startsWith("audio/") || /\.(mp3|wav|ogg|m4a)$/i.test(name)) return "audio";
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) return "doc";
  if (mime.startsWith("text/") || /\.(txt|log|md|csv|json|xml)$/i.test(name)) return "doc";
  return "other";
}

export function AttachmentPreviewDialog({
  item,
  onOpenChange,
}: {
  item: PreviewItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const kind = previewKind(item?.mime, item?.name ?? "");

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="truncate">{item?.name ?? "Preview"}</DialogTitle>
          {item?.meta && <DialogDescription>{item.meta}</DialogDescription>}
        </DialogHeader>
        {item && (
          <div className="space-y-3">
            {!item.url ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Preview tidak tersedia untuk file ini.
                </p>
              </div>
            ) : kind === "image" ? (
              <img
                src={item.url}
                alt={item.name}
                className="max-h-[65svh] w-full rounded-lg border object-contain"
              />
            ) : kind === "video" ? (
              <video src={item.url} controls className="max-h-[65svh] w-full rounded-lg border" />
            ) : kind === "audio" ? (
              <audio src={item.url} controls className="w-full" />
            ) : kind === "doc" ? (
              <iframe
                src={item.url}
                title={item.name}
                className="h-[65svh] w-full rounded-lg border bg-white"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Tipe file ini tidak bisa di-preview langsung.
                </p>
              </div>
            )}
            {item.url && (
              <div className="flex justify-end">
                <Button size="sm" asChild>
                  <a href={item.url} download={item.name}>
                    <Download className="h-4 w-4" /> Unduh
                  </a>
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
