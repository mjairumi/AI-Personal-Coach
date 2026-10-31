import { createApiClient } from "@disha/core";
import { getUser } from "./user.ts";

// Same-origin on the web. Set VITE_API_BASE to point at a separately hosted server.
export const api = createApiClient(import.meta.env.VITE_API_BASE ?? "", () => getUser()?.id ?? null);
