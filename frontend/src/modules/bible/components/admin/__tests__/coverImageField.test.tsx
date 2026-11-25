import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "@/i18n/LanguageProvider";
import { Toaster } from "@/components/ui/sonner";
import { MAX_IMAGE_UPLOAD_BYTES } from "@/lib/imageUpload";

vi.mock("@/lib/auth", () => ({
  getAccessToken: vi.fn(() => "test-token"),
}));

vi.mock("@/lib/api", () => ({
  uploadVerseCover: vi.fn(),
}));

import { uploadVerseCover } from "@/lib/api";
import { CoverImageField } from "../CoverImageField";

const mockedUpload = vi.mocked(uploadVerseCover);

function renderField(onChange = vi.fn()) {
  const result = render(
    <LanguageProvider>
      <Toaster position="top-center" />
      <CoverImageField value="" onChange={onChange} />
    </LanguageProvider>,
  );
  const input =
    result.container.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).not.toBeNull();
  return { input: input!, onChange };
}

describe("the cover image upload", () => {
  it("refuses an image larger than 5 MB before sending it", async () => {
    const { input } = renderField();
    const file = new File(["image"], "large.png", { type: "image/png" });
    Object.defineProperty(file, "size", {
      value: MAX_IMAGE_UPLOAD_BYTES + 1,
    });

    fireEvent.change(input, { target: { files: [file] } });

    expect(
      await screen.findByText(
        "حجم الصورة أكبر من 5 ميغابايت. اختر صورة أصغر وحاول مرة أخرى.",
      ),
    ).toBeInTheDocument();
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it("does not screen the selected file type in the browser", async () => {
    mockedUpload.mockResolvedValueOnce({ url: "https://example.com/cover" });
    const { input, onChange } = renderField();
    const file = new File(["image"], "cover.any", {
      type: "application/octet-stream",
    });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(mockedUpload).toHaveBeenCalledWith(file, "test-token"),
    );
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith("https://example.com/cover"),
    );
  });
});
