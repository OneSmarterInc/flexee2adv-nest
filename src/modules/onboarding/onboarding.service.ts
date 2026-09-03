// src/modules/onboarding/onboarding.service.ts
//
// CHANGES vs your working version:
//   1. EnrollmentStatus.PENDING (doesn't exist in your enum) replaced with
//      EnrollmentStatus.PENDING_FIRM_ASSIGNMENT. This was the silent bug —
//      the enum value evaluated to `undefined` and either fell back to the
//      schema default or threw a validation error, leaving accepted invites
//      with no enrollment record.
//   2. Enrollment creation moved BEFORE the invite is marked accepted. If
//      enrollment creation fails, the invite stays PENDING so the participant
//      and facilitator can retry instead of being stuck in a "accepted but no
//      team" limbo.
//   3. Added console.log lines around the enrollment write so you can see
//      in the Nest dev console exactly what happened on each accept.
//   4. Honour pre-assigned firms from the invite (invite.firm / invite.firmNumber).
//      If facilitator assigned a firm at invite time, enrollment becomes ACTIVE
//      with that firm attached. Otherwise PENDING_FIRM_ASSIGNMENT with null firm.

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as XLSX from 'xlsx';
import { randomUUID } from 'crypto';
import {
  ParticipantOnboarding,
  ParticipantOnboardingDocument,
  InviteStatus,
  Simulation,
  SimulationDocument,
  User,
  UserDocument,
  UserRole,
  Enrollment,
  EnrollmentDocument,
  EnrollmentStatus,
  EnrollmentRole,
  Firm,
  FirmDocument,
} from '../../entities/index.entity';
import {
  InviteParticipantDto,
  BulkInviteDto,
  BulkInviteResponseDto,
  ExcelImportDto,
  ExcelImportResponseDto,
  AcceptInviteDto,
  AcceptInviteResponseDto,
} from './dto';
import { sendParticipantInviteEmail } from '../../utils/email.util';

@Injectable()
export class OnboardingService {
  constructor(
    @InjectModel(ParticipantOnboarding.name)
    private participantOnboardingModel: Model<ParticipantOnboardingDocument>,
    @InjectModel(Simulation.name)
    private simulationModel: Model<SimulationDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(Enrollment.name)
    private enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(Firm.name)
    private firmModel: Model<FirmDocument>,
  ) {}

  /**
   * Send single invite to a participant
   */
  async inviteParticipant(
    dto: InviteParticipantDto,
    facilitatorUser: any,
  ): Promise<any> {
    const simulation = await this.simulationModel.findById(dto.simulationId);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }

    const email = dto.email.toLowerCase();

    const existing = await this.participantOnboardingModel.findOne({
      simulation: dto.simulationId,
      email,
    });

    if (existing) {
      if (existing.status === InviteStatus.ACCEPTED) {
        throw new ConflictException(
          'Participant is already enrolled in this simulation',
        );
      }

      if (existing.status === InviteStatus.PENDING) {
        return {
          id: existing._id,
          email: existing.email,
          status: existing.status,
          inviteToken: existing.inviteToken,
          expiresAt: existing.expiresAt,
          message: 'Invite already sent to this participant',
        };
      }

      const inviteToken = this.generateInviteToken();
      const updatedInvite = await this.participantOnboardingModel.findByIdAndUpdate(
        existing._id,
        {
          inviteToken,
          status: InviteStatus.PENDING,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          inviteMessage: dto.inviteMessage,
        },
        { new: true },
      );

      if (!updatedInvite) {
        throw new NotFoundException('Failed to update invite');
      }

      await this.sendInviteEmail(
        email,
        inviteToken,
        simulation,
        dto.inviteMessage,
      );

      await updatedInvite.updateOne({
        sentEmailNotification: true,
        emailSentAt: new Date(),
      });

      return {
        id: updatedInvite._id,
        email: updatedInvite.email,
        status: updatedInvite.status,
        inviteToken: updatedInvite.inviteToken,
        expiresAt: updatedInvite.expiresAt,
        message: 'New invite generated and sent',
      };
    }

    const inviteToken = this.generateInviteToken();

    const invite = await this.participantOnboardingModel.create({
      simulation: dto.simulationId,
      email,
      inviteToken,
      status: InviteStatus.PENDING,
      invitedBy: facilitatorUser._id,
      inviteMessage: dto.inviteMessage,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    await this.sendInviteEmail(email, inviteToken, simulation, dto.inviteMessage);

    await invite.updateOne({
      sentEmailNotification: true,
      emailSentAt: new Date(),
    });

    return {
      id: invite._id,
      email: invite.email,
      status: invite.status,
      inviteToken: invite.inviteToken,
      expiresAt: invite.expiresAt,
      message: 'Invite sent successfully',
    };
  }

  /**
   * Send bulk invites to multiple participants
   */
  async bulkInviteParticipants(
    dto: BulkInviteDto,
    facilitatorUser: any,
  ): Promise<BulkInviteResponseDto> {
    const simulation = await this.simulationModel.findById(dto.simulationId);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }

    const successful: any[] = [];
    const failed: any[] = [];

    for (const email of dto.emails) {
      const normalizedEmail = email.toLowerCase();

      try {
        const existing = await this.participantOnboardingModel.findOne({
          simulation: dto.simulationId,
          email: normalizedEmail,
        });

        if (existing) {
          if (existing.status === InviteStatus.ACCEPTED) {
            failed.push({
              email: normalizedEmail,
              reason: 'Already enrolled in this simulation',
            });
            continue;
          }

          if (existing.status === InviteStatus.PENDING) {
            failed.push({
              email: normalizedEmail,
              reason: 'Invite already sent (pending)',
            });
            continue;
          }

          const inviteToken = this.generateInviteToken();
          const updatedInvite =
            await this.participantOnboardingModel.findByIdAndUpdate(
              existing._id,
              {
                inviteToken,
                status: InviteStatus.PENDING,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                inviteMessage: dto.inviteMessage,
              },
              { new: true },
            );

          if (!updatedInvite) {
            throw new Error('Failed to update invite');
          }

          await this.sendInviteEmail(
            normalizedEmail,
            inviteToken,
            simulation,
            dto.inviteMessage,
          );

          await updatedInvite.updateOne({
            sentEmailNotification: true,
            emailSentAt: new Date(),
          });

          successful.push({
            id: updatedInvite._id,
            email: normalizedEmail,
            status: updatedInvite.status,
            inviteToken: updatedInvite.inviteToken,
            expiresAt: updatedInvite.expiresAt,
            message: 'New invite regenerated and sent',
          });
          continue;
        }

        const inviteToken = this.generateInviteToken();

        const invite = await this.participantOnboardingModel.create({
          simulation: dto.simulationId,
          email: normalizedEmail,
          inviteToken,
          status: InviteStatus.PENDING,
          invitedBy: facilitatorUser._id,
          inviteMessage: dto.inviteMessage,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });

        await this.sendInviteEmail(
          normalizedEmail,
          inviteToken,
          simulation,
          dto.inviteMessage,
        );

        await invite.updateOne({
          sentEmailNotification: true,
          emailSentAt: new Date(),
        });

        successful.push({
          id: invite._id,
          email: normalizedEmail,
          status: invite.status,
          inviteToken: invite.inviteToken,
          expiresAt: invite.expiresAt,
          message: 'Invite sent successfully',
        });
      } catch (error: any) {
        failed.push({
          email: normalizedEmail,
          reason: error.message || 'Failed to send invite',
        });
      }
    }

    return {
      successful,
      failed,
      summary: {
        total: dto.emails.length,
        successCount: successful.length,
        failureCount: failed.length,
      },
    };
  }

  /**
   * Process Excel file for bulk participant invites
   */
  async importFromExcel(
    file: any,
    dto: ExcelImportDto,
    facilitatorUser: any,
  ): Promise<ExcelImportResponseDto> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const simulation = await this.simulationModel.findById(dto.simulationId);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }

    const workbook = XLSX.read(file.buffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      throw new BadRequestException('Excel file is empty');
    }

    const bulkImportId = randomUUID();
    const successful: any[] = [];
    const failed: any[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i] as any;
      const rowNumber = i + 2;

      try {
        let email = row.email || row.Email || row.EMAIL || row.participantEmail;

        if (!email) {
          throw new Error('Email column not found in Excel row');
        }

        email = email.toString().toLowerCase().trim();

        if (!this.isValidEmail(email)) {
          throw new Error('Invalid email format');
        }

        const existing = await this.participantOnboardingModel.findOne({
          simulation: dto.simulationId,
          email,
        });

        if (existing) {
          if (existing.status === InviteStatus.ACCEPTED) {
            failed.push({
              rowNumber,
              email,
              reason: 'Already enrolled in this simulation',
            });
            continue;
          }

          if (existing.status === InviteStatus.PENDING) {
            failed.push({
              rowNumber,
              email,
              reason: 'Invite already pending',
            });
            continue;
          }

          const inviteToken = this.generateInviteToken();
          const updatedInvite =
            await this.participantOnboardingModel.findByIdAndUpdate(
              existing._id,
              {
                inviteToken,
                status: InviteStatus.PENDING,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                inviteMessage: dto.inviteMessage,
                bulkImportId,
                rowNumber,
              },
              { new: true },
            );

          if (!updatedInvite) {
            throw new Error('Failed to update invite');
          }

          await this.sendInviteEmail(
            email,
            inviteToken,
            simulation,
            dto.inviteMessage,
          );

          await updatedInvite.updateOne({
            sentEmailNotification: true,
            emailSentAt: new Date(),
          });

          successful.push({
            rowNumber,
            email,
            status: updatedInvite.status,
          });
          continue;
        }

        const inviteToken = this.generateInviteToken();

        const invite = await this.participantOnboardingModel.create({
          simulation: dto.simulationId,
          email,
          inviteToken,
          status: InviteStatus.PENDING,
          invitedBy: facilitatorUser._id,
          inviteMessage: dto.inviteMessage,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          bulkImportId,
          rowNumber,
        });

        await this.sendInviteEmail(
          email,
          inviteToken,
          simulation,
          dto.inviteMessage,
        );

        await invite.updateOne({
          sentEmailNotification: true,
          emailSentAt: new Date(),
        });

        successful.push({
          rowNumber,
          email,
          status: invite.status,
        });
      } catch (error: any) {
        failed.push({
          rowNumber,
          email: (row as any)?.email || (row as any)?.Email || 'unknown',
          reason: error.message,
        });
      }
    }

    return {
      bulkImportId,
      totalRowsProcessed: data.length,
      successful,
      failed,
      summary: {
        total: data.length,
        successCount: successful.length,
        failureCount: failed.length,
      },
    };
  }

  /**
   * Accept invite and create user / enrollment.
   *
   * Order is deliberate: User → Enrollment → mark invite ACCEPTED.
   * If enrollment fails, the invite stays PENDING so the flow can be retried
   * instead of leaving a half-accepted state.
   */
  async acceptInvite(
    dto: AcceptInviteDto,
  ): Promise<AcceptInviteResponseDto> {
    console.log(`[acceptInvite] start token=${dto.inviteToken?.slice(0, 12)}...`);

    // ─── 1. Find a valid invite ───────────────────────────────────────────
    const invite = await this.participantOnboardingModel.findOne({
      inviteToken: dto.inviteToken,
      status: InviteStatus.PENDING,
      expiresAt: { $gt: new Date() },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found, expired, or already used');
    }

    console.log(
      `[acceptInvite] invite found: email=${invite.email}, ` +
      `sim=${invite.simulation}, firm=${invite.firm ?? 'null'}`,
    );

    // ─── 2. Find or create the user ───────────────────────────────────────
    let user = await this.userModel.findOne({ email: invite.email });

    if (!user) {
      if (!dto.password) {
        throw new BadRequestException(
          'Password is required for new participant accounts',
        );
      }

      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(dto.password, 10);

      const firstName = (dto.firstName ?? '').trim();
      const lastName = (dto.lastName ?? '').trim();
      const fullName = `${firstName} ${lastName}`.trim();
      const displayName = fullName || invite.email;

      user = await this.userModel.create({
        email: invite.email,
        firstName,
        lastName,
        displayName,
        role: UserRole.PARTICIPANT,
        passwordHash,
        isActive: true,
      });
      console.log(`[acceptInvite] created user ${user._id} for ${invite.email}`);
    } else {
      console.log(`[acceptInvite] linked existing user ${user._id} for ${invite.email}`);
    }

    // ─── 3. Resolve firm context (honour pre-assigned firm if any) ────────
    let firmId: Types.ObjectId | null = invite.firm ?? null;
    let firmNumber: number | null = invite.firmNumber ?? null;

    if (firmId) {
      const firmDoc = await this.firmModel.findById(firmId);
      if (firmDoc) {
        firmNumber = firmDoc.firmNumber;
      } else {
        // Stale firm pointer — fall back to unplaced rather than failing
        console.warn(
          `[acceptInvite] invite.firm ${firmId} not found, falling back to unplaced`,
        );
        firmId = null;
        firmNumber = null;
      }
    }

    const enrollmentStatus = firmId
      ? EnrollmentStatus.ACTIVE
      : EnrollmentStatus.PENDING_FIRM_ASSIGNMENT;

    // ─── 4. Create or fetch enrollment ────────────────────────────────────
    // Done BEFORE marking the invite accepted, so a failure here leaves
    // the invite in PENDING for a clean retry.
    let enrollment = await this.enrollmentModel.findOne({
      simulation: invite.simulation,
      user: user._id,
    });

    if (!enrollment) {
      try {
        enrollment = await this.enrollmentModel.create({
          simulation: new Types.ObjectId(String(invite.simulation)),
          user: user._id,
          firm: firmId,
          firmNumber,
          status: enrollmentStatus,                  // ← FIXED: was PENDING (doesn't exist)
          role: EnrollmentRole.TEAM_MEMBER,
          canSubmitDecisions: !!firmId,
          canViewReports: true,
          canViewCompetitorData: false,
        });
        console.log(
          `[acceptInvite] created enrollment ${enrollment._id} ` +
          `(status=${enrollmentStatus}, firm=${firmId ?? 'null'})`,
        );
      } catch (err: any) {
        // E11000 = duplicate key on the {simulation, user} unique index.
        // Re-fetch instead of failing (likely double-submit).
        if (err.code === 11000) {
          enrollment = await this.enrollmentModel.findOne({
            simulation: invite.simulation,
            user: user._id,
          });
          if (!enrollment) {
            throw new InternalServerErrorException(
              'Enrollment race condition — could not create or find record',
            );
          }
          console.warn(
            `[acceptInvite] dup key — using existing enrollment ${enrollment._id}`,
          );
        } else {
          console.error('[acceptInvite] enrollment creation failed:', err);
          throw new InternalServerErrorException(
            `Failed to create enrollment: ${err.message}`,
          );
        }
      }
    } else {
      console.log(`[acceptInvite] enrollment ${enrollment._id} already exists, reusing`);
    }

    // ─── 5. Mark invite ACCEPTED only after enrollment is confirmed ───────
    await invite.updateOne({
      user: user._id,
      status: InviteStatus.ACCEPTED,
      acceptedAt: new Date(),
    });
    console.log(`[acceptInvite] marked invite ${invite._id} as ACCEPTED`);

    // ─── 6. Build response ────────────────────────────────────────────────
    const simulation = await this.simulationModel.findById(invite.simulation);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }

    return {
      success: true,
      message: firmId
        ? 'Successfully joined simulation and placed in firm.'
        : 'Successfully joined simulation. Awaiting firm assignment from facilitator.',
      simulation: {
        id: (simulation._id as Types.ObjectId).toString(),
        name: simulation.name,
      },
      user: {
        id: (user._id as Types.ObjectId).toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  /**
   * Get invite details by token
   */
  async getInviteDetails(inviteToken: string): Promise<any> {
    const invite = await this.participantOnboardingModel.findOne({
      inviteToken,
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    const simulation = await this.simulationModel.findById(invite.simulation);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }

    const existingUser = await this.userModel.findOne({ email: invite.email });
    const userExists = !!existingUser;

    // Look up firm name if pre-assigned (for the accept-page preview)
    let firmInfo: { name: string; firmNumber: number } | null = null;
    if (invite.firm) {
      const firm = await this.firmModel.findById(invite.firm);
      if (firm) {
        firmInfo = { name: firm.name, firmNumber: firm.firmNumber };
      }
    }

    return {
      email: invite.email,
      status: invite.status,
      simulation: {
        id: (simulation._id as Types.ObjectId).toString(),
        name: simulation.name,
      },
      firm: invite.firm,
      firmNumber: invite.firmNumber,
      firmName: firmInfo?.name ?? null,
      expiresAt: invite.expiresAt,
      isExpired: new Date() > invite.expiresAt,
      userExists,
    };
  }

  /**
   * Get all pending invites for a simulation
   */
  async getSimulationInvites(simulationId: string, facilitatorUser: any): Promise<any[]> {
    const simulation = await this.simulationModel.findById(simulationId);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }

    const invites = await this.participantOnboardingModel
      .find({
        simulation: simulationId,
      })
      .sort({ createdAt: -1 });

    return invites.map((invite: any) => ({
      id: invite._id,
      email: invite.email,
      status: invite.status,
      invitedBy: invite.invitedBy,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
      user: invite.user,
      createdAt: invite.createdAt || new Date(),
    }));
  }

  /**
   * Resend invite email
   */
  async resendInvite(inviteId: string, facilitatorUser: any): Promise<any> {
    const invite = await this.participantOnboardingModel.findById(inviteId);

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException(
        'Cannot resend invite for ' + invite.status + ' invite',
      );
    }

    if (new Date() > invite.expiresAt) {
      invite.inviteToken = this.generateInviteToken();
      invite.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    const simulation = await this.simulationModel.findById(invite.simulation);
    await this.sendInviteEmail(
      invite.email,
      invite.inviteToken,
      simulation,
      invite.inviteMessage,
    );

    await invite.updateOne({
      sentEmailNotification: true,
      emailSentAt: new Date(),
    });

    return {
      success: true,
      message: 'Invite resent successfully',
    };
  }

  /**
   * Generate a sample Excel template for bulk import
   */
  generateExcelTemplate(): Buffer {
    const sampleData = [
      {
        Email: 'participant1@university.edu',
        'First Name': 'John',
        'Last Name': 'Doe',
        Notes: 'Optional notes',
      },
      {
        Email: 'participant2@university.edu',
        'First Name': 'Jane',
        'Last Name': 'Smith',
        Notes: 'Optional notes',
      },
      {
        Email: 'participant3@university.edu',
        'First Name': 'Bob',
        'Last Name': 'Johnson',
        Notes: 'Optional notes',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Participants');

    worksheet['!cols'] = [
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
      { wch: 30 },
    ];

    return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
  }

  /**
   * Get all onboarding records for a simulation (invites + enrollments)
   * Optionally filter by status
   */
  async getOnboardingRecords(
    simulationId: string,
    status?: string,
    facilitatorUser?: any,
  ): Promise<any[]> {
    const simulation = await this.simulationModel.findById(simulationId);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }

    const query: any = { simulation: simulationId };
    if (status) {
      query.status = status;
    }

    const invites = await this.participantOnboardingModel
      .find(query)
      .sort({ createdAt: -1 });

    return invites.map((invite: any) => ({
      id: invite._id,
      email: invite.email,
      status: invite.status,
      invitedBy: invite.invitedBy,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
      user: invite.user,
      firm: invite.firm,
      firmNumber: invite.firmNumber,
      createdAt: invite.createdAt || new Date(),
    }));
  }

  /**
   * List enrollments that are waiting for firm assignment
   * (status = PENDING_FIRM_ASSIGNMENT)
   */
  async listPendingFirmAssignment(simulationId: string): Promise<any[]> {
    const simulation = await this.simulationModel.findById(simulationId);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }

    const pendingEnrollments = await this.enrollmentModel
      .find({
        simulation: simulationId,
        status: EnrollmentStatus.PENDING_FIRM_ASSIGNMENT,
      })
      .populate('user', 'email firstName lastName displayName')
      .sort({ createdAt: 1 });

    return pendingEnrollments.map((enrollment: any) => ({
      id: enrollment._id,
      user: {
        id: enrollment.user?._id,
        email: enrollment.user?.email,
        firstName: enrollment.user?.firstName,
        lastName: enrollment.user?.lastName,
        displayName: enrollment.user?.displayName,
      },
      status: enrollment.status,
      firm: enrollment.firm,
      firmNumber: enrollment.firmNumber,
      createdAt: enrollment.createdAt || new Date(),
    }));
  }

  /**
   * Assign a firm to a pending enrollment
   * Updates enrollment status to ACTIVE once firm is assigned
   */
  async assignFirmToEnrollment(
    enrollmentId: string,
    firmNumber: number,
    facilitatorUser: any,
  ): Promise<any> {
    const enrollment = await this.enrollmentModel.findById(enrollmentId);
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    if (enrollment.status !== EnrollmentStatus.PENDING_FIRM_ASSIGNMENT) {
      throw new BadRequestException(
        `Enrollment is not in PENDING_FIRM_ASSIGNMENT status (current: ${enrollment.status})`,
      );
    }

    // Look up firm by firmNumber
    const firm = await this.firmModel.findOne({ firmNumber });
    if (!firm) {
      throw new NotFoundException(`Firm with number ${firmNumber} not found`);
    }

    // Update enrollment with firm details
    const updated = await this.enrollmentModel.findByIdAndUpdate(
      enrollmentId,
      {
        firm: firm._id,
        firmNumber: firm.firmNumber,
        status: EnrollmentStatus.ACTIVE,
        canSubmitDecisions: true,
      },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('Failed to update enrollment');
    }

    // Fetch user separately since populate might not work as expected
    const user = await this.userModel.findById(updated.user);

    return {
      id: updated._id,
      user: user ? {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
      } : null,
      firm: updated.firm,
      firmNumber: updated.firmNumber,
      status: updated.status,
      canSubmitDecisions: updated.canSubmitDecisions,
      message: 'Firm assigned successfully, enrollment activated',
    };
  }

  // ============== PRIVATE HELPER METHODS ==============

  private generateInviteToken(): string {
    return randomUUID();
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private async sendInviteEmail(
    email: string,
    inviteToken: string,
    simulation: any,
    customMessage?: string,
  ): Promise<void> {
    const inviteLink = `${process.env.FRONTEND_URL}/onboarding/accept?token=${inviteToken}`;

    try {
      await sendParticipantInviteEmail(
        email,
        simulation.name,
        inviteLink,
        customMessage,
      );
    } catch (error) {
      console.error('Failed to send invite email:', error);
      // Don't throw - invite record still created even if email fails
    }
  }
}