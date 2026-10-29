/**
 * Shared CSV helpers.
 *
 * CSV generation lives beside the other cross-module helpers so the
 * attendance and the analytics exports cannot drift into separate
 * implementations. Every file starts with a UTF-8 BOM for Excel and
 * uses RFC 4180-style quoting for cells that contain a comma, a quote
 * or a line break.
 */

import { downloadBlob } from "./download";

export type CsvCell = string | number | boolean | null | undefined;
export type CsvRow = readonly CsvCell[];

const UTF8_BOM = "\uFEFF";
const CSV_MIME_TYPE = "text/csv;charset=utf-8";

/** Escape one CSV cell, quoting it only when the value requires it. */
export function escapeCsvCell(value: CsvCell): string {
  const text = value === null || value === undefined ? "" : String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

/**
 * Build a UTF-8 CSV blob from a header and its rows.
 *
 * The BOM is the first character of the blob. Records are separated by
 * CRLF; a line break inside a cell stays inside its quoted cell and is
 * therefore one record, not an extra row.
 */
export function createCsvBlob(
  headers: readonly string[],
  rows: readonly CsvRow[],
): Blob {
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ];

  return new Blob([UTF8_BOM, lines.join("\r\n")], {
    type: CSV_MIME_TYPE,
  });
}

/** Trigger a browser download for a generated CSV blob. */
export function downloadCsv(blob: Blob, filename: string): void {
  downloadBlob(blob, filename);
}

/** Build and download a CSV in one step. */
export function downloadCsvRows(
  filename: string,
  headers: readonly string[],
  rows: readonly CsvRow[],
): void {
  downloadBlob(createCsvBlob(headers, rows), filename);
}
