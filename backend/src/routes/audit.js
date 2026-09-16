import express from "express";
import {
  getClaimAuditTimeline,
  getDataAuditLogs,
  getAccessLogs,
} from "../controllers/auditController.js";
import { protect } from "../middleware/auth.js";
import { requireAuditAccess } from "../middleware/requireAuditAccess.js";

const router = express.Router();

router.use(protect);

router.get("/claims/:id/timeline", getClaimAuditTimeline);
router.get("/data-changes", getDataAuditLogs);
router.get("/access-logs", getAccessLogs);

export default router;
