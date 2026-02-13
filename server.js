import { createWeatherServer } from "./src/server/app-server.js";

const initialPort = Number(process.env.PORT || 8080);
const maxRetries = 20;
const host = process.env.HOST || "127.0.0.1";

startServer(initialPort, 0);

function startServer(port, retries) {
  const server = createWeatherServer();

  server.once("error", (error) => {
    if (error?.code === "EADDRINUSE" && retries < maxRetries) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is in use. Retrying on ${nextPort}...`);
      startServer(nextPort, retries + 1);
      return;
    }

    console.error(
      `Failed to start server on port ${port}: ${error?.code || "UNKNOWN"} ${error?.message || ""}`.trim(),
    );
    process.exit(1);
  });

  server.listen(port, host, () => {
    console.log(`Weather Outfit server listening on http://${host}:${port}`);
  });
}
