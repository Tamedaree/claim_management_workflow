import jsPDF from "jspdf";

/**
 * Export an array of records to CSV (Excel-compatible).
 * @param {string} filename - download file name (without extension)
 * @param {string[]} headers - column headers
 * @param {Array<Array<string|number|null|undefined>>} rows - data rows matching headers
 */
export function exportToCSV(filename, headers, rows) {
  /**
   * @param {string|number|null|undefined} val
   */
  const escape = (val) => {
    const s = String(val ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csv = [
    headers.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${filename}.csv`);
}

/**
 * Export an array of records to a PDF with a manually drawn table.
 * @param {string} filename - download file name (without extension)
 * @param {string} title - document title
 * @param {string[]} headers - column headers
 * @param {Array<Array<string|number|null|undefined>>} rows - data rows
 * @param {number[]} [colWidths] - optional relative column widths (fractions of 1)
 */
export function exportToPDF(filename, title, headers, rows, colWidths) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const tableW = pageW - margin * 2;

  // Title
  doc.setFontSize(16);
  doc.setTextColor(30, 58, 138);
  doc.text(title, margin, 40);

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    `Generated: ${new Date().toLocaleString()}  ·  ${rows.length} record(s)`,
    margin,
    56,
  );

  // Column widths
  const relW = colWidths || headers.map(() => 1);
  const totalRel = relW.reduce((a, b) => a + b, 0);
  const widths = relW.map((w) => (w / totalRel) * tableW);

  let y = 72;
  const rowH = 18;
  const fontSize = 7;
  doc.setFontSize(fontSize);

  // Header row
  doc.setFillColor(30, 58, 138);
  doc.rect(margin, y, tableW, rowH, "F");
  doc.setTextColor(255);
  let x = margin;
  headers.forEach((h, i) => {
    doc.text(String(h), x + 4, y + 12);
    x += widths[i];
  });
  y += rowH;

  // Data rows
  doc.setTextColor(40);
  rows.forEach((row, ri) => {
    if (y > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    if (ri % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(margin, y, tableW, rowH, "F");
    }
    x = margin;
    row.forEach((cell, i) => {
      const val = String(cell ?? "");
      const maxChars = Math.floor((widths[i] - 8) / (fontSize * 0.5));
      const truncated =
        val.length > maxChars ? val.slice(0, maxChars - 1) + "…" : val;
      doc.text(truncated, x + 4, y + 12);
      x += widths[i];
    });
    y += rowH;
  });

  // Borders
  doc.setDrawColor(200);
  doc.rect(margin, 72, tableW, y - 72);

  doc.save(`${filename}.pdf`);
}

/**
 * @param {Blob} blob
 * @param {string} filename
 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
