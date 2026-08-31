import express from "express";
import {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  uploadProfileImage,
} from "../controllers/authController.js";
import { uploadProfilePhoto } from "../middleware/upload.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/profile-photo", protect, uploadProfilePhoto, uploadProfileImage);

router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

export default router;
