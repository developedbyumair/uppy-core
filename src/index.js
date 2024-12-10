// const port = process.env.PORT || 5000;
// app.listen(port, () => {
//   /* eslint-disable no-console */
//   console.log(`Listening: http://localhost:${port}`);
//   /* eslint-enable no-console */
// });

import app from "./app.js";
import express from "express";
import bodyParser from "body-parser";
import companion from "@uppy/companion";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

// Fix for __dirname in ES modules
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
const uploadsDir = path.join(__dirname, "uploads");

// Companion options
const companionOptions = {
  providerOptions: {
    dropbox: {
      key:
        process.env.DROPBOX_KEY ||
        "Wg-X31Zno-d_QVkFifC96czVe1hhUUAfTEybwNq7e2E",
      secret:
        process.env.DROPBOX_SECRET ||
        "E00NcA5wx8RfwZFwgBfgtl4HZpRs0YsQ66OsTIuKTJ4",
    },
    unsplash: {
      key:
        process.env.UNSPLASH_KEY ||
        "Wg-X31Zno-d_QVkFifC96czVe1hhUUAfTEybwNq7e2E",
      secret:
        process.env.UNSPLASH_SECRET ||
        "E00NcA5wx8RfwZFwgBfgtl4HZpRs0YsQ66OsTIuKTJ4",
    },
    url: {
      enabled: true,
      companion: true,
    },
  },
  server: {
    host: process.env.VERCEL_URL || "localhost:5000",
    protocol: process.env.VERCEL_URL ? "https" : "http",
  },
  secret: process.env.COMPANION_SECRET || "676522f38edb8239a1238cc03702dbab",
  debug: process.env.NODE_ENV !== "production",
  corsOrigins: true,
  filePath: uploadsDir,
  streamingUpload: true,
  allowLocalUrls: String(process.env.NODE_ENV) === "development",
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
