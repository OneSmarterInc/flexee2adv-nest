import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
  Response,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../entities/index.entity';
import { OnboardingService } from './onboarding.service';
import {
  InviteParticipantDto,
  BulkInviteDto,
  BulkInviteResponseDto,
  ExcelImportDto,
  ExcelImportResponseDto,
  AcceptInviteDto,
  AcceptInviteResponseDto,
} from './dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Participant Onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  /**
   * Send invite to single participant
   */
  @Post('invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FACILITATOR, UserRole.ADMINISTRATOR)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Invite a single participant to a simulation' })
  @ApiResponse({ status: 201, description: 'Invite sent successfully' })
  async inviteParticipant(
    @Body() dto: InviteParticipantDto,
    @CurrentUser() facilitatorUser: any,
  ) {
    return this.onboardingService.inviteParticipant(dto, facilitatorUser);
  }

  /**
   * Send bulk invites to multiple participants
   */
  @Post('bulk-invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FACILITATOR, UserRole.ADMINISTRATOR)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Send invites to multiple participants' })
  @ApiResponse({
    status: 201,
    description: 'Bulk invites processed',
    type: BulkInviteResponseDto,
  })
  async bulkInviteParticipants(
    @Body() dto: BulkInviteDto,
    @CurrentUser() facilitatorUser: any,
  ): Promise<BulkInviteResponseDto> {
    return this.onboardingService.bulkInviteParticipants(dto, facilitatorUser);
  }

  /**
   * Import participants from Excel file
   */
  @Post('import-excel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FACILITATOR, UserRole.ADMINISTRATOR)
  @UseInterceptors(FileInterceptor('file'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Bulk invite participants from Excel file' })
  @ApiResponse({
    status: 201,
    description: 'Excel file processed',
    type: ExcelImportResponseDto,
  })
  async importFromExcel(
    @UploadedFile() file: any,
    @Body() dto: ExcelImportDto,
    @CurrentUser() facilitatorUser: any,
  ): Promise<ExcelImportResponseDto> {
    if (!file || !file.mimetype.includes('sheet')) {
      throw new BadRequestException(
        'Invalid file format. Please upload an Excel file.',
      );
    }

    return this.onboardingService.importFromExcel(file, dto, facilitatorUser);
  }

  /**
   * Accept invite and create user
   */
  @Post('accept')
  @ApiOperation({ summary: 'Accept invitation to join simulation' })
  @ApiResponse({
    status: 201,
    description: 'Invite accepted, user created/linked',
    type: AcceptInviteResponseDto,
  })
  async acceptInvite(
    @Body() dto: AcceptInviteDto,
  ): Promise<AcceptInviteResponseDto> {
    return this.onboardingService.acceptInvite(dto);
  }

  /**
   * Get invite details (before accepting)
   */
  @Get('invite/:inviteToken')
  @ApiOperation({ summary: 'Get details of an invitation' })
  @ApiResponse({ status: 200, description: 'Invite details' })
  async getInviteDetails(@Param('inviteToken') inviteToken: string) {
    return this.onboardingService.getInviteDetails(inviteToken);
  }

  /**
   * Get all invites for a simulation
   */
  @Get('simulation/:simulationId/invites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FACILITATOR, UserRole.ADMINISTRATOR)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get all participant invites for a simulation' })
  @ApiResponse({ status: 200, description: 'List of invites' })
  async getSimulationInvites(
    @Param('simulationId') simulationId: string,
    @CurrentUser() facilitatorUser: any,
  ) {
    return this.onboardingService.getSimulationInvites(
      simulationId,
      facilitatorUser,
    );
  }

  /**
   * Get all onboarding records for a simulation (all statuses or filtered)
   */
  @Get('simulation/:simulationId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FACILITATOR, UserRole.ADMINISTRATOR)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get all onboarding records for a simulation with optional status filter' })
  @ApiResponse({ status: 200, description: 'List of onboarding records' })
  async getOnboardingRecords(
    @Param('simulationId') simulationId: string,
    @Query('status') status?: string,
    @CurrentUser() facilitatorUser?: any,
  ) {
    return this.onboardingService.getOnboardingRecords(
      simulationId,
      status,
      facilitatorUser,
    );
  }

  /**
   * Resend invite to participant
   */
  @Post('resend/:inviteId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FACILITATOR, UserRole.ADMINISTRATOR)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Resend invitation email to participant' })
  @ApiResponse({ status: 200, description: 'Invite resent successfully' })
  async resendInvite(
    @Param('inviteId') inviteId: string,
    @CurrentUser() facilitatorUser: any,
  ) {
    return this.onboardingService.resendInvite(inviteId, facilitatorUser);
  }

  /**
   * List enrollments waiting on firm assignment for a simulation
   */
  @Get('simulation/:simulationId/pending-assignment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FACILITATOR, UserRole.ADMINISTRATOR)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List participants who accepted but have no firm yet' })
  @ApiResponse({ status: 200, description: 'Pending enrollments' })
  async getPendingFirmAssignment(
    @Param('simulationId') simulationId: string,
  ) {
    return this.onboardingService.listPendingFirmAssignment(simulationId);
  }

  /**
   * Assign a firm to a pending enrollment
   */
  @Post('enrollment/:enrollmentId/assign-firm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FACILITATOR, UserRole.ADMINISTRATOR)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Assign a firm to a pending enrollment' })
  @ApiResponse({ status: 200, description: 'Firm assigned, enrollment activated' })
  async assignFirm(
    @Param('enrollmentId') enrollmentId: string,
    @Body() body: { firmNumber: number },
    @CurrentUser() facilitatorUser: any,
  ) {
    return this.onboardingService.assignFirmToEnrollment(
      enrollmentId,
      body.firmNumber,
      facilitatorUser,
    );
  }

  /**
   * Download Excel template for bulk import
   */
  @Get('download-template')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FACILITATOR, UserRole.ADMINISTRATOR)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Download sample Excel template for bulk participant import',
  })
  @ApiResponse({
    status: 200,
    description: 'Excel template file',
  })
  async downloadTemplate(@Response() res: any) {
    const buffer = this.onboardingService.generateExcelTemplate();

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="participant-invites-template.xlsx"',
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
