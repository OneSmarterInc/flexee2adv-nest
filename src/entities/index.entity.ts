// src/schemas/index.ts
// FLEXEE 2.0 Supply Chain Simulation - Mongoose Schemas for MongoDB

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// ============================================================================
// ENUMS
// ============================================================================
export enum SimulationStatus {
  CREATED = 'CREATED',
  INITIALIZED = 'INITIALIZED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED',
}

export enum RetailerMode {
  NORMAL = 'NORMAL',
  PANIC = 'PANIC',
  CLEARANCE = 'CLEARANCE',
}

export enum InspectionLevel {
  NONE = 'NONE',
  BASIC = 'BASIC',
  FULL = 'FULL',
}

export enum ShippingMode {
  STANDARD = 'STANDARD',
  EXPRESS = 'EXPRESS',
  AIR = 'AIR',
}

export enum DecisionStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  PROCESSED = 'PROCESSED',
  LOCKED = 'LOCKED',
}

export enum TechnologyType {
  ERP = 'ERP',
  CONTROL_TOWER = 'CONTROL_TOWER',
  APS = 'APS',
  DEMAND_SENSING = 'DEMAND_SENSING',
  SOP_WORKBENCH = 'SOP_WORKBENCH',
  WMS = 'WMS',
  TMS = 'TMS',
  OMS = 'OMS',
  ANALYTICS = 'ANALYTICS',
}

export enum TechnologyCategory {
  VISIBILITY = 'VISIBILITY',
  PLANNING = 'PLANNING',
  EXECUTION = 'EXECUTION',
  ANALYTICS = 'ANALYTICS',
}

export enum EventType {
  SUPPLY_DISRUPTION = 'SUPPLY_DISRUPTION',
  DEMAND_SURGE = 'DEMAND_SURGE',
  COMPETITOR_STUMBLE = 'COMPETITOR_STUMBLE',
  ECONOMIC_DOWNTURN = 'ECONOMIC_DOWNTURN',
  RAW_MATERIAL_SPIKE = 'RAW_MATERIAL_SPIKE',
}

export enum EventEffect {
  PARTS_DELAYED = 'PARTS_DELAYED',
  DEMAND_SPIKE = 'DEMAND_SPIKE',
  STEAL_INPLAY = 'STEAL_INPLAY',
  DEMAND_DROP = 'DEMAND_DROP',
  COST_INCREASE = 'COST_INCREASE',
}

export enum EventSource {
  RANDOM = 'RANDOM',
  FACULTY_TRIGGERED = 'FACULTY_TRIGGERED',
  SCENARIO = 'SCENARIO',
}

export enum SupplierType {
  GLOBAL = 'GLOBAL',
  REGIONAL = 'REGIONAL',
}

export enum ScMaturityLevel {
  BASIC = 'BASIC',
  DEVELOPING = 'DEVELOPING',
  ADVANCED = 'ADVANCED',
}

export enum UserRole {
  STUDENT = 'STUDENT',
  FACULTY = 'FACULTY',
  ADMIN = 'ADMIN',
}

export enum EnrollmentStatus {
  PENDING_FIRM_ASSIGNMENT = 'PENDING_FIRM_ASSIGNMENT',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  DROPPED = 'DROPPED',
}

export enum EnrollmentRole {
  TEAM_MEMBER = 'TEAM_MEMBER',
  TEAM_LEAD = 'TEAM_LEAD',
  OBSERVER = 'OBSERVER',
}

export enum WarrantyTier {
  NONE = 'NONE',
  BASIC = 'BASIC',
  STANDARD = 'STANDARD',
  PREMIUM = 'PREMIUM',
}

export enum ModuleScheduleMode {
  PROGRESSIVE = 'PROGRESSIVE',
  ALL_OPEN = 'ALL_OPEN',
  CUSTOM = 'CUSTOM',
}

export enum InviteStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export enum DisposalMethod {
  LANDFILL = 'LANDFILL',
  RECYCLE = 'RECYCLE',
  REFURBISH = 'REFURBISH',
}

export enum CarrierMode {
  INTERMODAL = 'INTERMODAL',
  TRUCK = 'TRUCK',
  AIR = 'AIR',
}

export enum DCStatus {
  NO = 'NO',
  YES = 'YES',
  CLOSE = 'CLOSE',
}

export enum TransferDestination {
  NONE = 'NONE',
  WEST = 'WEST',
  CENTRAL = 'CENTRAL',
  FACTORY = 'FACTORY',
}

export enum ForecastMethod {
  GUT = 'GUT',
  MODEL = 'MODEL',
}

export enum IntelReportType {
  MARKET_TRENDS = 'MARKET_TRENDS',
  COMPETITOR_PRICING = 'COMPETITOR_PRICING',
  REGIONAL_DEMAND = 'REGIONAL_DEMAND',
  RETAIL_CHANNEL = 'RETAIL_CHANNEL',
  COMPETITOR_CAPACITY = 'COMPETITOR_CAPACITY',
  SUPPLIER_RISK = 'SUPPLIER_RISK',
  CUSTOMER_SENTIMENT = 'CUSTOMER_SENTIMENT',
}

export enum ExpansionType {
  SMALL_LINE = 'SMALL_LINE',
  MEDIUM_LINE = 'MEDIUM_LINE',
  LARGE_LINE = 'LARGE_LINE',
}

export enum SCRMLevel {
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  ELEVATED = 'ELEVATED',
  HIGH = 'HIGH',
}

// ============================================================================
// SUB-DOCUMENT SCHEMAS (Embedded Documents)
// ============================================================================
@Schema({ _id: false })
export class SeasonalityConfig {
  @Prop({ default: 0.85 })
  q1Multiplier: number;

  @Prop({ default: 1.0 })
  q2Multiplier: number;

  @Prop({ default: 1.0 })
  q3Multiplier: number;

  @Prop({ default: 1.25 })
  q4Multiplier: number;
}

@Schema({ _id: false })
export class FeatureToggles {
  @Prop({ default: true })
  seasonality: boolean;

  @Prop({ default: true })
  randomEvents: boolean;

  @Prop({ default: true })
  customerChurn: boolean;

  @Prop({ default: true })
  retailerBrain: boolean;

  @Prop({ default: true })
  regionalCompetition: boolean;

  @Prop({ default: true })
  demandForecasting: boolean;

  @Prop({ default: true })
  perfectOrderTracking: boolean;

  @Prop({ default: true })
  technologyInvestments: boolean;

  @Prop({ default: true })
  qualityControl: boolean;

  @Prop({ default: true })
  transportLogistics: boolean;
  @Prop({ default: false })
  capacityExpansion: boolean;

  @Prop({ default: false })
  regionalDCs: boolean;

  @Prop({ default: false })
  multiCarrierSelection: boolean;

  @Prop({ default: false })
  returnsGreenScore: boolean;

  @Prop({ default: false })
  intelligenceCenter: boolean;

  @Prop({ default: false })
  vmi: boolean;

  @Prop({ default: false })
  analyticsMode: boolean;

  @Prop({ default: false })
  productInnovation: boolean; // Product 3 (P3) launch and management

  @Prop({ default: false })
  marketExpansion: boolean; // Regions 4-6 (R4, R5, R6) market entry
}

const ADVANCED_MODULE_IDS = [
  'capacityExpansion',
  'regionalDCs',
  'multiCarrierSelection',
  'returnsGreenScore',
  'intelligenceCenter',
  'vmi',
  'analyticsMode',
  'productInnovation',
  'marketExpansion',
] as const;

export type AdvancedModuleId = typeof ADVANCED_MODULE_IDS[number];

@Schema({ _id: false })
export class AdvancedModuleConfig {
  @Prop({ required: true, enum: ADVANCED_MODULE_IDS })
  moduleId: AdvancedModuleId;

  @Prop({ required: true })
  order: number;

  @Prop({ required: true, min: 1 })
  unlocksAtQuarter: number;

  @Prop({ default: true })
  enabled: boolean;
}

@Schema({ _id: false })
export class ModuleSchedule {
  @Prop({ enum: ModuleScheduleMode, default: ModuleScheduleMode.ALL_OPEN })
  mode: ModuleScheduleMode;

  @Prop({ type: [AdvancedModuleConfig], default: () => [] })
  modules: AdvancedModuleConfig[];
}

@Schema({ _id: false })
export class PerfectOrderComponents {
  @Prop({ default: 0.92 })
  onTime: number;

  @Prop({ default: 0.95 })
  inFull: number;

  @Prop({ default: 0.97 })
  damageFree: number;

  @Prop({ default: 0.99 })
  documentation: number;

  @Prop({ default: 0.84 })
  overall: number;
}

@Schema({ _id: false })
export class TechnologyEffects {
  @Prop()
  holdingCostReduction?: number;

  @Prop()
  onTimeBonus?: number;

  @Prop()
  eventResponseBonus?: number;

  @Prop()
  capacityUtilizationBonus?: number;

  @Prop()
  forecastErrorReduction?: number;

  @Prop()
  freightCostReduction?: number;

  @Prop()
  perfectOrderBonus?: number;

  @Prop()
  planningVisibility?: boolean;

  @Prop()
  analyticsEnabled?: boolean;
}

@Schema({ _id: false })
export class BalancedScorecard {
  @Prop({ default: 0 })
  financial: number;

  @Prop({ default: 0 })
  customer: number;

  @Prop({ default: 0 })
  process: number;

  @Prop({ default: 0 })
  learning: number;

  @Prop({ default: 0 })
  overall: number;

  @Prop({ default: 0 })
  rank: number;

  @Prop()
  grade?: string;
}

@Schema({ _id: false })
export class CostBreakdown {
  @Prop({ default: 0 })
  labor: number;

  @Prop({ default: 0 })
  holding: number;

  @Prop({ default: 0 })
  marketing: number;

  @Prop({ default: 0 })
  quality: number;

  @Prop({ default: 0 })
  freight: number;

  @Prop({ default: 0 })
  techMaintenance: number;

  @Prop({ default: 0 })
  interest: number;

  // VMI — split so faculty can show students setup is one-time capital
  // while ongoing is recurring opex
  @Prop({ default: 0 })
  vmiSetup: number;

  @Prop({ default: 0 })
  vmiOngoing: number;
}

// ============================================================================
// SIMULATION SCHEMA
// ============================================================================
export type SimulationDocument = Simulation & Document;

@Schema({ timestamps: true, collection: 'simulations' })
export class Simulation {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ enum: SimulationStatus, default: SimulationStatus.CREATED })
  status: SimulationStatus;

  @Prop({ default: 0 })
  currentQuarter: number;

  @Prop({ default: 12 })
  maxQuarters: number;

  // Configuration
  @Prop({ default: 3 })
  numFirms: number;

  @Prop({ default: 3 })
  numRegions: number;

  @Prop({ default: 2 })
  numProducts: number;

  @Prop({ default: 1000000000 })
  startingCash: number;

  @Prop({ default: 1000000000 })
  startingRevenue: number;

  @Prop({ default: 600000 })
  totalMarketSize: number;

  // Feature Toggles (embedded)
  @Prop({ type: FeatureToggles, default: () => ({}) })
  features: FeatureToggles;

  // Scheduled module activation by quarter (faculty sets at creation time)
  @Prop({ type: ModuleSchedule, default: () => ({}) })
  moduleSchedule: ModuleSchedule;

  // ── Quarter pacing ──────────────────────────────────────────────────────
  // How many real-world days each simulated quarter lasts. Set at creation
  // time, applies to every quarter for the life of the sim. Default 14.
  @Prop({ default: 14, min: 1, max: 90 })
  quarterDurationDays: number;

  // When the currently-active quarter opened. Set on each call to
  // advanceQuarter (and on initial sim create). The auto-advance check
  // uses this + quarterDurationDays to decide whether the window has closed.
  @Prop({ type: Date, default: null })
  quarterStartedAt: Date | null;

  // Convenience field — same as quarterStartedAt + quarterDurationDays days.
  // Stored rather than derived so the cockpit can render a countdown without
  // doing date math on every render.
  @Prop({ type: Date, default: null })
  quarterEndsAt: Date | null;

  // Seasonality (embedded)
  @Prop({ type: SeasonalityConfig, default: () => ({}) })
  seasonality: SeasonalityConfig;

  // Event Settings
  @Prop({ default: 0.15 })
  eventProbability: number;

  @Prop({ default: 0.05 })
  demandVariability: number;

  // Owner/Faculty
  @Prop({ type: Types.ObjectId, ref: 'User' })
  owner?: Types.ObjectId;

  @Prop()
  courseCode?: string;

  @Prop()
  institutionName?: string;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  facultyIds?: Types.ObjectId[];

  // UI Controls
  @Prop({ default: false })
  showQuarterData: boolean;
}

export const SimulationSchema = SchemaFactory.createForClass(Simulation);

// Helper methods
SimulationSchema.methods.isModuleUnlocked = function (
  this: any,
  moduleId: AdvancedModuleId,
): boolean {
  if (!this.moduleSchedule?.modules) return false;
  const config = this.moduleSchedule.modules.find(
    (m: any) => m.moduleId === moduleId,
  );
  if (!config || !config.enabled) return false;
  return (this.currentQuarter || 0) >= config.unlocksAtQuarter;
} as any;

// Indexes
SimulationSchema.index({ owner: 1 });
SimulationSchema.index({ status: 1 });
SimulationSchema.index({ courseCode: 1 });

// ============================================================================
// FIRM SCHEMA
// ============================================================================
export type FirmDocument = Firm & Document;

@Schema({ timestamps: true, collection: 'firms' })
export class Firm {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation: Types.ObjectId;

  @Prop({ required: true })
  firmNumber: number;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  // Team assignment
  @Prop()
  teamId?: string;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  members: Types.ObjectId[];

  @Prop({ default: '#3B82F6' })
  color: string;

  // Current state (denormalized for quick access)
  @Prop({ default: 0 })
  currentCash: number;

  @Prop({ default: 80 })
  currentCsi: number;

  @Prop({ default: 0.3333 })
  currentMarketShare: number;

  @Prop({ default: 0 })
  cumulativeRevenue: number;

  @Prop({ default: 0 })
  cumulativeProfit: number;

  // Technologies owned (array of tech types for quick lookup)
  @Prop({ type: [String], enum: TechnologyType, default: [] })
  techOwned: TechnologyType[];
}

export const FirmSchema = SchemaFactory.createForClass(Firm);

// Indexes
FirmSchema.index({ simulation: 1, firmNumber: 1 }, { unique: true });
FirmSchema.index({ members: 1 });

// ============================================================================
// QUARTER STATE SCHEMA
// ============================================================================
export type QuarterStateDocument = QuarterState & Document;

@Schema({ _id: false })
export class SupplierPerformance {
  @Prop({ default: 0.92 })
  onTimeRate: number;

  @Prop({ default: 0.95 })
  qualityRate: number;

  @Prop({ default: 0.6 })
  flexibilityScore: number;

  @Prop({ default: 0 })
  costIndex: number;

  @Prop({ default: 0 })
  overallScore: number;
}

@Schema({ _id: false })
export class SupplierMetrics {
  @Prop({ enum: SupplierType, required: true })
  supplierType: SupplierType;

  @Prop({ type: SupplierPerformance, default: () => ({}) })
  currentPerformance: SupplierPerformance;

  @Prop({ default: 0 })
  ordersPlaced: number;

  @Prop({ default: 0 })
  unitsOrdered: number;

  @Prop({ default: 0 })
  unitsDelivered: number;

  @Prop({ default: 0 })
  qualityIssuesTotal: number;

  @Prop({ default: 0 })
  onTimeOrders: number;

  @Prop()
  lastOrderQuarter?: number;
}

@Schema({ _id: false })
export class VmiQuarterSnapshot {
  // Was VMI active this quarter?
  @Prop({ default: false })
  active: boolean;

  // Costs this quarter
  @Prop({ default: 0 })
  setupCost: number;         // $2M on first activation quarter, else 0

  @Prop({ default: 0 })
  ongoingCost: number;       // $100K every active quarter after first

  @Prop({ default: 0 })
  totalCostThisQuarter: number;  // setupCost + ongoingCost for convenience

  // Retailer state AFTER VMI thresholds were applied
  @Prop({ default: 0 })
  coverageMonths: number;    // retailerInventory / (retailDemand / 3)

  @Prop({ default: 0 })
  effectivePanicThreshold: number;    // 0.5 mo with VMI vs 1.0 mo without
  
  @Prop({ default: 0 })
  effectiveClearanceThreshold: number; // 6.0 mo with VMI vs 4.0 mo without

  @Prop({ enum: RetailerMode, default: RetailerMode.NORMAL })
  retailerModeThisQuarter: RetailerMode;

  // Was clearance mode avoided because of VMI?
  // True when: coverageMonths > standard clearance threshold (4.0)
  //            BUT < VMI clearance threshold (6.0)
  // Meaning: without VMI the retailer would have entered clearance
  @Prop({ default: false })
  clearancePrevented: boolean;

  // Was panic mode avoided because of VMI?
  // True when: coverageMonths < standard panic threshold (1.0)
  //            BUT >= VMI panic threshold (0.5)
  @Prop({ default: false })
  panicPrevented: boolean;

  // Revenue protected: how much wholesale revenue was saved by
  // preventing clearance (clearance applies 15% discount to shipmentToRetailer * wholesalePrice)
  // 0 if clearance was not prevented or VMI inactive
  @Prop({ default: 0 })
  revenueProtected: number;

  // CSI points protected: clearance → -2 CSI, panic stockout → -5 CSI
  // Records how many points would have been lost without VMI
  @Prop({ default: 0 })
  csiProtected: number;

  // Order quantity sent to retailer this quarter
  @Prop({ default: 0 })
  shipmentToRetailer: number;

  // Cumulative totals (running sum from quarter 1 — easy for charts)
  @Prop({ default: 0 })
  cumulativeSetupCost: number;

  @Prop({ default: 0 })
  cumulativeOngoingCost: number;

  @Prop({ default: 0 })
  cumulativeTotalCost: number;

  @Prop({ default: 0 })
  cumulativeRevenueProtected: number;

  @Prop({ default: 0 })
  cumulativeCsiProtected: number;

  // Net benefit = cumulativeRevenueProtected - cumulativeTotalCost
  // Negative early (setup cost dominates), turns positive if VMI pays off
  @Prop({ default: 0 })
  cumulativeNetBenefit: number;
}

@Schema({ timestamps: true, collection: 'quarter_states' })
export class QuarterState {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', required: true })
  firm: Types.ObjectId;

  @Prop({ required: true })
  quarter: number;

  // Financial Position
  @Prop({ default: 0 })
  cash: number;

  @Prop({ default: 0 })
  accountsReceivable: number;

  @Prop({ default: 0 })
  fixedAssets: number;

  @Prop({ default: 0 })
  accountsPayable: number;

  @Prop({ default: 0 })
  shortTermDebt: number;

  @Prop({ default: 0 })
  longTermDebt: number;
  // === SUPPLIER PERFORMANCE ===
  @Prop({ type: [SupplierMetrics], default: [] })
  supplierMetrics: SupplierMetrics[];

  @Prop({ default: 0 })
  lastSupplierScoreUpdate: number;
  // Inventory Position (units)
  @Prop({ default: 0 })
  rawMaterialUnits: number;

  @Prop({ default: 0 })
  finishedGoodsUnits: number;

  @Prop({ default: 0 })
  inTransitUnits: number;

  @Prop({ default: 0 })
  ordersInTransit: number;

  // Production
  @Prop({ default: 250000 })
  capacityUnits: number;

  // Performance Metrics
  @Prop({ default: 80 })
  csi: number;

  @Prop({ default: 0.3333 })
  marketShare: number;

  @Prop({ default: 0 })
  cumulativeRevenue: number;

  @Prop({ default: 0 })
  cumulativeProfit: number;

  // Retailer Channel
  @Prop({ default: 0 })
  retailerInventory: number;

  @Prop({ enum: RetailerMode, default: RetailerMode.NORMAL })
  retailerMode: RetailerMode;

  // Customer Pools
  @Prop({ default: 0 })
  customersLoyal: number;

  @Prop({ default: 0 })
  customersInPlay: number;

  // Previous price for churn calculation
  @Prop({ default: 500 })
  prevPriceP1: number;

  // === MARKET EXPANSION STATE ===
  @Prop({ default: false })
  r4Active: boolean;

  @Prop({ default: 0 })
  r4QuartersActive: number;

  @Prop({ default: false })
  r5Active: boolean;

  @Prop({ default: 0 })
  r5QuartersActive: number;

  @Prop({ default: false })
  r6Active: boolean;

  @Prop({ default: 0 })
  r6QuartersActive: number;
  // === DC INVENTORY MOVEMENTS ===
  @Prop({ default: 0 })
  inventoryReturnedToFactory: number;

  // Active Event
  @Prop({ type: Types.ObjectId, ref: 'Event' })
  activeEvent?: Types.ObjectId;

  // Perfect Order (embedded)
  @Prop({ type: PerfectOrderComponents, default: () => ({}) })
  perfectOrder: PerfectOrderComponents;

  // Tech maintenance cost this quarter
  @Prop({ default: 0 })
  techMaintenanceCost: number;

  @Prop({ type: [Object], default: [] })
  expansionInProgress: Array<{
    type: ExpansionType;
    capacity: number;
    maintenance: number;
    completesQ: number;
  }>;

  @Prop({ default: 0 })
  additionalCapacity: number;

  @Prop({ default: 0 })
  expansionMaintenance: number;

  // === REGIONAL DCs ===
  @Prop({ default: false })
  dcCentralOpen: boolean;

  @Prop({ default: 0 })
  dcCentralInventory: number;

  @Prop({ default: false })
  dcWestOpen: boolean;

  @Prop({ default: 0 })
  dcWestInventory: number;

  @Prop({ default: 0 })
  dcTotalOpex: number;

  @Prop({ default: 0 })
  dcSetupCost: number;

  @Prop({ default: 0 })
  dcDisposalRevenue: number;

  @Prop({ default: 0 })
  dcTransferCost: number;

  @Prop({ default: 0 })
  dcServiceBonus: number;

  // === MULTI-CARRIER STATE ===
  @Prop({ enum: CarrierMode, default: CarrierMode.TRUCK })
  carrierMode: CarrierMode;

  @Prop({ default: 0 })
  freightCost: number;

  @Prop({ default: false })
  forcedAir: boolean;

  @Prop({ default: 0 })
  lastMileCost: number;

  @Prop({ default: 0 })
  volumeDiscount: number;

  @Prop({ default: 0 })
  tmsDiscount: number;

  // === GREEN SCORE ===
  @Prop({ default: 50 })
  greenScore: number;

  @Prop({ enum: DisposalMethod, default: DisposalMethod.RECYCLE })
  disposalMethod: DisposalMethod;

  // === VMI ===
  @Prop({ default: false })
  vmiActive: boolean;

  // Full VMI impact snapshot for this quarter (replaces bare vmiActive for analytics)
  @Prop({ type: VmiQuarterSnapshot, default: () => ({}) })
  vmiSnapshot: VmiQuarterSnapshot;

  // === WARRANTY ===
  @Prop({ enum: WarrantyTier, default: WarrantyTier.STANDARD })
  warrantyTier: WarrantyTier;

  @Prop({ default: false })
  centralWarrantyNetwork: boolean;

  @Prop({ default: false })
  westWarrantyNetwork: boolean;

  @Prop({ default: 0 })
  creditScore: number;

  @Prop({ default: 'Fair' })
  creditTier: string;

  @Prop({ default: 50_000_000 })
  creditLimit: number;

  @Prop({ default: 0.18 })
  currentInterestRate: number;

  @Prop({ default: false })
  wasOverlimitThisQuarter: boolean;

  @Prop({ default: false })
  forcedSaleThisQuarter: boolean;

  @Prop({ default: 0 })
  customersCompetitor: number;

  @Prop({ default: 0 })
  scrmRiskScore: number;

  @Prop({ default: 'LOW' })
  scrmRiskLevel: string;

  @Prop({ type: Object })
  segmentAllocation?: {
    champions: number;
    growth: number;
    atRisk: number;
    other: number;
  };

  // === PRODUCT INNOVATION (P3) STATE ===
  @Prop({ default: false })
  p3Launched: boolean;

  @Prop({ default: null, type: Number })
  p3LaunchQuarter: number | null;

  @Prop({ type: String, default: null })
  p3Config: string | null;

  // === MARKET EXPANSION ENTRY QUARTERS ===
  @Prop({ default: null, type: Number })
  r4EntryQuarter: number | null;

  @Prop({ default: null, type: Number })
  r5EntryQuarter: number | null;

  @Prop({ default: null, type: Number })
  r6EntryQuarter: number | null;
}

export const QuarterStateSchema = SchemaFactory.createForClass(QuarterState);

// Indexes
QuarterStateSchema.index(
  { simulation: 1, firm: 1, quarter: 1 },
  { unique: true },
);
QuarterStateSchema.index({ firm: 1, quarter: -1 });

// ============================================================================
// DECISION SCHEMA (Decision Cockpit)
// ============================================================================
export type DecisionDocument = Decision & Document;

@Schema({ timestamps: true, collection: 'decisions' })
export class Decision {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', required: true })
  firm: Types.ObjectId;

  @Prop({ required: true })
  quarter: number;

  @Prop({ enum: DecisionStatus, default: DecisionStatus.DRAFT })
  status: DecisionStatus;

  // ========== DEMAND FORECAST ==========
  @Prop({ default: 80000 })
  forecastR1: number;

  @Prop({ default: 70000 })
  forecastR2: number;

  @Prop({ default: 50000 })
  forecastR3: number;

  // ========== PROCUREMENT ==========
  @Prop({ default: 600000 })
  orderGlobal: number;

  @Prop({ default: 0 })
  orderRegional: number;

  // ========== PRODUCTION ==========
  @Prop({ default: 120000 })
  productionP1: number;

  @Prop({ default: 80000 })
  productionP2: number;

  @Prop({ default: 1, min: 1, max: 3 })
  shifts: number;

  // ========== PRICING ==========
  @Prop({ default: 500 })
  priceP1: number;

  @Prop({ default: 850 })
  priceP2: number;

  // ========== MARKETING ==========
  @Prop({ default: 5000000 })
  marketingBudget: number;

  // ========== QUALITY CONTROL ==========
  @Prop({ enum: InspectionLevel, default: InspectionLevel.BASIC })
  inspectionLevel: InspectionLevel;

  // ========== LOGISTICS ==========
  @Prop({ enum: ShippingMode, default: ShippingMode.STANDARD })
  shippingMode: ShippingMode;

  // ========== TECHNOLOGY PURCHASES ==========
  @Prop({ type: Object, default: {} })
  techPurchases: {
    erp?: boolean;
    controlTower?: boolean;
    aps?: boolean;
    demandSensing?: boolean;
    wms?: boolean;
    tms?: boolean;
    oms?: boolean;
    analytics?: boolean;
  };

  // ========== OUTCOMES (filled after processing) ==========
  @Prop()
  actualProduction?: number;

  @Prop()
  unitsSold?: number;

  @Prop()
  revenue?: number;

  @Prop()
  cogs?: number;

  @Prop()
  laborCost?: number;

  @Prop()
  grossMargin?: number;

  @Prop()
  netIncome?: number;

  @Prop()
  fillRate?: number;

  @Prop()
  endingCsi?: number;

  @Prop({ default: false })
  enterR4: boolean;

  @Prop({ default: 0 })
  forecastR4: number;

  @Prop({ default: false })
  enterR5: boolean;

  @Prop({ default: 0 })
  forecastR5: number;

  @Prop({ default: false })
  enterR6: boolean;

  @Prop({ default: 0 })
  forecastR6: number;

  @Prop({ default: 0 })
  estimatedTotalCost: number;

  @Prop({ default: 0 })
  borrowingNeeded: number;

  @Prop({ default: 0 })
  interestCost: number;

  @Prop({ default: 0.15 })
  creditLineRate: number;

  @Prop({ default: 0 })
  totalCostWithInterest: number;

  // Quality Outcomes
  @Prop()
  defectsProduced?: number;

  @Prop()
  defectsDetected?: number;

  @Prop()
  customerReturns?: number;

  @Prop()
  qualityCost?: number;

  // Logistics Outcomes
  @Prop()
  freightCost?: number;

  // Technology Outcomes
  @Prop()
  techPurchaseCost?: number;

  @Prop()
  techMaintenanceCost?: number;

  // Metadata
  @Prop({ type: Types.ObjectId, ref: 'User' })
  submittedBy?: Types.ObjectId;

  @Prop()
  submittedAt?: Date;

  @Prop()
  processedAt?: Date;

  @Prop({ enum: ForecastMethod, default: ForecastMethod.GUT })
  forecastMethod: ForecastMethod;

  // === CAPACITY EXPANSION DECISIONS ===
  @Prop({ default: false })
  buildSmallLine: boolean;

  @Prop({ default: false })
  buildMediumLine: boolean;

  @Prop({ default: false })
  buildLargeLine: boolean;

  // === REGIONAL DC DECISIONS ===
  @Prop({ enum: DCStatus, default: DCStatus.NO })
  dcCentralStatus: DCStatus;

  @Prop({ enum: DCStatus, default: DCStatus.NO })
  dcWestStatus: DCStatus;

  @Prop({ default: 0 })
  allocateCentral: number;

  @Prop({ default: 0 })
  allocateWest: number;

  // === INVENTORY TRANSFERS ===
  @Prop({ default: 0 })
  transferFromCentral: number;

  @Prop({ enum: TransferDestination, default: TransferDestination.NONE })
  transferFromCentralTo: TransferDestination;

  @Prop({ default: 0 })
  transferFromWest: number;

  @Prop({ enum: TransferDestination, default: TransferDestination.NONE })
  transferFromWestTo: TransferDestination;

  // === MULTI-CARRIER ===
  @Prop({ enum: CarrierMode, default: CarrierMode.TRUCK })
  carrier: CarrierMode;

  // === WARRANTY ===
  @Prop({ enum: WarrantyTier, default: WarrantyTier.STANDARD })
  warrantyTier: WarrantyTier;

  @Prop({ default: false })
  centralWarrantyNetwork: boolean;

  @Prop({ default: false })
  westWarrantyNetwork: boolean;

  // === GREEN SCORE ===
  @Prop({ enum: DisposalMethod, default: DisposalMethod.RECYCLE })
  disposalMethod: DisposalMethod;

  @Prop({ default: false })
  ecoPackaging: boolean;

  // === INTELLIGENCE SUBSCRIPTIONS ===
  @Prop({ type: Object, default: {} })
  intelSubscriptions: {
    regionalDemand?: boolean;
    retailChannel?: boolean;
    competitorCapacity?: boolean;
    supplierRisk?: boolean;
    customerSentiment?: boolean;
  };

  // === VMI ===
  @Prop({ default: false })
  enableVMI: boolean;

  // ========== SUPPLIER SELECTION (Analytics Mode) ==========
  @Prop({ default: 'SUP001' })
  primarySupplier: string;

  @Prop({ default: 'NONE' })
  secondarySupplier: string;

  @Prop({ default: 100, min: 50, max: 100 })
  primaryAllocation: number;

  @Prop({ default: 0 })
  emergencyRegionalOrder: number;

  // ========== PRODUCT INNOVATION (P3 - Analytics Mode) ==========
  @Prop({ default: false })
  launchP3: boolean;

  @Prop({ default: 'STANDARD' })
  p3Config: string;

  @Prop({ default: 549 })
  p3Price: number;

  @Prop({ default: 0 })
  productionP3: number;

  // ========== CUSTOMER SEGMENT ALLOCATION (Analytics Mode) ==========
  @Prop({ default: 25, min: 0, max: 100 })
  segmentChampions: number;

  @Prop({ default: 25, min: 0, max: 100 })
  segmentGrowth: number;

  @Prop({ default: 25, min: 0, max: 100 })
  segmentAtRisk: number;

  @Prop({ default: 25, min: 0, max: 100 })
  segmentOther: number;

  // ========== TECHNOLOGY PURCHASES (Individual fields) ==========
  @Prop({ default: false })
  purchaseERP: boolean;

  @Prop({ default: false })
  purchaseControlTower: boolean;

  @Prop({ default: false })
  purchaseAPS: boolean;

  @Prop({ default: false })
  purchaseDemandSensing: boolean;

  @Prop({ default: false })
  purchaseWMS: boolean;

  @Prop({ default: false })
  purchaseTMS: boolean;

  @Prop({ default: false })
  purchaseOMS: boolean;

  @Prop({ default: false })
  purchaseAnalytics: boolean;

  // ========== INTELLIGENCE SUBSCRIPTIONS (Individual fields) ==========
  @Prop({ default: false })
  intelRegionalDemand: boolean;

  @Prop({ default: false })
  intelRetailChannel: boolean;

  @Prop({ default: false })
  intelCompetitorCapacity: boolean;

  @Prop({ default: false })
  intelSupplierRisk: boolean;

  @Prop({ default: false })
  intelCustomerSentiment: boolean;
}

export const DecisionSchema = SchemaFactory.createForClass(Decision);

// Indexes
DecisionSchema.index({ simulation: 1, firm: 1, quarter: 1 }, { unique: true });
DecisionSchema.index({ firm: 1, status: 1 });

export type EventImpactDocument = EventImpact & Document;

@Schema({ _id: false })
export class EventImpactDetails {
  // For PARTS_DELAYED
  @Prop()
  partsDelayed?: number;

  @Prop()
  ordersAffected?: number;

  // For DEMAND_SPIKE / DEMAND_DROP
  @Prop()
  demandModifier?: number;

  @Prop()
  demandChangeUnits?: number;

  @Prop()
  demandChangePercent?: number;

  // For COST_INCREASE (RAW_MATERIAL_SPIKE)
  @Prop()
  additionalCost?: number;

  @Prop()
  costIncreasePercent?: number;

  // For STEAL_INPLAY (COMPETITOR_STUMBLE)
  @Prop()
  customersGained?: number;

  @Prop()
  marketShareChange?: number;
}

@Schema({ _id: false })
export class FirmContextSnapshot {
  @Prop()
  cashBefore?: number;

  @Prop()
  inventoryBefore?: number;

  @Prop()
  marketShareBefore?: number;

  @Prop()
  csiBefore?: number;

  @Prop()
  ordersInTransit?: number;
}

@Schema({ timestamps: true, collection: 'event_impacts' })
export class EventImpact {
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true })
  event: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', required: true })
  firm: Types.ObjectId;

  @Prop({ required: true })
  quarter: number;

  // Event metadata (denormalized for query efficiency)
  @Prop({ enum: ['SUPPLY_DISRUPTION', 'DEMAND_SURGE', 'COMPETITOR_STUMBLE', 'ECONOMIC_DOWNTURN', 'RAW_MATERIAL_SPIKE'], required: true })
  eventType: string;

  @Prop({ enum: ['PARTS_DELAYED', 'DEMAND_SPIKE', 'STEAL_INPLAY', 'DEMAND_DROP', 'COST_INCREASE'], required: true })
  eventEffect: string;

  @Prop({ enum: ['RANDOM', 'FACULTY_TRIGGERED', 'SCENARIO'], required: true })
  source: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  triggeredBy?: Types.ObjectId;

  // Raw event magnitude (before mitigation)
  @Prop({ required: true })
  rawMagnitude: number;

  // Mitigation applied (from Control Tower, etc.)
  @Prop({ default: 0 })
  mitigationApplied: number;

  @Prop({ default: false })
  hasControlTower: boolean;

  // Effective magnitude after mitigation
  @Prop({ required: true })
  effectiveMagnitude: number;

  // Realized impacts (what actually happened)
  @Prop({ type: EventImpactDetails, default: () => ({}) })
  impacts: EventImpactDetails;

  // Financial impact summary
  @Prop({ default: 0 })
  revenueImpact: number;

  @Prop({ default: 0 })
  costImpact: number;

  @Prop({ default: 0 })
  netImpact: number;

  // Context at time of impact
  @Prop({ type: FirmContextSnapshot })
  firmContext?: FirmContextSnapshot;
}

export const EventImpactSchema = SchemaFactory.createForClass(EventImpact);

// Indexes for efficient queries
EventImpactSchema.index({ simulation: 1, quarter: 1 });
EventImpactSchema.index({ event: 1 });
EventImpactSchema.index({ firm: 1, quarter: -1 });
EventImpactSchema.index({ source: 1, simulation: 1 }); // Faculty dashboard: "Show all faculty-triggered"
EventImpactSchema.index({ triggeredBy: 1, simulation: 1 }); // "Show my triggered events"


// ============================================================================
// DEMAND HISTORY SCHEMA
// ============================================================================
export type DemandHistoryDocument = DemandHistory & Document;

@Schema({ timestamps: true, collection: 'demand_history' })
export class DemandHistory {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation: Types.ObjectId;

  @Prop({ required: true })
  quarter: number;

  // Actual demand by region
  @Prop({ default: 0 })
  demandR1: number;

  @Prop({ default: 0 })
  demandR2: number;

  @Prop({ default: 0 })
  demandR3: number;

  @Prop({ default: 0 })
  totalDemand: number;

  // Seasonality
  @Prop({ default: 1.0 })
  seasonalMultiplier: number;

  @Prop()
  seasonLabel?: string;

  @Prop({ min: 1, max: 4 })
  calendarQuarter: number;

  // Market conditions
  @Prop({ default: 1.0 })
  demandVariabilityApplied: number;

  @Prop()
  eventImpact?: string;
}

export const DemandHistorySchema = SchemaFactory.createForClass(DemandHistory);

// Indexes
DemandHistorySchema.index({ simulation: 1, quarter: 1 }, { unique: true });

// ============================================================================
// FORECAST LOG SCHEMA
// ============================================================================
export type ForecastLogDocument = ForecastLog & Document;

@Schema({ timestamps: true, collection: 'forecast_logs' })
export class ForecastLog {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', required: true })
  firm: Types.ObjectId;

  @Prop({ required: true })
  quarter: number;

  // Forecast values
  @Prop({ type: Object })
  forecast: {
    r1: number;
    r2: number;
    r3: number;
    total: number;
  };

  // Actual values
  @Prop({ type: Object })
  actual: {
    r1: number;
    r2: number;
    r3: number;
    total: number;
  };

  // Error calculations
  @Prop({ type: Object })
  error: {
    r1: number;
    r2: number;
    r3: number;
    total: number;
  };

  // Absolute Percentage Errors
  @Prop({ type: Object })
  ape: {
    r1: number;
    r2: number;
    r3: number;
  };

  // Metrics
  @Prop({ default: 0 })
  mape: number;

  @Prop({ default: 0 })
  bias: number;

  @Prop({ default: 0 })
  accuracy: number;
}

export const ForecastLogSchema = SchemaFactory.createForClass(ForecastLog);

// Indexes
ForecastLogSchema.index(
  { simulation: 1, firm: 1, quarter: 1 },
  { unique: true },
);

// ============================================================================
// TECHNOLOGY SCHEMA
// ============================================================================
export type TechnologyDocument = Technology & Document;

@Schema({ timestamps: true, collection: 'technologies' })
export class Technology {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', required: true })
  firm: Types.ObjectId;

  @Prop({ enum: TechnologyType, required: true })
  type: TechnologyType;

  @Prop({ enum: TechnologyCategory, required: true })
  category: TechnologyCategory;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  // Purchase details
  @Prop({ required: true })
  purchaseCost: number;

  @Prop({ required: true })
  purchaseQuarter: number;

  // Maintenance
  @Prop({ default: 0.0375 })
  quarterlyMaintenanceRate: number;

  @Prop({ default: 0 })
  totalMaintenancePaid: number;

  // Benefits (embedded)
  @Prop({ type: TechnologyEffects, default: () => ({}) })
  effects: TechnologyEffects;

  @Prop({ default: true })
  isActive: boolean;
}

export const TechnologySchema = SchemaFactory.createForClass(Technology);

// Indexes
TechnologySchema.index({ simulation: 1, firm: 1, type: 1 }, { unique: true });
TechnologySchema.index({ firm: 1, isActive: 1 });

// ============================================================================
// EVENT SCHEMA
// ============================================================================
export type EventDocument = Event & Document;

@Schema({ timestamps: true, collection: 'events' })
export class Event {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation: Types.ObjectId;

  @Prop({ enum: EventType, required: true })
  type: EventType;

  @Prop({ enum: EventEffect, required: true })
  effect: EventEffect;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  // Timing
  @Prop({ required: true })
  startQuarter: number;

  @Prop({ default: 1 })
  duration: number;

  @Prop()
  endQuarter?: number;

  @Prop({ default: true })
  isActive: boolean;

  // Impact
  @Prop({ default: 0 })
  magnitude: number;

  // Affected firms (empty = all firms)
  @Prop({ type: [Types.ObjectId], ref: 'Firm', default: [] })
  affectedFirms: Types.ObjectId[];

  // Source
  @Prop({ enum: EventSource, default: EventSource.RANDOM })
  source: EventSource;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  triggeredBy?: Types.ObjectId;
}

export const EventSchema = SchemaFactory.createForClass(Event);

// Indexes
EventSchema.index({ simulation: 1, startQuarter: 1 });
EventSchema.index({ simulation: 1, isActive: 1 });

// ============================================================================
// SUPPLIER ORDER SCHEMA
// ============================================================================
export type SupplierOrderDocument = SupplierOrder & Document;

@Schema({ timestamps: true, collection: 'supplier_orders' })
export class SupplierOrder {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', required: true })
  firm: Types.ObjectId;

  @Prop({ required: true })
  quarter: number;

  @Prop({ enum: SupplierType, required: true })
  supplierType: SupplierType;

  // Order details
  @Prop({ required: true })
  quantityOrdered: number;

  @Prop()
  quantityReceived?: number;

  @Prop({ required: true })
  unitCost: number;

  @Prop({ required: true })
  totalCost: number;

  // Lead time
  @Prop({ default: 1 })
  leadTimeQuarters: number;

  @Prop()
  expectedDeliveryQuarter?: number;

  @Prop()
  actualDeliveryQuarter?: number;

  // Performance
  @Prop()
  fillRate?: number;

  @Prop({ default: false })
  wasDelayed: boolean;

  @Prop()
  delayReason?: string;

  // Quality
  @Prop({ default: 0 })
  defectiveUnits: number;

  @Prop({ default: 0 })
  defectRate: number;
}

export const SupplierOrderSchema = SchemaFactory.createForClass(SupplierOrder);

// Indexes
SupplierOrderSchema.index({ simulation: 1, firm: 1, quarter: 1 });

// ============================================================================
// KPI HISTORY SCHEMA
// ============================================================================
export type KpiHistoryDocument = KpiHistory & Document;

@Schema({ timestamps: true, collection: 'kpi_history' })
export class KpiHistory {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', required: true })
  firm: Types.ObjectId;

  @Prop({ required: true })
  quarter: number;

  // Financial Metrics
  @Prop({ type: Object })
  financial: {
    revenue: number;
    netIncome: number;
    cash: number;
    grossMarginPct: number;
    cogs: number;
    operatingExpenses: number;
  };

  // Customer Metrics
  @Prop({ type: Object })
  customer: {
    csi: number;
    marketShare: number;
    fillRate: number;
    returnRate: number;
    customersLoyal: number;
    customersInPlay: number;
    customersChurned: number;
  };

  // Operational Metrics
  @Prop({ type: Object })
  operations: {
    perfectOrder: number;
    capacityUtilization: number;
    defectRate: number;
    onTimeDelivery: number;     // maps to poOnTime
    inFull: number;             // PO component from perfectOrder.inFull
    damageFree: number;         // PO component from perfectOrder.damageFree
    documentation: number;      // PO component from perfectOrder.documentation
    mape: number;
    unitsProduced: number;
    unitsSold: number;
    totalCapacity: number;
    additionalCapacity: number;
    expansionsInProgress: number;
  };

  // Inventory Metrics
  @Prop({ type: Object })
  inventory: {
    rawMaterialUnits: number;
    finishedGoodsUnits: number;
    inventoryValue: number;
    inventoryTurnover: number;
    weeksOfSupply: number;
    retailerInventory: number;
    inTransitUnits: number;
  };

  // Learning & Growth
  @Prop({ type: Object })
  learning: {
    techSystemsCount: number;
    scMaturity: ScMaturityLevel;
    techInvestmentTotal: number;
    forecastAccuracy: number;
  };

  // VMI Impact (populated only when features.vmi is enabled)
  @Prop({ type: Object })
  vmi?: {
    active: boolean;
    setupCost: number;
    ongoingCost: number;
    totalCostThisQuarter: number;
    retailerMode: string;           // NORMAL / PANIC / CLEARANCE
    coverageMonths: number;
    clearancePrevented: boolean;
    panicPrevented: boolean;
    revenueProtected: number;
    csiProtected: number;
    cumulativeTotalCost: number;
    cumulativeRevenueProtected: number;
    cumulativeNetBenefit: number;
  };

  // Balanced Scorecard (embedded)
  @Prop({ type: BalancedScorecard, default: () => ({}) })
  bsc: BalancedScorecard;

  // Cost Breakdown (embedded)
  @Prop({ type: CostBreakdown, default: () => ({}) })
  costs: CostBreakdown;
}

export const KpiHistorySchema = SchemaFactory.createForClass(KpiHistory);

// Indexes
KpiHistorySchema.index(
  { simulation: 1, firm: 1, quarter: 1 },
  { unique: true },
);
KpiHistorySchema.index({ firm: 1, quarter: -1 });

// ============================================================================
// USER SCHEMA
// ============================================================================
export type UserDocument = User & Document;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop()
  displayName?: string;

  @Prop({ select: false })
  passwordHash?: string;

  @Prop({ enum: UserRole, default: UserRole.STUDENT })
  role: UserRole;

  @Prop()
  studentId?: string;

  @Prop()
  organization?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  avatarUrl?: string;

  @Prop()
  lastLoginAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1 });

// ============================================================================
// ENROLLMENT SCHEMA
// ============================================================================
export type EnrollmentDocument = Enrollment & Document;

@Schema({ timestamps: true, collection: 'enrollments' })
export class Enrollment {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', default: null })
  firm: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: Number, default: null, min: 1, max: 6 })
  firmNumber: number | null;

  @Prop({ enum: EnrollmentStatus, default: EnrollmentStatus.PENDING_FIRM_ASSIGNMENT })
  status: EnrollmentStatus;

  @Prop({ enum: EnrollmentRole, default: EnrollmentRole.TEAM_MEMBER })
  role: EnrollmentRole;

  @Prop()
  teamName?: string;

  // Access control
  @Prop({ default: true })
  canSubmitDecisions: boolean;

  @Prop({ default: true })
  canViewReports: boolean;

  @Prop({ default: false })
  canViewCompetitorData: boolean;

  // Engagement
  @Prop({ default: 0 })
  decisionsSubmitted: number;

  @Prop()
  lastActivityAt?: Date;
}

export const EnrollmentSchema = SchemaFactory.createForClass(Enrollment);

// Indexes
EnrollmentSchema.index({ simulation: 1, user: 1 }, { unique: true });
EnrollmentSchema.index({ simulation: 1, firm: 1 });
EnrollmentSchema.index({ user: 1 });

export type IntelligenceReportDocument = IntelligenceReport & Document;

@Schema({ timestamps: true, collection: 'intelligence_reports' })
export class IntelligenceReport {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', required: true })
  firm: Types.ObjectId;

  @Prop({ required: true })
  quarter: number;

  @Prop({ enum: IntelReportType, required: true })
  reportType: IntelReportType;

  // Report display name from CONFIG (e.g. "Market Trends Report")
  @Prop({ required: true })
  title: string;

  // Cost label (e.g. "(Free)", "($50K subscription)")
  @Prop()
  subtitle?: string;

  // Structured report data - rich object with firms, alerts, metrics, tips, etc.
  // Each report type has its own shape (see generate*Report methods in service)
  @Prop({ type: Object, default: {} })
  content: Record<string, any>;

  // GAS-style text lines for simple text rendering (backward compat)
  // Mirrors the lines[] array from each GAS report generator
  @Prop({ type: [String], default: [] })
  lines: string[];

  // Subscription cost for this report (0 for free reports)
  @Prop({ default: 0 })
  cost: number;

  // True for MARKET_TRENDS and COMPETITOR_PRICING (always generated)
  @Prop({ default: false })
  isFree: boolean;

  // Explicit generation timestamp (supplements Mongoose createdAt)
  @Prop()
  generatedAt?: Date;
}

export const IntelligenceReportSchema =
  SchemaFactory.createForClass(IntelligenceReport);
IntelligenceReportSchema.index({
  simulation: 1,
  firm: 1,
  quarter: 1,
  reportType: 1,
});

export type WarrantyClaimDocument = WarrantyClaim & Document;

@Schema({ timestamps: true, collection: 'warranty_claims' })
export class WarrantyClaim {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', required: true })
  firm: Types.ObjectId;

  @Prop({ required: true })
  quarter: number;

  @Prop({ enum: WarrantyTier, required: true })
  tier: WarrantyTier;

  // Claims breakdown
  @Prop({ default: 0 })
  productDefects: number;

  @Prop({ default: 0 })
  shippingDamage: number;

  @Prop({ default: 0 })
  totalClaims: number;

  // Claims by region
  @Prop({ type: Object })
  claimsByRegion: {
    r1: number;
    r2: number;
    r3: number;
  };

  // Costs
  @Prop({ default: 0 })
  warrantyRevenue: number;

  @Prop({ default: 0 })
  partShippingCost: number;

  @Prop({ default: 0 })
  serviceCost: number;

  @Prop({ default: 0 })
  networkMaintenanceCost: number;

  @Prop({ default: 0 })
  totalExpense: number;

  @Prop({ default: 0 })
  netWarranty: number;

  // Service details
  @Prop({ default: false })
  centralNetworkActive: boolean;

  @Prop({ default: false })
  westNetworkActive: boolean;
}

export const WarrantyClaimSchema = SchemaFactory.createForClass(WarrantyClaim);

export type GreenScoreHistoryDocument = GreenScoreHistory & Document;

@Schema({ timestamps: true, collection: 'green_score_history' })
export class GreenScoreHistory {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', required: true })
  firm: Types.ObjectId;

  @Prop({ required: true })
  quarter: number;

  @Prop({ default: 50 })
  previousScore: number;

  @Prop({ default: 50 })
  newScore: number;

  @Prop({ default: 0 })
  scoreChange: number;

  @Prop({ enum: DisposalMethod, required: true })
  disposalMethod: DisposalMethod;

  @Prop({ default: 0 })
  unitsDisposed: number;

  @Prop({ default: 0 })
  disposalCost: number;

  @Prop({ default: 0 })
  disposalRecovery: number;

  @Prop({ default: false })
  ecoPackaging: boolean;

  @Prop({ default: 0 })
  ecoPackagingCost: number;

  @Prop()
  effectBracket?: string;

  @Prop({ default: 0 })
  csiEffect: number;

  @Prop({ default: 1.0 })
  churnMultiplier: number;
}

export const GreenScoreHistorySchema =
  SchemaFactory.createForClass(GreenScoreHistory);

// ============================================================================
// 10-Q REPORT SCHEMA
// ============================================================================
export type TenQReportDocument = TenQReport & Document;

@Schema({ timestamps: true, collection: 'tenq_reports' })
export class TenQReport {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', required: true })
  firm: Types.ObjectId;

  @Prop({ required: true })
  quarter: number;

  // Income Statement
  @Prop({ type: Object })
  incomeStatement: {
    revenue: number;
    cogs: number;
    grossProfit: number;      // dollar value = revenue - cogs
    grossMarginPct: number;   // percentage, e.g. 57.8
    laborCost: number;
    holdingCost: number;
    marketing: number;
    techMaintenance: number;
    qualityCost: number;
    freightCost: number;
    totalOpex: number;
    operatingIncome: number;
    interest: number;
    netIncome: number;
  };

  // Balance Sheet
  @Prop({ type: Object })
  balanceSheet: {
    // Assets
    cash: number;
    accountsReceivable: number;
    inventoryValue: number;
    totalCurrentAssets: number;
    fixedAssets: number;
    totalAssets: number;

    // Liabilities
    accountsPayable: number;
    shortTermDebt: number;
    longTermDebt: number;
    totalLiabilities: number;

    // Equity
    equity: number;
  };

  // Cash Flow Statement
  @Prop({ type: Object })
  cashFlow: {
    // Operating Activities
    netIncome: number;
    depreciation: number;
    workingCapitalChange: number;
    cashFromOperations: number;

    // Investing Activities
    capitalExpenditures: number;
    cashUsedInvesting: number;

    // Financing Activities
    debtChange: number;
    dividends: number;
    cashFromFinancing: number;

    // Summary
    netCashChange: number;
    beginningCash: number;
    endingCash: number;
  };

  // Inventory Report
  @Prop({ type: Object })
  inventoryReport: {
    // Raw Materials
    rawMaterialUnits: number;
    rawMaterialValue: number;
    rawDaysOfSupply: number;

    // Finished Goods
    finishedGoodsUnits: number;
    finishedGoodsValue: number;
    finishedGoodsDaysOfSupply: number;

    // In Transit & Retail
    inTransitUnits: number;
    retailerInventory: number;
    totalPipeline: number;
    totalInventoryValue: number;

    // KPIs
    inventoryTurnover: number;
    weeksOfSupply: number;
  };

  // Key Metrics
  @Prop({ type: Object })
  keyMetrics: {
    unitsProduced: number;
    unitsSold: number;
    fillRate: number;
    csi: number;
    marketShare: number;
    perfectOrder: number;
    forecastAccuracy: number;
    mape: number;                  // raw MAPE value (0-1), e.g. 0.08 = 8%
    poComponents: {                // individual PO breakdown
      onTime: number;
      inFull: number;
      damageFree: number;
      documentation: number;
    };
  };

  // YTD Totals (for current fiscal year)
  @Prop({ type: Object })
  ytdTotals?: {
    revenue: number;
    netIncome: number;
    unitsSold: number;
    avgFillRate: number;
    avgCsi: number;
    cashGenerated: number;   // sum of cashFlow.cashFromOperations Q1→current
  };

  @Prop({ default: new Date() })
  generatedAt: Date;
}

export const TenQReportSchema = SchemaFactory.createForClass(TenQReport);
TenQReportSchema.index(
  { simulation: 1, firm: 1, quarter: 1 },
  { unique: true },
);
TenQReportSchema.index({ firm: 1, quarter: -1 });

// ============================================================================
// CREDIT HISTORY SCHEMA
// ============================================================================
export type CreditHistoryDocument = CreditHistory & Document;

@Schema({ timestamps: true, collection: 'credit_history' })
export class CreditHistory {
  @Prop({
    type: Types.ObjectId,
    ref: 'Simulation',
    required: true,
    index: true,
  })
  simulation: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', required: true, index: true })
  firm: Types.ObjectId;

  @Prop({ required: true, index: true })
  quarter: number;

  // Creditworthiness scoring breakdown
  @Prop({ type: Object, required: true })
  creditScore: {
    currentRatioScore: number;
    debtToEquityScore: number;
    profitMarginScore: number;
    interestCoverageScore: number;
    cashFlowScore: number;
    totalScore: number;
  };

  // Credit tier and terms
  @Prop({ required: true })
  tierName: string;

  @Prop({ required: true })
  creditLimit: number;

  @Prop({ required: true })
  annualRate: number;

  @Prop({ required: true })
  effectiveRate: number;

  // Debt position
  @Prop({ required: true })
  beginningDebt: number;

  @Prop({ required: true })
  endingDebt: number;

  @Prop({ required: true })
  interestCharge: number;

  // Auto-borrow/repay
  @Prop({ default: 0 })
  autoBorrowAmount: number;

  @Prop({ default: 0 })
  autoRepayAmount: number;

  // Overlimit handling
  @Prop({ default: false })
  wasOverlimit: boolean;

  @Prop({ default: 0 })
  overlimitAmount: number;

  @Prop({ default: 0 })
  overlimitFee: number;

  // Forced sale
  @Prop({ default: false })
  forcedSaleTriggered: boolean;

  @Prop({ default: 0 })
  inventorySoldUnits: number;

  @Prop({ default: 0 })
  forcedSaleRecovery: number;

  // Cash position
  @Prop({ required: true })
  beginningCash: number;

  @Prop({ required: true })
  endingCash: number;
}

export const CreditHistorySchema = SchemaFactory.createForClass(CreditHistory);

// Compound index for efficient queries
CreditHistorySchema.index(
  { simulation: 1, firm: 1, quarter: 1 },
  { unique: true },
);

export type SCRMHistoryDocument = SCRMHistory & Document;

@Schema({ timestamps: true, collection: 'scrm_history' })
export class SCRMHistory {
  @Prop({
    type: Types.ObjectId,
    ref: 'Simulation',
    required: true,
    index: true,
  })
  simulation: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Firm', required: true, index: true })
  firm: Types.ObjectId;

  @Prop({ required: true, index: true })
  quarter: number;

  // ============================================================================
  // OVERALL RISK ASSESSMENT
  // GAS lines 2352-2373
  // ============================================================================
  
  @Prop({ default: 0 })
  totalRiskScore: number;  // 0-100 weighted score

  @Prop({ default: 'LOW' })
  riskLevel: string;  // LOW, MODERATE, ELEVATED, HIGH, CRITICAL

  @Prop({ default: '#d9ead3' })
  riskColor: string;  // Color code for UI display

  @Prop()
  riskDescription?: string;  // Human-readable description

  // ============================================================================
  // RISK BREAKDOWN BY CATEGORY (5 categories as per GAS)
  // Field names MUST match processor output exactly
  // GAS lines 346-352: weights
  // GAS lines 2209-2350: calculations
  // Each score is 0-100, higher = more risk
  // ============================================================================
  
  @Prop({ type: Object, required: true })
  breakdown: {
    // Category 1: Supplier Concentration Risk (25% weight)
    // GAS lines 2209-2227
    supplierConcentrationRisk: number;
    
    // Category 2: Inventory Buffer Risk (20% weight)
    // GAS lines 2230-2262
    inventoryBufferRisk: number;
    
    // Category 3: Demand Volatility Risk (15% weight)
    // GAS lines 2264-2290
    demandVolatilityRisk: number;
    
    // Category 4: Financial Health Risk (15% weight)
    // GAS lines 2292-2321
    financialHealthRisk: number;
    
    // Category 5: Operational Risk (25% weight)
    // GAS lines 2323-2350 (combines capacity, perfect order, lead time)
    operationalRisk: number;
  };

  // ============================================================================
  // RISK DETAILS (human-readable explanations from processor)
  // ============================================================================
  
  @Prop({ type: Object })
  details?: {
    supplierDetails: string;
    inventoryDetails: string;
    demandDetails: string;
    financialDetails: string;
    operationalDetails: string;
  };

  // ============================================================================
  // CUSTOMER POOL STATE (end of quarter snapshot)
  // ============================================================================
  
  @Prop({ default: 0 })
  customersLoyal: number;

  @Prop({ default: 0 })
  customersInPlay: number;

  @Prop({ default: 0 })
  customersCompetitor: number;

  // ============================================================================
  // CUSTOMER MOVEMENTS (changes during this quarter)
  // ============================================================================
  
  @Prop({ type: Object })
  customerMovements?: {
    churnedToCompetitor: number;
    degradedFromLoyal: number;
    wonBackFromCompetitor: number;
    newEntrants: number;
    growthConverted: number;
    atRiskSaved: number;
  };

  // ============================================================================
  // SEGMENT ALLOCATION (if analyticsMode enabled)
  // ============================================================================
  
  @Prop({ type: Object })
  segmentAllocation?: {
    champions: number;
    growth: number;
    atRisk: number;
    other: number;
  };

  // ============================================================================
  // RETENTION METRICS
  // ============================================================================
  
  @Prop({ default: 0 })
  retentionBonus: number;

  @Prop({ default: 0 })
  csiImpact: number;

  // ============================================================================
  // INPUTS USED FOR RISK CALCULATION (full audit trail)
  // Stores ALL data used to calculate each risk category
  // ============================================================================
  
  @Prop({ type: Object })
  inputs?: {
    // Supplier Concentration (25%)
    globalOrders: number;
    regionalOrders: number;
    supplierConcentration: number;
    numSuppliers: number;
    
    // Inventory Buffer (20%)
    rawMaterialUnits: number;
    finishedGoodsUnits: number;
    rawDaysOfSupply: number;
    fgDaysOfSupply: number;
    totalRevenue: number;
    
    // Demand Volatility (15%)
    demandMape: number;
    calendarQuarter: number;
    
    // Financial Health (15%)
    cash: number;
    shortTermDebt: number;
    longTermDebt: number;
    debtRatio: number;
    cashRunway: number;
    accountsReceivable: number;
    fixedAssets: number;
    inventoryValue: number;
    
    // Operational (25%)
    unitsProduced: number;
    maxCapacity: number;
    capacityUtilization: number;
    perfectOrder: number;
    ordersInTransit: number;
    leadTimeExposure: number;
    
    // Context
    dcCentralOpen: boolean;
    dcWestOpen: boolean;
  };

  // ============================================================================
  // GENERATED RECOMMENDATIONS
  // GAS lines 2400-2420
  // ============================================================================
  
  @Prop({ type: [String], default: [] })
  recommendations: string[];
}

export const SCRMHistorySchema = SchemaFactory.createForClass(SCRMHistory);

// Indexes for efficient queries
SCRMHistorySchema.index(
  { simulation: 1, firm: 1, quarter: 1 },
  { unique: true },
);
SCRMHistorySchema.index({ firm: 1, quarter: -1 });
SCRMHistorySchema.index({ simulation: 1, riskLevel: 1 });

// ============================================================================
// STATIC DEFINITIONS
// ============================================================================
export const TECHNOLOGY_DEFINITIONS: Record<
  TechnologyType,
  {
    name: string;
    category: TechnologyCategory;
    cost: number;
    benefit: string;
    effects: TechnologyEffects;
  }
> = {
  [TechnologyType.ERP]: {
    name: 'Basic ERP',
    category: TechnologyCategory.VISIBILITY,
    cost: 2000000,
    benefit: 'See all inventory locations, -5% holding cost',
    effects: { holdingCostReduction: 0.05 },
  },
  [TechnologyType.CONTROL_TOWER]: {
    name: 'Control Tower',
    category: TechnologyCategory.VISIBILITY,
    cost: 4000000,
    benefit: 'Real-time alerts, +3% on-time, -10% event impact',
    effects: { onTimeBonus: 0.03, eventResponseBonus: 0.1 },
  },
  [TechnologyType.APS]: {
    name: 'Advanced Planning (APS)',
    category: TechnologyCategory.PLANNING,
    cost: 3000000,
    benefit: '+5% effective capacity utilization',
    effects: { capacityUtilizationBonus: 0.05 },
  },
  [TechnologyType.DEMAND_SENSING]: {
    name: 'Demand Sensing',
    category: TechnologyCategory.PLANNING,
    cost: 2500000,
    benefit: '-10% forecast error (MAPE)',
    effects: { forecastErrorReduction: 0.1 },
  },
  [TechnologyType.SOP_WORKBENCH]: {
    name: 'S&OP Workbench',
    category: TechnologyCategory.PLANNING,
    cost: 1000000,
    benefit: 'Scenario planning tools',
    effects: { planningVisibility: true },
  },
  [TechnologyType.WMS]: {
    name: 'Warehouse Management (WMS)',
    category: TechnologyCategory.EXECUTION,
    cost: 1500000,
    benefit: '-10% holding cost',
    effects: { holdingCostReduction: 0.1 },
  },
  [TechnologyType.TMS]: {
    name: 'Transportation Management (TMS)',
    category: TechnologyCategory.EXECUTION,
    cost: 1500000,
    benefit: '-8% freight cost',
    effects: { freightCostReduction: 0.08 },
  },
  [TechnologyType.OMS]: {
    name: 'Order Management (OMS)',
    category: TechnologyCategory.EXECUTION,
    cost: 1000000,
    benefit: '+5% Perfect Order',
    effects: { perfectOrderBonus: 0.05 },
  },
  [TechnologyType.ANALYTICS]: {
    name: 'SC Analytics Dashboard',
    category: TechnologyCategory.ANALYTICS,
    cost: 1000000,
    benefit: 'Detailed KPI tracking & benchmarks',
    effects: { analyticsEnabled: true },
  },
};

export const INSPECTION_CONFIG: Record<
  InspectionLevel,
  { cost: number; detection: number; labor: number }
> = {
  [InspectionLevel.NONE]: { cost: 0, detection: 0.2, labor: 1.0 },
  [InspectionLevel.BASIC]: { cost: 2, detection: 0.7, labor: 1.05 },
  [InspectionLevel.FULL]: { cost: 5, detection: 0.95, labor: 1.15 },
};

export const SHIPPING_CONFIG: Record<
  ShippingMode,
  { cost: number; days: number; onTimeBonus: number }
> = {
  [ShippingMode.STANDARD]: { cost: 3, days: 7, onTimeBonus: 0 },
  [ShippingMode.EXPRESS]: { cost: 5, days: 3, onTimeBonus: 0.03 },
  [ShippingMode.AIR]: { cost: 10, days: 1, onTimeBonus: 0.08 },
};

export const SUPPLIER_CONFIG: Record<
  SupplierType,
  {
    id: string;
    name: string;
    location: string;
    leadTime: number;
    costMultiplier: number;
    unitCost: number;
    premium: number;
    minOrder: number;
    maxOrder: number;
    description: string;
    baseOnTime: number;
    baseQuality: number;
    baseFlexibility: number;
  }
> = {
  [SupplierType.GLOBAL]: {
    id: 'GLOBAL',
    name: 'Global Parts Co.',
    location: 'Asia-Pacific',
    leadTime: 1,
    costMultiplier: 1.0,
    unitCost: 150,
    premium: 1.0,
    minOrder: 100000,
    maxOrder: 2000000,
    description: 'Low cost, 1 quarter lead time',
    baseOnTime: 0.92,
    baseQuality: 0.95,
    baseFlexibility: 0.6,
  },
  [SupplierType.REGIONAL]: {
    id: 'REGIONAL',
    name: 'Regional Supply Inc.',
    location: 'Domestic',
    leadTime: 0,
    costMultiplier: 1.15,
    unitCost: 172.5,
    premium: 1.15,
    minOrder: 0,
    maxOrder: 500000,
    description: '+15% cost, same quarter delivery',
    baseOnTime: 0.95,
    baseQuality: 0.93,
    baseFlexibility: 0.9,
  },
};

// Supplier scorecard configuration (matching GAS flexeesuppliers.gs)
export const SUPPLIER_SCORECARD_CONFIG = {
  WEIGHTS: {
    onTime: 0.3, // 30% - delivery reliability
    quality: 0.25, // 25% - defect-free rate
    cost: 0.25, // 25% - cost competitiveness
    flexibility: 0.2, // 20% - responsiveness
  },
  VARIABILITY: {
    onTime: 0.05, // ±5% random variation
    quality: 0.03, // ±3% random variation
  },
  RATINGS: {
    EXCELLENT: 90,
    GOOD: 80,
    ACCEPTABLE: 70,
    POOR: 60,
  },
};

// Add after SUPPLIER_SCORECARD_CONFIG

export const CARRIER_CONFIG: Record<
  CarrierMode,
  {
    name: string;
    costPerUnit: number;
    onTimeRate: number;
    damageRate: number;
    volumeDiscountThreshold: number;
    volumeDiscountRate: number;
  }
> = {
  [CarrierMode.TRUCK]: {
    name: 'Truck',
    costPerUnit: 3.5,
    onTimeRate: 0.93,
    damageRate: 0.005,
    volumeDiscountThreshold: 100000,
    volumeDiscountRate: 0.1,
  },
  [CarrierMode.INTERMODAL]: {
    name: 'Intermodal',
    costPerUnit: 1.5,
    onTimeRate: 0.8,
    damageRate: 0.01,
    volumeDiscountThreshold: 200000,
    volumeDiscountRate: 0.15,
  },
  [CarrierMode.AIR]: {
    name: 'Air',
    costPerUnit: 12.0,
    onTimeRate: 1.0,
    damageRate: 0.0,
    volumeDiscountThreshold: 50000,
    volumeDiscountRate: 0.05,
  },
};

export const WARRANTY_TIER_CONFIG: Record<
  WarrantyTier,
  {
    name: string;
    pricePerUnit: number;
    includesPart: boolean;
    includesService: boolean;
    churnMultiplier: number;
    csiPenalty: number;
  }
> = {
  [WarrantyTier.NONE]: {
    name: 'No Warranty',
    pricePerUnit: 0,
    includesPart: false,
    includesService: false,
    churnMultiplier: 1.15,
    csiPenalty: 5,
  },
  [WarrantyTier.BASIC]: {
    name: 'Basic Warranty',
    pricePerUnit: 1.5,
    includesPart: true,
    includesService: false,
    churnMultiplier: 0.95,
    csiPenalty: -2,
  },
  [WarrantyTier.STANDARD]: {
    name: 'Standard Warranty',
    pricePerUnit: 2.1,
    includesPart: true,
    includesService: true,
    churnMultiplier: 0.85,
    csiPenalty: 0,
  },
  [WarrantyTier.PREMIUM]: {
    name: 'Premium Warranty',
    pricePerUnit: 3.0,
    includesPart: true,
    includesService: true,
    churnMultiplier: 0.75,
    csiPenalty: -5,
  },
};

export const DISPOSAL_METHOD_CONFIG: Record<
  DisposalMethod,
  {
    name: string;
    costPerUnit: number;
    recoveryPerUnit: number;
    greenScoreChange: number;
  }
> = {
  [DisposalMethod.LANDFILL]: {
    name: 'Landfill',
    costPerUnit: 5,
    recoveryPerUnit: 0,
    greenScoreChange: -10,
  },
  [DisposalMethod.RECYCLE]: {
    name: 'Recycle',
    costPerUnit: 15,
    recoveryPerUnit: 0,
    greenScoreChange: 5,
  },
  [DisposalMethod.REFURBISH]: {
    name: 'Refurbish',
    costPerUnit: 25,
    recoveryPerUnit: 40,
    greenScoreChange: 10,
  },
};

export const CAPACITY_EXPANSION_CONFIG: Record<
  ExpansionType,
  {
    name: string;
    cost: number;
    unitsPerQuarter: number;
    buildTime: number;
    maintenance: number;
  }
> = {
  [ExpansionType.SMALL_LINE]: {
    name: 'Small Line',
    cost: 8000000,
    unitsPerQuarter: 50000,
    buildTime: 1,
    maintenance: 200000,
  },
  [ExpansionType.MEDIUM_LINE]: {
    name: 'Medium Line',
    cost: 15000000,
    unitsPerQuarter: 100000,
    buildTime: 2,
    maintenance: 350000,
  },
  [ExpansionType.LARGE_LINE]: {
    name: 'Large Line',
    cost: 25000000,
    unitsPerQuarter: 200000,
    buildTime: 3,
    maintenance: 500000,
  },
};

export const DC_CONFIG = {
  CENTRAL: {
    name: 'Central Distribution Center',
    location: 'Central Region',
    setupCost: 4000000,
    quarterlyOpex: 700000,
    capacity: 200000,
    serviceBonus: 0.03, // +3% on-time delivery bonus
    regionServed: 'R1',
  },
  WEST: {
    name: 'West Distribution Center',
    location: 'West Region',
    setupCost: 6000000,
    quarterlyOpex: 900000,
    capacity: 150000,
    serviceBonus: 0.02, // +2% on-time delivery bonus
    regionServed: 'R3',
  },
  DISPOSAL_VALUE_RATE: 0.3,
  TRANSFER_COSTS: {
    DC_TO_DC: 1.5,
    DC_TO_FACTORY: 2.0,
  },
};

export const VMI_CONFIG = {
  SETUP_COST: 2000000,
  QUARTERLY_COST: 100000,
  EFFECTS: {
    PANIC_THRESHOLD_MULTIPLIER: 0.5,        // panic triggers at lower threshold (less sensitive)
    CLEARANCE_THRESHOLD_MULTIPLIER: 1.5,    // clearance triggers at higher threshold (less sensitive)
    PANIC_ORDER_MULTIPLIER: 1.3,            // smoother than non-VMI's 1.5
    CLEARANCE_ORDER_MULTIPLIER: 0.7,        // smoother than non-VMI's 0.5
  },
};

// ============================================================================
// TYPE INTERFACES FOR SIMULATION PROCESSING
// ============================================================================

/**
 * Result from processing Regional Distribution Centers
 */
export interface RegionalDCResult {
  setupCost: number;
  disposalRevenue: number;
  transferCost: number;
  opex: number;
  dcCentralOpen: boolean;
  dcCentralInventory: number;
  dcWestOpen: boolean;
  dcWestInventory: number;
  serviceBonus: number;
  totalDCOpex: number;
  inventoryAllocated: number;
  inventoryReturnedToFactory: number;
}

// ============================================================================
// STUDENT ONBOARDING SCHEMA (DA Flow)
// ============================================================================

export type StudentOnboardingDocument = StudentOnboarding & Document;

@Schema({ timestamps: true, collection: 'student_onboardings' })
export class StudentOnboarding {
  @Prop({ type: Types.ObjectId, ref: 'Simulation', required: true })
  simulation: Types.ObjectId;

  // Optional firm assignment at invite time. Faculty can assign to a firm
  // up front, or leave it null and have the student pick a firm at accept.
  @Prop({ type: Types.ObjectId, ref: 'Firm', default: null })
  firm: Types.ObjectId | null;

  @Prop({ type: Number, default: null })
  firmNumber: number | null;

  // Email is the invite key. A user record may not exist yet — that's the
  // whole point of this flow. When the student accepts, we either link to
  // an existing User by email or create one.
  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  // Once accepted, this points to the User record (existing or freshly created)
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  user: Types.ObjectId | null;

  // Cryptographic invite token. Sent to student via email; required to accept.
  @Prop({ required: true, unique: true })
  inviteToken: string;

  @Prop({ enum: InviteStatus, default: InviteStatus.PENDING })
  status: InviteStatus;

  // Faculty member who created the invite
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  invitedBy: Types.ObjectId;

  // Optional personal note from faculty included in the invite email
  @Prop()
  inviteMessage?: string;

  // 30-day expiry by default. Status flips to EXPIRED on access after this.
  @Prop({ default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) })
  expiresAt: Date;

  @Prop()
  acceptedAt?: Date;

  @Prop()
  rejectedAt?: Date;

  // Email notification tracking — set true once the email send succeeded
  @Prop({ default: false })
  sentEmailNotification: boolean;

  @Prop()
  emailSentAt?: Date;

  // Bulk import grouping — every row in a single CSV upload shares this ID
  // so faculty can see "Spring 2026 cohort upload" as a single batch in
  // the management UI. Null for one-off invites.
  @Prop()
  bulkImportId?: string;

  @Prop()
  rowNumber?: number;
}

export const StudentOnboardingSchema =
  SchemaFactory.createForClass(StudentOnboarding);

StudentOnboardingSchema.index(
  { simulation: 1, email: 1 },
  { unique: true },
);
StudentOnboardingSchema.index({ inviteToken: 1 }, { unique: true });
StudentOnboardingSchema.index({ status: 1, expiresAt: 1 });
StudentOnboardingSchema.index({ user: 1 });
StudentOnboardingSchema.index({ bulkImportId: 1 });

/**
 * Result from processing Multi-Carrier Selection
 */
export interface MultiCarrierResult {
  carrierMode: string;
  carrierName: string;
  costPerUnit: number;
  baseCostPerUnit: number;
  lastMileCost: number;
  forcedAir: boolean;
  unitsShipped: number;
  baseFreightCost: number;
  volumeDiscount: number;
  volumeDiscountAmount: number;
  tmsDiscount: number;
  tmsDiscountAmount: number;
  freightCost: number;
  onTimeRate: number;
  onTimeBonus: number;
  damageRate: number;
}

/**
 * Result from processing DC Sales fulfillment
 */
export interface DCSalesResult {
  r1Sales: number;
  r2Sales: number;
  r3Sales: number;
  dcSales: number;
  totalSales: number;
  dcServiceBonus: number;
  updatedDCResult: RegionalDCResult;
  remainingFactoryInventory: number;
}
