import mongoose from 'mongoose';
import { config } from '../src/config.js';
import { User } from '../src/models.js';

async function run() {
  try {
    await mongoose.connect(config.mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to', config.mongoUri);

    const targetEmail = 'tuancreations.africa@gmail.com';

    // Prefer an existing admin; otherwise pick the first user record
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      admin = await User.findOne({}) ;
    }

    if (!admin) {
      console.error('No user records found to update.');
      process.exit(2);
    }

    admin.email = targetEmail;
    await admin.save();

    console.log('Updated admin user:', { id: admin._id.toString(), email: admin.email });
    process.exit(0);
  } catch (err) {
    console.error('Error updating admin email:', err);
    process.exit(1);
  }
}

run();
