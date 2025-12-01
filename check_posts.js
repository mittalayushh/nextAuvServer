import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const posts = await prisma.post.findMany({
    include: { author: true }
  });
  console.log("Posts in DB:", JSON.stringify(posts, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
