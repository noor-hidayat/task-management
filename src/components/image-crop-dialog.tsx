import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Rect = { x: number; y: number; w: number; h: number };

/**
 * Crop editor sederhana untuk gambar Note (tanpa dependensi tambahan).
 * - Seret area untuk memindahkan, seret sudut untuk mengubah ukuran.
 * - Apply → canvas crop → blob webp → dikembalikan ke editor sebagai
 *   blob baru (diunggah ke Storage saat note di-save).
 */
export function ImageCropDialog({
  open,
  src,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  /** Object/blob URL atau URL gambar yang akan di-crop. */
  src: string | null;
  onOpenChange: (open: boolean) => void;
  onApply: (cropped: Blob) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [disp, setDisp] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const [drag, setDrag] = useState<null | { mode: "move" | "nw" | "ne" | "sw" | "se"; sx: number; sy: number; base: Rect }>(null);
  const [busy, setBusy] = useState(false);

  // Muat dimensi asli + inisialisasi area crop 80% di tengah.
  useEffect(() => {
    if (!open || !src) return;
    setBusy(false);
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      const maxW = Math.min(640, img.naturalWidth);
      const scale = Math.min(1, maxW / img.naturalWidth);
      const dw = Math.max(1, Math.round(img.naturalWidth * scale));
      const dh = Math.max(1, Math.round(img.naturalHeight * scale));
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      setDisp({ w: dw, h: dh });
      const cw = Math.round(dw * 0.8);
      const ch = Math.round(dh * 0.8);
      setCrop({ x: Math.round((dw - cw) / 2), y: Math.round((dh - ch) / 2), w: cw, h: ch });
    };
    img.onerror = () => {
      if (alive) onOpenChange(false);
    };
    img.src = src;
    return () => {
      alive = false;
    };
  }, [open, src]); // eslint-disable-line react-hooks/exhaustive-deps

  const clampCrop = (r: Rect): Rect => {
    const w = Math.max(20, Math.min(r.w, disp.w - r.x));
    const h = Math.max(20, Math.min(r.h, disp.h - r.y));
    const x = Math.max(0, Math.min(r.x, disp.w - 20));
    const y = Math.max(0, Math.min(r.y, disp.h - 20));
    return { x, y, w: Math.max(20, Math.min(w, disp.w - x)), h: Math.max(20, Math.min(h, disp.h - y)) };
  };

  const onPointerDown = (mode: "move" | "nw" | "ne" | "sw" | "se") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ mode, sx: e.clientX, sy: e.clientY, base: { ...crop } });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || disp.w === 0) return;
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    // Konversi pergerakan pointer ke koordinat gambar (gambar pas di box).
    const scaleX = disp.w / box.width;
    const scaleY = disp.h / box.height;
    const dx = (e.clientX - drag.sx) * scaleX;
    const dy = (e.clientY - drag.sy) * scaleY;
    const b = drag.base;
    let next: Rect = b;
    if (drag.mode === "move") {
      next = { ...b, x: b.x + dx, y: b.y + dy };
    } else {
      let { x, y, w, h } = b;
      if (drag.mode.includes("e")) w = b.w + dx;
      if (drag.mode.includes("s")) h = b.h + dy;
      if (drag.mode.includes("w")) {
        x = b.x + dx;
        w = b.w - dx;
      }
      if (drag.mode.includes("n")) {
        y = b.y + dy;
        h = b.h - dy;
      }
      next = { x, y, w, h };
    }
    setCrop(clampCrop(next));
  };

  const onPointerUp = () => setDrag(null);

  const handleApply = async () => {
    if (!src || busy || disp.w === 0) return;
    setBusy(true);
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = src;
      });
      const kx = img.naturalWidth / disp.w;
      const ky = img.naturalHeight / disp.h;
      const sx = Math.max(0, Math.round(crop.x * kx));
      const sy = Math.max(0, Math.round(crop.y * ky));
      const sw = Math.min(img.naturalWidth - sx, Math.max(1, Math.round(crop.w * kx)));
      const sh = Math.min(img.naturalHeight - sy, Math.max(1, Math.round(crop.h * ky)));
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas tidak didukung");
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/webp", 0.9)
      );
      onApply(blob ?? (await (await fetch(src)).blob()));
      onOpenChange(false);
    } catch {
      setBusy(false);
    }
  };

  const outW = disp.w ? Math.round((crop.w / disp.w) * natural.w) : 0;
  const outH = disp.h ? Math.round((crop.h / disp.h) * natural.h) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
        </DialogHeader>
        {!src || disp.w === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Memuat gambar…</p>
        ) : (
          <div className="grid gap-3">
            <div className="flex justify-center overflow-auto rounded-lg border bg-black/80 p-4">
              <div
                ref={boxRef}
                className="relative shrink-0 touch-none select-none"
                style={{ width: disp.w, height: disp.h }}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <img
                  src={src}
                  alt="Crop preview"
                  draggable={false}
                  className="pointer-events-none block h-full w-full"
                />
                {/* Gelapkan area di luar crop */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ boxShadow: "0 0 0 999px rgba(0,0,0,0.55)" }}
                />
                {/* Area crop */}
                <div
                  className="absolute cursor-move border-2 border-primary"
                  style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
                  onPointerDown={onPointerDown("move")}
                >
                  {(["nw", "ne", "sw", "se"] as const).map((pos) => (
                    <span
                      key={pos}
                      onPointerDown={onPointerDown(pos)}
                      className="absolute h-4 w-4 rounded-sm border-2 border-primary bg-background"
                      style={{
                        cursor: `${pos}-resize`,
                        top: pos.includes("n") ? -9 : undefined,
                        bottom: pos.includes("s") ? -9 : undefined,
                        left: pos.includes("w") ? -9 : undefined,
                        right: pos.includes("e") ? -9 : undefined,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Hasil: {outW} × {outH}px — seret area untuk pindah, seret sudut untuk ukuran.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleApply} disabled={busy || disp.w === 0}>
            {busy ? "Memproses…" : "Terapkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
