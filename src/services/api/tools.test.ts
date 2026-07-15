import { describe, expect, it } from "vitest";

import {
  buildMailCodePublicUrl,
  isMailCodePublicLinkReady,
  MAIL_CODE_PUBLIC_TOKEN_LENGTH,
  MAIL_CODE_PUBLIC_UID_LENGTH,
} from "./tools";

const token = "00574647c0c6a9d1489c360253c0e35d";
const uid = "aa0661e4a22b61d20ec0";

describe("mail code public links", () => {
  it("builds the public mail code page URL", () => {
    expect(token).toHaveLength(MAIL_CODE_PUBLIC_TOKEN_LENGTH);
    expect(uid).toHaveLength(MAIL_CODE_PUBLIC_UID_LENGTH);
    expect(isMailCodePublicLinkReady(token, uid)).toBe(true);
    expect(buildMailCodePublicUrl(token, uid)).toBe(`http://localhost/code/fetch?token=${token}&uid=${uid}`);
  });

  it("trims token and uid before building the public URL", () => {
    expect(isMailCodePublicLinkReady(` ${token} `, `\n${uid}\t`)).toBe(true);
    expect(buildMailCodePublicUrl(` ${token} `, `\n${uid}\t`)).toBe(`http://localhost/code/fetch?token=${token}&uid=${uid}`);
  });

  it("rejects legacy or malformed public links", () => {
    expect(isMailCodePublicLinkReady("legacy_token-123", uid)).toBe(false);
    expect(isMailCodePublicLinkReady(token, "uid-123")).toBe(false);
    expect(isMailCodePublicLinkReady(token.toUpperCase(), uid)).toBe(false);
    expect(buildMailCodePublicUrl("legacy_token-123", uid)).toBe("");
  });
});
