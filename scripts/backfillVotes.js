import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Starting vote count backfill...');

  const posts = await prisma.post.findMany({
    include: {
      votes: true,
    },
  });

  for (const post of posts) {
    const voteCount = post.votes.reduce((acc, vote) => acc + vote.value, 0);

    if (post.voteCount !== voteCount) {
      console.log(`Updating post ${post.id}: ${post.voteCount} -> ${voteCount}`);
      await prisma.post.update({
        where: { id: post.id },
        data: { voteCount },
      });
    }
  }

  console.log('Backfill complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
