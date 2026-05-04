// src/modules/decision/dto/decision.dto.ts
// DTOs for Decision Cockpit matching GAS exactly
// Includes all standard and advanced module decisions

import {
  IsString,
  IsInt,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsMongoId,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  InspectionLevel,
  ShippingMode,
  WarrantyTier,
  DisposalMethod,
  CarrierMode,
  ExpansionType,
} from '../../../entities/index.entity';

// ============================================================================
// NESTED DTOS
// ============================================================================

export class TechPurchasesDto {
  @IsOptional()
  @IsBoolean()
  erp?: boolean;

  @IsOptional()
  @IsBoolean()
  controlTower?: boolean;

  @IsOptional()
  @IsBoolean()
  aps?: boolean;

  @IsOptional()
  @IsBoolean()
  demandSensing?: boolean;

  @IsOptional()
  @IsBoolean()
  wms?: boolean;

  @IsOptional()
  @IsBoolean()
  tms?: boolean;

  @IsOptional()
  @IsBoolean()
  oms?: boolean;

  @IsOptional()
  @IsBoolean()
  analytics?: boolean;
}

// ============================================================================
// CREATE DECISION DTO - MATCHES GAS EXACTLY
// ============================================================================

export class CreateDecisionDto {
  @IsMongoId()
  simulation: string;

  @IsMongoId()
  firm: string;

  @IsInt()
  @Min(1)
  quarter: number;

  // ==================== DEMAND FORECAST ====================
  @IsInt()
  @Min(0)
  forecastR1: number;

  @IsInt()
  @Min(0)
  forecastR2: number;

  @IsInt()
  @Min(0)
  forecastR3: number;

  @IsOptional()
  @IsEnum(['GUT', 'MODEL'])
  forecastMethod?: string;

  // ==================== SUPPLIER SELECTION (Analytics Mode) ====================
  @IsOptional()
  @IsString()
  primarySupplier?: string; // e.g., "SUP001"

  @IsOptional()
  @IsString()
  secondarySupplier?: string; // "NONE" or "SUP###"

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(100)
  primaryAllocation?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  emergencyRegionalOrder?: number;

  // ==================== PROCUREMENT ====================
  @IsInt()
  @Min(0)
  orderGlobal: number;

  @IsInt()
  @Min(0)
  orderRegional: number;

  // ==================== PRODUCTION ====================
  @IsInt()
  @Min(0)
  productionP1: number;

  @IsInt()
  @Min(0)
  productionP2: number;

  @IsInt()
  @Min(1)
  @Max(3)
  shifts: number;

  // ==================== PRODUCT INNOVATION (P3 - Analytics Mode) ====================
  @IsOptional()
  @IsBoolean()
  launchP3?: boolean;

  @IsOptional()
  @IsEnum(['STANDARD', 'PREMIUM'])
  p3Config?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  p3Price?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  productionP3?: number;

  // ==================== MARKET EXPANSION (R4-R6 - Analytics Mode) ====================
  @IsOptional()
  @IsBoolean()
  enterR4?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  forecastR4?: number;

  @IsOptional()
  @IsBoolean()
  enterR5?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  forecastR5?: number;

  @IsOptional()
  @IsBoolean()
  enterR6?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  forecastR6?: number;

  // ==================== PRICING ====================
  @IsNumber()
  @Min(0)
  priceP1: number;

  @IsNumber()
  @Min(0)
  priceP2: number;

  // ==================== MARKETING ====================
  @IsNumber()
  @Min(0)
  marketingBudget: number;

  // ==================== CUSTOMER SEGMENT ALLOCATION (Analytics Mode) ====================
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  segmentChampions?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  segmentGrowth?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  segmentAtRisk?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  segmentOther?: number;

  // ==================== QUALITY CONTROL ====================
  @IsEnum(InspectionLevel)
  inspectionLevel: InspectionLevel;

  // ==================== LOGISTICS ====================
  @IsEnum(ShippingMode)
  shippingMode: ShippingMode;

  // ==================== TECHNOLOGY PURCHASES ====================
  @IsOptional()
  @IsBoolean()
  purchaseERP?: boolean;

  @IsOptional()
  @IsBoolean()
  purchaseControlTower?: boolean;

  @IsOptional()
  @IsBoolean()
  purchaseAPS?: boolean;

  @IsOptional()
  @IsBoolean()
  purchaseDemandSensing?: boolean;

  @IsOptional()
  @IsBoolean()
  purchaseWMS?: boolean;

  @IsOptional()
  @IsBoolean()
  purchaseTMS?: boolean;

  @IsOptional()
  @IsBoolean()
  purchaseOMS?: boolean;

  @IsOptional()
  @IsBoolean()
  purchaseAnalytics?: boolean;

  // ==================== CAPACITY EXPANSION (Advanced Module) ====================
  @IsOptional()
  @IsBoolean()
  buildSmallLine?: boolean;

  @IsOptional()
  @IsBoolean()
  buildMediumLine?: boolean;

  @IsOptional()
  @IsBoolean()
  buildLargeLine?: boolean;

  // ==================== REGIONAL DCs (Advanced Module) ====================
  @IsOptional()
  @IsEnum(['NO', 'YES', 'CLOSE'])
  dcCentralStatus?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  allocateCentral?: number;

  @IsOptional()
  @IsEnum(['NO', 'YES', 'CLOSE'])
  dcWestStatus?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  allocateWest?: number;

  // ==================== INVENTORY TRANSFERS ====================
  @IsOptional()
  @IsInt()
  @Min(0)
  transferFromCentral?: number;

  @IsOptional()
  @IsEnum(['NONE', 'WEST', 'FACTORY'])
  transferFromCentralTo?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  transferFromWest?: number;

  @IsOptional()
  @IsEnum(['NONE', 'CENTRAL', 'FACTORY'])
  transferFromWestTo?: string;

  // ==================== MULTI-CARRIER SELECTION (Advanced Module) ====================
  @IsOptional()
  @IsEnum(CarrierMode)
  carrier?: CarrierMode;

  // ==================== WARRANTY NETWORK (Advanced Module) ====================
  @IsOptional()
  @IsEnum(WarrantyTier)
  warrantyTier?: WarrantyTier;

  @IsOptional()
  @IsBoolean()
  centralWarrantyNetwork?: boolean;

  @IsOptional()
  @IsBoolean()
  westWarrantyNetwork?: boolean;

  // ==================== GREEN SCORE (Advanced Module) ====================
  @IsOptional()
  @IsEnum(DisposalMethod)
  disposalMethod?: DisposalMethod;

  @IsOptional()
  @IsBoolean()
  ecoPackaging?: boolean;

  // ==================== INTELLIGENCE CENTER (Advanced Module) ====================
  @IsOptional()
  @IsBoolean()
  intelRegionalDemand?: boolean;

  @IsOptional()
  @IsBoolean()
  intelRetailChannel?: boolean;

  @IsOptional()
  @IsBoolean()
  intelCompetitorCapacity?: boolean;

  @IsOptional()
  @IsBoolean()
  intelSupplierRisk?: boolean;

  @IsOptional()
  @IsBoolean()
  intelCustomerSentiment?: boolean;

  // ==================== VMI (Advanced Module) ====================
  @IsOptional()
  @IsBoolean()
  enableVMI?: boolean;
}

// ============================================================================
// UPDATE DECISION DTO
// ============================================================================

export class UpdateDecisionDto {
  // All fields optional for PATCH requests
  @IsOptional()
  @IsInt()
  @Min(0)
  forecastR1?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  forecastR2?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  forecastR3?: number;

  @IsOptional()
  @IsEnum(['GUT', 'MODEL'])
  forecastMethod?: string;

  @IsOptional()
  @IsString()
  primarySupplier?: string;

  @IsOptional()
  @IsString()
  secondarySupplier?: string;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(100)
  primaryAllocation?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  emergencyRegionalOrder?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  orderGlobal?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  orderRegional?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  productionP1?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  productionP2?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  shifts?: number;

  @IsOptional()
  @IsBoolean()
  launchP3?: boolean;

  @IsOptional()
  @IsEnum(['STANDARD', 'PREMIUM'])
  p3Config?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  p3Price?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  productionP3?: number;

  @IsOptional()
  @IsBoolean()
  enterR4?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  forecastR4?: number;

  @IsOptional()
  @IsBoolean()
  enterR5?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  forecastR5?: number;

  @IsOptional()
  @IsBoolean()
  enterR6?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  forecastR6?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceP1?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceP2?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  marketingBudget?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  segmentChampions?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  segmentGrowth?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  segmentAtRisk?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  segmentOther?: number;

  @IsOptional()
  @IsEnum(InspectionLevel)
  inspectionLevel?: InspectionLevel;

  @IsOptional()
  @IsEnum(ShippingMode)
  shippingMode?: ShippingMode;

  @IsOptional()
  @IsBoolean()
  purchaseERP?: boolean;

  @IsOptional()
  @IsBoolean()
  purchaseControlTower?: boolean;

  @IsOptional()
  @IsBoolean()
  purchaseAPS?: boolean;

  @IsOptional()
  @IsBoolean()
  purchaseDemandSensing?: boolean;

  @IsOptional()
  @IsBoolean()
  purchaseWMS?: boolean;

  @IsOptional()
  @IsBoolean()
  purchaseTMS?: boolean;

  @IsOptional()
  @IsBoolean()
  purchaseOMS?: boolean;

  @IsOptional()
  @IsBoolean()
  purchaseAnalytics?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => TechPurchasesDto)
  techPurchases?: TechPurchasesDto;

  @IsOptional()
  @IsBoolean()
  buildSmallLine?: boolean;

  @IsOptional()
  @IsBoolean()
  buildMediumLine?: boolean;

  @IsOptional()
  @IsBoolean()
  buildLargeLine?: boolean;

  @IsOptional()
  @IsEnum(['NO', 'YES', 'CLOSE'])
  dcCentralStatus?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  allocateCentral?: number;

  @IsOptional()
  @IsEnum(['NO', 'YES', 'CLOSE'])
  dcWestStatus?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  allocateWest?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  transferFromCentral?: number;

  @IsOptional()
  @IsEnum(['NONE', 'WEST', 'FACTORY'])
  transferFromCentralTo?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  transferFromWest?: number;

  @IsOptional()
  @IsEnum(['NONE', 'CENTRAL', 'FACTORY'])
  transferFromWestTo?: string;

  @IsOptional()
  @IsEnum(CarrierMode)
  carrier?: CarrierMode;

  @IsOptional()
  @IsEnum(WarrantyTier)
  warrantyTier?: WarrantyTier;

  @IsOptional()
  @IsBoolean()
  centralWarrantyNetwork?: boolean;

  @IsOptional()
  @IsBoolean()
  westWarrantyNetwork?: boolean;

  @IsOptional()
  @IsEnum(DisposalMethod)
  disposalMethod?: DisposalMethod;

  @IsOptional()
  @IsBoolean()
  ecoPackaging?: boolean;

  @IsOptional()
  @IsBoolean()
  intelRegionalDemand?: boolean;

  @IsOptional()
  @IsBoolean()
  intelRetailChannel?: boolean;

  @IsOptional()
  @IsBoolean()
  intelCompetitorCapacity?: boolean;

  @IsOptional()
  @IsBoolean()
  intelSupplierRisk?: boolean;

  @IsOptional()
  @IsBoolean()
  intelCustomerSentiment?: boolean;

  @IsOptional()
  @IsBoolean()
  enableVMI?: boolean;
}

// ============================================================================
// SUBMIT DECISION DTO
// ============================================================================

export class SubmitDecisionDto {
  @IsMongoId()
  decisionId: string;

  @IsOptional()
  @IsMongoId()
  submittedBy?: string;
}

// ============================================================================
// RESPONSE DTOs - UPDATED WITH ALL ADVANCED MODULE FIELDS
// ============================================================================

export class DecisionResponseDto {
  id: string;
  simulation: string;
  firm: string;
  quarter: number;
  status: string;

  // ==================== FORECAST ====================
  forecastR1: number;
  forecastR2: number;
  forecastR3: number;
  forecastR4?: number;
  forecastR5?: number;
  forecastR6?: number;
  forecastMethod?: string;
  totalForecast: number;

  // ==================== PROCUREMENT ====================
  orderGlobal: number;
  orderRegional: number;
  primarySupplier?: string;
  secondarySupplier?: string;
  primaryAllocation?: number;
  emergencyRegionalOrder?: number;
  procurementCost: number;

  // ==================== PRODUCTION ====================
  productionP1: number;
  productionP2: number;
  productionP3?: number;
  shifts: number;
  totalProduction: number;

  // ==================== PRODUCT INNOVATION (P3) ====================
  launchP3?: boolean;
  p3Config?: string;
  p3Price?: number;

  // ==================== MARKET EXPANSION (R4-R6) ====================
  enterR4?: boolean;
  enterR5?: boolean;
  enterR6?: boolean;

  // ==================== PRICING ====================
  priceP1: number;
  priceP2: number;

  // ==================== MARKETING ====================
  marketingBudget: number;

  // ==================== CUSTOMER SEGMENTS ====================
  segmentChampions?: number;
  segmentGrowth?: number;
  segmentAtRisk?: number;
  segmentOther?: number;

  // ==================== OPERATIONS ====================
  inspectionLevel: string;
  shippingMode: string;

  // ==================== MULTI-CARRIER ====================
  carrier?: string;

  // ==================== WARRANTY ====================
  warrantyTier?: string;
  centralWarrantyNetwork?: boolean;
  westWarrantyNetwork?: boolean;

  // ==================== GREEN SCORE ====================
  disposalMethod?: string;
  ecoPackaging?: boolean;

  // ==================== REGIONAL DCs ====================
  dcCentralStatus?: string;
  dcWestStatus?: string;
  allocateCentral?: number;
  allocateWest?: number;

  // ==================== INVENTORY TRANSFERS ====================
  transferFromCentral?: number;
  transferFromCentralTo?: string;
  transferFromWest?: number;
  transferFromWestTo?: string;

  // ==================== CAPACITY EXPANSION ====================
  buildSmallLine?: boolean;
  buildMediumLine?: boolean;
  buildLargeLine?: boolean;

  // ==================== VMI ====================
  enableVMI?: boolean;

  // ==================== INTELLIGENCE CENTER ====================
  intelRegionalDemand?: boolean;
  intelRetailChannel?: boolean;
  intelCompetitorCapacity?: boolean;
  intelSupplierRisk?: boolean;
  intelCustomerSentiment?: boolean;

  // ==================== TECHNOLOGY ====================
  purchaseERP?: boolean;
  purchaseControlTower?: boolean;
  purchaseAPS?: boolean;
  purchaseDemandSensing?: boolean;
  purchaseWMS?: boolean;
  purchaseTMS?: boolean;
  purchaseOMS?: boolean;
  purchaseAnalytics?: boolean;
  techPurchases: any;
  techPurchaseCost: number;

  // ==================== COST ESTIMATES ====================
  estimatedLaborCost: number;
  estimatedQualityCost: number;
  estimatedFreightCost: number;
  totalEstimatedCost: number;

  // ==================== FINANCING ====================
  financeNote?: string;

  // ==================== TIMESTAMPS ====================
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date;
}

export class FirmStateResponseDto {
  id: string;
  firmNumber: number;
  name: string;
  quarter: number;
  cash: number;
  rawMaterials: number;
  finishedGoods: number;
  inTransit: number;
  retailerInventory: number;
  csi: number;
  marketShare: number;
  perfectOrder: number;
  retailerMode: string;
  techOwned: string[];
}