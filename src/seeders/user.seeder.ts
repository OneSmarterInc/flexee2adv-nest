import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument, UserRole } from '../entities/index.entity';

export interface SeedUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  participantId?: string;
  organization?: string;
  role: UserRole;
}

@Injectable()
export class UserSeeder {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async seed(): Promise<void> {
    console.log('🌱 Starting user seeding...');
    
    const seedUsers: SeedUser[] = [
      // Administrator users
      {
        email: 'administrator@flexee.com',
        password: 'Administrator@123456',
        firstName: 'Administrator',
        lastName: 'User',
        displayName: 'Administrator User',
        role: UserRole.ADMINISTRATOR,
        organization: 'Flexee',
      },
      {
        email: 'administrator2@flexee.com',
        password: 'Administrator@123456',
        firstName: 'Administrator',
        lastName: 'User 2',
        displayName: 'Administrator User 2',
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

    let createdCount = 0;
    let skippedCount = 0;

    for (const seedUser of seedUsers) {
      try {
        // Check if user already exists
        const existingUser = await this.userModel.findOne({ 
          email: seedUser.email.toLowerCase() 
        });
        
        if (existingUser) {
          console.log(`⏭️  User ${seedUser.email} already exists, skipping...`);
          skippedCount++;
          continue;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(seedUser.password, 10);

        // Create user object with all required fields
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

        // Debug log
        console.log(`📝 Creating user:`, {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
        });

        // Create and save user
        const user = new this.userModel(userData);
        await user.save();
        
        console.log(`✅ Created ${seedUser.role}: ${seedUser.email}`);
        createdCount++;
      } catch (error) {
        console.error(`❌ Failed to create user ${seedUser.email}:`);
        console.error('Error details:', {
          message: error.message,
          errors: error.errors,
        });
        throw error;
      }
    }

    console.log(`\n✨ User seeding completed!`);
    console.log(`📊 Summary: ${createdCount} created, ${skippedCount} skipped`);
  }

  async clear(): Promise<void> {
    try {
      console.log('🗑️  Clearing all users...');
      const result = await this.userModel.deleteMany({});
      console.log(`✅ Cleared ${result.deletedCount} users`);
    } catch (error) {
      console.error('❌ Failed to clear users:', error.message);
      throw error;
    }
  }
}