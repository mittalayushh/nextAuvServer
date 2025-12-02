import prisma from "../utils/prisma.js";

// Get user profile stats (karma, join date)
export const getUserProfile = async (req, res) => {
  const { username } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        createdAt: true,
        posts: { select: { votes: true } },
        comments: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Calculate Karma (Post votes + Comment count for simplicity, or complex logic)
    // Reddit karma is complex, but let's do: sum of post votes + number of comments
    const postKarma = user.posts.reduce((acc, post) => {
      return acc + post.votes.reduce((vAcc, vote) => vAcc + vote.value, 0);
    }, 0);
    const commentKarma = user.comments.length; // Simplified
    const totalKarma = postKarma + commentKarma;

    res.json({
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      karma: totalKarma,
    });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get posts created by user
export const getUserPosts = async (req, res) => {
  const { username } = req.params;
  try {
    const posts = await prisma.post.findMany({
      where: { author: { username } },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { username: true } },
        votes: true,
      },
    });

    // Calculate vote counts
    const postsWithVotes = posts.map(post => {
      const voteCount = post.votes.reduce((acc, vote) => acc + vote.value, 0);
      const userVote = req.user ? post.votes.find(v => v.userId === req.user.id)?.value || 0 : 0;
      const { votes, ...postData } = post;
      return { ...postData, voteCount, userVote };
    });

    res.json(postsWithVotes);
  } catch (err) {
    console.error("Get user posts error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get comments by user
export const getUserComments = async (req, res) => {
  const { username } = req.params;
  try {
    const comments = await prisma.comment.findMany({
      where: { author: { username } },
      orderBy: { createdAt: "desc" },
      include: {
        post: { select: { id: true, title: true, author: { select: { username: true } } } },
      },
    });
    res.json(comments);
  } catch (err) {
    console.error("Get user comments error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get saved posts (Private: requires auth and matching user)
export const getUserSavedPosts = async (req, res) => {
  const { username } = req.params;

  // Only allow viewing own saved posts
  if (!req.user || req.user.username !== username) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const savedPosts = await prisma.savedPost.findMany({
      where: { user: { username } },
      orderBy: { createdAt: "desc" },
      include: {
        post: {
          include: {
            author: { select: { username: true } },
            votes: true,
          },
        },
      },
    });

    // Transform to return post objects with vote counts
    const posts = savedPosts.map(sp => {
      const post = sp.post;
      const voteCount = post.votes.reduce((acc, vote) => acc + vote.value, 0);
      const userVote = post.votes.find(v => v.userId === req.user.id)?.value || 0;
      const { votes, ...postData } = post;
      return { ...postData, voteCount, userVote };
    });

    res.json(posts);
  } catch (err) {
    console.error("Get saved posts error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get upvoted/downvoted posts (Private)
export const getUserVotedPosts = async (req, res) => {
  const { username } = req.params;
  const { type } = req.query; // 'upvoted' or 'downvoted'
  const value = type === 'downvoted' ? -1 : 1;

  if (!req.user || req.user.username !== username) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const votes = await prisma.vote.findMany({
      where: {
        user: { username },
        value: value
      },
      include: {
        post: {
          include: {
            author: { select: { username: true } },
            votes: true,
          },
        },
      },
    });

    const posts = votes.map(v => {
      const post = v.post;
      const voteCount = post.votes.reduce((acc, vote) => acc + vote.value, 0);
      const userVote = post.votes.find(v => v.userId === req.user.id)?.value || 0;
      const { votes, ...postData } = post;
      return { ...postData, voteCount, userVote };
    });

    res.json(posts);
  } catch (err) {
    console.error("Get voted posts error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
