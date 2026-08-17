export const QR_CONTEXT_MESSAGE_TYPE = "idncar:qr-context";
export const QR_HTML_SANDBOX = "allow-scripts allow-forms allow-popups";
export const QR_HTML_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https:",
  "style-src 'unsafe-inline' https:",
  "img-src data: blob: https:",
  "font-src data: https:",
  "connect-src https:",
  "media-src data: blob: https:",
  "frame-src https:",
  "form-action https:",
  "base-uri 'none'",
  "object-src 'none'",
].join("; ");

export const qrScanCounterTemplate = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>扫码成功</title>
  <style>
    * { box-sizing: border-box; }
    html, body { min-height: 100%; margin: 0; }
    body {
      display: grid;
      place-items: center;
      padding: 24px;
      background: #f3f6fa;
      color: #172033;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      width: min(100%, 520px);
      padding: 36px 28px;
      border: 1px solid #dce3ec;
      border-radius: 8px;
      background: #ffffff;
      box-shadow: 0 18px 48px rgba(23, 32, 51, 0.10);
      text-align: center;
    }
    .mark {
      display: grid;
      width: 52px;
      height: 52px;
      margin: 0 auto 22px;
      place-items: center;
      border-radius: 8px;
      background: #1f5eff;
      color: #ffffff;
      font-size: 24px;
      font-weight: 800;
    }
    h1 { margin: 0; font-size: 28px; line-height: 1.3; }
    .subtitle { margin: 10px 0 28px; color: #657086; line-height: 1.7; }
    .counter {
      padding: 24px 16px;
      border: 1px solid #dce3ec;
      border-radius: 8px;
      background: #f8fafc;
    }
    .counter-label, .meta-label { color: #657086; font-size: 13px; }
    .counter-value {
      display: block;
      min-height: 70px;
      margin-top: 4px;
      color: #d33838;
      font-size: 54px;
      font-weight: 800;
      line-height: 1.3;
    }
    .meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 20px;
      text-align: left;
    }
    .meta-item {
      min-width: 0;
      padding: 14px;
      border-left: 3px solid #24a46d;
      background: #f7faf9;
    }
    .meta-value {
      display: block;
      margin-top: 5px;
      overflow-wrap: anywhere;
      color: #172033;
      font-size: 14px;
      font-weight: 650;
    }
    @media (max-width: 480px) {
      body { padding: 14px; }
      main { padding: 28px 18px; }
      h1 { font-size: 24px; }
      .counter-value { font-size: 46px; }
      .meta { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <div class="mark" aria-hidden="true">QR</div>
    <h1 id="page-title">扫码成功</h1>
    <p class="subtitle">本次访问已经记录</p>
    <section class="counter" aria-live="polite">
      <span class="counter-label">累计扫码次数</span>
      <strong class="counter-value" id="scan-count">...</strong>
    </section>
    <div class="meta">
      <div class="meta-item">
        <span class="meta-label">二维码短码</span>
        <span class="meta-value" id="short-code">-</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">本次扫码时间</span>
        <span class="meta-value" id="scan-time">-</span>
      </div>
    </div>
  </main>
  <script>
    document.getElementById("scan-time").textContent = new Date().toLocaleString("zh-CN");

    window.addEventListener("message", function (event) {
      if (event.source !== window.parent || !event.data || event.data.type !== "idncar:qr-context") {
        return;
      }

      var count = Number(event.data.scanCount);
      document.getElementById("scan-count").textContent = Number.isFinite(count) ? String(count) : "0";
      document.getElementById("short-code").textContent = event.data.shortCode || "-";
      document.getElementById("page-title").textContent = event.data.title || "扫码成功";
    });
  </script>
</body>
</html>`;
