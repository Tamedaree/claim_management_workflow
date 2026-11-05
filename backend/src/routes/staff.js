import express from "express";
import {
  getStaffMembers,
  getStaffMember,
  createStaffMember,
  updateStaffMember,
  updateStaffStatus,
  resetStaffPassword,
  deleteStaffMember,
  lookupStaff,
} from "../controllers/staffController.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";

const router = express.Router();

router.use(protect);

// Full staff directory — ADMIN ONLY (VAPT Critical)
router.get("/", authorize("admin"), getStaffMembers);

// Limited lookup — before /:id
router.get(
  "/lookup",
  authorize(
    "admin",
    "secretary",
    "claim_adjuster",
    "gio_principal_claim_officer",
    "principal_claim_officer",
    "claim_manager",
    "gio_claim_manager",
    "director",
    "senior_director",
    "chief_of_gio",
    "ceo",
  ),
  lookupStaff,
);

router.get("/:id", authorize("admin"), getStaffMember);

router.post("/", authorize("admin"), createStaffMember);
router.put("/:id", authorize("admin"), updateStaffMember);
router.delete("/:id", authorize("admin"), deleteStaffMember);
router.patch("/:id/status", authorize("admin"), updateStaffStatus);
router.patch("/:id/reset-password", authorize("admin"), resetStaffPassword);

export default router;
