import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { migrate } from "./src/db/migrate.js";
import authRoutes from "./src/routes/auth.js";
import instructionsRoutes from "./src/routes/instructions.js";
import timelineRoutes from "./src/routes/timeline.js";
import topicsRoutes from "./src/routes/topics.js";
import gamesRoutes from "./src/routes/games.js";
import teamsRoutes from "./src/routes/teams.js";
import roomsRoutes from "./src/routes/rooms.js";
import bonusRoutes from "./src/routes/bonus.js";
import usersRoutes from "./src/routes/users.js";
import tasksRoutes from "./src/routes/tasks.js";
import notificationsRoutes from "./src/routes/notifications.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/instructions", instructionsRoutes);
app.use("/api/timeline", timelineRoutes);
app.use("/api/topics", topicsRoutes);
app.use("/api/games", gamesRoutes);
app.use("/api/teams", teamsRoutes);
app.use("/api/rooms", roomsRoutes);
app.use("/api/bonus", bonusRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/notifications", notificationsRoutes);

// Serve the built React app in production (single-service deploy)
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const PORT = process.env.PORT || 4000;

migrate()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servants & Served API running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to set up the database:", err);
    process.exit(1);
  });
