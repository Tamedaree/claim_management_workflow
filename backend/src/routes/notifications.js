import express from 'express';
import {
  getMyNotifications,
  getNotification,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../controllers/notificationController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(getMyNotifications)
  .post(createNotification);

router.patch('/read-all', markAllAsRead);

router
  .route('/:id')
  .get(getNotification)
  .delete(deleteNotification);

router.patch('/:id/read', markAsRead);

export default router;