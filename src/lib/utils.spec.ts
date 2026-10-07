import { describe, it, expect } from "vitest";
import { cn, normalizeGoogleDriveUrl, extractGoogleDriveFileId } from "./utils";

describe("cn function", () => {
  it("should merge classes correctly", () => {
    expect(cn("text-red-500", "bg-blue-500")).toBe("text-red-500 bg-blue-500");
  });

  it("should handle conditional classes", () => {
    const isActive = true;
    expect(cn("base-class", isActive && "active-class")).toBe(
      "base-class active-class",
    );
  });

  it("should handle false and null conditions", () => {
    const isActive = false;
    expect(cn("base-class", isActive && "active-class", null)).toBe(
      "base-class",
    );
  });

  it("should merge tailwind classes properly", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("should work with object notation", () => {
    expect(cn("base", { conditional: true, "not-included": false })).toBe(
      "base conditional",
    );
  });
});

describe("Google Drive URL helpers", () => {
  const FILE_ID = "1aBcDeFgHiJkLmNoPqRsTuVwXyZ123456";

  it("should extract file ID from various Google Drive URL formats", () => {
    expect(extractGoogleDriveFileId(`https://drive.google.com/file/d/${FILE_ID}/view?usp=sharing`)).toBe(FILE_ID);
    expect(extractGoogleDriveFileId(`https://drive.google.com/open?id=${FILE_ID}`)).toBe(FILE_ID);
    expect(extractGoogleDriveFileId(`https://drive.google.com/thumbnail?id=${FILE_ID}&sz=w1000`)).toBe(FILE_ID);
    expect(extractGoogleDriveFileId(`https://lh3.googleusercontent.com/d/${FILE_ID}`)).toBe(FILE_ID);
    expect(extractGoogleDriveFileId("https://example.com/image.jpg")).toBeNull();
  });

  it("should normalize Google Drive share URLs to thumbnail CDN endpoint", () => {
    const shareUrl = `https://drive.google.com/file/d/${FILE_ID}/view?usp=sharing`;
    expect(normalizeGoogleDriveUrl(shareUrl)).toBe(`https://drive.google.com/thumbnail?id=${FILE_ID}&sz=w1000`);
    
    const openUrl = `https://drive.google.com/open?id=${FILE_ID}`;
    expect(normalizeGoogleDriveUrl(openUrl)).toBe(`https://drive.google.com/thumbnail?id=${FILE_ID}&sz=w1000`);

    const directImg = "https://example.com/cdn/photo.jpg";
    expect(normalizeGoogleDriveUrl(directImg)).toBe(directImg);
  });
});

