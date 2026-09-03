import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import {
  ParticipantOnboarding,
  ParticipantOnboardingSchema,
  Simulation,
  SimulationSchema,
  User,
  UserSchema,
  Enrollment,
  EnrollmentSchema,
  Firm,
  FirmSchema,
} from '../../entities/index.entity';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: ParticipantOnboarding.name, schema: ParticipantOnboardingSchema },
      { name: Simulation.name, schema: SimulationSchema },
      { name: User.name, schema: UserSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: Firm.name, schema: FirmSchema },
    ]),
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
