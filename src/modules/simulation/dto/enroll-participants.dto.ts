// src/simulation/dto/enroll-participants.dto.ts
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsArray,
  IsMongoId,
  IsEnum,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum EnrollmentRole {
  TEAM_MEMBER = 'TEAM_MEMBER',
  TEAM_LEAD = 'TEAM_LEAD',
  OBSERVER = 'OBSERVER',
}

export class ParticipantEnrollmentDto {
  @ApiProperty({ description: 'Participant user ID' })
  @IsMongoId()
  participantId: string;

  @ApiPropertyOptional({ enum: EnrollmentRole, default: EnrollmentRole.TEAM_MEMBER })
  @IsOptional()
  @IsEnum(EnrollmentRole)
  role?: EnrollmentRole;
}

export class EnrollParticipantsDto {
  @ApiProperty({ description: 'Firm ID to enroll participants in' })
  @IsMongoId()
  firmId: string;

  @ApiProperty({ description: 'List of participants to enroll', type: [ParticipantEnrollmentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ParticipantEnrollmentDto)
  participants: ParticipantEnrollmentDto[];

  @ApiPropertyOptional({ description: 'Team name for this group' })
  @IsOptional()
  @IsString()
  teamName?: string;

  @ApiPropertyOptional({ default: true, description: 'Can participants submit decisions' })
  @IsOptional()
  @IsBoolean()
  canSubmitDecisions?: boolean;

  @ApiPropertyOptional({ default: true, description: 'Can participants view reports' })
  @IsOptional()
  @IsBoolean()
  canViewReports?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Can participants view competitor data' })
  @IsOptional()
  @IsBoolean()
  canViewCompetitorData?: boolean;
}

// Bulk enrollment DTO for CSV imports
export class BulkEnrollmentDto {
  @ApiProperty({ description: 'Array of enrollments by firm' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FirmEnrollmentDto)
  enrollments: FirmEnrollmentDto[];
}

export class FirmEnrollmentDto {
  @ApiProperty({ description: 'Firm number (1-6)' })
  @IsInt()
  @Min(1)
  @Max(6)
  firmNumber: number;

  @ApiPropertyOptional({ description: 'Team name' })
  @IsOptional()
  @IsString()
  teamName?: string;

  @ApiProperty({ description: 'Participant emails to enroll' })
  @IsArray()
  @IsString({ each: true })
  participantEmails: string[];
}

// Response DTOs
export class EnrollmentResponseDto {
  id: string;
  simulation: string;
  firm: {
    id: string;
    firmNumber: number;
    name: string;
  };
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  firmNumber: number;
  status: string;
  role: string;
  teamName?: string;
  canSubmitDecisions: boolean;
  canViewReports: boolean;
  canViewCompetitorData: boolean;
  decisionsSubmitted: number;
  createdAt: Date;
  updatedAt: Date;
}

export class FirmWithEnrollmentsDto {
  id: string;
  firmNumber: number;
  name: string;
  color: string;
  currentCash: number;
  currentCsi: number;
  currentMarketShare: number;
  techOwned: string[];
  enrollments: EnrollmentResponseDto[];
  memberCount: number;
}