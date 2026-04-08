const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const msg = await prisma.message.findFirst({
     where: { isDeleted: false }
  });
  if (!msg) return console.log("no message");
  
  console.log("Before:", msg.reactions);
  
  const currentReactions = msg.reactions || {};
  let usersForEmoji = currentReactions['👍'] || [];
  usersForEmoji.push('test-user-id');
  const updatedReactions = { ...currentReactions, '👍': usersForEmoji };
  
  const updated = await prisma.message.update({
    where: { id: msg.id },
    data: { reactions: updatedReactions }
  });
  
  console.log("After:", updated.reactions);
}
run().catch(console.error).finally(() => prisma.$disconnect());
