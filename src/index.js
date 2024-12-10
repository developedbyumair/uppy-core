// const port = process.env.PORT || 5000;
// app.listen(port, () => {
//   /* eslint-disable no-console */
//   console.log(`Listening: http://localhost:${port}`);
//   /* eslint-enable no-console */
// });

// import app from "./app.js";
import express from "express";
import bodyParser from "body-parser";
import companion from "@uppy/companion";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";
import os from "os";

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

// Create a temporary uploads directory
const uploadsDir = path.join(os.tmpdir(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("Uploads directory created at:", uploadsDir);
}

console.log(uploadsDir);

// Companion options
const companionOptions = {
  providerOptions: {
    unsplash: {
      key: "Wg-X31Zno-d_QVkFifC96czVe1hhUUAfTEybwNq7e2E",
      secret: "E00NcA5wx8RfwZFwgBfgtl4HZpRs0YsQ66OsTIuKTJ4",
    },
    url: {
      enabled: true,
      companion: true,
    },
  },
  server: {
    host: "uppy-core.vercel.app",
    protocol: "https",
  },
  secret: "676522f38edb8239a1238cc03702dbab",
  debug: process.env.NODE_ENV !== "production",
  corsOrigins: true,
  filePath: uploadsDir,
  streamingUpload: true,
  allowLocalUrls: String(process.env.NODE_ENV) === "development",
  uploadUrls: {
    // This should point to the temporary uploads directory
    url: uploadsDir,
  },
};

// Initialize Companion
const { app: companionApp } = companion.app(companionOptions);
app.use(companionApp);

const server = app.listen(5000);

companion.socket(server);
