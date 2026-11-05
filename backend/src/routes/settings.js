import express from "express";
import {
  getSettings,
  updateSettings,
  getPublicSettings,
} from "../controllers/settingsController.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";

const router = express.Router();

// No auth — safe fields only (VAPT High)
router.get("/public", getPublicSettings);

router.use(protect);
router.get("/", authorize("admin"), getSettings);
router.put("/", authorize("admin"), updateSettings);

export default router;
