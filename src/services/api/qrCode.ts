import type { QrCodeAccessPayload, QrCodeAccessResponse, QrCodePublicInfo } from "../../types/app";
import { apiRequest } from "./client";

export const qrCodeApi = {
  getPublicInfo: (shortCode: string) =>
    apiRequest<QrCodePublicInfo>(`/api/qr-codes/public/${encodeURIComponent(shortCode)}`, {
      authMode: "optional",
    }),
  access: (shortCode: string, payload: QrCodeAccessPayload) =>
    apiRequest<QrCodeAccessResponse>(`/api/qr-codes/public/${encodeURIComponent(shortCode)}/access`, {
      method: "POST",
      authMode: "optional",
      body: payload,
    }),
};
