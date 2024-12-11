export const errorHandler = (err, req, res, next) => {
  console.error("Error details:", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    headers: req.headers,
  });

  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    path: req.path,
  });
};
