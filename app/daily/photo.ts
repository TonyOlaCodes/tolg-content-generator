/**
 * Shrinks an optional highlight photo before it is stored as a data URL.
 * Local-only storage has limited room, so we cap the long edge and re-encode
 * as JPEG. If the browser cannot process images we report a clear error rather
 * than storing a huge original.
 */

const MAX_EDGE = 1_200;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

export async function shrinkPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > MAX_FILE_BYTES) throw new Error("That photo is larger than 15 MB. Try a smaller one.");

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    image.release();
    throw new Error("This browser could not process that photo.");
  }
  context.drawImage(image.source, 0, 0, width, height);
  image.release();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
  if (!dataUrl.startsWith("data:image/")) throw new Error("That photo could not be read.");
  return dataUrl;
}

type LoadedImage = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function loadImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Fall through to the <img> path below (some Safari versions).
    }
  }
  return await new Promise<LoadedImage>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => {} });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That photo could not be read."));
    };
    image.src = url;
  });
}
