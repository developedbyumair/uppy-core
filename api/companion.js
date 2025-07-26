import companion from "@uppy/companion";
import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import os from "os";
import path from "path";
import fs from "fs";

// Create Express app for companion
const app = express();

// Parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Session configuration
app.use(
  session({
    secret: "676522f38edb8239a1238cc03702dbab",
    resave: true,
    saveUninitialized: true,
  })
);

// Create a temporary uploads directory
const uploadsDir = path.join(os.tmpdir(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Companion options
const companionOptions = {
  providerOptions: {
    unsplash: {
      key: "Wg-X31Zno-d_QVkFifC96czVe1hhUUAfTEybwNq7e2E",
      secret: "E00NcA5wx8RfwZFwgBfgtl4HZpRs0YsQ66OsTIuKTJ4",
    },
    url: {
      enabled: false,
      companion: false,
    },
  },
  metrics: {
    enabled: true,
    prefix: "companion",
  },
  server: {
    host: "uppy-core.vercel.app",
    protocol: "https",
  },
  secret: "676522f38edb8239a1238cc03702dbab",
  debug: true,
  corsOrigins: true,
  filePath: "/tmp", // Use /tmp for Vercel
  streamingUpload: true,
  enableUrlEndpoint: true,
  allowedUrls: [".*"],
  uploadUrls: [".*"],
  maxFileSize: 100 * 1024 * 1024, // 100MB,
  clientSocketConnectTimeout: 60000,
  actionRetryDelays: [0, 1000, 3000, 5000],
  sendClientErrorMessage: true,
};

// Initialize Companion
const { app: companionApp } = companion.app(companionOptions);

// Mount companion routes
app.use("/", companionApp);

export default function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Origin, Content-Type, Accept");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Handle companion requests
  return app(req, res);
}