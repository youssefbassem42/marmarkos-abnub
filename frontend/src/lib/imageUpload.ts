/** The image upload limit shared by every upload surface of the platform. */
export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Whether a file is larger than the server's image upload limit. */
export function isImageTooLarge(file: File): boolean {
  return file.size > MAX_IMAGE_UPLOAD_BYTES;
}
