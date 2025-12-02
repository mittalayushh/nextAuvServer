import prisma from "../utils/prisma.js";

export const createComment = async (req, res) => {
  const { postId } = req.params;
  const { content, parentId } = req.body;
  const userId = req.user.id;

  if (!content) {
    return res.status(400).json({ message: "Content is required" });
  }

  try {
    const comment = await prisma.comment.create({
      data: {
        content,
        postId: parseInt(postId),
        authorId: userId,
        parentId: parentId ? parseInt(parentId) : null,
      },
      include: {
        author: {
          select: { username: true },
        },
      },
    });
    res.status(201).json(comment);
  } catch (err) {
    console.error("Create comment error:", err);
    res.status(500).json({ message: "Failed to create comment" });
  }
};

export const getComments = async (req, res) => {
  const { postId } = req.params;

  try {
    const comments = await prisma.comment.findMany({
      where: { postId: parseInt(postId) },
      include: {
        author: {
          select: { username: true },
        },
        replies: {
          include: {
            author: {
              select: { username: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Organize comments into a tree structure if needed, or return flat list
    // For now, let's return all comments and let frontend handle nesting or return top-level only
    // Actually, a better approach for deep nesting is to fetch all and build tree in frontend,
    // OR fetch top-level and load replies on demand.
    // Let's fetch all for this post for simplicity.

    res.json(comments);
  } catch (err) {
    console.error("Get comments error:", err);
    res.status(500).json({ message: "Failed to fetch comments" });
  }
};

export const updateComment = async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  try {
    const comment = await prisma.comment.findUnique({ where: { id: parseInt(id) } });

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (comment.authorId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const updatedComment = await prisma.comment.update({
      where: { id: parseInt(id) },
      data: { content },
    });

    res.json(updatedComment);
  } catch (err) {
    console.error("Update comment error:", err);
    res.status(500).json({ message: "Failed to update comment" });
  }
};

export const deleteComment = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const comment = await prisma.comment.findUnique({ where: { id: parseInt(id) } });

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (comment.authorId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // For comments, we might want to "soft delete" if there are replies, 
    // or delete recursively. Reddit usually shows [deleted].
    // Let's just delete for now. If there are replies, Prisma might complain 
    // if foreign keys are strict and no cascade.
    // Assuming cascade or simple delete.

    await prisma.comment.delete({ where: { id: parseInt(id) } });

    res.json({ message: "Comment deleted successfully" });
  } catch (err) {
    console.error("Delete comment error:", err);
    res.status(500).json({ message: "Failed to delete comment" });
  }
};
