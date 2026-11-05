import express from "express";
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser,
  lookupUsers,
} from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";

const router = express.Router();

router.use(protect);

// Full directory — ADMIN ONLY (VAPT Critical)
router.get("/", authorize("admin"), getUsers);

// Assignee dropdowns — limited fields
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
  lookupUsers,
);

router.get("/:id", authorize("admin"), getUser);

router.post("/", authorize("admin"), createUser);
router.put("/:id", authorize("admin"), updateUser);
router.patch("/:id/status", authorize("admin"), updateUserStatus);
router.delete("/:id", authorize("admin"), deleteUser);

export default router;
