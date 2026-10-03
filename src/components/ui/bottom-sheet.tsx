import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

/**
 * BottomSheet — panel yang muncul dari bawah layar.
 * Dipakai untuk Menu, panel Details di mobile, dan aksi kontekstual.
 * Otomatis menghormati safe-area iPhone (home indicator).
 */
const BottomSheet = DialogPrimitive.Root;
const BottomSheetTrigger = DialogPrimitive.Trigger;
const BottomSheetClose = DialogPrimitive.Close;

const BottomSheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** Tinggi maksimum panel, default 88% tinggi viewport. */
    maxHeight?: string;
    /** Sembunyikan handle kecil di atas panel. */
    hideHandle?: boolean;
  }
>(({ className, children, maxHeight = "88svh", hideHandle = false, style, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className={cn("sheet-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]")}
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "sheet-panel fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-2xl border-t bg-background shadow-2xl",
        className
      )}
      style={{
        maxHeight,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        ...style,
      }}
      {...props}
    >
      {!hideHandle && (
        <div className="flex shrink-0 justify-center pt-2.5 pb-1">
          <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
        </div>
      )}
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));

BottomSheetContent.displayName = "BottomSheetContent";

const BottomSheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-base font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
BottomSheetTitle.displayName = "BottomSheetTitle";

const BottomSheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
BottomSheetDescription.displayName = "BottomSheetDescription";

export {
  BottomSheet,
  BottomSheetTrigger,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetTitle,
  BottomSheetDescription,
};
