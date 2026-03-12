import { createWeatherServer } from "./src/server/app-server.js";
const server = createWeatherServer();
server.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
