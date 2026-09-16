import { Router } from "express";
import { listGarages } from "../controllers/garageController.js";
import { protect } from "../middleware/auth.js"; // use your real auth middleware name

const router = Router();

router.get("/", protect, listGarages);

export default router;
