import express from 'express';
import {
  getActions,
  getActionsByClaim,
  getAction,
  createAction,
  deleteAction,
} from '../controllers/claimActionController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(getActions)
  .post(createAction);

router.get('/claim/:claimId', getActionsByClaim);

router
  .route('/:id')
  .get(getAction)
  .delete(deleteAction);

export default router;