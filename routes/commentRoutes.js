import express from "express";
import { createComment, getComments } from "../controllers/commentController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router({ mergeParams: true });

router.post("/", authenticate, createComment);
router.get("/", getComments);

export default router;
