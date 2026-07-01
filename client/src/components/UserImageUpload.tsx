import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { ImageUp, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
}

export default function UserImageUpload({ value, onChange, folder = "uploads" }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const upload = trpc.upload.image.useMutation();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const res = await upload.mutateAsync({ dataUrl, folder });
        onChange(res.url);
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      {value ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border">
          <img src={value} className="h-full w-full object-cover" />
          <button onClick={() => onChange(null)}
            className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/70 text-white">
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()}
          className={cn("flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-8 transition-colors hover:border-primary/50",
            loading && "opacity-50 pointer-events-none")}>
          {loading ? <Loader2 className="size-6 animate-spin text-muted-foreground" /> : <ImageUp className="size-6 text-muted-foreground" />}
          <span className="text-xs text-muted-foreground">{loading ? "Uploading..." : "Tap to upload"}</span>
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
