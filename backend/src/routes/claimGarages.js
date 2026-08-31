import express from 'express';
import {
  getGarages,
  getGaragesByClaim,
  getGarage,
  createGarage,
  updateGarage,
  deleteGarage,
} from '../controllers/claimGarageController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(getGarages)
  .post(createGarage);

router.get('/claim/:claimId', getGaragesByClaim);

router
  .route('/:id')
  .get(getGarage)
  .put(updateGarage)
  .delete(deleteGarage);

export default router;