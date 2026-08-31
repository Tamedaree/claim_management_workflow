import prisma from '../config/db.js';
import ApiError from '../utils/ApiError.js';

// @desc    Get notifications for current user
// @route   GET /api/notifications
export const getMyNotifications = async (req, res, next) => {
  try {
    const { is_read, type } = req.query;

    const where = {
      user_id: req.user.id,
    };

    if (is_read !== undefined) {
      where.is_read = is_read === 'true';
    }
    if (type) {
      where.type = type;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        user_id: req.user.id,
        is_read: false,
      },
    });

    res.json({
      success: true,
      count: notifications.length,
      unreadCount,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single notification
// @route   GET /api/notifications/:id
export const getNotification = async (req, res, next) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });

    if (!notification) {
      throw new ApiError(404, 'Notification not found');
    }

    // Only owner can view
    if (notification.user_id !== req.user.id) {
      throw new ApiError(403, 'Not authorized to view this notification');
    }

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create notification
// @route   POST /api/notifications
export const createNotification = async (req, res, next) => {
  try {
    const { user_id, claim_id, claim_reference, title, message, type } = req.body;

    if (!user_id || !title || !message) {
      throw new ApiError(400, 'user_id, title and message are required');
    }

    const notification = await prisma.notification.create({
      data: {
        user_id,
        claim_id,
        claim_reference,
        title,
        message,
        type: type || 'general',
      },
    });

    res.status(201).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
export const markAsRead = async (req, res, next) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });

    if (!notification) {
      throw new ApiError(404, 'Notification not found');
    }

    if (notification.user_id !== req.user.id) {
      throw new ApiError(403, 'Not authorized');
    }

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { is_read: true },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/read-all
export const markAllAsRead = async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: {
        user_id: req.user.id,
        is_read: false,
      },
      data: { is_read: true },
    });

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
export const deleteNotification = async (req, res, next) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });

    if (!notification) {
      throw new ApiError(404, 'Notification not found');
    }

    if (notification.user_id !== req.user.id) {
      throw new ApiError(403, 'Not authorized');
    }

    await prisma.notification.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    next(error);
  }
};