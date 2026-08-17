import { describe, expect, it } from "vitest";

import {
  QR_CONTEXT_MESSAGE_TYPE,
  QR_HTML_CONTENT_SECURITY_POLICY,
  QR_HTML_SANDBOX,
  qrScanCounterTemplate,
} from "./qrHtmlTemplate";

describe("QR HTML page", () => {
  it("runs scripts without granting access to the parent origin", () => {
    expect(QR_HTML_SANDBOX).toContain("allow-scripts");
    expect(QR_HTML_SANDBOX).not.toContain("allow-same-origin");
    expect(QR_HTML_SANDBOX).not.toContain("allow-top-navigation");
    expect(QR_HTML_CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(QR_HTML_CONTENT_SECURITY_POLICY).toContain("base-uri 'none'");
  });

  it("includes a scan counter that only accepts context from its parent frame", () => {
    expect(qrScanCounterTemplate).toContain(`event.data.type !== "${QR_CONTEXT_MESSAGE_TYPE}"`);
    expect(qrScanCounterTemplate).toContain("event.source !== window.parent");
    expect(qrScanCounterTemplate).toContain("event.data.totalScanCount");
    expect(qrScanCounterTemplate).toContain('id="scan-count"');
  });
});
