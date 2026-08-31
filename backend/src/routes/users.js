import express from "express";
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser,
} from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";

const router = express.Router();

router.use(protect);

// Any logged-in operational role can list users (for assignee dropdowns)
router.get(
  "/",
  authorize(
    "admin",
    "secretary",
    "claim_adjuster",
    "gio_claim_adjuster",
    "surveyor",
    "principal_claim_officer",
    "claim_manager",
    "gio_claim_manager",
    "director",
    "chief_of_gio",
    "ceo",
  ),
  getUsers,
);

router.get(
  "/:id",
  authorize(
    "admin",
    "secretary",
    "claim_adjuster",
    "gio_claim_adjuster",
    "surveyor",
    "principal_claim_officer",
    "claim_manager",
    "gio_claim_manager",
    "director",
    "chief_of_gio",
    "ceo",
  ),
  getUser,
);

// Admin-only mutations
router.post("/", authorize("admin"), createUser);
router.put("/:id", authorize("admin"), updateUser);
router.patch("/:id/status", authorize("admin"), updateUserStatus);
router.delete("/:id", authorize("admin"), deleteUser);

export default router;
