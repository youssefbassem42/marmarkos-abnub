/**
 * Trigger a browser download for a generated blob.
 *
 * Shared by the modules that export data (attendance, analytics): the
 * helper lives in `src/lib` so no module has to import another module's
 * internals.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
