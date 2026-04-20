import type { TrackVisitPayload } from "../../types/app";
import { apiRequest } from "./client";

export const analyticsApi = {
  trackVisit: (payload: TrackVisitPayload) =>
    apiRequest<{ message: string }>("/api/analytics/visit", {
      method: "POST",
      authMode: "optional",
      body: payload,
    }),
};
