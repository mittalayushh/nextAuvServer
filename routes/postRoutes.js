import express from "express";
import { createPost, getPosts } from "../controllers/postController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", authenticate, createPost);
router.get("/", getPosts);

export default router;
