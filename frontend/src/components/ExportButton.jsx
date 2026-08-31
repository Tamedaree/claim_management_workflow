import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";

/**
 * @typedef {Object} ExportButtonProps
 * @property {(format: "csv" | "pdf") => void} onExport — called with the chosen format
 * @property {string} [label]
 * @property {boolean} [disabled]
 */

/**
 * Reusable export dropdown button.
 * @param {ExportButtonProps} props
 */
export default function ExportButton({ onExport, label = "Export", disabled }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={disabled}>
          <Download className="w-4 h-4" /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onExport("csv")}>
          <FileSpreadsheet className="w-4 h-4" /> Excel (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport("pdf")}>
          <FileText className="w-4 h-4" /> PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export { exportToCSV, exportToPDF };