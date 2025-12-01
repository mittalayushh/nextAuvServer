import 'dotenv/config';
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import prisma from "./lib/prisma.js";
import { validateUser } from "./lib/validateUser.js";
import { authenticate } from "./lib/auth.js";
import { generateToken } from "./jwt.js";

const app = express();
app.use(cors({
  origin: ["http://localhost:3000", "https://nextauv.vercel.app"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));
app.use(express.json());
app.post("/signup", validateUser, async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { username, email, password: hashedPassword },
    });

    const token = generateToken(user);
    res.status(201).json({ message: "Signup successful", token });
  } catch (err) {
    console.error("Signup error:", err.message);
    console.error("Full error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});
app.post("/login", validateUser, async (req, res) => {
  const { email, password } = req.body;
  console.log("Login attempt for email:", email);

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return res.status(400).json({ message: "Invalid email or password" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(400).json({ message: "Invalid email or password" });

    const token = generateToken(user);
    return res.status(200).json({ message: "Login successful", token });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/posts", authenticate, async (req, res) => {
  console.log("Received create post request");
  const { title, content, tags } = req.body;
  console.log("req.user object:", req.user);
  const userId = req.user.id;
  console.log("User ID:", userId);
  console.log("Post Data:", { title, tags });

  if (!title) {
    console.log("Validation failed: Title missing");
    return res.status(400).json({ message: "Title is required" });
  }

  try {
    const post = await prisma.post.create({
      data: {
        title,
        content,
        tags: tags || [],
        authorId: userId,
      },
    });
    console.log("Post created successfully:", post.id);
    res.status(201).json({ message: "Post created successfully", post });
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ message: "Failed to create post: " + err.message });
  }
});

app.get("/api/posts", async (req, res) => {
  console.log("Received GET /api/posts request");
  try {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: { username: true, email: true },
        },
      },
    });
    console.log(`Found ${posts.length} posts`);
    res.json(posts);
  } catch (err) {
    console.error("Get posts error:", err);
    res.status(500).json({ message: "Failed to retrieve posts: " + err.message });
  }
});

const PORT = 4001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));