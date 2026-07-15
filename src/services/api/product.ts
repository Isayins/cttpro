import type { Product } from "../../types/app";
import { apiRequest } from "./client";

export const productApi = {
  getProducts: () =>
    apiRequest<Product[]>("/api/products", {
      authMode: "optional",
    }),
  getProduct: (id: number) =>
    apiRequest<Product>(`/api/products/${id}`, {
      authMode: "optional",
    }),
};
