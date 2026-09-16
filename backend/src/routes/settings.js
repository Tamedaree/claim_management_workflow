import express from "express";
import {
  getSettings,
  updateSettings,
} from "../controllers/settingsController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);
router.get("/", getSettings);
router.put("/", updateSettings);
export default router;
