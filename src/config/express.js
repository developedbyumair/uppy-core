import bodyParser from "body-parser";
import session from "express-session";
import { corsMiddleware } from "../middleware/cors.js";
import { errorHandler } from "../middleware/error.js";

export function configureExpress(app) {
  // CORS should be first
  app.use(corsMiddleware);

  // Parse JSON bodies
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // Session configuration
  app.use(
    session({
      secret: "676522f38edb8239a1238cc03702dbab",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: true, // set to true if using https
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })
  );

  // Add basic route for testing
  app.get("/health", (req, res) => {
    res.json({ status: "OK" });
  });

  // Error handling should be last
  app.use(errorHandler);
}
