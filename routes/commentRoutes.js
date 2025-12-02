import express from "express";
import { createComment, getComments, updateComment, deleteComment } from "../controllers/commentController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router({ mergeParams: true });

router.post("/", authenticate, createComment);
router.get("/", getComments);
router.put("/:id", authenticate, updateComment);
router.delete("/:id", authenticate, deleteComment);

export default router;
