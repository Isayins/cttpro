import { describe, expect, it } from "vitest";

import { decodeQrCodeFromFile, MAX_QR_IMAGE_BYTES } from "./qrDecodeUtils";

describe("QR decode limits", () => {
  it("rejects oversized images before allocating browser image resources", async () => {
    const file = {
      type: "image/png",
      size: MAX_QR_IMAGE_BYTES + 1,
    } as File;

    await expect(decodeQrCodeFromFile(file)).rejects.toThrow("不能超过 10 MB");
  });
});
