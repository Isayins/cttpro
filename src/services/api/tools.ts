import type { JavaDecompilePayload, JavaDecompileResult } from "../../types/app";
import { apiRequest } from "./client";

export const toolsApi = {
  javaDecompile: (payload: JavaDecompilePayload) =>
    apiRequest<JavaDecompileResult>("/api/tools/java-decompile", {
      method: "POST",
      body: payload,
    }),
};
