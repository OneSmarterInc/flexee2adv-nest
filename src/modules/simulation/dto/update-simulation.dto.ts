// src/simulation/dto/update-simulation.dto.ts
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsNumber,
  IsEnum,
  IsArray,
  IsMongoId,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SeasonalityConfigDto, FeatureTogglesDto } from './create-simulation.dto';

export enum SimulationStatus {
  CREATED = 'CREATED',
  INITIALIZED = 'INITIALIZED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED',
}

export class UpdateSimulationDto {
  @ApiPropertyOptional({ description: 'Simulation name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Simulation description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: SimulationStatus, description: 'Simulation status' })
  @IsOptional()
  @IsEnum(SimulationStatus)
  status?: SimulationStatus;

  @ApiPropertyOptional({ description: 'Current quarter number' })
  @IsOptional()
  @IsInt()
  @Min(0)
  currentQuarter?: number;

  @ApiPropertyOptional({ description: 'Maximum quarters' })
  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(20)
  maxQuarters?: number;

  @ApiPropertyOptional({ description: 'Course code' })
  @IsOptional()
  @IsString()
  courseCode?: string;

  @ApiPropertyOptional({ description: 'Institution name' })
  @IsOptional()
  @IsString()
  institutionName?: string;

  @ApiPropertyOptional({ description: 'Feature toggles' })
  @IsOptional()
  @ValidateNested()
  @Type(() => FeatureTogglesDto)
  features?: FeatureTogglesDto;

  @ApiPropertyOptional({ description: 'Seasonality configuration' })
  @IsOptional()
  @ValidateNested()
  @Type(() => SeasonalityConfigDto)
  seasonality?: SeasonalityConfigDto;

  @ApiPropertyOptional({ description: 'Event probability' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.5)
  eventProbability?: number;

  @ApiPropertyOptional({ description: 'Demand variability' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.2)
  demandVariability?: number;

  @ApiPropertyOptional({ description: 'Facilitator IDs to assign' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  facilitatorIds?: string[];

  @ApiPropertyOptional({ description: 'Is simulation archived' })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}