import type { SiteNotice } from "../../types/app";
import { apiRequest } from "./client";

export const siteNoticeApi = {
  getSiteNotices: () =>
    apiRequest<SiteNotice[]>("/api/site-notices", {
      authMode: "optional",
    }),
};
