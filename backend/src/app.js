import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";
import errorHandler from "./middleware/errorHandler.js";
import { auditContext } from "./middleware/auditContext.js";
import accessLog from "./middleware/accessLog.js";

// Routes
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import staffRoutes from "./routes/staff.js";
import claimRoutes from "./routes/claims.js";
import claimActivityRoutes from "./routes/claimActivities.js";
import claimActionRoutes from "./routes/claimActions.js";
import claimGarageRoutes from "./routes/claimGarages.js";
import notificationRoutes from "./routes/notifications.js";
import workflowStageRoutes from "./routes/workflowStage.js";
import approvalThresholdRoutes from "./routes/approvalThreshold.js";
import auditRoutes from "./routes/audit.js";

const app = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(auditContext);
app.use(accessLog);

// Serve uploaded profile photos
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
});
app.use("/api", limiter);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/claims", claimRoutes);
app.use("/api/claim-activities", claimActivityRoutes);
app.use("/api/claim-actions", claimActionRoutes);
app.use("/api/claim-garages", claimGarageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/workflow-stages", workflowStageRoutes);
app.use("/api/approval-thresholds", approvalThresholdRoutes);
app.use("/api/audit", auditRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Claim Workflow API is running" });
});

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Claim Workflow API is running",
  });
});

app.use(errorHandler);

export default app;
