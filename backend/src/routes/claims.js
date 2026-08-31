import express from "express";
import {
  getClaims,
  getClaim,
  createClaim,
  updateClaim,
  deleteClaim,
  submitClaim,
  completeStage,
} from "../controllers/claimController.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";

const router = express.Router();

router.use(protect); // All claim routes require authentication

router.route("/").get(getClaims).post(createClaim);

router
  .route("/:id")
  .get(getClaim)
  .put(updateClaim)
  .delete(
    authorize("admin", "claim_manager", "gio_claim_manager"),
    deleteClaim,
  );

router.patch("/:id/submit", submitClaim);
router.post('/:id/complete-stage', completeStage);

export default router;
