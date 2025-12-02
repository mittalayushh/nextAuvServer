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
        votes: true,
      },
    });

    // Calculate vote counts and check if saved
    const postsWithVotes = posts.map(post => {
      const voteCount = post.votes.reduce((acc, vote) => acc + vote.value, 0);
      const userVote = req.user ? post.votes.find(v => v.userId === req.user.id)?.value || 0 : 0;
      // Check if saved by current user (requires fetching savedPosts or checking relation if included)
      // Since we didn't include savedBy in the main query, we might need a different approach or include it.
      // Let's include savedBy in the main query but filtered by user if possible, or just map it.
      // Prisma doesn't support filtering filtered relations easily in include without a separate query or advanced features.
      // A simpler way for now: fetch user's saved post IDs separately if user is logged in.
      const { votes, ...postData } = post; // Destructure votes to remove it from the final post object
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
      console.log(`Found ${posts.length} posts`);
      res.json(finalPosts);
    } else {
      console.log(`Found ${posts.length} posts`);
      res.json(postsWithVotes.map(p => ({ ...p, isSaved: false })));
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
