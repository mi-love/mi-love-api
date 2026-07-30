/**
 * Seed default admin login credentials.
 * Email: admin@milove.com
 * Password: adminMiLove
 *
 * Usage: node scripts/seed-admin.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

const ADMIN = {
  email: 'admin@milove.com',
  password: 'adminMilove',
  username: 'admin_milove',
  first_name: 'Admin',
  last_name: 'MiLove',
  country: 'NG',
};

async function seedAdmin() {
  console.log('Seeding admin user...');

  const hashedPassword = await bcrypt.hash(ADMIN.password, 10);
  const existing = await db.user.findUnique({
    where: { email: ADMIN.email },
  });

  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: {
        password: hashedPassword,
        is_admin: true,
        admin_role: 'super_admin',
        account_status: 'active',
        is_deleted: false,
        auth_provider: 'local',
      },
    });
    console.log(`Updated existing admin: ${ADMIN.email}`);
  } else {
    const usernameTaken = await db.user.findUnique({
      where: { username: ADMIN.username },
    });
    const username = usernameTaken
      ? `admin_milove_${Date.now().toString(36)}`
      : ADMIN.username;

    await db.user.create({
      data: {
        email: ADMIN.email,
        password: hashedPassword,
        first_name: ADMIN.first_name,
        last_name: ADMIN.last_name,
        username,
        country: ADMIN.country,
        auth_provider: 'local',
        is_admin: true,
        admin_role: 'super_admin',
        account_status: 'active',
        wallet: {
          create: { balance: 0 },
        },
      },
    });
    console.log(`Created admin: ${ADMIN.email}`);
  }

  console.log('');
  console.log('Admin login credentials:');
  console.log(`  Email:    ${ADMIN.email}`);
  console.log(`  Password: ${ADMIN.password}`);
  console.log('  Endpoint: POST /admin/auth/login');
}

seedAdmin()
  .then(async () => {
    await db.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Admin seed failed:', error);
    await db.$disconnect();
    process.exit(1);
  });
