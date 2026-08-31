import express from 'express';
import {
  getActivities,
  getActivitiesByClaim,
  getActivity,
  createActivity,
  updateActivity,
  deleteActivity,
} from '../controllers/claimActivityController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(getActivities)
  .post(createActivity);

router.get('/claim/:claimId', getActivitiesByClaim);

router
  .route('/:id')
  .get(getActivity)
  .put(updateActivity)
  .delete(deleteActivity);

export default router;