import { createRoomServer } from "./rooms.mjs";
const production = process.env.NODE_ENV === "production";
const configured = process.env.ALLOWED_ORIGINS?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (production && !configured?.length)
  throw new Error("ALLOWED_ORIGINS is required in production.");
const server = createRoomServer(
  configured ? { origins: configured } : undefined,
);
server.http.listen(
  Number(process.env.PORT || 8787),
  process.env.HOST || (production ? "0.0.0.0" : "127.0.0.1"),
  () => {
    console.log("MECHVERSE room server ready.");
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await server.close();
    process.exit(0);
  });
