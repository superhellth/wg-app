import type { Device, RegisterDevice } from "@wg/shared";
import { http } from "./client.js";

export const devicesApi = {
  register: (body: RegisterDevice) =>
    http<Device>("/api/devices", { method: "POST", body: JSON.stringify(body) }),
  unregister: (pushEndpoint: string) =>
    http<void>("/api/devices", {
      method: "DELETE",
      body: JSON.stringify({ pushEndpoint }),
    }),
};
