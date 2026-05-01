/**
 * Run once to create your first admin account:
 *   node scripts/seedAdmin.js
 */
require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const User = require('../models/User');

const ADMIN = {
  name: process.env.SEED_ADMIN_NAME || 'Platform Admin',
  email: process.env.SEED_ADMIN_EMAIL || 'admin@yourplatform.com',
  password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123456',
};

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const existing = await User.findOne({ email: ADMIN.email });
  if (existing) {
    console.log(`Admin already exists: ${ADMIN.email}`);
    await mongoose.disconnect();
    return;
  }

  await User.create({ ...ADMIN, role: 'admin' });
  console.log(`✅ Admin created: ${ADMIN.email}`);
  console.log(`   Password: ${ADMIN.password}`);
  console.log(`   ⚠️  Change this password immediately after first login!`);
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
