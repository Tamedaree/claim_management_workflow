import  { useState } from "react";
import { Upload, X, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { uploadFiles } from "@/lib/claimRegistration";

export default function FileUploadSection({ files, setFiles }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const newFiles = Array.from(e.target.files);
    if (!newFiles.length) return;
    setUploading(true);
    const uploaded = await uploadFiles(newFiles, toast);
    setFiles((prev) => [...prev, ...uploaded]);
    setUploading(false);
    e.target.value = "";
  };

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
        <div className="flex flex-col items-center gap-1">
          <Upload className="w-5 h-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {uploading ? "Uploading..." : "Click to upload documents"}
          </span>
        </div>
        <input type="file" className="hidden" multiple onChange={handleUpload} />
      </label>
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium truncate max-w-[200px]">{f.name}</span>
              </div>
              <button type="button" onClick={() => removeFile(i)} className="p-1 hover:bg-muted rounded">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}