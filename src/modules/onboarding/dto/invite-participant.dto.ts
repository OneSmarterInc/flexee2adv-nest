import {
  IsString,
  IsEmail,
  IsMongoId,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InviteParticipantDto {
  @ApiProperty({ description: 'Simulation ID' })
  @IsMongoId()
  simulationId: string;

  @ApiProperty({ description: 'Participant email address' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'Custom invite message' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  inviteMessage?: string;
}

export class BulkInviteDto {
  @ApiProperty({ description: 'Simulation ID' })
  @IsMongoId()
  simulationId: string;

  @ApiProperty({
    description: 'List of participant email addresses to invite',
    example: ['participant1@example.com', 'participant2@example.com'],
  })
  @IsString({ each: true })
  emails: string[];

  @ApiPropertyOptional({ description: 'Custom invite message for all participants' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  inviteMessage?: string;
}

export class InviteResponseDto {
  id: string;
  email: string;
  status: string;
  inviteToken: string;
  expiresAt: Date;
  message: string;
}

export class BulkInviteResponseDto {
  successful: InviteResponseDto[];
  failed: Array<{
    email: string;
    reason: string;
  }>;
  summary: {
    total: number;
    successCount: number;
    failureCount: number;
  };
}
