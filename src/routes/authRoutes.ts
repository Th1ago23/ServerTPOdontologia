import express from "express";
import AuthController from "../controllers/AuthController";

const router = express.Router();

router.post("/register", AuthController.registerUser);
router.post("/login", AuthController.loginUser);
router.post("/unified-login", AuthController.unifiedLogin);
router.post("/check-type", AuthController.checkUserType);

export default router;