import express from 'express';
import {
  getWorkflowStages,
  getWorkflowStage,
  createWorkflowStage,
  updateWorkflowStage,
  deleteWorkflowStage,
} from '../controllers/workflowStageController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(getWorkflowStages)
  .post(authorize('admin', 'claim_manager', 'gio_claim_manager', 'director', 'chief_of_gio', 'ceo'), createWorkflowStage);

router
  .route('/:id')
  .get(getWorkflowStage)
  .put(authorize('admin', 'claim_manager', 'gio_claim_manager', 'director', 'chief_of_gio', 'ceo'), updateWorkflowStage)
  .delete(authorize('admin', 'ceo'), deleteWorkflowStage);

export default router;