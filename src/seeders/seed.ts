import { connect } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { User, UserSchema, UserRole } from '../entities/index.entity';

dotenv.config();

interface SeedUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  participantId?: string;
  organization?: string;
  role: UserRole;
}

const seedUsers: SeedUser[] = [
  // Admin users
  {
    email: 'administrator@flexee.com',
    password: 'Administrator@123456',
    firstName: 'Admin',
    lastName: 'User',
    displayName: 'Admin User',
    role: UserRole.ADMINISTRATOR,
    organization: 'Flexee',
  },
  {
    email: 'administrator2@flexee.com',
    password: 'Administrator@123456',
    firstName: 'Admin',
    lastName: 'User 2',
    displayName: 'Admin User 2',
    role: UserRole.ADMINISTRATOR,
    organization: 'Flexee',
  },

  // Facilitator users
  {
    email: 'facilitator1@flexee.com',
    password: 'Facilitator@123456',
    firstName: 'John',
    lastName: 'Smith',
    displayName: 'Dr. John Smith',
    role: UserRole.FACILITATOR,
    organization: 'MIT',
  },
  {
    email: 'facilitator2@flexee.com',
    password: 'Facilitator@123456',
    firstName: 'Sarah',
    lastName: 'Johnson',
    displayName: 'Dr. Sarah Johnson',
    role: UserRole.FACILITATOR,
    organization: 'Stanford',
  },
  {
    email: 'facilitator3@flexee.com',
    password: 'Facilitator@123456',
    firstName: 'Michael',
    lastName: 'Brown',
    displayName: 'Prof. Michael Brown',
    role: UserRole.FACILITATOR,
    organization: 'Harvard',
  },

  // Participant users
  {
    email: 'participant1@flexee.com',
    password: 'Participant@123456',
    firstName: 'Alice',
    lastName: 'Johnson',
    participantId: 'STU001',
    role: UserRole.PARTICIPANT,
    organization: 'MIT',
  },
  {
    email: 'participant2@flexee.com',
    password: 'Participant@123456',
    firstName: 'Bob',
    lastName: 'Smith',
    participantId: 'STU002',
    role: UserRole.PARTICIPANT,
    organization: 'MIT',
  },
  {
    email: 'participant3@flexee.com',
    password: 'Participant@123456',
    firstName: 'Charlie',
    lastName: 'Davis',
    participantId: 'STU003',
    role: UserRole.PARTICIPANT,
    organization: 'Stanford',
  },
  {
    email: 'participant4@flexee.com',
    password: 'Participant@123456',
    firstName: 'Diana',
    lastName: 'Williams',
    participantId: 'STU004',
    role: UserRole.PARTICIPANT,
    organization: 'Stanford',
  },
  {
    email: 'participant5@flexee.com',
    password: 'Participant@123456',
    firstName: 'Eve',
    lastName: 'Martinez',
    participantId: 'STU005',
    role: UserRole.PARTICIPANT,
    organization: 'Harvard',
  },
  {
    email: 'participant6@flexee.com',
    password: 'Participant@123456',
    firstName: 'Frank',
    lastName: 'Wilson',
    participantId: 'STU006',
    role: UserRole.PARTICIPANT,
    organization: 'Harvard',
  },
];

async function runSeeder() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/flexee';

  try {
    console.log(`🔌 Connecting to MongoDB: ${mongoUri}`);
    const connection = await connect(mongoUri);
    const UserModel = connection.model(User.name, UserSchema);

    const command = process.argv[2];

    if (command === 'clear') {
      console.log('🗑️  Clearing all users...');
      const result = await UserModel.deleteMany({});
      console.log(`✅ Cleared ${result.deletedCount} users`);
    } else {
      console.log('🌱 Seeding database...');

      let createdCount = 0;
      let skippedCount = 0;

      for (const seedUser of seedUsers) {
        try {
          const existingUser = await UserModel.findOne({ 
            email: seedUser.email.toLowerCase() 
          });
          
          if (existingUser) {
            console.log(`⏭️  User ${seedUser.email} already exists, skipping...`);
            skippedCount++;
            continue;
          }

          const hashedPassword = await bcrypt.hash(seedUser.password, 10);

          const userData = {
            email: seedUser.email.toLowerCase(),
            firstName: seedUser.firstName,
            lastName: seedUser.lastName,
            displayName: seedUser.displayName || `${seedUser.firstName} ${seedUser.lastName}`,
            passwordHash: hashedPassword,
            role: seedUser.role,
            participantId: seedUser.participantId || undefined,
            organization: seedUser.organization || undefined,
            isActive: true,
          };

          const user = new UserModel(userData);
          await user.save();
          
          console.log(`✅ Created ${seedUser.role}: ${seedUser.email}`);
          createdCount++;
        } catch (error) {
          console.error(`❌ Failed to create user ${seedUser.email}:`, error.message);
          throw error;
        }
      }

      console.log(`\n📊 Summary: ${createdCount} users created, ${skippedCount} skipped`);
    }

    console.log('✨ Seeding completed!');
    await connection.disconnect();
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

runSeeder();