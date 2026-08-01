/** Compress an image file to a JPEG data URL suitable for DB storage. */
export async function compressImageToDataUrl(
  file: File,
  opts: { maxEdge?: number; quality?: number } = {},
): Promise<string> {
  const maxEdge = opts.maxEdge ?? 960;
  const quality = opts.quality ?? 0.82;

  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("Image is too large (max 12MB before compression).");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process image.");
    ctx.drawImage(bitmap, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length > 2_200_000) {
      // One more pass at lower quality
      const smaller = canvas.toDataURL("image/jpeg", 0.65);
      if (smaller.length > 2_200_000) {
        throw new Error("Photo is still too large after compression.");
      }
      return smaller;
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}
