/**
 * The shared CSV helper.
 *
 * The BOM, the pinned header, the quoting and the record count are the
 * contract every export relies on before a member opens the file in
 * Excel.
 */

import { describe, expect, it, vi } from "vitest";

import { downloadBlob } from "@/lib/download";
import { createCsvBlob, downloadCsvRows } from "@/lib/csv";

vi.mock("@/lib/download", () => ({
  downloadBlob: vi.fn(),
}));

const mockedDownloadBlob = vi.mocked(downloadBlob);

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
  return new Uint8Array(buffer);
}

async function blobText(blob: Blob): Promise<string> {
  const bytes = await blobBytes(blob);
  return new TextDecoder("utf-8").decode(bytes);
}

/** Parse CSV records, including a line break inside a quoted cell. */
function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      record.push(cell);
      cell = "";
    } else if (character === "\r" && text[index + 1] === "\n") {
      record.push(cell);
      records.push(record);
      record = [];
      cell = "";
      index += 1;
    } else {
      cell += character;
    }
  }

  if (cell || record.length) {
    record.push(cell);
    records.push(record);
  }

  return records;
}

describe("the shared CSV helper", () => {
  it("starts with the UTF-8 BOM", async () => {
    const blob = createCsvBlob(["الاسم"], [["أحمد"]]);

    const bytes = await blobBytes(blob);
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("pins the header and keeps one record per row", async () => {
    const blob = createCsvBlob(
      ["الاسم", "الدرجة", "الملاحظات"],
      [
        ["أحمد", 10, "مكتمل"],
        ["فاطمة", 8, "حضرت متأخرة"],
      ],
    );

    const text = await blobText(blob);
    const records = parseCsvRecords(text.replace(/^\uFEFF/, ""));

    expect(records).toEqual([
      ["الاسم", "الدرجة", "الملاحظات"],
      ["أحمد", "10", "مكتمل"],
      ["فاطمة", "8", "حضرت متأخرة"],
    ]);
    expect(records).toHaveLength(3);
  });

  it("escapes a comma, a quote and a line break inside a value", async () => {
    const blob = createCsvBlob(
      ["الاسم", "الملاحظات"],
      [["أحمد, محمد", 'قال "مرحبا"\nثم غادر']],
    );

    const text = await blobText(blob);
    expect(text).toContain('"أحمد, محمد","قال ""مرحبا""\nثم غادر"');

    const records = parseCsvRecords(text.replace(/^\uFEFF/, ""));
    expect(records).toHaveLength(2);
    expect(records[1]).toEqual(["أحمد, محمد", 'قال "مرحبا"\nثم غادر']);
  });

  it("downloads the generated blob with the given file name", () => {
    downloadCsvRows("نقاط-2026-10.csv", ["الاسم"], [["أحمد"]]);

    expect(mockedDownloadBlob).toHaveBeenCalledOnce();
    expect(mockedDownloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      "نقاط-2026-10.csv",
    );
  });
});
