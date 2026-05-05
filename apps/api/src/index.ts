import { loadConfig } from "./config";
import { buildServer } from "./server";

const config = loadConfig();
const server = buildServer(config);

await server.listen({
  host: "0.0.0.0",
  port: config.PORT,
});
