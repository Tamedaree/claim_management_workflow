import express from 'express';
import {
  getThresholds,
  getThreshold,
  createThreshold,
  updateThreshold,
  deleteThreshold,
} from '../controllers/approvalThresholdController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

const router = express.Router();

router.use(protect);

// Only high level roles can manage thresholds
router.use(authorize('admin', 'claim_manager', 'gio_claim_manager', 'director', 'chief_of_gio', 'ceo'));

router
  .route('/')
  .get(getThresholds)
  .post(createThreshold);

router
  .route('/:id')
  .get(getThreshold)
  .put(updateThreshold)
  .delete(deleteThreshold);

export default router;