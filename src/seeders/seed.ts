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
  studentId?: string;
  organization?: string;
  role: UserRole;
}

const seedUsers: SeedUser[] = [
  // Admin users
  {
    email: 'admin@flexee.com',
    password: 'Admin@123456',
    firstName: 'Admin',
    lastName: 'User',
    displayName: 'Admin User',
    role: UserRole.ADMIN,
    organization: 'Flexee',
  },
  {
    email: 'admin2@flexee.com',
    password: 'Admin@123456',
    firstName: 'Admin',
    lastName: 'User 2',
    displayName: 'Admin User 2',
    role: UserRole.ADMIN,
    organization: 'Flexee',
  },

  // Faculty users
  {
    email: 'faculty1@flexee.com',
    password: 'Faculty@123456',
    firstName: 'John',
    lastName: 'Smith',
    displayName: 'Dr. John Smith',
    role: UserRole.FACULTY,
    organization: 'MIT',
  },
  {
    email: 'faculty2@flexee.com',
    password: 'Faculty@123456',
    firstName: 'Sarah',
    lastName: 'Johnson',
    displayName: 'Dr. Sarah Johnson',
    role: UserRole.FACULTY,
    organization: 'Stanford',
  },
  {
    email: 'faculty3@flexee.com',
    password: 'Faculty@123456',
    firstName: 'Michael',
    lastName: 'Brown',
    displayName: 'Prof. Michael Brown',
    role: UserRole.FACULTY,
    organization: 'Harvard',
  },

  // Student users
  {
    email: 'student1@flexee.com',
    password: 'Student@123456',
    firstName: 'Alice',
    lastName: 'Johnson',
    studentId: 'STU001',
    role: UserRole.STUDENT,
    organization: 'MIT',
  },
  {
    email: 'student2@flexee.com',
    password: 'Student@123456',
    firstName: 'Bob',
    lastName: 'Smith',
    studentId: 'STU002',
    role: UserRole.STUDENT,
    organization: 'MIT',
  },
  {
    email: 'student3@flexee.com',
    password: 'Student@123456',
    firstName: 'Charlie',
    lastName: 'Davis',
    studentId: 'STU003',
    role: UserRole.STUDENT,
    organization: 'Stanford',
  },
  {
    email: 'student4@flexee.com',
    password: 'Student@123456',
    firstName: 'Diana',
    lastName: 'Williams',
    studentId: 'STU004',
    role: UserRole.STUDENT,
    organization: 'Stanford',
  },
  {
    email: 'student5@flexee.com',
    password: 'Student@123456',
    firstName: 'Eve',
    lastName: 'Martinez',
    studentId: 'STU005',
    role: UserRole.STUDENT,
    organization: 'Harvard',
  },
  {
    email: 'student6@flexee.com',
    password: 'Student@123456',
    firstName: 'Frank',
    lastName: 'Wilson',
    studentId: 'STU006',
    role: UserRole.STUDENT,
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
            studentId: seedUser.studentId || undefined,
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