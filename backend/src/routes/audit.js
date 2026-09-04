import express from "express";
import {
  getClaimAuditTimeline,
  getDataAuditLogs,
  getAccessLogs,
} from "../controllers/auditController.js";

const router = express.Router();

router.get("/claims/:id/timeline", getClaimAuditTimeline);
router.get("/data-changes", getDataAuditLogs);
router.get("/access-logs", getAccessLogs);

export default router;
