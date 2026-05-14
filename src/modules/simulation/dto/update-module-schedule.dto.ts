// ============================================================================
// FILE: src/modules/simulation/dto/update-module-schedule.dto.ts
// ============================================================================
// Used by PATCH /simulations/:id/module-schedule. Supports the rich shape:
//   { mode?: 'PROGRESSIVE' | 'ALL_OPEN' | 'CUSTOM', modules?: [...] }
// All fields optional for partial updates.
// ============================================================================

import {
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsInt,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ModuleConfigUpdateDto {
  @ApiPropertyOptional({ description: 'Module ID (e.g., "vmi", "regionalDCs")' })
  @IsOptional()
  @IsString()
  moduleId?: string;

  @ApiPropertyOptional({
    description: 'Quarter at which this module unlocks',
    minimum: 0,
    maximum: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  unlocksAtQuarter?: number;

  @ApiPropertyOptional({
    description: 'Whether this module is enabled in the schedule',
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateModuleScheduleDto {
  @ApiPropertyOptional({
    description:
      'Schedule mode: PROGRESSIVE (unlock by quarter), ALL_OPEN (all active), CUSTOM (explicit list)',
    enum: ['PROGRESSIVE', 'ALL_OPEN', 'CUSTOM'],
  })
  @IsOptional()
  @IsString()
  mode?: string;

  @ApiPropertyOptional({
    description: 'List of module configurations to update',
    type: [ModuleConfigUpdateDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModuleConfigUpdateDto)
  modules?: ModuleConfigUpdateDto[];
}