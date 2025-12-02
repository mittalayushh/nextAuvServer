import express from "express";
import { createPost, getPosts, getPostById, votePost, savePost, updatePost, deletePost } from "../controllers/postController.js";
import { authenticate, authenticateOptional } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", authenticate, createPost);
router.get("/", authenticateOptional, getPosts);
router.get("/:id", authenticateOptional, getPostById);
router.put("/:id", authenticate, updatePost);
router.delete("/:id", authenticate, deletePost);
router.post("/:id/vote", authenticate, votePost);
router.post("/:id/save", authenticate, savePost);

export default router;
