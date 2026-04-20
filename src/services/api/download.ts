import type { DownloadResource } from "../../types/app";
import { apiRequest } from "./client";

export const downloadApi = {
  getDownloads: () =>
    apiRequest<DownloadResource[]>("/api/downloads", {
      authMode: "optional",
    }),
  trackDownload: (downloadId: number) =>
    apiRequest<{ message: string }>(`/api/downloads/${downloadId}/track`, {
      method: "POST",
      authMode: "optional",
    }),
};
