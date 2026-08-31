import express from "express";
import {
  getStaffMembers,
  getStaffMember,
  createStaffMember,
  updateStaffMember,
  updateStaffStatus,
  resetStaffPassword,
  deleteStaffMember,
} from "../controllers/staffController.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";

const router = express.Router();

router.use(protect);

// READ — any logged-in role that needs names / lookups
router.get(
  "/",
  authorize(
    "admin",
    "secretary",
    "claim_manager",
    "gio_claim_manager",
    "director",
    "chief_of_gio",
    "ceo",
    "claim_adjuster",
    "principal_claim_officer",
    "surveyor",
  ),
  getStaffMembers,
);

router.get(
  "/:id",
  authorize(
    "admin",
    "secretary",
    "claim_manager",
    "gio_claim_manager",
    "director",
    "chief_of_gio",
    "ceo",
    "claim_adjuster",
    "principal_claim_officer",
    "surveyor",
  ),
  getStaffMember,
);

// WRITE — restricted
router.post("/", authorize("admin", "secretary"), createStaffMember);

router.put("/:id", authorize("admin", "secretary"), updateStaffMember);

router.delete("/:id", authorize("admin"), deleteStaffMember);

router.patch("/:id/status", authorize("admin", "secretary"), updateStaffStatus);

router.patch(
  "/:id/reset-password",
  authorize("admin", "secretary"),
  resetStaffPassword,
);

export default router;
