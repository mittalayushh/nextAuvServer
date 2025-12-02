import prisma from "../utils/prisma.js";

export const getTopics = async (req, res) => {
  const { search = "", limit = 20 } = req.query;

  try {
    // Fetch all tags from posts
    // Note: This is not the most efficient way for huge datasets, but works for now.
    // Ideally, we would have a separate 'Topic' or 'Tag' model in Prisma.
    // Since tags are a string array on Post, we have to aggregate manually.
    const posts = await prisma.post.findMany({
      select: { tags: true },
    });

    const tagCounts = {};
    posts.forEach(post => {
      post.tags.forEach(tag => {
        if (tag) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      });
    });

    // Convert to array and sort
    let sortedTopics = Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Filter by search query
    if (search) {
      sortedTopics = sortedTopics.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Limit results
    const results = sortedTopics.slice(0, parseInt(limit));

    res.json(results);
  } catch (err) {
    console.error("Get topics error:", err);
    res.status(500).json({ message: "Failed to retrieve topics" });
  }
};
