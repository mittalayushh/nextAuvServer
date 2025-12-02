import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const calculateHotScore = (votes, date) => {
  const order = Math.log10(Math.max(Math.abs(votes), 1));
  const sign = votes > 0 ? 1 : votes < 0 ? -1 : 0;
  const seconds = (date.getTime() - 1134028003000) / 1000;
  return Math.round((order + sign * seconds / 45000) * 10000000) / 10000000;
};

async function main() {
  console.log('Starting hot score backfill...');

  const posts = await prisma.post.findMany();

  for (const post of posts) {
    const hotScore = calculateHotScore(post.voteCount, post.createdAt);

    console.log(`Updating post ${post.id}: votes=${post.voteCount}, hotScore=${hotScore}`);
    await prisma.post.update({
      where: { id: post.id },
      data: { hotScore },
    });
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
