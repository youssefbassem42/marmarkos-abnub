import { useMutation } from "@tanstack/react-query";
import { blogApi } from "../api";

/** Upload the cover image of a post. */
export function useUploadBlogCover() {
  return useMutation({
    mutationFn: (file: File) => blogApi.uploadCover(file),
  });
}

/** Upload a picture that the writer inserts in the body of a post. */
export function useUploadBlogBodyImage() {
  return useMutation({
    mutationFn: (file: File) => blogApi.uploadBodyImage(file),
  });
}
