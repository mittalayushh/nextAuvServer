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
      include: {
        author: {
          select: { username: true, email: true },
        },
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
  const { cursor, limit = 10 } = req.query;
  const take = parseInt(limit);

  try {
    const posts = await prisma.post.findMany({
      take: take + 1, // Fetch one extra to determine if there's a next page
      cursor: cursor ? { id: parseInt(cursor) } : undefined,
      skip: cursor ? 1 : 0, // Skip the cursor itself if provided
      orderBy: { createdAt: "desc" }, // Or id: 'desc' if you prefer consistent ordering by ID
      include: {
        author: {
          select: { username: true, email: true },
        },
        votes: true,
      },
    });

    let nextCursor = null;
    if (posts.length > take) {
      const nextItem = posts.pop(); // Remove the extra item
      nextCursor = nextItem.id;
    }

    // Calculate vote counts and check if saved
    const postsWithVotes = posts.map(post => {
      const voteCount = post.votes.reduce((acc, vote) => acc + vote.value, 0);
      const userVote = req.user ? post.votes.find(v => v.userId === req.user.id)?.value || 0 : 0;
      const { votes, ...postData } = post; 
      return { ...postData, voteCount, userVote };
    });

    // If user is logged in, fetch their saved post IDs to map isSaved
    if (req.user) {
      const savedPosts = await prisma.savedPost.findMany({
        where: { userId: req.user.id },
        select: { postId: true },
      });
      const savedPostIds = new Set(savedPosts.map(sp => sp.postId));

      const finalPosts = postsWithVotes.map(post => ({
        ...post,
        isSaved: savedPostIds.has(post.id)
      }));
      console.log(`Found ${finalPosts.length} posts`);
      res.json({ posts: finalPosts, nextCursor });
    } else {
      console.log(`Found ${postsWithVotes.length} posts`);
      res.json({ posts: postsWithVotes.map(p => ({ ...p, isSaved: false })), nextCursor });
    }
  } catch (err) {
    console.error("Get posts error:", err);
    res.status(500).json({ message: "Failed to retrieve posts: " + err.message });
  }
};

export const getPostById = async (req, res) => {
  const { id } = req.params;
  try {
    const post = await prisma.post.findUnique({
      where: { id: parseInt(id) },
      include: {
        author: {
          select: { username: true, email: true },
        },
        votes: true,
      },
    });
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const voteCount = post.votes.reduce((acc, vote) => acc + vote.value, 0);
    const userVote = req.user ? post.votes.find(v => v.userId === req.user.id)?.value || 0 : 0;
    const { votes, ...postData } = post;

    let isSaved = false;
    if (req.user) {
      const savedPost = await prisma.savedPost.findUnique({
        where: {
          userId_postId: {
            userId: req.user.id,
            postId: post.id
          }
        }
      });
      isSaved = !!savedPost;
    }

    res.json({ ...postData, voteCount, userVote, isSaved });
  } catch (err) {
    res.status(500).json({ message: "Failed to retrieve post" });
  }
};

export const votePost = async (req, res) => {
  const { id } = req.params;
  const { value } = req.body; // 1 for upvote, -1 for downvote
  const userId = req.user.id;
  const postId = parseInt(id);

  if (![1, -1].includes(value)) {
    return res.status(400).json({ message: "Invalid vote value" });
  }

  const handleVoteTransaction = async () => {
    const existingVote = await prisma.vote.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    if (existingVote) {
      if (existingVote.value === value) {
        // Toggle off (remove vote)
        await prisma.vote.delete({
          where: { id: existingVote.id },
        });
        return res.json({ message: "Vote removed", value: 0 });
      } else {
        // Change vote
        const updatedVote = await prisma.vote.update({
          where: { id: existingVote.id },
          data: { value },
        });
        return res.json({ message: "Vote updated", value: updatedVote.value });
      }
    } else {
      // Create new vote
      try {
        const newVote = await prisma.vote.create({
          data: {
            userId,
            postId,
            value,
          },
        });
        return res.json({ message: "Vote added", value: newVote.value });
      } catch (err) {
        if (err.code === 'P2002') {
          // Race condition: Vote was created by another request just now.
          // Retry the logic to treat it as an existing vote (toggle/update).
          return handleVoteTransaction();
        }
        throw err;
      }
    }
  };

  try {
    await handleVoteTransaction();
  } catch (err) {
    console.error("Vote error:", err);
    if (err.code === 'P2003') {
      return res.status(404).json({ message: "Post not found" });
    }
    res.status(500).json({ message: "Failed to vote" });
  }
};

export const savePost = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const postId = parseInt(id);

  try {
    const existingSave = await prisma.savedPost.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    if (existingSave) {
      // Unsave
      await prisma.savedPost.delete({
        where: { id: existingSave.id },
      });
      return res.json({ message: "Post unsaved", saved: false });
    } else {
      // Save
      await prisma.savedPost.create({
        data: {
          userId,
          postId,
        },
      });
      return res.json({ message: "Post saved", saved: true });
    }
  } catch (err) {
    console.error("Save post error:", err);
    if (err.code === 'P2002') {
      // Race condition, treat as saved
      return res.json({ message: "Post saved", saved: true });
    }
    if (err.code === 'P2003') {
      return res.status(404).json({ message: "Post not found" });
    }
    res.status(500).json({ message: "Failed to save post" });
  }
};

export const updatePost = async (req, res) => {
  const { id } = req.params;
  const { title, content, tags } = req.body;
  const userId = req.user.id;

  try {
    const post = await prisma.post.findUnique({ where: { id: parseInt(id) } });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.authorId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const updatedPost = await prisma.post.update({
      where: { id: parseInt(id) },
      data: { title, content, tags },
    });

    res.json(updatedPost);
  } catch (err) {
    console.error("Update post error:", err);
    res.status(500).json({ message: "Failed to update post" });
  }
};

export const deletePost = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const post = await prisma.post.findUnique({ where: { id: parseInt(id) } });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.authorId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Delete related data (comments, votes, savedPosts) if not handled by cascade
    // Prisma schema usually handles cascade delete if configured, but let's check schema.
    // Assuming cascade delete is set up or we rely on DB constraints.
    // Ideally, we should delete related items or use onDelete: Cascade in schema.

    await prisma.post.delete({ where: { id: parseInt(id) } });

    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error("Delete post error:", err);
    res.status(500).json({ message: "Failed to delete post" });
  }
};
