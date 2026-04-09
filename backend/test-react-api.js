const prisma = require('@prisma/client');
async function run() {
  const db = new prisma.PrismaClient();
  const user = await db.user.findFirst();
  const group = await db.cohortGroup.findFirst();
  const msg = await db.message.findFirst({where: { groupId: group.id }});
  if (!user || !group || !msg) return console.log("Missing data");
  
  const jwt = require('./src/utils/jwt');
  const token = jwt.generateTokens({
    sub: user.id,
    email: user.email,
    displayName: user.displayName,
    globalRing: user.globalRing,
  }).accessToken;
  
  try {
    const res = await fetch(`http://localhost:5000/api/v1/groups/${group.id}/messages/${msg.id}/react`, {
      method: 'PATCH',
      headers: {
         'Content-Type': 'application/json',
         Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ emoji: '❤️' })
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Response:", data);
  } catch (err) {
    console.log("Error:", err.message);
  }
  await db.$disconnect();
}
run();
