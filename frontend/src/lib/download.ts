/**
 * Generate a CSV blob and trigger a browser download.
 *
 * Handles escaping of commas, double-quotes, and newlines inside cell values.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: string[][],
): void {
  const escape = (cell: string): string => {
    if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  };

  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];

  const csv = "\uFEFF" + lines.join("\r\n"); // BOM for Excel
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
