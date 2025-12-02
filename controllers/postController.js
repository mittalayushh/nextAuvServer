import prisma from "../utils/prisma.js";

// Helper to calculate hot score
const calculateHotScore = (votes, date) => {
  const order = Math.log10(Math.max(Math.abs(votes), 1));
  const sign = votes > 0 ? 1 : votes < 0 ? -1 : 0;
  const seconds = (date.getTime() - 1134028003000) / 1000;
  return Math.round((order + sign * seconds / 45000) * 10000000) / 10000000;
};

export const createPost = async (req, res) => {
  console.log("Received create post request");
  const { title, content, tags, category } = req.body;
  console.log("req.user object:", req.user);
  const userId = req.user.id;
  console.log("User ID:", userId);
  console.log("Post Data:", { title, tags, category });

  if (!title) {
    console.log("Validation failed: Title missing");
    return res.status(400).json({ message: "Title is required" });
  }

  try {
    const now = new Date();
    const hotScore = calculateHotScore(0, now);

    const post = await prisma.post.create({
      data: {
        title,
        content,
        tags: tags || [],
        category,
        authorId: userId,
        hotScore,
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
  const { page = 1, limit = 5, search = "", sort = "newest", tag, category } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const where = {
    AND: [
      search
        ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { content: { contains: search, mode: "insensitive" } },
            { tags: { hasSome: [search] } },
          ],
        }
        : {},
      tag ? { tags: { has: tag } } : {},
      category ? { category: category } : {},
    ],
  };

  let orderBy = { createdAt: "desc" };
  if (sort === "oldest") {
    orderBy = { createdAt: "asc" };
  } else if (sort === "top") {
    orderBy = { voteCount: "desc" };
  } else if (sort === "hot") {
    orderBy = { hotScore: "desc" };
  }

  try {
    const [posts, totalPosts] = await Promise.all([
      prisma.post.findMany({
        where,
        skip: skip,
        take: limitNum,
        orderBy,
        include: {
          author: {
            select: { username: true, email: true },
          },
          votes: true,
        },
      }),
      prisma.post.count({ where }),
    ]);

    const totalPages = Math.ceil(totalPosts / limitNum);

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
      console.log(`Found ${finalPosts.length} posts for page ${pageNum}`);
      res.json({
        posts: finalPosts,
        pagination: {
          total: totalPosts,
          pages: totalPages,
          page: pageNum,
          limit: limitNum
        }
      });
    } else {
      console.log(`Found ${postsWithVotes.length} posts for page ${pageNum}`);
      res.json({
        posts: postsWithVotes.map(p => ({ ...p, isSaved: false })),
        pagination: {
          total: totalPosts,
          pages: totalPages,
          page: pageNum,
          limit: limitNum
        }
      });
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

    let newVoteCount;
    let postCreatedAt;

    // Fetch post creation time for hot score calculation
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { createdAt: true, voteCount: true } });
    if (!post) throw { code: 'P2003' };
    postCreatedAt = post.createdAt;
    newVoteCount = post.voteCount;

    if (existingVote) {
      if (existingVote.value === value) {
        // Toggle off (remove vote)
        newVoteCount -= value;
        const hotScore = calculateHotScore(newVoteCount, postCreatedAt);

        await prisma.$transaction([
          prisma.vote.delete({
            where: { id: existingVote.id },
          }),
          prisma.post.update({
            where: { id: postId },
            data: {
              voteCount: { decrement: value },
              hotScore
            },
          }),
        ]);
        return res.json({ message: "Vote removed", value: 0 });
      } else {
        // Change vote
        const voteDiff = value - existingVote.value;
        newVoteCount += voteDiff;
        const hotScore = calculateHotScore(newVoteCount, postCreatedAt);

        const [updatedVote] = await prisma.$transaction([
          prisma.vote.update({
            where: { id: existingVote.id },
            data: { value },
          }),
          prisma.post.update({
            where: { id: postId },
            data: {
              voteCount: { increment: voteDiff },
              hotScore
            },
          }),
        ]);
        return res.json({ message: "Vote updated", value: updatedVote.value });
      }
    } else {
      // Create new vote
      newVoteCount += value;
      const hotScore = calculateHotScore(newVoteCount, postCreatedAt);

      try {
        const [newVote] = await prisma.$transaction([
          prisma.vote.create({
            data: {
              userId,
              postId,
              value,
            },
          }),
          prisma.post.update({
            where: { id: postId },
            data: {
              voteCount: { increment: value },
              hotScore
            },
          }),
        ]);
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
