import { useMutation } from "@tanstack/react-query";
import { blogApi } from "../api";

/** Upload the cover image of a post. */
export function useUploadBlogCover() {
  return useMutation({
    mutationFn: (file: File) => blogApi.uploadCover(file),
  });
}
