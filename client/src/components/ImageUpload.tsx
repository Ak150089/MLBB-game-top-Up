import { trpc } from "@/lib/trpc";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

type Folder = "logos" | "banners" | "products";

/**
 * Reusable image picker that uploads the selected photo to S3 (via admin.uploadImage)
 * and returns the public URL through onChange. Replaces manual "image URL" inputs.
 */
export default function ImageUpload({
  value,
  onChange,
  folder = "products",
  label,
  aspect = "square",
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
  folder?: Folder;
  label?: string;
  aspect?: "square" | "wide";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = trpc.admin.uploadImage.useMutation();

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large (max 5MB)");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await upload.mutateAsync({ dataUrl, folder });
      onChange(res.url);
      toast.success("Uploaded");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const boxClass =
    aspect === "wide"
      ? "aspect-[16/7] w-full"
      : "size-24";

  return (
    <div className="space-y-1.5">
      {label && <span className="text-sm font-medium">{label}</span>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={`relative grid ${boxClass} place-items-center overflow-hidden rounded-xl border border-dashed border-border bg-background/40 text-muted-foreground transition hover:border-primary`}
        >
          {value ? (
            <img src={value} alt="preview" className="size-full object-cover" />
          ) : busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <div className="flex flex-col items-center gap-1 px-2 text-center">
              <ImagePlus className="size-5" />
              <span className="text-[10px] leading-tight">Upload photo</span>
            </div>
          )}
          {busy && value && (
            <div className="absolute inset-0 grid place-items-center bg-black/50">
              <Loader2 className="size-5 animate-spin text-white" />
            </div>
          )}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-destructive"
          >
            <X className="size-3.5" /> Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
