import prisma from "../utils/prisma.js";

export const createPost = async (req, res) => {
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
};

export const getPosts = async (req, res) => {
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
};
