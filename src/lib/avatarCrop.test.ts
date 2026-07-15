import { describe, expect, it } from "vitest";

import { getRotatedBounds } from "./avatarCrop";

describe("getRotatedBounds", () => {
  it("keeps dimensions without rotation", () => {
    expect(getRotatedBounds(400, 200, 0)).toEqual({ width: 400, height: 200 });
  });

  it("swaps dimensions at a quarter turn", () => {
    const bounds = getRotatedBounds(400, 200, 90);
    expect(bounds.width).toBeCloseTo(200);
    expect(bounds.height).toBeCloseTo(400);
  });

  it("calculates the enclosing square at 45 degrees", () => {
    const bounds = getRotatedBounds(100, 100, 45);
    expect(bounds.width).toBeCloseTo(Math.sqrt(2) * 100);
    expect(bounds.height).toBeCloseTo(Math.sqrt(2) * 100);
  });
});
