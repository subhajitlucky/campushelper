import { describe, expect, it } from "vitest";
import { detectImageType, extensionForImageType } from "@/lib/image-type";

const jpegBytes = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

const webpBytes = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

const htmlBytes = new TextEncoder().encode("<!DOCTYPE html><html><body>hi</body></html>");
const svgBytes = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'
);

describe("detectImageType", () => {
  it("detects JPEG content from magic bytes", () => {
    expect(detectImageType(jpegBytes)).toBe("image/jpeg");
  });

  it("detects PNG content from magic bytes", () => {
    expect(detectImageType(pngBytes)).toBe("image/png");
  });

  it("detects WebP content from RIFF/WEBP markers", () => {
    expect(detectImageType(webpBytes)).toBe("image/webp");
  });

  it("rejects HTML content", () => {
    expect(detectImageType(htmlBytes)).toBeNull();
  });

  it("rejects SVG content", () => {
    expect(detectImageType(svgBytes)).toBeNull();
  });

  it("rejects empty and truncated buffers", () => {
    expect(detectImageType(new Uint8Array([]))).toBeNull();
    expect(detectImageType(jpegBytes.subarray(0, 2))).toBeNull();
    expect(detectImageType(pngBytes.subarray(0, 4))).toBeNull();
    expect(detectImageType(webpBytes.subarray(0, 10))).toBeNull();
  });

  it("maps detected types to canonical extensions", () => {
    expect(extensionForImageType("image/jpeg")).toBe("jpg");
    expect(extensionForImageType("image/png")).toBe("png");
    expect(extensionForImageType("image/webp")).toBe("webp");
  });
});
