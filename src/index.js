// const port = process.env.PORT || 5000;
// app.listen(port, () => {
//   /* eslint-disable no-console */
//   console.log(`Listening: http://localhost:${port}`);
//   /* eslint-enable no-console */
// });
import app from "./app.js";
import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import companion from "@uppy/companion";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// TODOFix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();

// Middleware for parsing JSON and handling CORS
app.use(bodyParser.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Origin, Content-Type, Accept"
  );
  next();
});

// Configure session middleware
app.use(
  session({
    secret: "676522f38edb8239a1238cc03702dbab",
    resave: false,
    saveUninitialized: false,
  })
);

// Define file upload directory
const uploadsDir = path.join(__dirname, "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("Uploads directory created at:", uploadsDir);
}

// Companion options
const companionOptions = {
  providerOptions: {
    // Dropbox provider configuration
    dropbox: {
      key: "Wg-X31Zno-d_QVkFifC96czVe1hhUUAfTEybwNq7e2E",
      secret: "E00NcA5wx8RfwZFwgBfgtl4HZpRs0YsQ66OsTIuKTJ4",
    },
    // Unsplash provider configuration
    unsplash: {
      key: "Wg-X31Zno-d_QVkFifC96czVe1hhUUAfTEybwNq7e2E",
      secret: "E00NcA5wx8RfwZFwgBfgtl4HZpRs0YsQ66OsTIuKTJ4",
    },
    // URL provider is enabled by default
    url: {
      enabled: true,
      companion: true,
    },
  },
  server: {
    host: "uppy-core.vercel.app",
    protocol: "https",
  },
  filePath: uploadsDir,
  secret: "676522f38edb8239a1238cc03702dbab",
  debug: String(process.env.NODE_ENV !== "production"),
  corsOrigins: true, // Allow all origins in development
  streamingUpload: true,
  allowLocalUrls: String(process.env.NODE_ENV) === "development", // Allow local URLs in development process.env.NODE_ENV !== "production", // Only allow in development
};

// Initialize Companion
const { app: companionApp } = companion.app(companionOptions);
app.use(companionApp);

// Error handling
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res
    .status(err.status || 500)
    .json({ message: err.message || "Internal Server Error" });
});

// Start the server
const server = app.listen(5000, () => {
  console.log("Companion server running at http://localhost:5000");
});

// Enable WebSocket support
companion.socket(server);
