import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";
import errorHandler from "./middleware/errorHandler.js";

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

const app = express();

// Behind nginx / IIS / load balancer in production
if (process.env.TRUST_PROXY === "1" || process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

const allowedOrigins = (
  process.env.FRONTEND_URL || "http://localhost:5173"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // allow same-origin / server tools with no Origin header
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ── Rate limits ──────────────────────────────────────────────
const isDev = process.env.NODE_ENV !== "production";

// Login / register / password — protect against brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: isDev ? 100 : 30, // 30 login attempts / 15 min / IP in prod
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many auth attempts. Try again in 15 minutes.",
  },
});

// General API — high enough for real UI traffic
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 5000 : 2000, // ~2k req / 15 min / IP in prod
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please slow down and try again.",
  },
});

// Health — no limit
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Claim Workflow API is running" });
});

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Claim Workflow API is running",
  });
});

// Apply limiters BEFORE routes
app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

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

app.use(errorHandler);

export default app;