/**
 * Image type detection via magic bytes.
 *
 * File extensions and declared MIME types are client-controlled and must not be
 * trusted for stored uploads. Only the leading bytes of the file content are
 * reliable enough to classify the actual format.
 */

export type DetectedImageType = 'image/jpeg' | 'image/png' | 'image/webp';

const IMAGE_EXTENSIONS: Record<DetectedImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Detect the image type from the first bytes of a file.
 * Returns null when the content does not match a supported image format.
 */
export function detectImageType(bytes: Uint8Array): DetectedImageType | null {
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: "RIFF" at 0-3 and "WEBP" at 8-11
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Returns the canonical file extension for a detected image type.
 */
export function extensionForImageType(type: DetectedImageType): string {
  return IMAGE_EXTENSIONS[type];
}
