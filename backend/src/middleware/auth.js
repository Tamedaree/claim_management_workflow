import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import ApiError from '../utils/ApiError.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new ApiError(401, 'Not authorized, no token');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        department: true,
        work_location: true,
        is_active: true,
        phone: true,
        position_title: true,
      },
    });

    if (!user || !user.is_active) {
      throw new ApiError(401, 'User not found or inactive');
    }

    req.user = user;
    next();
  } catch (error) {
    next(new ApiError(401, 'Not authorized'));
  }
};