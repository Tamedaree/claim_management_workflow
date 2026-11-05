import ApiError from "../utils/ApiError.js";

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user?.role) {
      return next(new ApiError(401, "Not authorized"));
    }
    // admin always allowed if you want — OR keep explicit only
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `Role (${req.user.role}) is not authorized to access this resource`,
        ),
      );
    }
    next();
  };
};
