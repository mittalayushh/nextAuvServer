import express from "express";
import {
  getUserProfile,
  getUserPosts,
  getUserComments,
  getUserSavedPosts,
  getUserVotedPosts
} from "../controllers/userController.js";
import { authenticate, authenticateOptional } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes (optional auth for userVote status)
router.get("/:username", getUserProfile);
router.get("/:username/posts", authenticateOptional, getUserPosts);
router.get("/:username/comments", getUserComments);

// Private routes (require auth)
router.get("/:username/saved", authenticate, getUserSavedPosts);
router.get("/:username/voted", authenticate, getUserVotedPosts);

export default router;
