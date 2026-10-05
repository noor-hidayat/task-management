import { useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type FileUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFilesSelected: (files: FileList) => void | Promise<void>;
  multiple?: boolean;
};

export function FileUploadDialog({
  open,
  onOpenChange,
  onFilesSelected,
  multiple = true,
}: FileUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "camera" | "uploading" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [count, setCount] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Reset state tiap dialog dibuka.
  useEffect(() => {
    if (open) {
      setStatus("idle");
      setProgress(0);
      setCount(0);
      setIsDragging(false);
      setCameraError(null);
    }
  }, [open]);

  // Cleanup camera stream saat dialog ditutup atau mode berubah
  useEffect(() => {
    if (!open || status !== "camera") {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, [open, status]);

  // Progress palsu: naik cepat lalu merangkak ke ~90% selama proses upload.
  useEffect(() => {
    if (status !== "uploading") return;
    setProgress(8);
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        const step = p < 50 ? 12 : p < 75 ? 5 : 2;
        return Math.min(90, p + step);
      });
    }, 180);
    return () => clearInterval(timer);
  }, [status]);

  // Pasang stream ke elemen <video> SETELAH elemennya dirender (status="camera").
  // Sebelumnya srcObject dipasang saat videoRef masih null → preview hitam.
  useEffect(() => {
    if (status === "camera" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play?.().catch(() => {});
    }
  }, [status]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setCount(files.length);
    setStatus("uploading");
    setProgress(8);
    try {
      await onFilesSelected(files);
      setProgress(100);
      setStatus("done");
      setTimeout(() => {
        onOpenChange(false);
      }, 600);
    } catch {
      onOpenChange(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (status === "uploading") return;
    void handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (status === "uploading") return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const openCamera = () => {
    setCameraError(null);
    // Di HP, pakai kamera bawaan OS lewat input capture native: dipanggil SINKRON
    // di dalam gesture klik, jadi tidak diblokir popup-blocker / webview.
    // getUserMedia (kamera in-app) sering diblokir di webview HP.
    const isMobile =
      typeof navigator !== "undefined" &&
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (isMobile) {
      captureInputRef.current?.click();
      return;
    }
    // Desktop: coba kamera in-app dulu; kalau tak tersedia/gagal, fallback native.
    if (!navigator.mediaDevices?.getUserMedia) {
      captureInputRef.current?.click();
      return;
    }
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        streamRef.current = stream;
        setStatus("camera");
      } catch (err) {
        console.error("Camera access denied:", err);
        setCameraError("Kamera tidak bisa diakses. Coba izinkan akses kamera.");
        captureInputRef.current?.click();
      }
    })();
  };

  const capturePhoto = () => {
    if (!videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
      const dt = new DataTransfer();
      dt.items.add(file);
      void handleFiles(dt.files);
    }, "image/jpeg", 0.92);
  };

  const busy = status === "uploading";

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {status === "idle"
              ? "Upload File"
              : status === "camera"
                ? "Take Photo"
                : status === "uploading"
                  ? "Uploading…"
                  : "Complete"}
          </DialogTitle>
          <DialogDescription>
            {status === "idle"
              ? "Select file from camera or your device"
              : status === "camera"
                ? "Press button to take photo"
                : status === "uploading"
                  ? `Uploading ${count} file(s), please wait…`
                  : `${count} file(s) uploaded successfully`}
          </DialogDescription>
        </DialogHeader>

        {status === "camera" ? (
          <div className="space-y-3">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
              <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
            </div>
            {cameraError && (
              <div className="text-sm text-destructive text-center bg-destructive/10 px-3 py-2 rounded">
                {cameraError}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStatus("idle")}>
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button className="flex-1" onClick={capturePhoto}>
                <Camera className="h-4 w-4" /> Take Photo
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div
              className={cn(
                "relative flex min-h-40 flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-all duration-200",
                busy
                  ? "border-primary/40 bg-primary/5"
                  : isDragging
                    ? "border-primary bg-primary/5 scale-[1.02]"
                    : "border-muted-foreground/25"
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {busy || status === "done" ? (
                <div className="flex w-full flex-col items-center gap-4 text-center">
                  <div
                    className={cn(
                      "relative flex h-14 w-14 items-center justify-center rounded-full transition-colors",
                      status === "done" ? "bg-emerald-500/15 text-emerald-600" : "bg-primary/10 text-primary"
                    )}
                  >
                    {status === "done" ? (
                      <Check className="h-7 w-7 animate-in zoom-in" />
                    ) : (
                      <>
                        <Upload className="h-6 w-6 animate-pulse" />
                        <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                      </>
                    )}
                  </div>
                  <div className="w-full space-y-1.5">
                    <Progress value={progress} className="h-2 transition-all" />
                    <p className="text-xs text-muted-foreground">
                      {status === "done" ? "Upload complete" : `${progress}%`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div
                    className={cn(
                      "rounded-full bg-muted p-3 transition-transform duration-200",
                      isDragging && "scale-110"
                    )}
                  >
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Drag & drop file here</p>
                    <p className="text-xs text-muted-foreground">or choose an option below</p>
                  </div>
                </div>
              )}
            </div>

            <div
              className={cn(
                "grid grid-cols-2 gap-3 transition-opacity duration-200",
                busy && "pointer-events-none opacity-40"
              )}
            >
              <Button
                variant="outline"
                className="flex h-auto flex-col gap-2 py-4"
                onClick={openCamera}
                disabled={busy}
              >
                <Camera className="h-5 w-5" />
                <span className="text-sm">Kamera</span>
              </Button>

              <Button
                variant="outline"
                className="flex h-auto flex-col gap-2 py-4"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                <span className="text-sm">File</span>
              </Button>
            </div>

            {cameraError && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {cameraError}
              </p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              multiple={multiple}
              className="hidden"
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.target.value = "";
              }}
              accept="*/*"
            />

            {/* Fallback kamera: buka aplikasi kamera bawaan HP (butuh HTTPS di iOS). */}
            <input
              ref={captureInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
