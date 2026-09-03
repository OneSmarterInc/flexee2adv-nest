// src/modules/simulation/simulation.service.ts
// FLEXEE 2.0 Supply Chain Simulation - FIXED VERSION
// Key Fix: Consistent ObjectId usage in all queries

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateSimulationDto } from './dto/create-simulation.dto';
import {
  UpdateSimulationDto,
  SimulationStatus,
} from './dto/update-simulation.dto';
import {
  EnrollParticipantsDto,
  EnrollmentResponseDto,
  FirmWithEnrollmentsDto,
} from './dto/enroll-participants.dto';
import { TriggerEventDto } from './dto/trigger-event.dto';
import { UpdateFeaturesDto } from './dto/update-features.dto';
import { ModuleScheduleDto } from './dto/create-simulation.dto';
import {
  buildScheduleFromDto,
  mergeScheduleUpdate,
  syncFeaturesFromSchedule,
  getScheduleStatus,
} from './helpers/module-schedule';
import { maybeAutoAdvance } from './helpers/auto-advance';
import { ModuleSchedule } from '@/entities/index.entity';
import {
  Simulation,
  SimulationDocument,
  Firm,
  FirmDocument,
  QuarterState,
  QuarterStateDocument,
  Decision,
  DecisionDocument,
  DemandHistory,
  DemandHistoryDocument,
  Enrollment,
  EnrollmentDocument,
  User,
  UserDocument,
  Event,
  EventDocument,
  KpiHistory,
  KpiHistoryDocument,
  IntelligenceReport,
  IntelligenceReportDocument,
  WarrantyClaim,
  WarrantyClaimDocument,
  GreenScoreHistory,
  GreenScoreHistoryDocument,
  EnrollmentStatus,
  RetailerMode,
  UserRole,
  ScMaturityLevel,
  DecisionStatus,
  WarrantyTier,
  DisposalMethod,
  CarrierMode,
  TechnologyType,
  DCStatus,
  TransferDestination,
  ForecastMethod,
  ExpansionType,
  InspectionLevel,
  ShippingMode,
  SupplierOrder,
  SupplierOrderDocument,
  SupplierMetrics,
  SupplierPerformance,
  SUPPLIER_SCORECARD_CONFIG,
  INSPECTION_CONFIG,
  SHIPPING_CONFIG,
  SupplierType,
  SUPPLIER_CONFIG,
  ForecastLogDocument,
  ForecastLog,
  EnrollmentRole,
  TenQReportDocument,
  TenQReport,
  CreditHistoryDocument,
  CreditHistory,
  EventImpact,
  EventImpactDocument,
  RegionalDCResult,
  MultiCarrierResult,
  DCSalesResult,
  Technology,
  TechnologyDocument,
  ParticipantOnboarding,
  ParticipantOnboardingDocument,
} from '../../entities/index.entity';
import {
  processCustomerPools,
  CustomerPoolsResult,
  SCRMDecisions,
  CUSTOMER_POOLS_CONFIG,
} from './processors/customer-pools.processor';

import {
  calculateSCRMRiskAssessment,
  SCRMRiskResult,
  SCRMRiskInputs, // ADD THIS
} from './processors/scrm-risk.processor';

// Add to entity imports:
import { SCRMHistory, SCRMHistoryDocument } from '../../entities/index.entity';

import { CONFIG } from './simulation.config';

// ============================================================================
// CONFIGURATION
// ============================================================================
// INTERFACES
// ============================================================================
// INTERFACES
// ============================================================================

interface DemandData {
  demandR1: number;
  demandR2: number;
  demandR3: number;
  totalDemand: number;
  seasonalMultiplier: number;
  calendarQuarter: number;
  variabilityApplied: number;
}

interface QuarterResult {
  firmId: Types.ObjectId;
  firmNumber: number;
  // Demand and channel position - what the market offered, what the retail
  // channel actually pulled, and what was sold direct.
  marketDemand: number;
  seasonalMultiplier: number;
  firmDemand: number;
  retailDemand: number;
  directDemand: number;
  shipmentToRetailer: number;
  retailSales: number;
  directSales: number;
  retailerMode: RetailerMode;
  retailerCoverageMonths: number;
  revenue: number;
  netIncome: number;
  grossProfit: number;
  cogs: number;
  operatingExpenses: number;
  interest: number;
  laborCost: number;
  holdingCost: number;
  marketingCost: number;
  qualityCost: number;
  freightCost: number;
  techMaintenanceCost: number;
  dcOpex: number;
  expansionMaintenance: number;
  warrantyCost: number;
  disposalCost: number;
  unitsSold: number;
  unitsProduced: number;
  fillRate: number;
  defectRate: number;
  perfectOrder: number;
  capacityUtilization: number;
  rawMaterialUnits: number;
  finishedGoodsUnits: number;
  retailerInventory: number;
  inTransitUnits: number;
  dcCentralInventory: number;
  dcWestInventory: number;
  csi: number;
  greenScore: number;
  marketShare: number;
  customersLoyal: number;
  customersInPlay: number;
  customersChurned: number;
  cash: number;
  // Perfect Order Components (from quarterState.perfectOrder)
  poOnTime: number;
  poInFull: number;
  poDamageFree: number;
  poDocumentation: number;
  // VMI impact — populated every quarter (zeros when VMI inactive)
  vmiSnapshot: {
    active: boolean;
    setupCost: number;
    ongoingCost: number;
    totalCostThisQuarter: number;
    retailerMode: RetailerMode;
    coverageMonths: number;
    effectivePanicThreshold: number;
    effectiveClearanceThreshold: number;
    clearancePrevented: boolean;
    panicPrevented: boolean;
    revenueProtected: number;
    csiProtected: number;
    shipmentToRetailer: number;
    cumulativeSetupCost: number;
    cumulativeOngoingCost: number;
    cumulativeTotalCost: number;
    cumulativeRevenueProtected: number;
    cumulativeCsiProtected: number;
    cumulativeNetBenefit: number;
  };
}
interface CreditScore {
  currentRatioScore: number;
  debtToEquityScore: number;
  profitMarginScore: number;
  interestCoverageScore: number;
  cashFlowScore: number;
  totalScore: number;
}

interface CreditTier {
  name: string;
  minScore: number;
  creditMultiplier: number;
  annualRate: number;
}

interface CreditFacilityResult {
  // Scoring
  creditScore: CreditScore;
  tier: CreditTier;
  creditLimit: number;

  // Current position
  previousDebt: number;
  interestCharge: number;

  // Auto-borrow (if cash < floor)
  autoBorrowAmount: number;

  // Auto-repay (if cash > ceiling)
  autoRepayAmount: number;

  // Overlimit handling
  isOverlimit: boolean;
  overlimitAmount: number;
  overlimitFee: number;

  // Forced asset sale (if severely overlimit)
  forcedSaleTriggered: boolean;
  inventorySold: number;
  forcedSaleRecovery: number;

  // Final position
  newDebt: number;
  newCash: number;
  effectiveInterestRate: number;
}

interface FinancialMetrics {
  cash: number;
  accountsReceivable: number;
  inventoryValue: number;
  fixedAssets: number;
  accountsPayable: number;
  shortTermDebt: number;
  longTermDebt: number;
  revenue: number;
  netIncome: number;
  operatingIncome: number;
  interestExpense: number;
}
interface StartingPosition {
  rawMaterialUnits: number;
  finishedGoodsUnits: number;
  accountsReceivable: number;
  fixedAssets: number;
  accountsPayable: number;
  shortTermDebt: number;
  longTermDebt: number;
}

interface FeatureFlags {
  // Base features (default: true)
  seasonality: boolean; // Applies seasonal demand multipliers
  randomEvents: boolean; // Processes random market events
  customerChurn: boolean; // Customer pool movement logic
  retailerBrain: boolean; // Retailer panic/clearance modes
  regionalCompetition: boolean; // Regional price sensitivity
  demandForecasting: boolean; // Forecast accuracy tracking
  perfectOrderTracking: boolean; // Perfect order metric calculation
  technologyInvestments: boolean; // Tech purchase and maintenance
  qualityControl: boolean; // Inspection levels and defect detection
  transportLogistics: boolean; // Basic shipping mode selection

  // Advanced modules (default: false)
  capacityExpansion: boolean; // Production line expansion
  regionalDCs: boolean; // Central and West distribution centers
  multiCarrierSelection: boolean; // Carrier mode with volume discounts
  returnsGreenScore: boolean; // Warranty and disposal/green score
  intelligenceCenter: boolean; // Market intelligence reports
  vmi: boolean; // Vendor managed inventory

  // Analytics mode modules (default: false)
  analyticsMode: boolean; // Customer segment allocation
  productInnovation: boolean; // P3 product development
  marketExpansion: boolean; // R4-R6 regional expansion
}

interface ExpansionInProgress {
  type: ExpansionType;
  capacity: number;
  maintenance: number;
  completesQ: number;
}

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class SimulationService {
  constructor(
    @InjectModel(Simulation.name)
    private simulationModel: Model<SimulationDocument>,
    @InjectModel(Firm.name) private firmModel: Model<FirmDocument>,
    @InjectModel(QuarterState.name)
    private quarterStateModel: Model<QuarterStateDocument>,
    @InjectModel(Decision.name) private decisionModel: Model<DecisionDocument>,
    @InjectModel(DemandHistory.name)
    private demandHistoryModel: Model<DemandHistoryDocument>,
    @InjectModel(Enrollment.name)
    private enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @InjectModel(KpiHistory.name)
    private kpiHistoryModel: Model<KpiHistoryDocument>,
    @InjectModel(IntelligenceReport.name)
    private intelligenceReportModel: Model<IntelligenceReportDocument>,
    @InjectModel(WarrantyClaim.name)
    private warrantyClaimModel: Model<WarrantyClaimDocument>,
    @InjectModel(GreenScoreHistory.name)
    private greenScoreHistoryModel: Model<GreenScoreHistoryDocument>,
    @InjectModel(SupplierOrder.name)
    private supplierOrderModel: Model<SupplierOrderDocument>,
    @InjectModel(ForecastLog.name)
    private forecastLogModel: Model<ForecastLogDocument>,
    @InjectModel(TenQReport.name)
    private tenqReportModel: Model<TenQReportDocument>,
    @InjectModel(CreditHistory.name)
    private creditHistoryModel: Model<CreditHistoryDocument>,
    @InjectModel(SCRMHistory.name)
    private scrmHistoryModel: Model<SCRMHistoryDocument>,
    @InjectModel(EventImpact.name)
    private eventImpactModel: Model<EventImpactDocument>,
    @InjectModel(Technology.name)
    private technologyModel: Model<TechnologyDocument>,
    @InjectModel(ParticipantOnboarding.name)
    private participantOnboardingModel: Model<ParticipantOnboardingDocument>,
  ) {}

  // ============================================================================
  // HELPER: Convert string to ObjectId safely
  // ============================================================================

  private toObjectId(id: string | Types.ObjectId): Types.ObjectId {
    if (id instanceof Types.ObjectId) return id;
    return new Types.ObjectId(id);
  }

  /**
   * Calculate creditworthiness score based on 5 financial metrics
   * Matching GAS calculateCreditworthiness_() function
   */
  private calculateCreditworthinessScore(
    metrics: FinancialMetrics,
  ): CreditScore {
    const W = CONFIG.credit.SCORING_WEIGHTS;
    const T = CONFIG.credit.SCORING_THRESHOLDS;

    // Calculate financial ratios
    const currentAssets =
      metrics.cash + metrics.accountsReceivable + metrics.inventoryValue;
    const currentLiabilities = metrics.accountsPayable + metrics.shortTermDebt;
    const totalDebt = metrics.shortTermDebt + metrics.longTermDebt;
    const totalAssets = currentAssets + metrics.fixedAssets;
    const equity = totalAssets - (currentLiabilities + metrics.longTermDebt);

    // 1. Current Ratio Score (20 pts)
    const currentRatio =
      currentLiabilities > 0 ? currentAssets / currentLiabilities : 999;
    let currentRatioScore = 0;
    if (currentRatio >= T.CURRENT_RATIO.excellent) {
      currentRatioScore = W.CURRENT_RATIO;
    } else if (currentRatio >= T.CURRENT_RATIO.good) {
      currentRatioScore = W.CURRENT_RATIO * 0.8;
    } else if (currentRatio >= T.CURRENT_RATIO.fair) {
      currentRatioScore = W.CURRENT_RATIO * 0.6;
    } else if (currentRatio >= T.CURRENT_RATIO.poor) {
      currentRatioScore = W.CURRENT_RATIO * 0.3;
    } else {
      currentRatioScore = W.CURRENT_RATIO * 0.1;
    }

    // 2. Debt to Equity Score (25 pts) - Lower is better
    const debtToEquity = equity > 0 ? totalDebt / equity : 999;
    let debtToEquityScore = 0;
    if (debtToEquity <= T.DEBT_TO_EQUITY.excellent) {
      debtToEquityScore = W.DEBT_TO_EQUITY;
    } else if (debtToEquity <= T.DEBT_TO_EQUITY.good) {
      debtToEquityScore = W.DEBT_TO_EQUITY * 0.8;
    } else if (debtToEquity <= T.DEBT_TO_EQUITY.fair) {
      debtToEquityScore = W.DEBT_TO_EQUITY * 0.6;
    } else if (debtToEquity <= T.DEBT_TO_EQUITY.poor) {
      debtToEquityScore = W.DEBT_TO_EQUITY * 0.3;
    } else {
      debtToEquityScore = W.DEBT_TO_EQUITY * 0.1;
    }

    // 3. Profit Margin Score (20 pts)
    const profitMargin =
      metrics.revenue > 0 ? metrics.netIncome / metrics.revenue : 0;
    let profitMarginScore = 0;
    if (profitMargin >= T.PROFIT_MARGIN.excellent) {
      profitMarginScore = W.PROFIT_MARGIN;
    } else if (profitMargin >= T.PROFIT_MARGIN.good) {
      profitMarginScore = W.PROFIT_MARGIN * 0.8;
    } else if (profitMargin >= T.PROFIT_MARGIN.fair) {
      profitMarginScore = W.PROFIT_MARGIN * 0.6;
    } else if (profitMargin >= T.PROFIT_MARGIN.poor) {
      profitMarginScore = W.PROFIT_MARGIN * 0.3;
    } else {
      profitMarginScore = W.PROFIT_MARGIN * 0.1;
    }

    // 4. Interest Coverage Score (15 pts)
    const interestCoverage =
      metrics.interestExpense > 0
        ? metrics.operatingIncome / metrics.interestExpense
        : 999;
    let interestCoverageScore = 0;
    if (interestCoverage >= T.INTEREST_COVERAGE.excellent) {
      interestCoverageScore = W.INTEREST_COVERAGE;
    } else if (interestCoverage >= T.INTEREST_COVERAGE.good) {
      interestCoverageScore = W.INTEREST_COVERAGE * 0.8;
    } else if (interestCoverage >= T.INTEREST_COVERAGE.fair) {
      interestCoverageScore = W.INTEREST_COVERAGE * 0.6;
    } else if (interestCoverage >= T.INTEREST_COVERAGE.poor) {
      interestCoverageScore = W.INTEREST_COVERAGE * 0.3;
    } else {
      interestCoverageScore = W.INTEREST_COVERAGE * 0.1;
    }

    // 5. Cash Flow Score (20 pts) - Cash relative to floor
    const cashFloorRatio = metrics.cash / CONFIG.credit.CASH_FLOOR;
    let cashFlowScore = 0;
    if (cashFloorRatio >= T.CASH_FLOW.excellent) {
      cashFlowScore = W.CASH_FLOW;
    } else if (cashFloorRatio >= T.CASH_FLOW.good) {
      cashFlowScore = W.CASH_FLOW * 0.8;
    } else if (cashFloorRatio >= T.CASH_FLOW.fair) {
      cashFlowScore = W.CASH_FLOW * 0.6;
    } else if (cashFloorRatio >= T.CASH_FLOW.poor) {
      cashFlowScore = W.CASH_FLOW * 0.3;
    } else {
      cashFlowScore = W.CASH_FLOW * 0.1;
    }

    const totalScore = Math.round(
      currentRatioScore +
        debtToEquityScore +
        profitMarginScore +
        interestCoverageScore +
        cashFlowScore,
    );

    return {
      currentRatioScore: Math.round(currentRatioScore),
      debtToEquityScore: Math.round(debtToEquityScore),
      profitMarginScore: Math.round(profitMarginScore),
      interestCoverageScore: Math.round(interestCoverageScore),
      cashFlowScore: Math.round(cashFlowScore),
      totalScore: Math.min(100, Math.max(0, totalScore)),
    };
  }

  /**
   * Determine credit tier based on creditworthiness score
   */
  private determineCreditTier(score: number): CreditTier {
    const tiers = CONFIG.credit.TIERS;

    if (score >= tiers.EXCELLENT.minScore) return tiers.EXCELLENT;
    if (score >= tiers.GOOD.minScore) return tiers.GOOD;
    if (score >= tiers.FAIR.minScore) return tiers.FAIR;
    if (score >= tiers.POOR.minScore) return tiers.POOR;
    return tiers.DISTRESSED;
  }

  /**
   * Process credit facility for a firm during quarter processing
   * Handles auto-borrow, auto-repay, overlimit fees, and forced sales
   * Matching GAS processCreditFacility_() function
   */
  private processCreditFacility(
    metrics: FinancialMetrics,
    rawMaterialUnits: number,
    finishedGoodsUnits: number,
  ): CreditFacilityResult {
    const CF = CONFIG.credit;
    const C = CONFIG.costs;

    // Step 1: Calculate creditworthiness and determine tier
    const creditScore = this.calculateCreditworthinessScore(metrics);
    const tier = this.determineCreditTier(creditScore.totalScore);
    const creditLimit = CF.BASE_CREDIT_LINE * tier.creditMultiplier;

    // Step 2: Calculate interest on existing debt (quarterly rate)
    const previousDebt = metrics.shortTermDebt;
    const quarterlyRate = tier.annualRate / 4;
    const interestCharge = previousDebt * quarterlyRate;

    // Initialize tracking variables
    let currentCash = metrics.cash;
    let currentDebt = previousDebt;
    let autoBorrowAmount = 0;
    let autoRepayAmount = 0;
    let overlimitAmount = 0;
    let overlimitFee = 0;
    let forcedSaleTriggered = false;
    let inventorySold = 0;
    let forcedSaleRecovery = 0;

    // Step 3: Deduct interest from cash
    currentCash -= interestCharge;

    // Step 4: Auto-borrow if cash falls below floor
    if (currentCash < CF.CASH_FLOOR) {
      const shortfall = CF.CASH_FLOOR - currentCash;
      autoBorrowAmount = shortfall;
      currentDebt += autoBorrowAmount;
      currentCash = CF.CASH_FLOOR;
    }

    // Step 5: Check overlimit status
    const isOverlimit = currentDebt > creditLimit;
    if (isOverlimit) {
      overlimitAmount = currentDebt - creditLimit;
      overlimitFee = overlimitAmount * CF.OVERLIMIT_FEE_RATE;
      currentCash -= overlimitFee;

      // Step 6: Check for severe overlimit - trigger forced asset sale
      if (currentDebt > creditLimit * CF.SEVERE_OVERLIMIT_THRESHOLD) {
        forcedSaleTriggered = true;

        // Calculate inventory to liquidate (10% of total)
        const totalInventoryUnits = rawMaterialUnits + finishedGoodsUnits;
        inventorySold = Math.floor(
          totalInventoryUnits * CF.FORCED_SALE_INVENTORY_PERCENT,
        );

        // Calculate recovery value (50% of inventory value)
        const avgUnitValue = (C.RAW_MATERIAL_COST + C.STANDARD_COGS) / 2;
        forcedSaleRecovery =
          inventorySold * avgUnitValue * CF.FORCED_SALE_RECOVERY_RATE;

        // Apply recovery to debt reduction
        currentDebt = Math.max(0, currentDebt - forcedSaleRecovery);
      }

      // Re-borrow if overlimit fee pushed us below floor
      if (currentCash < CF.CASH_FLOOR) {
        const additionalBorrow = CF.CASH_FLOOR - currentCash;
        autoBorrowAmount += additionalBorrow;
        currentDebt += additionalBorrow;
        currentCash = CF.CASH_FLOOR;
      }
    }

    // Step 7: Auto-repay if cash exceeds ceiling
    if (currentCash > CF.CASH_CEILING && currentDebt > 0) {
      const excessCash = currentCash - CF.CASH_CEILING;
      autoRepayAmount = Math.min(
        excessCash * CF.AUTO_REPAY_PERCENT,
        currentDebt,
      );
      currentDebt -= autoRepayAmount;
      currentCash -= autoRepayAmount;
    }

    // Calculate effective interest rate (for reporting)
    const totalCharges = interestCharge + overlimitFee;
    const effectiveRate =
      previousDebt > 0 ? (totalCharges / previousDebt) * 4 : tier.annualRate;

    return {
      creditScore,
      tier,
      creditLimit,
      previousDebt,
      interestCharge,
      autoBorrowAmount,
      autoRepayAmount,
      isOverlimit,
      overlimitAmount,
      overlimitFee,
      forcedSaleTriggered,
      inventorySold,
      forcedSaleRecovery,
      newDebt: currentDebt,
      newCash: currentCash,
      effectiveInterestRate: effectiveRate,
    };
  }

  /**
   * Record credit facility history to database
   */
  private async recordCreditHistory(
    simulationId: Types.ObjectId,
    firmId: Types.ObjectId,
    quarter: number,
    beginningCash: number,
    creditResult: CreditFacilityResult,
  ): Promise<void> {
    await this.creditHistoryModel.create({
      simulation: simulationId,
      firm: firmId,
      quarter,
      creditScore: creditResult.creditScore,
      tierName: creditResult.tier.name,
      creditLimit: creditResult.creditLimit,
      annualRate: creditResult.tier.annualRate,
      effectiveRate: creditResult.effectiveInterestRate,
      beginningDebt: creditResult.previousDebt,
      endingDebt: creditResult.newDebt,
      interestCharge: creditResult.interestCharge,
      autoBorrowAmount: creditResult.autoBorrowAmount,
      autoRepayAmount: creditResult.autoRepayAmount,
      wasOverlimit: creditResult.isOverlimit,
      overlimitAmount: creditResult.overlimitAmount,
      overlimitFee: creditResult.overlimitFee,
      forcedSaleTriggered: creditResult.forcedSaleTriggered,
      inventorySoldUnits: creditResult.inventorySold,
      forcedSaleRecovery: creditResult.forcedSaleRecovery,
      beginningCash,
      endingCash: creditResult.newCash,
    });
  }

  /**
   * Get credit facility history for a firm
   */
  async getCreditHistory(
    simulationId: string,
    firmId: string,
    quarters?: number,
  ): Promise<any> {
    const firm = await this.resolveFirm(simulationId, firmId);
    const simObjectId = this.toObjectId(simulationId);

    let query = this.creditHistoryModel
      .find({ simulation: simObjectId, firm: firm._id })
      .sort({ quarter: -1 });

    if (quarters) {
      query = query.limit(quarters);
    }

    const history = await query;

    // Calculate summary statistics
    const summary = {
      currentTier: history[0]?.tierName || 'N/A',
      currentScore: history[0]?.creditScore?.totalScore || 0,
      currentCreditLimit: history[0]?.creditLimit || 0,
      currentDebt: history[0]?.endingDebt || 0,
      utilizationRate: history[0]
        ? (history[0].endingDebt / history[0].creditLimit) * 100
        : 0,
      totalInterestPaid: history.reduce((sum, h) => sum + h.interestCharge, 0),
      totalOverlimitFees: history.reduce((sum, h) => sum + h.overlimitFee, 0),
      timesOverlimit: history.filter((h) => h.wasOverlimit).length,
      forcedSalesCount: history.filter((h) => h.forcedSaleTriggered).length,
    };

    return {
      firmId: firm._id,
      firmNumber: firm.firmNumber,
      summary,
      history: quarters ? history.reverse() : history,
    };
  }

  // ============================================================================
  // CREATE SIMULATION
  // ============================================================================

  async create(
    userId: string,
    dto: CreateSimulationDto,
  ): Promise<SimulationDocument> {
    const simulation = new this.simulationModel({
      name: dto.name,
      description: dto.description,
      status: SimulationStatus.CREATED,
      currentQuarter: 0,
      maxQuarters: dto.maxQuarters ?? 12,
      numFirms: dto.numFirms ?? 3,
      numRegions: dto.numRegions ?? 3,
      numProducts: dto.numProducts ?? 2,
      startingRevenue:
        dto.startingRevenue ?? CONFIG.simulation.STARTING_REVENUE,
      startingCash: dto.startingCash ?? 50_000_000,
      totalMarketSize: dto.totalMarketSize ?? CONFIG.market.TOTAL_MARKET_SIZE,
      features: this.buildFeatureToggles(dto.features),
      moduleSchedule: buildScheduleFromDto(
        dto.moduleSchedule as any,
      ),
      quarterDurationDays: dto.quarterDurationDays ?? 14,
      seasonality: dto.seasonality ?? {
        q1Multiplier: CONFIG.seasonality.QUARTERS[1],
        q2Multiplier: CONFIG.seasonality.QUARTERS[2],
        q3Multiplier: CONFIG.seasonality.QUARTERS[3],
        q4Multiplier: CONFIG.seasonality.QUARTERS[4],
      },
      eventProbability: dto.eventProbability ?? 0.15,
      demandVariability: dto.demandVariability ?? 0.05,
      courseCode: dto.courseCode,
      institutionName: dto.institutionName,
      facilitatorIds: dto.facilitatorIds?.map((id) => this.toObjectId(id)) ?? [],
      owner: this.toObjectId(userId),
    });

    const savedSimulation = await simulation.save();
    const simulationId = savedSimulation._id as Types.ObjectId;
    const numFirms = dto.numFirms ?? 3;
    const startingCash = dto.startingCash ?? 50_000_000;

    try {
      // Create firms
      const firms: FirmDocument[] = [];
      for (let i = 1; i <= numFirms; i++) {
        const firmConfig = dto.firmConfigs?.find((f) => f.firmNumber === i);
        const firm = new this.firmModel({
          simulation: simulationId, // Use ObjectId directly
          firmNumber: i,
          name: firmConfig?.name ?? `Firm ${i}`,
          color: firmConfig?.color ?? this.getDefaultColor(i),
          currentCash: startingCash,
          currentCsi: 80,
          currentMarketShare: 1 / numFirms,
          cumulativeRevenue: 0,
          cumulativeProfit: 0,
          techOwned: [],
          members: [],
        });

        const savedFirm = await firm.save();
        firms.push(savedFirm);

        // Create initial Q0 state
        await this.createInitialQuarterState(
          simulationId,
          savedFirm._id as Types.ObjectId,
          numFirms,
          startingCash,
          savedSimulation.features as FeatureFlags,
        );
      }

      // Verify firms were created
      const firmCount = await this.firmModel.countDocuments({
        simulation: simulationId,
      });
      console.log(`Created ${firmCount} firms for simulation ${simulationId}`);

      if (firmCount === 0) {
        throw new Error('No firms were created');
      }

      // Pre-seed quarters Q1-Q3
      await this.preSeedQuarters(savedSimulation, firms);

      // Verify demand history was created
      const demandCount = await this.demandHistoryModel.countDocuments({
        simulation: simulationId,
      });
      console.log(
        `Created ${demandCount} demand history records for simulation ${simulationId}`,
      );

      // Verify KPI history was created
      const kpiCount = await this.kpiHistoryModel.countDocuments({
        simulation: simulationId,
      });
      console.log(
        `Created ${kpiCount} KPI history records for simulation ${simulationId}`,
      );

      // Update simulation status
      savedSimulation.currentQuarter =
        CONFIG.simulation.PREHISTORY_QUARTERS + 1;
      savedSimulation.status = SimulationStatus.INITIALIZED;

      // Open quarter window for the first decision quarter
      const startedAt = new Date();
      savedSimulation.quarterStartedAt = startedAt;
      savedSimulation.quarterEndsAt = new Date(
        startedAt.getTime() +
          savedSimulation.quarterDurationDays * 24 * 60 * 60 * 1000,
      );

      // Flip features ON for any modules unlocking at Q4
      const initSync = syncFeaturesFromSchedule(
        savedSimulation.moduleSchedule,
        savedSimulation.features as any,
        savedSimulation.currentQuarter,
      );
      savedSimulation.features = initSync.features as any;
      savedSimulation.markModified('features');

      await savedSimulation.save();
    } catch (error: any) {
      console.error('Error creating simulation:', error);
      await this.cleanupFailedSimulation(simulationId);
      throw new BadRequestException(
        `Failed to create simulation: ${error?.message || String(error)}`,
      );
    }

    return this.findOne(simulationId.toString());
  }

  private buildFeatureToggles(dto?: Partial<FeatureFlags>): FeatureFlags {
    return {
      seasonality: dto?.seasonality ?? true,
      randomEvents: dto?.randomEvents ?? true,
      customerChurn: dto?.customerChurn ?? true,
      retailerBrain: dto?.retailerBrain ?? true,
      regionalCompetition: dto?.regionalCompetition ?? true,
      demandForecasting: dto?.demandForecasting ?? true,
      perfectOrderTracking: dto?.perfectOrderTracking ?? true,
      technologyInvestments: dto?.technologyInvestments ?? true,
      qualityControl: dto?.qualityControl ?? true,
      transportLogistics: dto?.transportLogistics ?? true,
      capacityExpansion: dto?.capacityExpansion ?? false,
      regionalDCs: dto?.regionalDCs ?? false,
      multiCarrierSelection: dto?.multiCarrierSelection ?? false,
      returnsGreenScore: dto?.returnsGreenScore ?? false,
      intelligenceCenter: dto?.intelligenceCenter ?? false,
      vmi: dto?.vmi ?? false,
      analyticsMode: dto?.analyticsMode ?? false,
      productInnovation: dto?.productInnovation ?? false,
      marketExpansion: dto?.marketExpansion ?? false,
    };
  }

  private async cleanupFailedSimulation(
    simulationId: Types.ObjectId,
  ): Promise<void> {
    // Capture firmIds first — enrollments may reference firms whose
    // simulation pointer is null or detached, so a $or covers both paths.
    const firms = await this.firmModel.find({ simulation: simulationId });
    const firmIds = firms.map((f) => f._id);

    // Delete dependents first, then the simulation itself last. This
    // ordering means if a delete partially fails, the simulation doc
    // is still there and the cleanup can be retried.
    await Promise.all([
      // Firms and their derived data
      this.firmModel.deleteMany({ simulation: simulationId }),
      this.enrollmentModel.deleteMany({
        $or: [{ simulation: simulationId }, { firm: { $in: firmIds } }],
      }),

      // Quarter and demand data
      this.quarterStateModel.deleteMany({ simulation: simulationId }),
      this.demandHistoryModel.deleteMany({ simulation: simulationId }),

      // Financial and KPI data
      this.kpiHistoryModel.deleteMany({ simulation: simulationId }),
      this.decisionModel.deleteMany({ simulation: simulationId }),
      this.creditHistoryModel.deleteMany({ simulation: simulationId }),

      // Events, event impacts, and reports
      this.eventModel.deleteMany({ simulation: simulationId }),
      this.eventImpactModel.deleteMany({ simulation: simulationId }),
      this.intelligenceReportModel.deleteMany({ simulation: simulationId }),
      this.tenqReportModel.deleteMany({ simulation: simulationId }),

      // Warranty and green score data
      this.warrantyClaimModel.deleteMany({ simulation: simulationId }),
      this.greenScoreHistoryModel.deleteMany({ simulation: simulationId }),

      // Supplier, forecast, and tech investment data
      this.supplierOrderModel.deleteMany({ simulation: simulationId }),
      this.forecastLogModel.deleteMany({ simulation: simulationId }),
      this.technologyModel.deleteMany({ simulation: simulationId }),

      // Supply chain risk management
      this.scrmHistoryModel.deleteMany({ simulation: simulationId }),

      // Participant onboarding (invites)
      this.participantOnboardingModel.deleteMany({ simulation: simulationId }),
    ]);

    // Delete the simulation itself last so a partial failure leaves a
    // retry-able state instead of orphaned dependents under a missing parent.
    await this.simulationModel.deleteOne({ _id: simulationId });
  }
  // ============================================================================
  // INITIAL QUARTER STATE (Q0)
  // ============================================================================

  private async createInitialQuarterState(
    simulationId: Types.ObjectId,
    firmId: Types.ObjectId,
    numFirms: number,
    startingCash: number,
    features: FeatureFlags,
  ): Promise<void> {
    const pos = this.calculateStartingPosition(numFirms);
    const PO = CONFIG.perfectOrder;
    const R = CONFIG.retailer;
    const CP = CONFIG.customer.POOLS;
    const M = CONFIG.market;

    const quarterlyDemand = M.TOTAL_MARKET_SIZE / numFirms;
    const retailerDemand = quarterlyDemand * R.CHANNEL_SHARE;
    const retailerStartingInv = Math.round(
      (retailerDemand * R.INVENTORY_TARGET_MONTHS) / 3,
    );

    const totalCustomers = quarterlyDemand;
    const loyalCustomers = Math.round(totalCustomers * CP.LOYAL_PERCENT);
    const inPlayCustomers = Math.round(totalCustomers * CP.IN_PLAY_PERCENT);

    const perfectOrderOverall =
      PO.BASE_ON_TIME *
      PO.BASE_IN_FULL *
      PO.BASE_DAMAGE_FREE *
      PO.BASE_DOCUMENTATION;

    await this.quarterStateModel.create({
      simulation: simulationId,
      firm: firmId,
      quarter: 0,
      cash: startingCash,
      accountsReceivable: pos.accountsReceivable,
      fixedAssets: pos.fixedAssets,
      accountsPayable: pos.accountsPayable,
      shortTermDebt: pos.shortTermDebt,
      longTermDebt: pos.longTermDebt,
      rawMaterialUnits: pos.rawMaterialUnits,
      finishedGoodsUnits: pos.finishedGoodsUnits,
      inTransitUnits: 0,
      ordersInTransit: 600_000,
      capacityUnits: CONFIG.production.BASE_CAPACITY_PER_SHIFT,
      csi: 80,
      marketShare: 1 / numFirms,
      cumulativeRevenue: 0,
      cumulativeProfit: 0,
      retailerInventory: retailerStartingInv,
      retailerMode: RetailerMode.NORMAL,
      customersLoyal: loyalCustomers,
      customersInPlay: inPlayCustomers,
      prevPriceP1: M.PRODUCTS.P1.basePrice,
      perfectOrder: {
        onTime: PO.BASE_ON_TIME,
        inFull: PO.BASE_IN_FULL,
        damageFree: PO.BASE_DAMAGE_FREE,
        documentation: PO.BASE_DOCUMENTATION,
        overall: perfectOrderOverall,
      },
      techMaintenanceCost: 0,
      expansionInProgress: [],
      additionalCapacity: 0,
      expansionMaintenance: 0,
      dcCentralOpen: false,
      dcCentralInventory: 0,
      dcWestOpen: false,
      dcWestInventory: 0,
      dcTotalOpex: 0,
      greenScore: 50,
      disposalMethod: DisposalMethod.RECYCLE,
      vmiActive: false,
      warrantyTier: WarrantyTier.STANDARD,
      centralWarrantyNetwork: false,
      westWarrantyNetwork: false,
    });
  }

  private calculateStartingPosition(numFirms: number): StartingPosition {
    const F = CONFIG.financial;
    const C = CONFIG.costs;
    const M = CONFIG.market;
    const P = CONFIG.production;
    const revenue = CONFIG.simulation.STARTING_REVENUE;

    const cogs = revenue * F.COGS_PERCENT;
    const opex = revenue * F.OPEX_PERCENT;

    const avgPrice =
      M.PRODUCTS.P1.basePrice * M.PRODUCTS.P1.marketShare +
      M.PRODUCTS.P2.basePrice * M.PRODUCTS.P2.marketShare;
    const annualUnitsSold = revenue / avgPrice;
    const quarterlyUnits = annualUnitsSold / 4;

    const rawMaterialUnits = Math.round(
      quarterlyUnits * P.PARTS_PER_UNIT * (6 / 13),
    );
    const finishedGoodsUnits = Math.round(quarterlyUnits * (4 / 13));

    const accountsReceivable = (revenue / 365) * F.AR_DAYS;
    const fixedAssets = revenue * F.FIXED_ASSETS_PERCENT;
    const accountsPayable = (cogs / 365) * F.AP_DAYS_COGS;
    const shortTermDebt = F.SHORT_TERM_DEBT;

    const inventoryValue =
      rawMaterialUnits * C.RAW_MATERIAL_COST +
      finishedGoodsUnits * C.STANDARD_COGS;
    const quarterlyOpex = opex / 4;
    const totalAssets =
      quarterlyOpex * F.CASH_MONTHS_OPEX +
      accountsReceivable +
      inventoryValue +
      fixedAssets;
    const longTermDebt = totalAssets * F.LONG_TERM_DEBT_PERCENT;

    return {
      rawMaterialUnits,
      finishedGoodsUnits,
      accountsReceivable,
      fixedAssets,
      accountsPayable,
      shortTermDebt,
      longTermDebt,
    };
  }

  // In SimulationService constructor, add this injection:

  // Add this method to record forecast accuracy (like GAS recordForecastAccuracy_)
  private async recordForecastAccuracy(
    simulationId: Types.ObjectId,
    firmId: Types.ObjectId,
    quarter: number,
    naiveForecast: { r1: number; r2: number; r3: number },
    actualDemand: { demandR1: number; demandR2: number; demandR3: number },
  ): Promise<void> {
    // Calculate errors
    const errorR1 = naiveForecast.r1 - actualDemand.demandR1;
    const errorR2 = naiveForecast.r2 - actualDemand.demandR2;
    const errorR3 = naiveForecast.r3 - actualDemand.demandR3;
    const totalError =
      naiveForecast.r1 +
      naiveForecast.r2 +
      naiveForecast.r3 -
      (actualDemand.demandR1 + actualDemand.demandR2 + actualDemand.demandR3);

    // Calculate Absolute Percentage Errors (APE)
    const apeR1 =
      actualDemand.demandR1 > 0 ? Math.abs(errorR1) / actualDemand.demandR1 : 0;
    const apeR2 =
      actualDemand.demandR2 > 0 ? Math.abs(errorR2) / actualDemand.demandR2 : 0;
    const apeR3 =
      actualDemand.demandR3 > 0 ? Math.abs(errorR3) / actualDemand.demandR3 : 0;

    // Calculate MAPE: Average of regional APEs (matching GAS exactly)
    const mape = (apeR1 + apeR2 + apeR3) / 3;

    // Calculate bias: Percentage bias (matching GAS exactly)
    const totalActual =
      actualDemand.demandR1 + actualDemand.demandR2 + actualDemand.demandR3;
    const bias = totalActual > 0 ? totalError / totalActual : 0;

    // Calculate accuracy (inverse of MAPE, capped at 100%)
    const accuracy = Math.max(0, Math.min(1, 1 - mape));

    await this.forecastLogModel.findOneAndUpdate(
      { simulation: simulationId, firm: firmId, quarter },
      {
      simulation: simulationId,
      firm: firmId,
      quarter,
      forecast: {
        r1: naiveForecast.r1,
        r2: naiveForecast.r2,
        r3: naiveForecast.r3,
        total: naiveForecast.r1 + naiveForecast.r2 + naiveForecast.r3,
      },
      actual: {
        r1: actualDemand.demandR1,
        r2: actualDemand.demandR2,
        r3: actualDemand.demandR3,
        total: totalActual,
      },
      error: {
        r1: errorR1,
        r2: errorR2,
        r3: errorR3,
        total: totalError,
      },
      ape: {
        r1: apeR1,
        r2: apeR2,
        r3: apeR3,
      },
      mape,
      bias,
      accuracy,
      },
      { upsert: true, new: true },
    );
  }

  // Update preSeedQuarters to call forecast accuracy recording:
  private async preSeedQuarters(
    simulation: SimulationDocument,
    firms: FirmDocument[],
  ): Promise<void> {
    const simulationId = simulation._id as Types.ObjectId;
    const features = simulation.features as FeatureFlags;
    const M = CONFIG.market;

    console.log(
      `Pre-seeding ${CONFIG.simulation.PREHISTORY_QUARTERS} quarters for ${firms.length} firms`,
    );

    for (
      let quarter = 1;
      quarter <= CONFIG.simulation.PREHISTORY_QUARTERS;
      quarter++
    ) {
      console.log(`Processing quarter ${quarter}...`);

      // Generate and record demand
      const demandData = await this.generateAndRecordDemand(
        simulationId,
        quarter,
        simulation.demandVariability,
        features.seasonality,
        simulation.seasonality,
      );

      console.log(`Quarter ${quarter} demand: ${demandData.totalDemand}`);

      // Generate naive forecast (base demand without seasonality - like GAS does)
      // This creates realistic forecast error for pre-history
      const calendarQuarter = ((quarter - 1) % 4) + 1;
      const naiveForecast = {
        r1: Math.round(M.TOTAL_MARKET_SIZE * M.REGIONS[1].marketShare),
        r2: Math.round(M.TOTAL_MARKET_SIZE * M.REGIONS[2].marketShare),
        r3: Math.round(M.TOTAL_MARKET_SIZE * M.REGIONS[3].marketShare),
      };

      // Process each firm
      const quarterResults: QuarterResult[] = [];
      for (const firm of firms) {
        const firmId = firm._id as Types.ObjectId;

        // Record forecast accuracy for this firm (naive forecast vs actual demand)
        await this.recordForecastAccuracy(
          simulationId,
          firmId,
          quarter,
          naiveForecast,
          {
            demandR1: demandData.demandR1,
            demandR2: demandData.demandR2,
            demandR3: demandData.demandR3,
          },
        );

        const result = await this.runFirmQuarterWithVariance(
          simulationId,
          firm,
          quarter,
          demandData,
          features,
        );
        quarterResults.push(result);
      }

      // Record KPI history
      await this.recordKpiHistory(simulationId, firms, quarter, quarterResults);
      for (const firm of firms) {
        const firmId = firm._id as Types.ObjectId;
        await this.generateTenQReport(simulationId, firmId, quarter);
      }
    }
  }

  // ============================================================================
  // DEMAND GENERATION
  // ============================================================================

  private async generateAndRecordDemand(
    simulationId: Types.ObjectId,
    quarter: number,
    variability: number,
    applySeasonality: boolean,
    seasonalityConfig: any,
  ): Promise<DemandData> {
    const M = CONFIG.market;
    const calendarQuarter = ((quarter - 1) % 4) + 1;

    let seasonalMultiplier = 1.0;
    if (applySeasonality) {
      const seasonalityMap: Record<number, number> = {
        1: seasonalityConfig?.q1Multiplier ?? CONFIG.seasonality.QUARTERS[1],
        2: seasonalityConfig?.q2Multiplier ?? CONFIG.seasonality.QUARTERS[2],
        3: seasonalityConfig?.q3Multiplier ?? CONFIG.seasonality.QUARTERS[3],
        4: seasonalityConfig?.q4Multiplier ?? CONFIG.seasonality.QUARTERS[4],
      };
      seasonalMultiplier = seasonalityMap[calendarQuarter];
    }

    const variabilityApplied = 1 + (Math.random() * 2 - 1) * variability;

    const demandR1 = Math.round(
      M.TOTAL_MARKET_SIZE *
        M.REGIONS[1].marketShare *
        seasonalMultiplier *
        variabilityApplied,
    );
    const demandR2 = Math.round(
      M.TOTAL_MARKET_SIZE *
        M.REGIONS[2].marketShare *
        seasonalMultiplier *
        variabilityApplied,
    );
    const demandR3 = Math.round(
      M.TOTAL_MARKET_SIZE *
        M.REGIONS[3].marketShare *
        seasonalMultiplier *
        variabilityApplied,
    );
    const totalDemand = demandR1 + demandR2 + demandR3;

    // Create demand history record with explicit ObjectId
    await this.demandHistoryModel.create({
      simulation: simulationId, // ObjectId
      quarter,
      demandR1,
      demandR2,
      demandR3,
      totalDemand,
      seasonalMultiplier,
      seasonLabel: this.getSeasonLabel(calendarQuarter, seasonalMultiplier),
      calendarQuarter,
      demandVariabilityApplied: variabilityApplied,
    });

    return {
      demandR1,
      demandR2,
      demandR3,
      totalDemand,
      seasonalMultiplier,
      calendarQuarter,
      variabilityApplied,
    };
  }

  // ============================================================================
  // PRE-HISTORY QUARTER PROCESSING
  // ============================================================================

  private async runFirmQuarterWithVariance(
    simulationId: Types.ObjectId,
    firm: FirmDocument,
    quarter: number,
    demandData: DemandData,
    features: FeatureFlags,
  ): Promise<QuarterResult> {
    const variance = CONFIG.preHistory.VARIANCE_RANGE;
    const rand = () => 1 + (Math.random() * 2 - 1) * variance;
    const firmId = firm._id as Types.ObjectId;

    const prevState = await this.quarterStateModel
      .findOne({
        simulation: simulationId,
        firm: firmId,
        quarter: quarter - 1,
      })
      .lean();

    if (!prevState) {
      throw new Error(
        `No state found for firm ${firm.firmNumber} quarter ${quarter - 1}`,
      );
    }

    const decisions = {
      forecastR1: Math.round(demandData.demandR1 * rand()),
      forecastR2: Math.round(demandData.demandR2 * rand()),
      forecastR3: Math.round(demandData.demandR3 * rand()),
      forecastMethod: ForecastMethod.GUT,
      orderGlobal: Math.round(600_000 * rand()),
      orderRegional: 0,
      productionP1: Math.round(120_000 * rand()),
      productionP2: Math.round(80_000 * rand()),
      shifts: 1,
      priceP1: Math.round(CONFIG.market.PRODUCTS.P1.basePrice * rand()),
      priceP2: Math.round(CONFIG.market.PRODUCTS.P2.basePrice * rand()),
      marketingBudget: Math.round(5_000_000 * rand()),
      inspectionLevel: InspectionLevel.BASIC,
      shippingMode: ShippingMode.STANDARD,
      buildSmallLine: false,
      buildMediumLine: false,
      buildLargeLine: false,
      dcCentralStatus: DCStatus.NO,
      dcWestStatus: DCStatus.NO,
      allocateCentral: 0,
      allocateWest: 0,
      transferFromCentral: 0,
      transferFromCentralTo: TransferDestination.NONE,
      transferFromWest: 0,
      transferFromWestTo: TransferDestination.NONE,
      carrier: CarrierMode.TRUCK,
      warrantyTier: WarrantyTier.STANDARD,
      centralWarrantyNetwork: false,
      westWarrantyNetwork: false,
      disposalMethod: DisposalMethod.RECYCLE,
      ecoPackaging: false,
      intelSubscriptions: {},
      enableVMI: false,
    };
    await this.decisionModel.create({
      simulation: simulationId,
      firm: firmId,
      quarter,
      status: DecisionStatus.PROCESSED, // Already processed since it's pre-history
      submittedAt: new Date(),
      processedAt: new Date(),
      ...decisions,
    });
    return this.processQuarter(
      simulationId,
      firm,
      quarter,
      prevState as any,
      decisions,
      demandData,
      features,
    );
  }

  // ============================================================================
  // UTILITY HELPERS
  // ============================================================================

  private getSeasonLabel(calendarQuarter: number, multiplier: number): string {
    const label = CONFIG.seasonality.LABELS[calendarQuarter];
    const effect =
      multiplier < 1
        ? `${((1 - multiplier) * 100).toFixed(0)}% below normal`
        : multiplier > 1
          ? `${((multiplier - 1) * 100).toFixed(0)}% above normal`
          : 'Normal';
    return `${label} (${effect})`;
  }

  private getDefaultColor(firmNumber: number): string {
    const colors = [
      '#3B82F6',
      '#10B981',
      '#F59E0B',
      '#EF4444',
      '#8B5CF6',
      '#EC4899',
    ];
    return colors[(firmNumber - 1) % colors.length];
  }

  // ============================================================================
  // PROCESS QUARTER (Core Engine)
  // ============================================================================

  private async processQuarter(
    simulationId: Types.ObjectId,
    firm: FirmDocument,
    quarter: number,
    prevState: QuarterStateDocument,
    decisions: any,
    demandData: DemandData,
    features: FeatureFlags,
  ): Promise<QuarterResult> {
    const M = CONFIG.market;
    const P = CONFIG.production;
    const C = CONFIG.costs;
    const F = CONFIG.financial;
    const R = CONFIG.retailer;
    const PO = CONFIG.perfectOrder;
    const firmId = firm._id as Types.ObjectId;

    // ========================================================================
    // CAPACITY EXPANSION - Only if feature enabled
    // ========================================================================
    let totalCapacity =
      prevState.capacityUnits + (prevState.additionalCapacity || 0);
    let expansionInProgress = [...(prevState.expansionInProgress || [])];
    let expansionMaintenance = prevState.expansionMaintenance || 0;
    let additionalCapacity = prevState.additionalCapacity || 0;
    let expansionCost = 0;

    if (features.capacityExpansion) {
      const expResult = this.processCapacityExpansion(
        decisions,
        expansionInProgress,
        additionalCapacity,
        expansionMaintenance,
        quarter,
        prevState.cash,
      );
      expansionInProgress = expResult.expansionInProgress;
      additionalCapacity = expResult.additionalCapacity;
      expansionMaintenance = expResult.maintenanceCost;
      expansionCost = expResult.capitalCost;
      totalCapacity = prevState.capacityUnits + additionalCapacity;
    }

    // ========================================================================
    // RANDOM EVENTS - Only process if feature enabled
    // ========================================================================
    // Events are resolved BEFORE procurement and demand so that supply and
    // demand disruptions actually affect the quarter they fire in. (GAS
    // parity: eventEffect is computed ahead of the procurement block; running
    // it afterwards left partsDelayed/demandModifier computed but discarded.)
    let eventImpact: {
      costIncrease: number;
      demandModifier: number;
      partsDelayed: number;
      eventImpacts: any[];
    } = {
      costIncrease: 0,
      demandModifier: 1.0,
      partsDelayed: 0,
      eventImpacts: [],
    };

    if (features.randomEvents) {
      eventImpact = await this.processRandomEvents(
        simulationId,
        firmId,
        quarter,
        prevState,
        firm.techOwned || [], // Pass techOwned for Control Tower mitigation
      );
    }

    // ========================================================================
    // PROCUREMENT
    // ========================================================================
    // Global orders carry a 1-quarter lead time and land as ordersInTransit.
    // Regional orders are same-quarter delivery and are available to this
    // quarter's production run (GAS: totalPartsAvailable =
    // Raw_Material_Units + arrivingParts + regionalParts).
    const regionalParts = decisions.orderRegional || 0;
    const arrivingParts = Math.max(
      0,
      (prevState.ordersInTransit || 0) - eventImpact.partsDelayed,
    );
    const totalPartsAvailable =
      prevState.rawMaterialUnits + arrivingParts + regionalParts;
    // Unit costs come from SUPPLIER_CONFIG so the price quoted on the decision
    // screen and the price actually billed here cannot drift apart.
    const procurementCost =
      decisions.orderGlobal * SUPPLIER_CONFIG[SupplierType.GLOBAL].unitCost +
      regionalParts * SUPPLIER_CONFIG[SupplierType.REGIONAL].unitCost;
    const adjustedProcurementCost =
      procurementCost * (1 + eventImpact.costIncrease);

    // ========================================================================
    // PRODUCTION - P1, P2, and P3 (if productInnovation enabled)
    // ========================================================================
    let targetTotal = decisions.productionP1 + decisions.productionP2;
    let p3Production = 0;
    let p3LaunchCost = 0;
    let p3Config = prevState.p3Config || null;
    let p3Launched = prevState.p3Launched || false;
    let p3LaunchQuarter = prevState.p3LaunchQuarter || null;

    if (features.productInnovation) {
      // Check if launching P3 this quarter
      if (decisions.launchP3 && !p3Launched) {
        p3Launched = true;
        p3LaunchQuarter = quarter;
        p3Config = decisions.p3Config || 'STANDARD';
        p3LaunchCost = CONFIG.market.P3_CONFIG.LAUNCH_COST;

        // Validate marketing budget meets minimum
        if (
          decisions.marketingBudget < CONFIG.market.P3_CONFIG.MARKETING_REQUIRED
        ) {
          // Could log warning or adjust here
        }
      }

      // Add P3 production if launched
      if (p3Launched && decisions.productionP3 > 0) {
        p3Production = decisions.productionP3;
        targetTotal += p3Production;
      }
    }

    const shiftCostMultiplier = P.SHIFT_COSTS[decisions.shifts] || 1.0;
    const shiftEfficiency = P.SHIFT_EFFICIENCY[decisions.shifts] || 1.0;
    const effectiveCapacity = Math.floor(
      totalCapacity * decisions.shifts * shiftEfficiency,
    );
    const maxFromParts = Math.floor(totalPartsAvailable / P.PARTS_PER_UNIT);
    const actualProduction = Math.min(
      targetTotal,
      maxFromParts,
      effectiveCapacity,
    );
    const partsConsumed = actualProduction * P.PARTS_PER_UNIT;
    const laborCost =
      actualProduction * P.LABOR_COST_PER_UNIT * shiftCostMultiplier;
    const capacityUtilization =
      effectiveCapacity > 0 ? actualProduction / effectiveCapacity : 0;

    // ========================================================================
    // QUALITY CONTROL - Only if feature enabled
    // ========================================================================
    // Volume-weighted incoming defect rate across the suppliers actually used
    // this quarter. GAS carries a per-supplier defectRate and folds it into the
    // plant defect rate via SUPPLIER_QUALITY_WEIGHT; the port previously used a
    // flat BASE_DEFECT_RATE, so supplier quality had no consequence at all.
    const globalOrderedUnits = decisions.orderGlobal || 0;
    const supplierUnitsOrdered = globalOrderedUnits + regionalParts;
    const weightedSupplierDefectRate =
      supplierUnitsOrdered > 0
        ? (globalOrderedUnits *
            SUPPLIER_CONFIG[SupplierType.GLOBAL].defectRate +
            regionalParts *
              SUPPLIER_CONFIG[SupplierType.REGIONAL].defectRate) /
          supplierUnitsOrdered
        : SUPPLIER_CONFIG[SupplierType.GLOBAL].defectRate;

    let defectRate =
      P.BASE_DEFECT_RATE +
      weightedSupplierDefectRate * CONFIG.quality.SUPPLIER_QUALITY_WEIGHT;
    let qualityCost = 0;
    let defectsProduced = 0;
    let defectsDetected = 0;

    if (features.qualityControl) {
      const inspectionLevel = decisions.inspectionLevel || 'BASIC';
      const inspectionConfig =
        CONFIG.quality.INSPECTION[inspectionLevel] ||
        CONFIG.quality.INSPECTION.BASIC;
      defectsProduced = Math.round(actualProduction * defectRate);
      defectsDetected = Math.round(
        defectsProduced * inspectionConfig.detectionRate,
      );
      qualityCost = actualProduction * inspectionConfig.cost;
      // Add rework cost for detected defects
      qualityCost += defectsDetected * CONFIG.quality.REWORK_COST;
    } else {
      // Without quality control, use basic detection only (visual inspection)
      defectsProduced = Math.round(actualProduction * defectRate);
      defectsDetected = Math.round(
        defectsProduced * CONFIG.quality.INSPECTION.NONE.detectionRate,
      );
    }

    const goodProduction = actualProduction - defectsDetected;
    const endingRawUnits = totalPartsAvailable - partsConsumed;
    let availableFGUnits = prevState.finishedGoodsUnits + goodProduction;

    // ========================================================================
    // REGIONAL DCs - Only if feature enabled
    // ========================================================================
    let dcCentralOpen = prevState.dcCentralOpen || false;
    let dcCentralInventory = prevState.dcCentralInventory || 0;
    let dcWestOpen = prevState.dcWestOpen || false;
    let dcWestInventory = prevState.dcWestInventory || 0;
    let dcServiceBonus = 0;
    let dcTotalOpex = 0,
      dcSetupCost = 0,
      dcDisposalRecovery = 0,
      transferCost = 0;
    let allocatedToCentral = 0,
      allocatedToWest = 0;

    if (features.regionalDCs) {
      const dcResult = this.processRegionalDCs(
        decisions,
        prevState,
        availableFGUnits,
      );
      dcCentralOpen = dcResult.dcCentralOpen;
      dcCentralInventory = dcResult.dcCentralInventory;
      dcWestOpen = dcResult.dcWestOpen;
      dcWestInventory = dcResult.dcWestInventory;
      dcTotalOpex = dcResult.opex;
      dcSetupCost = dcResult.setupCost;
      dcDisposalRecovery = dcResult.disposalRecovery;
      transferCost = dcResult.transferCost;
      allocatedToCentral = dcResult.allocatedToCentral;
      allocatedToWest = dcResult.allocatedToWest;
      availableFGUnits -= allocatedToCentral + allocatedToWest;
      // Service benefit of holding regional stock (GAS flexeemaster.gs:4875,
      // 4906). Only the increment above the factory baseline is applied, so a
      // firm with no DC is unaffected; previously DCs were pure cost with no
      // service upside, making them strictly dominated.
      if (dcCentralOpen) dcServiceBonus += CONFIG.dc.CENTRAL.serviceBonus;
      if (dcWestOpen) dcServiceBonus += CONFIG.dc.WEST.serviceBonus;
    }

    // ========================================================================
    // MARKET EXPANSION (R4-R6) - Only if feature enabled
    // ========================================================================
    let expansionRegionCosts = 0;
    let expansionRegionDemand = { r4: 0, r5: 0, r6: 0 };
    let r4Active = prevState.r4Active || false;
    let r5Active = prevState.r5Active || false;
    let r6Active = prevState.r6Active || false;
    let r4EntryQuarter = prevState.r4EntryQuarter || null;
    let r5EntryQuarter = prevState.r5EntryQuarter || null;
    let r6EntryQuarter = prevState.r6EntryQuarter || null;

    if (features.marketExpansion) {
      const expansionResult = this.processMarketExpansion(
        decisions,
        prevState,
        quarter,
      );
      r4Active = expansionResult.r4Active;
      r5Active = expansionResult.r5Active;
      r6Active = expansionResult.r6Active;
      r4EntryQuarter = expansionResult.r4EntryQuarter;
      r5EntryQuarter = expansionResult.r5EntryQuarter;
      r6EntryQuarter = expansionResult.r6EntryQuarter;
      expansionRegionCosts = expansionResult.totalCost;
      expansionRegionDemand = expansionResult.demand;
    }

    // ========================================================================
    // DEMAND CALCULATION - With regional competition if enabled
    // ========================================================================
    let firmBaseDemand = demandData.totalDemand * prevState.marketShare;

    // Add expansion region demand if active
    if (features.marketExpansion) {
      firmBaseDemand +=
        expansionRegionDemand.r4 +
        expansionRegionDemand.r5 +
        expansionRegionDemand.r6;
    }

    const avgPrice =
      decisions.priceP1 * M.PRODUCTS.P1.marketShare +
      decisions.priceP2 * M.PRODUCTS.P2.marketShare;
    const baseAvgPrice =
      M.PRODUCTS.P1.basePrice * M.PRODUCTS.P1.marketShare +
      M.PRODUCTS.P2.basePrice * M.PRODUCTS.P2.marketShare;

    let priceEffect = baseAvgPrice / avgPrice;
    let csiEffect = prevState.csi / 80;

    // Regional competition affects price sensitivity
    if (features.regionalCompetition) {
      // Apply regional weight adjustments (future: compare with competitors)
      priceEffect *= 0.95 + Math.random() * 0.1;
    }

    // Green score effect on demand
    let greenScoreEffect = 1.0;
    if (features.returnsGreenScore) {
      const gs = prevState.greenScore || CONFIG.greenScore.INITIAL_SCORE;
      const gsEffectConfig = this.getGreenScoreEffect(gs);
      greenScoreEffect = 1 + gsEffectConfig.csiEffect / 100;
    }

    // P3 cannibalization and new market effect
    let p3DemandEffect = 0;
    if (features.productInnovation && p3Launched) {
      const p3Cfg = CONFIG.market.P3_CONFIG;
      const quartersActive = quarter - (p3LaunchQuarter || quarter);
      const rampUpFactor = Math.min(1, quartersActive / p3Cfg.RAMP_UP_QUARTERS);

      // P3 creates new demand
      p3DemandEffect = firmBaseDemand * p3Cfg.NEW_MARKET_RATE * rampUpFactor;
    }

    const totalFirmDemand = Math.round(
      (firmBaseDemand + p3DemandEffect) *
        priceEffect *
        csiEffect *
        greenScoreEffect *
        eventImpact.demandModifier,
    );

    // ========================================================================
    // RETAILER LOGIC - Only apply "brain" if feature enabled
    // ========================================================================
    const retailDemand = Math.round(totalFirmDemand * R.CHANNEL_SHARE);
    const directDemand = totalFirmDemand - retailDemand;

    let retailerInventory = prevState.retailerInventory || 0;
    let retailerMode: RetailerMode = RetailerMode.NORMAL;
    let shipmentToRetailer = Math.round(retailDemand * 1.1); // Default 10% buffer
    // Hoisted so the channel position can be reported. Participants could see that
    // finished goods were not selling but had no way to see why: the retailer's
    // own coverage is what decides how much it orders.
    const retailerMonthlyDemand = retailDemand / 3;
    const retailerCoverageMonths =
      retailerMonthlyDemand > 0
        ? retailerInventory / retailerMonthlyDemand
        : R.INVENTORY_TARGET_MONTHS;

    if (features.retailerBrain) {
      // Full retailer brain logic with panic/clearance modes
      // FIX: single declaration of monthlyDemand used throughout this block
      const monthlyDemand = retailerMonthlyDemand;
      const coverageMonths = retailerCoverageMonths;

      let panicThreshold = R.PANIC_THRESHOLD_MONTHS;
      let clearanceThreshold = R.CLEARANCE_THRESHOLD_MONTHS;
      let panicMultiplier = R.PANIC_ORDER_MULTIPLIER;
      let clearanceMultiplier = R.CLEARANCE_ORDER_MULTIPLIER;

      // VMI modifies retailer behavior thresholds
      // FIX: check vmiActive (current quarter) not prevState.vmiActive
      if (features.vmi && decisions.enableVMI === true) {
        panicThreshold *= CONFIG.vmi.EFFECTS.PANIC_THRESHOLD_MULTIPLIER;
        clearanceThreshold *= CONFIG.vmi.EFFECTS.CLEARANCE_THRESHOLD_MULTIPLIER;
        panicMultiplier = CONFIG.vmi.EFFECTS.PANIC_ORDER_MULTIPLIER;
        clearanceMultiplier = CONFIG.vmi.EFFECTS.CLEARANCE_ORDER_MULTIPLIER;
      }

      // FIX: target-based ordering matches GAS — accounts for current inventory position
      const targetInv = monthlyDemand * R.INVENTORY_TARGET_MONTHS;
      const baseOrder = Math.max(
        0,
        targetInv - retailerInventory + monthlyDemand,
      );

      if (coverageMonths < panicThreshold) {
        retailerMode = RetailerMode.PANIC;
        shipmentToRetailer = Math.round(baseOrder * panicMultiplier);
      } else if (coverageMonths > clearanceThreshold) {
        retailerMode = RetailerMode.CLEARANCE;
        shipmentToRetailer = Math.round(baseOrder * clearanceMultiplier);
      } else {
        shipmentToRetailer = Math.round(baseOrder); // normal mode — target-based too
      }
    }
    // If retailerBrain is disabled, retailer just orders steadily (shipmentToRetailer already set)

    // Regional DC stock is part of the shippable pool. Units allocated to a DC
    // used to leave the factory and never come back - they inflated the
    // shipping cap but were never sold or depleted, so they accumulated
    // forever. They are now real forward inventory: they fulfil demand in the
    // region their DC serves and draw down as they ship.
    const totalAvailableForShipping =
      availableFGUnits + dcCentralInventory + dcWestInventory;
    shipmentToRetailer = Math.min(
      shipmentToRetailer,
      totalAvailableForShipping,
    );

    // ========================================================================
    // TRANSPORT LOGISTICS / MULTI-CARRIER - Conditional on features
    // ========================================================================
    let freightCost = 0;
    let onTimeRate = PO.BASE_ON_TIME;
    let damageRate = 0;
    const shippedUnits = shipmentToRetailer + directDemand;

    if (features.multiCarrierSelection) {
      // Advanced: multi-carrier selection. Delegates to processMultiCarrier so
      // the DC-aware rules actually apply - a firm with no regional DC is
      // forced onto Air, and a firm with one pays last-mile (GAS
      // flexeemaster.gs:5609-5660). The previous inline block ignored both,
      // understating freight for firms with no DC open.
      const carrierResult = this.processMultiCarrier(
        decisions,
        firm,
        shippedUnits,
        dcCentralOpen || dcWestOpen,
        features,
      );
      freightCost = carrierResult.freightCost;
      onTimeRate = carrierResult.onTimeRate;
      damageRate = carrierResult.damageRate;
    } else if (features.transportLogistics) {
      // Basic: Shipping mode selection (standard/express/air)
      const shippingMode = decisions.shippingMode || 'STANDARD';
      const shippingConfig = {
        STANDARD: { cost: 3, onTimeBonus: 0 },
        EXPRESS: { cost: 5, onTimeBonus: 0.03 },
        AIR: { cost: 10, onTimeBonus: 0.08 },
      }[shippingMode] || { cost: 3, onTimeBonus: 0 };

      freightCost = shippedUnits * shippingConfig.cost;
      onTimeRate = PO.BASE_ON_TIME + shippingConfig.onTimeBonus;
    } else {
      // No transport feature: Use default truck rate
      freightCost = shippedUnits * 3; // $3 default
    }

    if (dcServiceBonus > 0) {
      onTimeRate = Math.min(1, onTimeRate + dcServiceBonus);
    }

    // ========================================================================
    // SALES CALCULATION
    // ========================================================================
    const retailSales = Math.min(
      retailDemand,
      retailerInventory + shipmentToRetailer,
    );
    const poolAfterRetailer = Math.max(
      0,
      totalAvailableForShipping - shipmentToRetailer,
    );
    const directSales = Math.min(directDemand, poolAfterRetailer);
    const unitsSold = retailSales + directSales;
    const stockoutUnits = totalFirmDemand - unitsSold;
    const fillRate = totalFirmDemand > 0 ? unitsSold / totalFirmDemand : 1;

    // Draw the shipped volume from the DCs first, each capped by the demand in
    // the region it serves (Central -> R2, West -> R3); the factory covers the
    // balance. This is what makes a DC worth opening: it holds stock forward,
    // cheaper, closer to its region.
    const unitsOut = shipmentToRetailer + directSales;
    const fromCentral = dcCentralOpen
      ? Math.min(
          dcCentralInventory,
          Math.round(unitsOut * M.REGIONS[2].marketShare),
        )
      : 0;
    const fromWest = dcWestOpen
      ? Math.min(dcWestInventory, Math.round(unitsOut * M.REGIONS[3].marketShare))
      : 0;
    dcCentralInventory -= fromCentral;
    dcWestInventory -= fromWest;
    const fromFactory = Math.max(0, unitsOut - fromCentral - fromWest);

    const endingFGUnits = Math.max(0, availableFGUnits - fromFactory);
    const endingRetailerInv = Math.max(
      0,
      retailerInventory - retailSales + shipmentToRetailer,
    );

    // Defects that inspection missed ship to customers and come back as
    // returns (GAS flexeemaster.gs:5318-5330). The port computed defects and
    // then ignored their downstream cost entirely, so inspection level had no
    // consequence beyond its own line-item cost.
    const defectsUndetected = Math.max(0, defectsProduced - defectsDetected);
    const defectiveShipped = Math.min(defectsUndetected, unitsSold);
    const productDefectReturns = Math.round(
      defectiveShipped * CONFIG.quality.RETURN_RATE,
    );
    const returnCost = productDefectReturns * CONFIG.quality.RETURN_COST;
    const productReturnRate =
      unitsSold > 0 ? productDefectReturns / unitsSold : 0;
    const qualityCsiPenalty =
      productReturnRate * 100 * CONFIG.quality.CSI_PENALTY_PER_RETURN_PCT;

    // Calculate demand by region for warranty processing
    const demandByRegion = {
      r1: Math.round(totalFirmDemand * M.REGIONS[1].marketShare),
      r2: Math.round(totalFirmDemand * M.REGIONS[2].marketShare),
      r3: Math.round(totalFirmDemand * M.REGIONS[3].marketShare),
    };

    // ========================================================================
    // WARRANTY & GREEN SCORE - Only if feature enabled
    // ========================================================================
    let warrantyRevenue = 0;
    let warrantyCost = 0;
    let totalWarrantyClaims = 0;
    let greenScore = prevState.greenScore || CONFIG.greenScore.INITIAL_SCORE;
    let disposalCost = 0;
    let disposalRecovery = 0;
    // FIX: declare ecoPackagingCost here so it's available for totalOpex/cashOut
    let ecoPackagingCost = 0;

    if (features.returnsGreenScore) {
      const defectsReachingCustomers = defectsProduced - defectsDetected;
      const warrantyTier = decisions.warrantyTier || WarrantyTier.STANDARD;

      const warrantyResult = this.processWarranty(
        warrantyTier,
        unitsSold,
        defectsReachingCustomers,
        damageRate,
        demandByRegion,
        decisions.centralWarrantyNetwork || false,
        decisions.westWarrantyNetwork || false,
      );
      warrantyRevenue = warrantyResult.revenue;
      warrantyCost = warrantyResult.totalCost;
      totalWarrantyClaims = warrantyResult.totalClaims;

      // Record warranty claims
      await this.warrantyClaimModel.create({
        simulation: simulationId,
        firm: firmId,
        quarter,
        tier: warrantyTier,
        productDefects: warrantyResult.productDefects,
        shippingDamage: warrantyResult.shippingDamage,
        totalClaims: warrantyResult.totalClaims,
        claimsByRegion: warrantyResult.claimsByRegion,
        warrantyRevenue: warrantyResult.revenue,
        partShippingCost: warrantyResult.partShippingCost,
        serviceCost: warrantyResult.serviceCost,
        networkMaintenanceCost: warrantyResult.networkMaintenanceCost,
        totalExpense: warrantyResult.totalCost,
        netWarranty: warrantyRevenue - warrantyCost,
        centralNetworkActive: decisions.centralWarrantyNetwork || false,
        westNetworkActive: decisions.westWarrantyNetwork || false,
      });

      // Process disposal and green score
      const disposalMethod = decisions.disposalMethod || DisposalMethod.RECYCLE;
      const disposalResult = this.processDisposalAndGreenScore(
        disposalMethod,
        totalWarrantyClaims,
        decisions.ecoPackaging || false,
        unitsSold,
        greenScore,
      );
      disposalCost = disposalResult.disposalCost;
      disposalRecovery = disposalResult.disposalRecovery;
      // FIX: extract ecoPackagingCost so it flows into financials
      ecoPackagingCost = disposalResult.ecoPackagingCost;
      greenScore = disposalResult.newGreenScore;

      // Record green score history
      await this.greenScoreHistoryModel.create({
        simulation: simulationId,
        firm: firmId,
        quarter,
        previousScore: prevState.greenScore || CONFIG.greenScore.INITIAL_SCORE,
        newScore: greenScore,
        scoreChange:
          greenScore -
          (prevState.greenScore || CONFIG.greenScore.INITIAL_SCORE),
        disposalMethod: disposalMethod,
        unitsDisposed: totalWarrantyClaims,
        disposalCost,
        disposalRecovery,
        ecoPackaging: decisions.ecoPackaging || false,
        ecoPackagingCost: disposalResult.ecoPackagingCost,
        effectBracket: this.getGreenScoreBracket(greenScore),
        csiEffect: this.getGreenScoreCSIEffect(greenScore),
        churnMultiplier: this.getGreenScoreChurnMultiplier(greenScore),
      });
    }

    // ========================================================================
    // TECHNOLOGY INVESTMENTS - Only if feature enabled
    // ========================================================================
    let techMaintenanceCost = prevState.techMaintenanceCost || 0;
    let techPurchaseCost = 0;
    let newTechPurchased: string[] = [];

    if (features.technologyInvestments && decisions.techPurchases) {
      const techResult = this.processTechnologyPurchases(
        decisions.techPurchases,
        firm.techOwned || [],
        prevState.cash,
      );
      techMaintenanceCost = techResult.maintenanceCost;
      newTechPurchased = techResult.newTech;
      techPurchaseCost = techResult.purchaseCost;

      // Update firm tech ownership
      if (newTechPurchased.length > 0) {
        await this.firmModel.updateOne(
          { _id: firmId },
          { $addToSet: { techOwned: { $each: newTechPurchased } } },
        );
      }
    }

    // ========================================================================
    // VMI SETUP - Only if feature enabled
    //
    // FIX 1: vmiActive is re-evaluated fresh each quarter from decisions,
    //         not latched permanently once true. Mirrors GAS behaviour where
    //         isVMIActive = vmiModuleEnabled && decisions.enableVMI.
    //
    // FIX 2: costs are split into vmiSetupCost (capital, hits cashOut only)
    //         and vmiOngoingCost (opex, hits both totalOpex and cashOut).
    //         Previously a single vmiCost was used for both, which incorrectly
    //         let the $2M setup cost distort operating income in the activation
    //         quarter.
    // ========================================================================
    let vmiActive = false;
    let vmiSetupCost = 0;
    let vmiOngoingCost = 0;

    if (features.vmi) {
      const wasVmiActive = prevState.vmiActive || false;
      vmiActive = decisions.enableVMI === true;

      if (vmiActive && !wasVmiActive) {
        // First quarter of activation — one-time capital outlay, not opex
        vmiSetupCost = CONFIG.vmi.SETUP_COST;
      } else if (vmiActive) {
        // Every subsequent active quarter — recurring operational cost
        vmiOngoingCost = CONFIG.vmi.QUARTERLY_COST;
      }
    }

    // ========================================================================
    // VMI RETAILER IMPACT SNAPSHOT
    // Compute what VMI did (or would have done) this quarter so we can
    // store it and show participants the bullwhip reduction in real numbers.
    // ========================================================================

    // These are already computed inside the retailerBrain block above.
    // Re-derive them here at the snapshot level so they're always available,
    // even when retailerBrain is disabled.
    const monthlyDemandForSnapshot = Math.round(retailDemand / 3);
    const coverageMonthsForSnapshot =
      monthlyDemandForSnapshot > 0
        ? (prevState.retailerInventory || 0) / monthlyDemandForSnapshot
        : R.INVENTORY_TARGET_MONTHS;

    const standardPanicThreshold = R.PANIC_THRESHOLD_MONTHS;       // 1.0
    const standardClearanceThreshold = R.CLEARANCE_THRESHOLD_MONTHS; // 4.0

    const effectivePanicThreshold =
      features.vmi && vmiActive
        ? standardPanicThreshold * CONFIG.vmi.EFFECTS.PANIC_THRESHOLD_MULTIPLIER
        : standardPanicThreshold;

    const effectiveClearanceThreshold =
      features.vmi && vmiActive
        ? standardClearanceThreshold * CONFIG.vmi.EFFECTS.CLEARANCE_THRESHOLD_MULTIPLIER
        : standardClearanceThreshold;

    // Was clearance mode prevented by VMI?
    // Coverage is above the standard threshold (would have triggered clearance)
    // but below the VMI threshold (VMI kept it in normal range)
    const clearancePrevented =
      features.vmi &&
      vmiActive &&
      coverageMonthsForSnapshot > standardClearanceThreshold &&
      coverageMonthsForSnapshot <= effectiveClearanceThreshold;

    // Was panic mode prevented by VMI?
    // Coverage is below the standard threshold (would have triggered panic)
    // but at or above the VMI threshold (VMI kept it in normal range)
    const panicPrevented =
      features.vmi &&
      vmiActive &&
      coverageMonthsForSnapshot < standardPanicThreshold &&
      coverageMonthsForSnapshot >= effectivePanicThreshold;

    // Revenue protected: if clearance was prevented, the 15% discount on
    // this quarter's wholesale shipment revenue was avoided
    const wholesalePriceForSnapshot = avgPrice * (1 - R.MARKUP);
    const revenueProtected = clearancePrevented
      ? shipmentToRetailer * wholesalePriceForSnapshot * R.CLEARANCE_DISCOUNT
      : 0;

    // CSI protected: clearance → 2 points, panic → 5 points
    // (CONFIG values: CSI_PENALTY_CLEARANCE: 2, CSI_PENALTY_STOCKOUT: 5)
    const csiProtected = clearancePrevented
      ? CONFIG.retailer.CSI_PENALTY_CLEARANCE
      : panicPrevented
        ? CONFIG.retailer.CSI_PENALTY_STOCKOUT
        : 0;

    // Pull cumulative totals from prevState.vmiSnapshot (or zero on first quarter)
    const prevVmi = prevState.vmiSnapshot || {
      cumulativeSetupCost: 0,
      cumulativeOngoingCost: 0,
      cumulativeTotalCost: 0,
      cumulativeRevenueProtected: 0,
      cumulativeCsiProtected: 0,
      cumulativeNetBenefit: 0,
    };

    const cumulativeSetupCost = (prevVmi.cumulativeSetupCost || 0) + vmiSetupCost;
    const cumulativeOngoingCost = (prevVmi.cumulativeOngoingCost || 0) + vmiOngoingCost;
    const cumulativeTotalCost = cumulativeSetupCost + cumulativeOngoingCost;
    const cumulativeRevenueProtected = (prevVmi.cumulativeRevenueProtected || 0) + revenueProtected;
    const cumulativeCsiProtected = (prevVmi.cumulativeCsiProtected || 0) + csiProtected;
    const cumulativeNetBenefit = cumulativeRevenueProtected - cumulativeTotalCost;

    const vmiSnapshot = {
      active: vmiActive,
      setupCost: vmiSetupCost,
      ongoingCost: vmiOngoingCost,
      totalCostThisQuarter: vmiSetupCost + vmiOngoingCost,
      retailerMode,
      coverageMonths: Math.round(coverageMonthsForSnapshot * 100) / 100,
      effectivePanicThreshold,
      effectiveClearanceThreshold,
      clearancePrevented,
      panicPrevented,
      revenueProtected: Math.round(revenueProtected),
      csiProtected,
      shipmentToRetailer,
      cumulativeSetupCost,
      cumulativeOngoingCost,
      cumulativeTotalCost,
      cumulativeRevenueProtected: Math.round(cumulativeRevenueProtected),
      cumulativeCsiProtected,
      cumulativeNetBenefit: Math.round(cumulativeNetBenefit),
    };

    // ========================================================================
    // INTELLIGENCE CENTER - Only if feature enabled
    // ========================================================================
    let intelligenceCost = 0;

    if (features.intelligenceCenter) {
      // Merge subscriptions from both sources:
      // 1. decisions.intelSubscriptions (object with camelCase keys)
      // 2. Individual fields (decisions.intelRegionalDemand, etc.)
      const mergedSubscriptions: Record<string, boolean> = {
        ...(decisions.intelSubscriptions || {}),
        regionalDemand:
          decisions.intelSubscriptions?.regionalDemand ||
          decisions.intelRegionalDemand ||
          false,
        retailChannel:
          decisions.intelSubscriptions?.retailChannel ||
          decisions.intelRetailChannel ||
          false,
        competitorCapacity:
          decisions.intelSubscriptions?.competitorCapacity ||
          decisions.intelCompetitorCapacity ||
          false,
        supplierRisk:
          decisions.intelSubscriptions?.supplierRisk ||
          decisions.intelSupplierRisk ||
          false,
        customerSentiment:
          decisions.intelSubscriptions?.customerSentiment ||
          decisions.intelCustomerSentiment ||
          false,
      };

      const intelResult = await this.processIntelligenceCenter(
        simulationId,
        firmId,
        quarter,
        mergedSubscriptions,
        prevState,
        demandData,
      );
      intelligenceCost = intelResult.totalCost;
    }

    // ========================================================================
    // FINANCIALS
    // ========================================================================
    const directRevenue = directSales * avgPrice;
    const wholesalePrice = avgPrice * (1 - R.MARKUP);
    let retailRevenue = shipmentToRetailer * wholesalePrice;

    // Clearance discount affects revenue
    if (retailerMode === RetailerMode.CLEARANCE) {
      retailRevenue *= 1 - R.CLEARANCE_DISCOUNT;
    }

    // P3 revenue if applicable
    let p3Revenue = 0;
    if (features.productInnovation && p3Launched && p3Production > 0) {
      const p3PriceConfig =
        CONFIG.market.P3_CONFIG.CONFIGS[p3Config || 'STANDARD'];
      const p3Price = decisions.p3Price || p3PriceConfig.suggestedPrice;
      const p3Sold = Math.round(p3Production * fillRate);
      p3Revenue = p3Sold * p3Price;
    }

    const revenue = directRevenue + retailRevenue + warrantyRevenue + p3Revenue;
    const cogs = (shipmentToRetailer + directSales) * C.STANDARD_COGS;
    const grossProfit = revenue - cogs;

    // DC stock is cheaper to hold than factory stock but is not free, which is
    // what it effectively was - DC inventory carried no holding cost at all
    // and CONFIG.dc.DC_HOLDING_COST_MULTIPLIER went unused.
    const holdingCost =
      (endingRawUnits + endingFGUnits) * F.HOLDING_COST_PER_UNIT +
      (dcCentralInventory + dcWestInventory) *
        F.HOLDING_COST_PER_UNIT *
        CONFIG.dc.DC_HOLDING_COST_MULTIPLIER;
    const unfilledOrderCost = stockoutUnits * C.UNFILLED_ORDER_COST;

    // FIX: totalOpex uses vmiOngoingCost only (recurring opex).
    //      vmiSetupCost is a capital outlay and must NOT flow through
    //      operating income — it belongs in cashOut only.
    //      ecoPackagingCost is now correctly included (was silently dropped).
    const totalOpex =
      laborCost +
      holdingCost +
      decisions.marketingBudget +
      qualityCost +
      freightCost +
      techMaintenanceCost +
      dcTotalOpex +
      expansionMaintenance +
      warrantyCost +
      disposalCost -
      disposalRecovery +
      ecoPackagingCost +
      unfilledOrderCost +
      returnCost +
      transferCost +
      vmiOngoingCost +
      p3LaunchCost +
      expansionRegionCosts +
      intelligenceCost;

    const operatingIncome = grossProfit - totalOpex;
    const interest =
      ((prevState.shortTermDebt + prevState.longTermDebt) *
        F.CREDIT_LINE_RATE) /
      4;
    const netIncome = operatingIncome - interest;

    const cashIn = revenue * 0.9;
    // FIX: cashOut uses vmiSetupCost + vmiOngoingCost (both hit cash),
    //      and ecoPackagingCost is now included here too.
    const cashOut =
      adjustedProcurementCost +
      laborCost +
      holdingCost +
      decisions.marketingBudget +
      qualityCost +
      freightCost +
      interest +
      dcSetupCost +
      expansionCost +
      warrantyCost +
      disposalCost -
      disposalRecovery -
      dcDisposalRecovery +
      ecoPackagingCost +
      returnCost +
      transferCost +
      vmiSetupCost +
      vmiOngoingCost +
      techPurchaseCost +
      p3LaunchCost +
      expansionRegionCosts +
      intelligenceCost;

    // ========================================================================
    // CREDIT FACILITY
    // ========================================================================
    const financialMetrics: FinancialMetrics = {
      cash: prevState.cash + cashIn - cashOut,
      accountsReceivable: prevState.accountsReceivable + revenue * 0.1,
      inventoryValue:
        endingRawUnits * C.RAW_MATERIAL_COST + endingFGUnits * C.STANDARD_COGS,
      fixedAssets:
        prevState.fixedAssets + dcSetupCost + expansionCost + techPurchaseCost,
      accountsPayable: prevState.accountsPayable,
      shortTermDebt: prevState.shortTermDebt,
      longTermDebt: prevState.longTermDebt,
      revenue,
      netIncome: grossProfit - totalOpex - interest,
      operatingIncome: grossProfit - totalOpex,
      interestExpense: interest,
    };

    const creditResult = this.processCreditFacility(
      financialMetrics,
      endingRawUnits,
      endingFGUnits,
    );
    let newCash = creditResult.newCash;
    let newDebt = creditResult.newDebt;

    // Adjust inventory if forced sale occurred
    let adjustedRawUnits = endingRawUnits;
    let adjustedFGUnits = endingFGUnits;
    if (creditResult.forcedSaleTriggered && creditResult.inventorySold > 0) {
      const totalUnits = endingRawUnits + endingFGUnits;
      const rawProportion = totalUnits > 0 ? endingRawUnits / totalUnits : 0.5;
      const rawSold = Math.floor(creditResult.inventorySold * rawProportion);
      const fgSold = creditResult.inventorySold - rawSold;
      adjustedRawUnits = Math.max(0, endingRawUnits - rawSold);
      adjustedFGUnits = Math.max(0, endingFGUnits - fgSold);
    }

    const finalInterest =
      creditResult.interestCharge + creditResult.overlimitFee;
    const finalNetIncome = grossProfit - totalOpex - finalInterest;

    await this.recordCreditHistory(
      simulationId,
      firmId,
      quarter,
      prevState.cash,
      creditResult,
    );

    // ========================================================================
    // CSI CALCULATION
    // ========================================================================
    const warrantyTier = decisions.warrantyTier || WarrantyTier.STANDARD;
    const baseCSI = this.calculateCSI(
      fillRate,
      defectRate,
      onTimeRate,
      prevState.csi,
      greenScore,
      warrantyTier,
      features.returnsGreenScore,
    );
    const newCSI = Math.max(
      50,
      Math.min(100, baseCSI + dcServiceBonus * 100 - qualityCsiPenalty),
    );

    // ========================================================================
    // CUSTOMER POOLS & SCRM - Only if customerChurn enabled
    // ========================================================================
    const poolsResult = await this.processCustomerPoolsAndSCRM(
      simulationId,
      firmId,
      quarter,
      prevState,
      decisions,
      features,
      newCSI,
      fillRate,
      stockoutUnits,
      actualProduction,
      newCash,
      dcCentralOpen,
      dcWestOpen,
    );

    // ========================================================================
    // PERFECT ORDER - Calculate (tracking optional but always computed)
    // ========================================================================
    // Perfect order components, ported from GAS calculatePerfectOrder_
    // (flexeemaster.gs:5087-5132). The port previously used fillRate directly
    // as in-full, multiplied the whole score by the overload penalty instead
    // of applying it to on-time, and ignored rush damage and the CSI
    // documentation effect - leaving STOCKOUT_IN_FULL_PENALTY,
    // RUSH_DAMAGE_PENALTY and CSI_DOCUMENTATION_BONUS unused in config.
    let poOnTime = onTimeRate;
    let inFull = PO.BASE_IN_FULL;
    let damageFree = (1 - damageRate) * PO.BASE_DAMAGE_FREE;
    let documentation = PO.BASE_DOCUMENTATION;

    // 1. Stockouts reduce in-full
    if (totalFirmDemand > 0 && stockoutUnits > 0) {
      const stockoutRate = stockoutUnits / totalFirmDemand;
      inFull = inFull * (1 - stockoutRate * PO.STOCKOUT_IN_FULL_PENALTY);
    }
    // 2. Running hot hurts on-time
    if (capacityUtilization > 0.9) {
      poOnTime = poOnTime * (1 - (capacityUtilization - 0.9) * PO.OVERLOAD_ON_TIME_PENALTY);
    }
    // 3. Rush operations increase damage
    if (capacityUtilization > 0.85) {
      damageFree =
        damageFree * (1 - (capacityUtilization - 0.85) * PO.RUSH_DAMAGE_PENALTY);
    }
    // 4. High CSI reflects better processes -> cleaner documentation
    if (newCSI > 85) {
      documentation = Math.min(
        1,
        documentation + ((newCSI - 85) * PO.CSI_DOCUMENTATION_BONUS) / 100,
      );
    }
    // 5. Poor fill rate drags overall reliability
    if (fillRate < 0.9) {
      poOnTime = poOnTime * (0.9 + fillRate * 0.1);
    }

    poOnTime = Math.max(0.5, Math.min(1, poOnTime));
    inFull = Math.max(0.5, Math.min(1, inFull));
    damageFree = Math.max(0.8, Math.min(1, damageFree));
    documentation = Math.max(0.9, Math.min(1, documentation));

    let perfectOrderOverall = poOnTime * inFull * damageFree * documentation;

    if (features.perfectOrderTracking) {
      if (firm.techOwned?.includes(TechnologyType.OMS)) {
        perfectOrderOverall = Math.min(
          1,
          perfectOrderOverall +
            CONFIG.technology.SYSTEMS.OMS.effect.perfectOrderBonus,
        );
      }
    }

    // ========================================================================
    // PERSIST QUARTER STATE
    // ========================================================================
    await this.quarterStateModel.findOneAndUpdate(
      { simulation: simulationId, firm: firmId, quarter },
      {
        $set: {
          cash: newCash,
          accountsReceivable: prevState.accountsReceivable + revenue * 0.1,
          fixedAssets:
            prevState.fixedAssets +
            dcSetupCost +
            expansionCost +
            techPurchaseCost,
          accountsPayable: prevState.accountsPayable,
          shortTermDebt: newDebt,
          longTermDebt: prevState.longTermDebt,
          rawMaterialUnits: adjustedRawUnits,
          finishedGoodsUnits: adjustedFGUnits,
          inTransitUnits: 0,
          ordersInTransit: decisions.orderGlobal,
          capacityUnits: prevState.capacityUnits,
          csi: newCSI,
          marketShare: prevState.marketShare,
          cumulativeRevenue: prevState.cumulativeRevenue + revenue,
          cumulativeProfit: prevState.cumulativeProfit + finalNetIncome,
          retailerInventory: endingRetailerInv,
          retailerMode,
          customersLoyal: poolsResult.customersLoyal,
          customersInPlay: poolsResult.customersInPlay,
          customersCompetitor: poolsResult.customersCompetitor,
          scrmRiskScore: poolsResult.scrmRiskScore,
          scrmRiskLevel: poolsResult.scrmRiskLevel,
          segmentAllocation: poolsResult.segmentAllocation,
          vmiActive,
          vmiSnapshot,
          prevPriceP1: decisions.priceP1,
          perfectOrder: {
            onTime: poOnTime,
            inFull,
            damageFree,
            documentation,
            overall: perfectOrderOverall,
          },
          techMaintenanceCost,
          expansionInProgress,
          additionalCapacity,
          expansionMaintenance,
          dcCentralOpen,
          dcCentralInventory,
          dcWestOpen,
          dcWestInventory,
          dcTotalOpex,
          greenScore,
          disposalMethod: decisions.disposalMethod || DisposalMethod.RECYCLE,
          warrantyTier,
          centralWarrantyNetwork: decisions.centralWarrantyNetwork || false,
          westWarrantyNetwork: decisions.westWarrantyNetwork || false,
          // Market expansion state
          r4Active,
          r5Active,
          r6Active,
          r4EntryQuarter,
          r5EntryQuarter,
          r6EntryQuarter,
          // Product innovation state
          p3Launched,
          p3LaunchQuarter,
          p3Config,
        },
      },
      { upsert: true, new: true },
    );

    // ========================================================================
    // SUPPLIER SCORECARD
    // ========================================================================
    // Recorded against what actually arrived, not against a random roll.
    // Global orders are judged on the shipment that was due this quarter
    // (prevState.ordersInTransit) versus what survived any supply disruption;
    // regional orders are same-quarter and judged on this quarter's order.
    const dueFromGlobal = prevState.ordersInTransit || 0;
    if (dueFromGlobal > 0) {
      await this.recordSupplierPerformance(
        simulationId,
        firmId,
        quarter,
        SupplierType.GLOBAL,
        dueFromGlobal,
        arrivingParts,
      );
    }
    if (regionalParts > 0) {
      await this.recordSupplierPerformance(
        simulationId,
        firmId,
        quarter,
        SupplierType.REGIONAL,
        regionalParts,
        regionalParts,
      );
    }

    // Update firm
    await this.firmModel.updateOne(
      { _id: firmId },
      {
        currentCash: newCash,
        currentCsi: newCSI,
        cumulativeRevenue: prevState.cumulativeRevenue + revenue,
        cumulativeProfit: prevState.cumulativeProfit + finalNetIncome,
      },
    );

    return {
      firmId,
      firmNumber: firm.firmNumber,
      revenue,
      netIncome: finalNetIncome,
      grossProfit,
      cogs,
      operatingExpenses: totalOpex,
      interest: finalInterest,
      laborCost,
      holdingCost,
      marketingCost: decisions.marketingBudget,
      qualityCost,
      freightCost,
      techMaintenanceCost,
      dcOpex: dcTotalOpex,
      expansionMaintenance,
      warrantyCost,
      disposalCost: disposalCost - disposalRecovery,
      unitsSold,
      unitsProduced: actualProduction,
      fillRate,
      defectRate,
      perfectOrder: perfectOrderOverall,
      capacityUtilization,
      rawMaterialUnits: adjustedRawUnits,
      finishedGoodsUnits: adjustedFGUnits,
      retailerInventory: endingRetailerInv,
      inTransitUnits: 0,
      dcCentralInventory,
      dcWestInventory,
      csi: newCSI,
      greenScore,
      marketShare: prevState.marketShare,
      customersLoyal: poolsResult.customersLoyal,
      customersInPlay: poolsResult.customersInPlay,
      customersChurned: 0,
      cash: newCash,
      poOnTime,
      poInFull: inFull,
      poDamageFree: damageFree,
      poDocumentation: documentation,
      marketDemand: demandData.totalDemand,
      seasonalMultiplier: demandData.seasonalMultiplier,
      firmDemand: totalFirmDemand,
      retailDemand,
      directDemand,
      shipmentToRetailer,
      retailSales,
      directSales,
      retailerMode,
      retailerCoverageMonths,
      vmiSnapshot,
    };
  }

  // ============================================================================
  // ADVANCED MODULE PROCESSORS
  // ============================================================================

  private processCapacityExpansion(
    decisions: any,
    currentExpansions: any[],
    currentAdditionalCapacity: number,
    currentMaintenance: number,
    quarter: number,
    availableCash: number,
  ) {
    const newExpansions = [...currentExpansions];
    let additionalCapacity = currentAdditionalCapacity;
    let maintenanceCost = currentMaintenance;
    let capitalCost = 0;

    for (let i = newExpansions.length - 1; i >= 0; i--) {
      if (newExpansions[i].completesQ <= quarter) {
        additionalCapacity += newExpansions[i].capacity;
        maintenanceCost += newExpansions[i].maintenance;
        newExpansions.splice(i, 1);
      }
    }

    const expansionTypes = [
      { decision: decisions.buildSmallLine, type: ExpansionType.SMALL_LINE },
      { decision: decisions.buildMediumLine, type: ExpansionType.MEDIUM_LINE },
      { decision: decisions.buildLargeLine, type: ExpansionType.LARGE_LINE },
    ];

    for (const exp of expansionTypes) {
      if (exp.decision) {
        const config = CONFIG.expansion[exp.type];
        if (availableCash - capitalCost >= config.cost) {
          newExpansions.push({
            type: exp.type,
            capacity: config.unitsPerQuarter,
            maintenance: config.maintenance,
            completesQ: quarter + config.buildTime,
          });
          capitalCost += config.cost;
        }
      }
    }

    return {
      expansionInProgress: newExpansions,
      additionalCapacity,
      maintenanceCost,
      capitalCost,
    };
  }

  private processRegionalDCs(
    decisions: any,
    prevState: any,
    availableFGUnits: number,
  ) {
    let dcCentralOpen = prevState.dcCentralOpen || false;
    let dcCentralInventory = prevState.dcCentralInventory || 0;
    let dcWestOpen = prevState.dcWestOpen || false;
    let dcWestInventory = prevState.dcWestInventory || 0;
    let opex = 0,
      setupCost = 0,
      disposalRecovery = 0,
      transferCost = 0;
    let allocatedToCentral = 0,
      allocatedToWest = 0;

    if (decisions.dcCentralStatus === DCStatus.YES && !dcCentralOpen) {
      dcCentralOpen = true;
      setupCost += CONFIG.dc.CENTRAL.setupCost;
    } else if (decisions.dcCentralStatus === DCStatus.CLOSE && dcCentralOpen) {
      dcCentralOpen = false;
      disposalRecovery +=
        CONFIG.dc.CENTRAL.setupCost * CONFIG.dc.DISPOSAL_VALUE_RATE;
      dcCentralInventory = 0;
    }

    if (decisions.dcWestStatus === DCStatus.YES && !dcWestOpen) {
      dcWestOpen = true;
      setupCost += CONFIG.dc.WEST.setupCost;
    } else if (decisions.dcWestStatus === DCStatus.CLOSE && dcWestOpen) {
      dcWestOpen = false;
      disposalRecovery +=
        CONFIG.dc.WEST.setupCost * CONFIG.dc.DISPOSAL_VALUE_RATE;
      dcWestInventory = 0;
    }

    if (dcCentralOpen) opex += CONFIG.dc.CENTRAL.quarterlyOpex;
    if (dcWestOpen) opex += CONFIG.dc.WEST.quarterlyOpex;

    if (dcCentralOpen && decisions.allocateCentral > 0) {
      allocatedToCentral = Math.min(
        decisions.allocateCentral,
        availableFGUnits,
        CONFIG.dc.CENTRAL.capacity - dcCentralInventory,
      );
      dcCentralInventory += allocatedToCentral;
    }

    if (dcWestOpen && decisions.allocateWest > 0) {
      const remaining = availableFGUnits - allocatedToCentral;
      allocatedToWest = Math.min(
        decisions.allocateWest,
        remaining,
        CONFIG.dc.WEST.capacity - dcWestInventory,
      );
      dcWestInventory += allocatedToWest;
    }

    if (decisions.transferFromCentral > 0 && dcCentralInventory > 0) {
      const toTransfer = Math.min(
        decisions.transferFromCentral,
        dcCentralInventory,
      );
      dcCentralInventory -= toTransfer;
      if (
        decisions.transferFromCentralTo === TransferDestination.WEST &&
        dcWestOpen
      ) {
        dcWestInventory += toTransfer;
        transferCost += toTransfer * CONFIG.dc.TRANSFER_COSTS.DC_TO_DC;
      } else if (
        decisions.transferFromCentralTo === TransferDestination.FACTORY
      ) {
        transferCost += toTransfer * CONFIG.dc.TRANSFER_COSTS.DC_TO_FACTORY;
      }
    }

    if (decisions.transferFromWest > 0 && dcWestInventory > 0) {
      const toTransfer = Math.min(decisions.transferFromWest, dcWestInventory);
      dcWestInventory -= toTransfer;
      if (
        decisions.transferFromWestTo === TransferDestination.CENTRAL &&
        dcCentralOpen
      ) {
        dcCentralInventory += toTransfer;
        transferCost += toTransfer * CONFIG.dc.TRANSFER_COSTS.DC_TO_DC;
      } else if (decisions.transferFromWestTo === TransferDestination.FACTORY) {
        transferCost += toTransfer * CONFIG.dc.TRANSFER_COSTS.DC_TO_FACTORY;
      }
    }

    return {
      dcCentralOpen,
      dcCentralInventory,
      dcWestOpen,
      dcWestInventory,
      opex,
      setupCost,
      disposalRecovery,
      transferCost,
      allocatedToCentral,
      allocatedToWest,
    };
  }

  // ============================================================================
  // PROCESS MULTI-CARRIER SELECTION
  // ============================================================================
  /**
   * Process Multi-Carrier Selection
   * Handles mode selection, volume discounts, TMS effects, and last-mile costs
   */
  private processMultiCarrier(
    decision: DecisionDocument,
    firm: FirmDocument,
    unitsShipped: number,
    anyDCOpen: boolean,
    features: any,
  ): MultiCarrierResult {
    const MC = CONFIG.carrier;
    const multiCarrierEnabled = features?.multiCarrierSelection || false;
    const regionalDCsEnabled = features?.regionalDCs || false;
    const hasTMS = firm.techOwned?.includes(TechnologyType.TMS) || false;

    // Get selected carrier mode
    let modeKey = (decision.carrier as string) || MC.DEFAULT_MODE;
    if (!multiCarrierEnabled) {
      modeKey = MC.DEFAULT_MODE;
    }

    // Determine effective mode based on DC status
    let effectiveMode: any;
    let effectiveModeKey: string;
    let lastMileCost = 0;
    let forcedAir = false;

    if (regionalDCsEnabled && multiCarrierEnabled) {
      if (!anyDCOpen) {
        // No DCs open - forced to use Air (penalty for no regional presence)
        effectiveMode = MC[CarrierMode.AIR];
        effectiveModeKey = CarrierMode.AIR;
        forcedAir = true;
      } else {
        // DCs open - use selected mode + last-mile
        effectiveMode = MC[modeKey] || MC[MC.DEFAULT_MODE];
        effectiveModeKey = modeKey;
        lastMileCost = MC.LAST_MILE_COST;
      }
    } else if (multiCarrierEnabled) {
      effectiveMode = MC[modeKey] || MC[MC.DEFAULT_MODE];
      effectiveModeKey = modeKey;
    } else {
      effectiveMode = MC[MC.DEFAULT_MODE];
      effectiveModeKey = MC.DEFAULT_MODE;
    }

    // Calculate base freight cost
    let costPerUnit = effectiveMode.costPerUnit;

    // Apply volume discount if applicable
    let volumeDiscount = 0;
    let volumeDiscountAmount = 0;
    if (
      !forcedAir &&
      effectiveMode.volumeDiscountThreshold &&
      unitsShipped >= effectiveMode.volumeDiscountThreshold
    ) {
      volumeDiscount = effectiveMode.volumeDiscountRate;
      volumeDiscountAmount =
        unitsShipped * effectiveMode.costPerUnit * volumeDiscount;
      costPerUnit = costPerUnit * (1 - volumeDiscount);
    }

    // Total cost = mode cost + last-mile
    const totalCostPerUnit = costPerUnit + lastMileCost;
    const baseFreightCost = unitsShipped * effectiveMode.costPerUnit;
    let freightCost = unitsShipped * totalCostPerUnit;

    // TMS discount (applies to mode cost only, not last-mile)
    const tmsDiscount = hasTMS ? MC.TMS_DISCOUNT : 0;
    const tmsDiscountAmount = unitsShipped * costPerUnit * tmsDiscount;
    freightCost = freightCost - tmsDiscountAmount;

    // On-time rate and bonus
    const onTimeRate = effectiveMode.onTimeRate;
    const baselineOnTime = 0.92;
    const onTimeBonus = onTimeRate - baselineOnTime;

    // Build display name
    let displayName = effectiveMode.name;
    if (forcedAir) {
      displayName = 'Air (No DC - Forced)';
    } else if (lastMileCost > 0) {
      displayName = effectiveMode.name + ' + Last Mile';
    }

    return {
      carrierMode: effectiveModeKey,
      carrierName: displayName,
      costPerUnit: totalCostPerUnit,
      baseCostPerUnit: effectiveMode.costPerUnit,
      lastMileCost,
      forcedAir,
      unitsShipped,
      baseFreightCost,
      volumeDiscount,
      volumeDiscountAmount,
      tmsDiscount,
      tmsDiscountAmount,
      freightCost,
      onTimeRate,
      onTimeBonus,
      damageRate: effectiveMode.damageRate || 0,
    };
  }



  // ============================================================================
  // SUPPLIER TRACKING METHODS
  // ============================================================================

  private async recordSupplierPerformance(
    simulationId: Types.ObjectId,
    firmId: Types.ObjectId,
    quarter: number,
    supplierType: SupplierType,
    orderQty: number,
    actualDelivered: number,
  ): Promise<void> {
    const supplier = SUPPLIER_CONFIG[supplierType];
    const performance = this.calculateSupplierPerformance(
      supplier,
      orderQty,
      actualDelivered,
    );

    // Record the supplier order
    await this.supplierOrderModel.create({
      simulation: simulationId,
      firm: firmId,
      quarter,
      supplierType,
      quantityOrdered: orderQty,
      quantityReceived: actualDelivered,
      unitCost: supplier.unitCost,
      totalCost: orderQty * supplier.unitCost,
      leadTimeQuarters: supplier.leadTime,
      expectedDeliveryQuarter:
        supplier.leadTime > 0 ? quarter + supplier.leadTime : quarter,
      actualDeliveryQuarter: quarter + (supplier.leadTime > 0 ? 1 : 0),
      fillRate: orderQty > 0 ? actualDelivered / orderQty : 1,
      wasDelayed: actualDelivered < orderQty,
      defectiveUnits: Math.round(
        actualDelivered * (1 - performance.qualityRate),
      ),
      defectRate: 1 - performance.qualityRate,
    });

    // Update supplier metrics in QuarterState
    const quarterState = await this.quarterStateModel.findOne({
      simulation: simulationId,
      firm: firmId,
      quarter,
    });

    if (quarterState) {
      const existingMetricsIndex = quarterState.supplierMetrics.findIndex(
        (m) => m.supplierType === supplierType,
      );

      if (existingMetricsIndex >= 0) {
        // Update existing metrics
        const metrics = quarterState.supplierMetrics[existingMetricsIndex];
        metrics.ordersPlaced += 1;
        metrics.unitsOrdered += orderQty;
        metrics.unitsDelivered += actualDelivered;
        metrics.qualityIssuesTotal += Math.round(
          actualDelivered * (1 - performance.qualityRate),
        );
        metrics.onTimeOrders += performance.onTimeDelivery ? 1 : 0;
        metrics.lastOrderQuarter = quarter;
        metrics.currentPerformance = {
          onTimeRate: performance.onTimeDelivery ? 1.0 : 0.0,
          qualityRate: performance.qualityRate,
          flexibilityScore: performance.flexibility,
          costIndex: performance.costIndex,
          overallScore: this.calculateSupplierScore(
            performance,
            metrics.ordersPlaced,
          ),
        };
      } else {
        // Add new supplier metrics
        quarterState.supplierMetrics.push({
          supplierType,
          currentPerformance: {
            onTimeRate: performance.onTimeDelivery ? 1.0 : 0.0,
            qualityRate: performance.qualityRate,
            flexibilityScore: performance.flexibility,
            costIndex: performance.costIndex,
            overallScore: this.calculateSupplierScore(performance, 1),
          },
          ordersPlaced: 1,
          unitsOrdered: orderQty,
          unitsDelivered: actualDelivered,
          qualityIssuesTotal: Math.round(
            actualDelivered * (1 - performance.qualityRate),
          ),
          onTimeOrders: performance.onTimeDelivery ? 1 : 0,
          lastOrderQuarter: quarter,
        });
      }

      await quarterState.save();
    }
  }

  /**
   * Executive supplier scorecard.
   *
   * Answers the three questions a CEO actually asks of a supply base -
   * are they shipping on time, is the material any good, and what is the
   * price variance to standard - rolled up per supplier across quarters.
   * Deliberately no part-number level detail.
   */
  async getSupplierScorecard(
    simulationId: string,
    firmId: string,
    quarters?: number,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const firm = await this.resolveFirm(simulationId, firmId);

    const orders = await this.supplierOrderModel
      .find({ simulation: simObjectId, firm: firm._id })
      .sort({ quarter: 1 })
      .lean();

    const limit = quarters ? Number(quarters) : null;
    const scoped =
      limit && orders.length > 0
        ? orders.filter((o) => o.quarter > Math.max(...orders.map((x) => x.quarter)) - limit)
        : orders;

    const standardCost = CONFIG.costs.RAW_MATERIAL_COST;

    const rollUp = (rows: typeof scoped) => {
      const ordered = rows.reduce((a, r) => a + (r.quantityOrdered || 0), 0);
      const received = rows.reduce((a, r) => a + (r.quantityReceived ?? 0), 0);
      const spend = rows.reduce((a, r) => a + (r.totalCost || 0), 0);
      const defective = rows.reduce((a, r) => a + (r.defectiveUnits || 0), 0);
      const onTimeCount = rows.filter((r) => !r.wasDelayed).length;
      // Purchase price variance against the $150 standard raw material cost.
      const standardSpend = ordered * standardCost;
      return {
        ordersPlaced: rows.length,
        unitsOrdered: ordered,
        unitsReceived: received,
        onTimeDeliveryPct: rows.length > 0 ? (onTimeCount / rows.length) * 100 : null,
        fillRatePct: ordered > 0 ? (received / ordered) * 100 : null,
        defectRatePct: received > 0 ? (defective / received) * 100 : null,
        totalSpend: spend,
        avgUnitCost: ordered > 0 ? spend / ordered : null,
        standardUnitCost: standardCost,
        // Positive PPV = paid above standard.
        purchasePriceVariance: spend - standardSpend,
        purchasePriceVariancePct:
          standardSpend > 0 ? ((spend - standardSpend) / standardSpend) * 100 : null,
      };
    };

    const suppliers = Object.values(SupplierType).map((type) => {
      const rows = scoped.filter((o) => o.supplierType === type);
      const cfg = SUPPLIER_CONFIG[type];
      return {
        supplierType: type,
        name: cfg.name,
        location: cfg.location,
        leadTimeQuarters: cfg.leadTime,
        ...rollUp(rows),
        byQuarter: [...new Set(rows.map((r) => r.quarter))]
          .sort((a, b) => a - b)
          .map((q) => ({
            quarter: q,
            ...rollUp(rows.filter((r) => r.quarter === q)),
          })),
      };
    });

    return {
      simulationId,
      firmId: firm._id,
      firmNumber: firm.firmNumber,
      standardUnitCost: standardCost,
      total: rollUp(scoped),
      suppliers,
    };
  }

  /**
   * Competitive market share reallocation.
   *
   * Port of GAS calculateMarketShareChanges_ (flexeemaster.gs:4370-4445).
   * Each firm is scored per region on price, availability (fill rate), quality
   * (CSI), trust (cumulative revenue) and awareness (marketing spend), using
   * that region's weighting. Regional scores normalise to regional shares,
   * those roll up weighted by region size, and each firm moves 20% of the way
   * from its current share toward that target. Shares are then renormalised
   * to sum to 1.
   *
   * Without this, every firm sat at 1/numFirms forever and no decision a team
   * made could win or lose share.
   */
  private calculateMarketShareChanges(
    metrics: Array<{
      price: number;
      fillRate: number;
      csi: number;
      cumRevenue: number;
      marketing: number;
      currentShare: number;
    }>,
  ): number[] {
    const n = metrics.length;
    if (n === 0) return [];
    if (n === 1) return [1];

    const M = CONFIG.market;
    const WEIGHTS = CONFIG.customer.REGIONAL_WEIGHTS;
    const ADJUSTMENT_RATE = 0.2; // GAS: gradual move toward target

    const prices = metrics.map((m) => m.price);
    const minPrice = Math.min(...prices);
    const priceRange = Math.max(...prices) - minPrice || 1;
    const maxFill = Math.max(...metrics.map((m) => m.fillRate));
    const maxCSI = Math.max(...metrics.map((m) => m.csi));
    const maxRevenue = Math.max(...metrics.map((m) => m.cumRevenue));
    const maxMarketing = Math.max(...metrics.map((m) => m.marketing));

    const regionalShares: Record<number, number[]> = {};
    for (let region = 1; region <= 3; region++) {
      const W = WEIGHTS[region];
      const scores = metrics.map((m) => {
        const priceScore = 1 - (m.price - minPrice) / priceRange;
        const fillScore = maxFill > 0 ? m.fillRate / maxFill : 1;
        const csiScore = maxCSI > 0 ? m.csi / maxCSI : 1;
        const trustScore = maxRevenue > 0 ? m.cumRevenue / maxRevenue : 1;
        const marketingScore = maxMarketing > 0 ? m.marketing / maxMarketing : 1;
        return (
          priceScore * W.price +
          fillScore * W.availability +
          csiScore * W.quality +
          trustScore * W.trust +
          marketingScore * W.awareness
        );
      });
      const total = scores.reduce((a, b) => a + b, 0);
      regionalShares[region] =
        total > 0 ? scores.map((sc) => sc / total) : metrics.map(() => 1 / n);
    }

    const targets = metrics.map(
      (_, i) =>
        regionalShares[1][i] * M.REGIONS[1].marketShare +
        regionalShares[2][i] * M.REGIONS[2].marketShare +
        regionalShares[3][i] * M.REGIONS[3].marketShare,
    );

    const adjusted = metrics.map(
      (m, i) => m.currentShare + (targets[i] - m.currentShare) * ADJUSTMENT_RATE,
    );
    const sum = adjusted.reduce((a, b) => a + b, 0);
    return sum > 0 ? adjusted.map((sc) => sc / sum) : metrics.map(() => 1 / n);
  }

  private calculateSupplierPerformance(
    supplier: any,
    orderQty: number,
    actualDelivered: number,
  ): {
    onTimeDelivery: boolean;
    qualityRate: number;
    flexibility: number;
    costIndex: number;
  } {
    // On-time is a fact, not a dice roll: the shipment was on time only if the
    // full quantity that was due actually landed this quarter. Rolling this
    // randomly produced scorecards that reported late deliveries in quarters
    // where every part arrived.
    const onTimeDelivery = orderQty > 0 ? actualDelivered >= orderQty : true;

    // Quality reflects the supplier's own incoming defect rate.
    const qualityRate = Math.min(
      1.0,
      Math.max(0.0, 1 - supplier.defectRate),
    );

    // Cost index (normalized to 100 = baseline)
    const costIndex = supplier.costMultiplier * 100;

    return {
      onTimeDelivery,
      qualityRate,
      flexibility: supplier.baseFlexibility,
      costIndex,
    };
  }

  private calculateSupplierScore(
    performance: {
      onTimeDelivery: boolean;
      qualityRate: number;
      flexibility: number;
      costIndex: number;
    },
    ordersPlaced: number,
  ): number {
    const W = SUPPLIER_SCORECARD_CONFIG.WEIGHTS;

    const onTimeScore = performance.onTimeDelivery ? 1.0 : 0.6;
    const qualityScore = performance.qualityRate;
    const costScore = Math.min(1.0, 150 / performance.costIndex); // Normalize to 150 baseline
    const flexibilityScore = performance.flexibility;

    const overallScore =
      onTimeScore * W.onTime * 100 +
      qualityScore * W.quality * 100 +
      costScore * W.cost * 100 +
      flexibilityScore * W.flexibility * 100;

    return Math.round(overallScore);
  }

  private processWarranty(
    tier: WarrantyTier,
    unitsSold: number,
    defectsReachingCustomers: number,
    damageRate: number,
    demandByRegion: any,
    centralNetworkActive: boolean,
    westNetworkActive: boolean,
  ) {
    const config = CONFIG.warranty[tier];
    const revenue = unitsSold * config.pricePerUnit;
    const productDefects = defectsReachingCustomers;
    const shippingDamage = Math.round(unitsSold * damageRate);
    const totalClaims = productDefects + shippingDamage;

    const totalDemand =
      demandByRegion.r1 + demandByRegion.r2 + demandByRegion.r3;
    const claimsByRegion = {
      r1: Math.round(totalClaims * (demandByRegion.r1 / totalDemand)),
      r2: Math.round(totalClaims * (demandByRegion.r2 / totalDemand)),
      r3: Math.round(totalClaims * (demandByRegion.r3 / totalDemand)),
    };

    let partShippingCost = 0,
      serviceCost = 0,
      networkMaintenanceCost = 0;

    if (config.includesPart) partShippingCost = totalClaims * 15;

    if (config.includesService) {
      if (centralNetworkActive) {
        networkMaintenanceCost += 50_000;
        claimsByRegion.r2 = Math.round(claimsByRegion.r2 * 0.8);
      }
      if (westNetworkActive) {
        networkMaintenanceCost += 75_000;
        claimsByRegion.r3 = Math.round(claimsByRegion.r3 * 0.7);
      }
      serviceCost =
        (claimsByRegion.r1 + claimsByRegion.r2 + claimsByRegion.r3) * 25;
    }

    return {
      revenue,
      totalCost: partShippingCost + serviceCost + networkMaintenanceCost,
      totalClaims,
      productDefects,
      shippingDamage,
      claimsByRegion,
      partShippingCost,
      serviceCost,
      networkMaintenanceCost,
    };
  }



  // ============================================================================
  // CSI & GREEN SCORE CALCULATIONS
  // ============================================================================

  private calculateCSI(
    fillRate: number,
    defectRate: number,
    onTimeRate: number,
    previousCSI: number,
    greenScore: number,
    warrantyTier: WarrantyTier,
    greenScoreEnabled: boolean,
  ): number {
    const W = CONFIG.scoring.CSI_WEIGHTS;
    const productQuality = (1 - defectRate) * 100;
    const serviceQuality = onTimeRate * 100;
    const availabilityQuality = fillRate * 100;

    let newCSI =
      productQuality * W.PRODUCT_QUALITY +
      serviceQuality * W.SERVICE_QUALITY +
      availabilityQuality * W.AVAILABILITY_QUALITY;

    if (greenScoreEnabled) newCSI += this.getGreenScoreCSIEffect(greenScore);
    newCSI -= CONFIG.warranty[warrantyTier].csiPenalty;
    newCSI = newCSI * 0.7 + previousCSI * 0.3;

    return Math.max(0, Math.min(100, newCSI));
  }

  private getGreenScoreBracket(score: number): string {
    return score >= 80
      ? 'LEADER'
      : score >= 60
        ? 'GOOD'
        : score >= 40
          ? 'AVERAGE'
          : score >= 20
            ? 'LAGGING'
            : 'POOR';
  }

  private getGreenScoreCSIEffect(score: number): number {
    return score >= 80
      ? 3
      : score >= 60
        ? 1
        : score >= 40
          ? 0
          : score >= 20
            ? -1
            : -3;
  }

  private getGreenScoreChurnMultiplier(score: number): number {
    return score >= 80
      ? 0.9
      : score >= 60
        ? 0.95
        : score >= 40
          ? 1.0
          : score >= 20
            ? 1.1
            : 1.2;
  }

  // ============================================================================
  // KPI HISTORY & BSC SCORING
  // ============================================================================

  private async recordKpiHistory(
    simulationId: Types.ObjectId,
    firms: FirmDocument[],
    quarter: number,
    results: QuarterResult[],
  ): Promise<void> {
    const C = CONFIG.costs;

    for (const result of results) {
      const firm = firms.find((f) =>
        (f._id as Types.ObjectId).equals(result.firmId),
      );
      if (!firm) continue;

      const inventoryValue =
        result.rawMaterialUnits * C.RAW_MATERIAL_COST +
        result.finishedGoodsUnits * C.STANDARD_COGS;
      const dailySales = result.unitsSold / 90;
      const weeksOfSupply =
        dailySales > 0
          ? (result.finishedGoodsUnits + result.retailerInventory) /
            (dailySales * 7)
          : 0;
      const inventoryTurnover =
        inventoryValue > 0 ? (result.cogs * 4) / inventoryValue : 0;

      let scMaturity: ScMaturityLevel = ScMaturityLevel.BASIC;
      if (firm.techOwned.length >= 4 && result.perfectOrder > 0.85)
        scMaturity = ScMaturityLevel.ADVANCED;
      else if (firm.techOwned.length >= 2 && result.perfectOrder > 0.8)
        scMaturity = ScMaturityLevel.DEVELOPING;

      // Get ForecastLog for this quarter to fetch actual MAPE
      const forecastLog = await this.forecastLogModel.findOne({
        simulation: simulationId,
        firm: result.firmId,
        quarter,
      });
      const actualMape = forecastLog?.mape ?? 0;

      const bscFinancial = this.calculateFinancialScore(result);
      const bscCustomer = this.calculateCustomerScore(result);
      const bscProcess = this.calculateProcessScore(result);
      const bscLearning = this.calculateLearningScore(
        firm.techOwned.length,
        result.perfectOrder,
      );
      const parts = [bscFinancial, bscCustomer, bscProcess, bscLearning].map(
        (v) => (Number.isFinite(v) ? v : 0),
      );
      const bscOverall = parts.reduce((a, b) => a + b, 0) / parts.length;

      await this.kpiHistoryModel.create({
        simulation: simulationId,
        firm: firm._id,
        quarter,
        financial: {
          revenue: result.revenue,
          netIncome: result.netIncome,
          cash: result.cash,
          grossMarginPct:
            result.revenue > 0
              ? (result.grossProfit / result.revenue) * 100
              : 0,
          cogs: result.cogs,
          operatingExpenses: result.operatingExpenses,
        },
        customer: {
          csi: result.csi,
          marketShare: result.marketShare,
          fillRate: result.fillRate,
          returnRate: result.defectRate,
          customersLoyal: result.customersLoyal,
          customersInPlay: result.customersInPlay,
          customersChurned: result.customersChurned,
        },
        operations: {
          perfectOrder: result.perfectOrder,
          capacityUtilization: result.capacityUtilization,
          defectRate: result.defectRate,
          onTimeDelivery: result.poOnTime,
          inFull: result.poInFull,
          damageFree: result.poDamageFree,
          documentation: result.poDocumentation,
          mape: actualMape,
          unitsProduced: result.unitsProduced,
          unitsSold: result.unitsSold,
        },
        inventory: {
          rawMaterialUnits: result.rawMaterialUnits,
          finishedGoodsUnits: result.finishedGoodsUnits,
          inventoryValue,
          inventoryTurnover,
          weeksOfSupply,
          retailerInventory: result.retailerInventory,
          inTransitUnits: result.inTransitUnits,
        },
        channel: {
          marketDemand: result.marketDemand,
          seasonalMultiplier: result.seasonalMultiplier,
          firmDemand: result.firmDemand,
          retailDemand: result.retailDemand,
          directDemand: result.directDemand,
          shipmentToRetailer: result.shipmentToRetailer,
          retailSales: result.retailSales,
          directSales: result.directSales,
          retailerMode: result.retailerMode,
          retailerCoverageMonths: result.retailerCoverageMonths,
        },
        learning: {
          techSystemsCount: firm.techOwned.length,
          scMaturity,
          techInvestmentTotal: 0,
          forecastAccuracy: Math.max(0, Math.min(1, 1 - actualMape)),
        },
        bsc: {
          financial: bscFinancial,
          customer: bscCustomer,
          process: bscProcess,
          learning: bscLearning,
          overall: bscOverall,
          rank: 0,
        },
        costs: {
          labor: result.laborCost,
          holding: result.holdingCost,
          marketing: result.marketingCost,
          quality: result.qualityCost,
          freight: result.freightCost,
          techMaintenance: result.techMaintenanceCost,
          interest: result.interest,
          vmiSetup: result.vmiSnapshot.setupCost,
          vmiOngoing: result.vmiSnapshot.ongoingCost,
        },
        // VMI impact block — only meaningful when features.vmi is true,
        // but always written so queries don't need a feature flag check
        vmi: {
          active: result.vmiSnapshot.active,
          setupCost: result.vmiSnapshot.setupCost,
          ongoingCost: result.vmiSnapshot.ongoingCost,
          totalCostThisQuarter: result.vmiSnapshot.totalCostThisQuarter,
          retailerMode: result.vmiSnapshot.retailerMode,
          coverageMonths: result.vmiSnapshot.coverageMonths,
          clearancePrevented: result.vmiSnapshot.clearancePrevented,
          panicPrevented: result.vmiSnapshot.panicPrevented,
          revenueProtected: result.vmiSnapshot.revenueProtected,
          csiProtected: result.vmiSnapshot.csiProtected,
          cumulativeTotalCost: result.vmiSnapshot.cumulativeTotalCost,
          cumulativeRevenueProtected: result.vmiSnapshot.cumulativeRevenueProtected,
          cumulativeNetBenefit: result.vmiSnapshot.cumulativeNetBenefit,
        },
      });
    }

    await this.updateKpiRanks(simulationId, quarter);
  }

  private async updateKpiRanks(
    simulationId: Types.ObjectId,
    quarter: number,
  ): Promise<void> {
    const kpis = await this.kpiHistoryModel
      .find({ simulation: simulationId, quarter })
      .sort({ 'bsc.overall': -1 });
    for (let i = 0; i < kpis.length; i++) {
      kpis[i].bsc.rank = i + 1;
      kpis[i].bsc.grade = this.getGrade(kpis[i].bsc.overall);
      await kpis[i].save();
    }
  }

  private getGrade(score: number): string {
    return score >= 90
      ? 'A'
      : score >= 80
        ? 'B'
        : score >= 70
          ? 'C'
          : score >= 60
            ? 'D'
            : 'F';
  }

  private calculateFinancialScore(result: QuarterResult): number {
    const T = CONFIG.scoring.BSC_THRESHOLDS;
    const safe = (v: number) => (Number.isFinite(v) ? v : 0);

    const netIncome = safe(result.netIncome);
    const revenue = safe(result.revenue);
    const grossProfit = safe(result.grossProfit);
    const cash = safe(result.cash);

    const netIncomePart =
      netIncome >= T.NET_INCOME_TARGET
        ? 30
        : Math.max(0, (netIncome / T.NET_INCOME_TARGET) * 30);

    const revenuePart =
      revenue >= T.REVENUE_TARGET ? 25 : (revenue / T.REVENUE_TARGET) * 25;

    const grossPct = revenue > 0 ? grossProfit / revenue : 0;
    const grossPart =
      grossPct >= T.GROSS_MARGIN_TARGET
        ? 25
        : (grossPct / T.GROSS_MARGIN_TARGET) * 25;

    const cashPart = cash >= T.CASH_TARGET ? 20 : (cash / T.CASH_TARGET) * 20;

    return Math.min(
      100,
      safe(netIncomePart) +
        safe(revenuePart) +
        safe(grossPart) +
        safe(cashPart),
    );
  }

  private calculateCustomerScore(result: QuarterResult): number {
    const T = CONFIG.scoring.BSC_THRESHOLDS;
    const safe = (v: number) => (Number.isFinite(v) ? v : 0);

    const csi = safe(result.csi);
    const marketShare = safe(result.marketShare);
    const fillRate = safe(result.fillRate);

    const csiPart =
      csi >= T.CSI_TARGET
        ? 30
        : Math.max(0, ((csi - 50) / (T.CSI_TARGET - 50)) * 30);

    const marketPart =
      marketShare >= T.MARKET_SHARE_TARGET
        ? 25
        : (marketShare / T.MARKET_SHARE_TARGET) * 25;

    const fillPart =
      fillRate >= T.FILL_RATE_TARGET
        ? 25
        : (fillRate / T.FILL_RATE_TARGET) * 25;

    return Math.min(
      100,
      safe(csiPart) + safe(marketPart) + safe(fillPart) + 20,
    );
  }

  private calculateProcessScore(result: QuarterResult): number {
    const T = CONFIG.scoring.BSC_THRESHOLDS;
    const safe = (v: number) => (Number.isFinite(v) ? v : 0);

    const perfectOrder = safe(result.perfectOrder);
    const capacityUtilization = safe(result.capacityUtilization);
    const baseOnTime = safe(CONFIG.perfectOrder.BASE_ON_TIME);

    let capScore = 0;
    if (
      capacityUtilization >= T.CAPACITY_UTIL_OPTIMAL_LOW &&
      capacityUtilization <= T.CAPACITY_UTIL_OPTIMAL_HIGH
    ) {
      capScore = 25;
    } else if (capacityUtilization < T.CAPACITY_UTIL_OPTIMAL_LOW) {
      capScore = (capacityUtilization / T.CAPACITY_UTIL_OPTIMAL_LOW) * 25;
    } else {
      capScore = Math.max(0, ((1 - capacityUtilization) / 0.15) * 25);
    }
    capScore = safe(capScore);

    const perfectPart =
      perfectOrder >= T.PERFECT_ORDER_TARGET
        ? 30
        : (perfectOrder / T.PERFECT_ORDER_TARGET) * 30;

    const onTimePart = baseOnTime >= 0.95 ? 20 : (baseOnTime / 0.95) * 20;

    return Math.min(100, safe(perfectPart) + capScore + 22 + safe(onTimePart));
  }

  private calculateLearningScore(
    techCount: number,
    perfectOrder: number,
  ): number {
    const safeNum = (v: number) => (Number.isFinite(v) ? v : 0);
    const tech = Math.max(0, Math.floor(safeNum(techCount)));
    const po = safeNum(perfectOrder);

    const techPart = tech >= 4 ? 30 : (tech / 4) * 30;
    const bonus = tech >= 4 && po > 0.85 ? 20 : tech >= 2 ? 10 : 0;
    const scaled = (tech * 2) / 3 > 1 ? 20 : ((tech * 2) / 3) * 20;

    return Math.min(100, safeNum(techPart) + 24 + bonus + safeNum(scaled));
  }

  // ============================================================================
  // CRUD OPERATIONS - FIXED WITH EXPLICIT ObjectId CONVERSION
  // ============================================================================

  async findAllByUser(userId: string): Promise<any[]> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    let simulations: SimulationDocument[];
    if (user.role === UserRole.ADMINISTRATOR) {
      simulations = await this.simulationModel.find().sort({ createdAt: -1 });
    } else if (user.role === UserRole.FACILITATOR) {
      simulations = await this.simulationModel
        .find({
          $or: [
            { owner: this.toObjectId(userId) },
            { facilitatorIds: this.toObjectId(userId) },
          ],
        })
        .sort({ createdAt: -1 });
    } else {
      const enrollments = await this.enrollmentModel.find({
        user: this.toObjectId(userId),
        status: { $in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.PENDING_FIRM_ASSIGNMENT] },
      });
      simulations = await this.simulationModel
        .find({
          _id: { $in: enrollments.map((e) => e.simulation) },
        })
        .sort({ createdAt: -1 });
    }

    return Promise.all(
      simulations.map(async (sim) => {
        const simId = sim._id as Types.ObjectId;
        const firms = await this.firmModel.find({ simulation: simId });
        const enrollmentCount = await this.enrollmentModel.countDocuments({
          simulation: simId,
          status: EnrollmentStatus.ACTIVE,
        });
        return {
          ...sim.toObject(),
          firms: firms.map((f) => ({
            id: f._id,
            firmNumber: f.firmNumber,
            name: f.name,
            color: f.color,
          })),
          enrollmentCount,
        };
      }),
    );
  }

  async findOne(simulationId: string): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    let simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    simulation = (await this.withAutoAdvanceCheck(
      simulation as SimulationDocument,
    )) as any;
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    const firms = await this.firmModel.find({ simulation: simObjectId });
    const firmsWithEnrollments = await Promise.all(
      firms.map(async (firm) => {
        const firmId = firm._id as Types.ObjectId;
        const enrollments = await this.enrollmentModel
          .find({ firm: firmId })
          .populate('user', 'email firstName lastName');
        return {
          id: firmId.toString(),
          firmNumber: firm.firmNumber,
          name: firm.name,
          color: firm.color,
          currentCash: firm.currentCash,
          currentCsi: firm.currentCsi,
          currentMarketShare: firm.currentMarketShare,
          techOwned: firm.techOwned,
          enrollments: enrollments.map((e) => ({
            id: (e._id as Types.ObjectId).toString(),
            simulation: (e.simulation as Types.ObjectId).toString(),
            firm: {
              id: firmId.toString(),
              firmNumber: firm.firmNumber,
              name: firm.name,
            },
            user: {
              id: (e.user as any)._id.toString(),
              email: (e.user as any).email,
              firstName: (e.user as any).firstName,
              lastName: (e.user as any).lastName,
            },
            firmNumber: e.firmNumber,
            status: e.status,
            role: e.role,
            teamName: e.teamName,
            canSubmitDecisions: e.canSubmitDecisions,
            canViewReports: e.canViewReports,
            canViewCompetitorData: e.canViewCompetitorData,
            decisionsSubmitted: e.decisionsSubmitted,
            createdAt: e['createdAt'],
            updatedAt: e['updatedAt'],
          })),
          memberCount: enrollments.length,
        };
      }),
    );

    const activeEvents = await this.eventModel.find({
      simulation: simObjectId,
      isActive: true,
    });
    return {
      ...simulation.toObject(),
      firms: firmsWithEnrollments,
      activeEvents: activeEvents.map((e) => ({
        id: e._id,
        name: e.name,
        type: e.type,
        effect: e.effect,
        magnitude: e.magnitude,
        startQuarter: e.startQuarter,
        duration: e.duration,
      })),
    };
  }

  async update(
    simulationId: string,
    dto: UpdateSimulationDto,
  ): Promise<SimulationDocument> {
    const simulation = await this.simulationModel.findById(
      this.toObjectId(simulationId),
    );
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    if (dto.status)
      this.validateStatusTransition(
        simulation.status as SimulationStatus,
        dto.status,
      );
    Object.assign(simulation, dto);
    await simulation.save();
    return this.findOne(simulationId);
  }

  private validateStatusTransition(
    current: SimulationStatus,
    next: SimulationStatus,
  ): void {
    const validTransitions: Record<SimulationStatus, SimulationStatus[]> = {
      [SimulationStatus.CREATED]: [SimulationStatus.INITIALIZED],
      [SimulationStatus.INITIALIZED]: [SimulationStatus.IN_PROGRESS],
      [SimulationStatus.IN_PROGRESS]: [
        SimulationStatus.PAUSED,
        SimulationStatus.COMPLETED,
      ],
      [SimulationStatus.PAUSED]: [
        SimulationStatus.IN_PROGRESS,
        SimulationStatus.COMPLETED,
      ],
      [SimulationStatus.COMPLETED]: [],
    };
    if (!validTransitions[current].includes(next))
      throw new BadRequestException(
        `Cannot transition from ${current} to ${next}`,
      );
  }

  async delete(simulationId: string): Promise<{ message: string }> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    await this.cleanupFailedSimulation(simObjectId);
    return {
      message: `Simulation ${simulationId} and all related data deleted successfully`,
    };
  }

  // ============================================================================
  // CURRENT QUARTER DATA - FIXED
  // ============================================================================

  async getCurrentQuarterData(simulationId: string): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    const quarter = simulation.currentQuarter;
    const firms = await this.firmModel.find({ simulation: simObjectId });

    console.log(
      `getCurrentQuarterData: Found ${firms.length} firms for simulation ${simulationId}`,
    );

    const firmsData = await Promise.all(
      firms.map(async (firm) => {
        const firmId = firm._id as Types.ObjectId;
        const quarterState = await this.quarterStateModel
          .findOne({ firm: firmId, quarter })
          .sort({ quarter: -1 });
        const decision = await this.decisionModel.findOne({
          firm: firmId,
          quarter,
        });
        const kpiHistory = await this.kpiHistoryModel
          .find({ firm: firmId })
          .sort({ quarter: -1 })
          .limit(4);

        return {
          firm: {
            id: firmId,
            firmNumber: firm.firmNumber,
            name: firm.name,
            color: firm.color,
          },
          state: quarterState
            ? {
                cash: quarterState.cash,
                rawMaterials: quarterState.rawMaterialUnits,
                finishedGoods: quarterState.finishedGoodsUnits,
                inTransit: quarterState.inTransitUnits,
                retailerInventory: quarterState.retailerInventory,
                csi: quarterState.csi,
                marketShare: quarterState.marketShare,
                perfectOrder: quarterState.perfectOrder,
                retailerMode: quarterState.retailerMode,
                cumulativeRevenue: quarterState.cumulativeRevenue,
                cumulativeProfit: quarterState.cumulativeProfit,
                dcCentralOpen: quarterState.dcCentralOpen,
                dcCentralInventory: quarterState.dcCentralInventory,
                dcWestOpen: quarterState.dcWestOpen,
                dcWestInventory: quarterState.dcWestInventory,
                greenScore: quarterState.greenScore,
                vmiActive: quarterState.vmiActive,
                warrantyTier: quarterState.warrantyTier,
                additionalCapacity: quarterState.additionalCapacity,
                expansionInProgress: quarterState.expansionInProgress,
              }
            : null,
          decision: decision
            ? {
                id: decision._id,
                status: decision.status,
                submittedAt: decision.submittedAt,
                forecastTotal:
                  decision.forecastR1 +
                  decision.forecastR2 +
                  decision.forecastR3,
                productionTotal: decision.productionP1 + decision.productionP2,
              }
            : null,
          kpiTrend: kpiHistory.reverse(),
        };
      }),
    );

    const demandHistory = await this.demandHistoryModel.findOne({
      simulation: simObjectId,
      quarter,
    });
    const activeEvents = await this.eventModel.find({
      simulation: simObjectId,
      isActive: true,
      startQuarter: { $lte: quarter },
    });
    const calendarQuarter = ((quarter - 1) % 4) + 1;

    return {
      simulation: {
        id: simulation._id,
        name: simulation.name,
        status: simulation.status,
        currentQuarter: quarter,
        maxQuarters: simulation.maxQuarters,
        features: simulation.features,
      },
      seasonality: {
        calendarQuarter,
        label: CONFIG.seasonality.LABELS[calendarQuarter],
        multiplier:
          simulation.seasonality?.[`q${calendarQuarter}Multiplier`] ??
          CONFIG.seasonality.QUARTERS[calendarQuarter],
      },
      firms: firmsData,
      demandHistory: demandHistory
        ? {
            demandR1: demandHistory.demandR1,
            demandR2: demandHistory.demandR2,
            demandR3: demandHistory.demandR3,
            totalDemand: demandHistory.totalDemand,
            seasonalMultiplier: demandHistory.seasonalMultiplier,
          }
        : null,
      activeEvents: activeEvents.map((e) => ({
        id: e._id,
        name: e.name,
        type: e.type,
        effect: e.effect,
        magnitude: e.magnitude,
        startQuarter: e.startQuarter,
        duration: e.duration,
      })),
      allDecisionsSubmitted: firmsData.every(
        (f) =>
          f.decision?.status === 'SUBMITTED' ||
          f.decision?.status === 'PROCESSED',
      ),
    };
  }

  // ============================================================================
  // DEMAND HISTORY - FIXED
  // ============================================================================

  async getDemandHistory(simulationId: string): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    const demandHistory = await this.demandHistoryModel
      .find({ simulation: simObjectId })
      .sort({ quarter: 1 });

    console.log(
      `getDemandHistory: Found ${demandHistory.length} demand records for simulation ${simulationId}`,
    );

    return {
      simulationId,
      totalMarketSize: simulation.totalMarketSize,
      demandHistory,
    };
  }

  // ============================================================================
  // LEADERBOARD - FIXED
  // ============================================================================

  async getLeaderboard(simulationId: string, quarter?: any): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    const parsed =
      quarter !== undefined && quarter !== null
        ? parseInt(String(quarter), 10)
        : NaN;
    const targetQuarter =
      Number.isFinite(parsed) && !isNaN(parsed)
        ? parsed
        : simulation.currentQuarter;

    const kpis = await this.kpiHistoryModel
      .find({ simulation: simObjectId, quarter: targetQuarter })
      .sort({ 'bsc.overall': -1 })
      .populate('firm', 'firmNumber name color');

    const rankings = kpis.map((kpi, index) => ({
      rank: index + 1,
      firmId: (kpi.firm as any)?._id ?? null,
      firmNumber: (kpi.firm as any)?.firmNumber ?? null,
      firmName: (kpi.firm as any)?.name ?? null,
      firmColor: (kpi.firm as any)?.color ?? null,
      bscOverall: kpi.bsc?.overall ?? null,
      bscFinancial: kpi.bsc?.financial ?? null,
      bscCustomer: kpi.bsc?.customer ?? null,
      bscProcess: kpi.bsc?.process ?? null,
      bscLearning: kpi.bsc?.learning ?? null,
      grade: kpi.bsc?.grade ?? null,
      csi: kpi.customer?.csi ?? null,
      marketShare: kpi.customer?.marketShare ?? null,
      revenue: kpi.financial?.revenue ?? null,
      netIncome: kpi.financial?.netIncome ?? null,
    }));

    return { simulationId, quarter: targetQuarter, rankings };
  }

  // ============================================================================
  // QUARTER HISTORY - FIXED
  // ============================================================================

  async getQuarterHistory(
    simulationId: string,
    fromQuarter?: number,
    toQuarter?: number,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    const from = fromQuarter ?? 1;
    const to = toQuarter ?? simulation.currentQuarter;

    const demandHistory = await this.demandHistoryModel
      .find({
        simulation: simObjectId,
        quarter: { $gte: from, $lte: to },
      })
      .sort({ quarter: 1 });

    const firms = await this.firmModel.find({ simulation: simObjectId });
    const firmKpis: Record<string, any[]> = {};

    for (const firm of firms) {
      const kpis = await this.kpiHistoryModel
        .find({
          firm: firm._id,
          quarter: { $gte: from, $lte: to },
        })
        .sort({ quarter: 1 });
      firmKpis[firm.firmNumber] = kpis;
    }

    return {
      simulationId,
      fromQuarter: from,
      toQuarter: to,
      demandHistory,
      firmKpis,
    };
  }

  // ============================================================================
  // GET QUARTER BY NUMBER
  // ============================================================================

  async getQuarterByNumber(
    simulationId: string,
    quarterNumber: number,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    if (quarterNumber < 0 || quarterNumber > simulation.currentQuarter) {
      throw new BadRequestException(
        `Quarter ${quarterNumber} is invalid. Current quarter is ${simulation.currentQuarter}`,
      );
    }

    const firms = await this.firmModel.find({ simulation: simObjectId });

    const firmsData = await Promise.all(
      firms.map(async (firm) => {
        const firmId = firm._id as Types.ObjectId;
        const quarterState = await this.quarterStateModel.findOne({
          firm: firmId,
          quarter: quarterNumber,
        });
        const decision = await this.decisionModel.findOne({
          firm: firmId,
          quarter: quarterNumber,
        });
        const kpiHistory = await this.kpiHistoryModel.findOne({
          firm: firmId,
          quarter: quarterNumber,
        });

        return {
          firm: {
            id: firmId,
            firmNumber: firm.firmNumber,
            name: firm.name,
            color: firm.color,
          },
          state: quarterState
            ? {
                cash: quarterState.cash,
                rawMaterials: quarterState.rawMaterialUnits,
                finishedGoods: quarterState.finishedGoodsUnits,
                inTransit: quarterState.inTransitUnits,
                retailerInventory: quarterState.retailerInventory,
                csi: quarterState.csi,
                marketShare: quarterState.marketShare,
                perfectOrder: quarterState.perfectOrder,
                retailerMode: quarterState.retailerMode,
                cumulativeRevenue: quarterState.cumulativeRevenue,
                cumulativeProfit: quarterState.cumulativeProfit,
                dcCentralOpen: quarterState.dcCentralOpen,
                dcCentralInventory: quarterState.dcCentralInventory,
                dcWestOpen: quarterState.dcWestOpen,
                dcWestInventory: quarterState.dcWestInventory,
                greenScore: quarterState.greenScore,
                vmiActive: quarterState.vmiActive,
                warrantyTier: quarterState.warrantyTier,
                additionalCapacity: quarterState.additionalCapacity,
                expansionInProgress: quarterState.expansionInProgress,
              }
            : null,
          decision: decision
            ? {
                id: decision._id,
                status: decision.status,
                submittedAt: decision.submittedAt,
                forecastTotal:
                  decision.forecastR1 +
                  decision.forecastR2 +
                  decision.forecastR3,
                productionTotal: decision.productionP1 + decision.productionP2,
              }
            : null,
          kpi: kpiHistory
            ? {
                bscOverall: kpiHistory.bsc?.overall ?? null,
                bscFinancial: kpiHistory.bsc?.financial ?? null,
                bscCustomer: kpiHistory.bsc?.customer ?? null,
                bscProcess: kpiHistory.bsc?.process ?? null,
                bscLearning: kpiHistory.bsc?.learning ?? null,
                grade: kpiHistory.bsc?.grade ?? null,
                csi: kpiHistory.customer?.csi ?? null,
                marketShare: kpiHistory.customer?.marketShare ?? null,
                revenue: kpiHistory.financial?.revenue ?? null,
                netIncome: kpiHistory.financial?.netIncome ?? null,
              }
            : null,
        };
      }),
    );

    const demandHistory = await this.demandHistoryModel.findOne({
      simulation: simObjectId,
      quarter: quarterNumber,
    });
    const activeEvents = await this.eventModel.find({
      simulation: simObjectId,
      isActive: true,
      startQuarter: { $lte: quarterNumber },
    });
    const calendarQuarter = ((quarterNumber - 1) % 4) + 1;

    return {
      simulation: {
        id: simulation._id,
        name: simulation.name,
        status: simulation.status,
        currentQuarter: simulation.currentQuarter,
        maxQuarters: simulation.maxQuarters,
        features: simulation.features,
      },
      quarter: quarterNumber,
      seasonality: {
        calendarQuarter,
        label: CONFIG.seasonality.LABELS[calendarQuarter],
        multiplier:
          simulation.seasonality?.[`q${calendarQuarter}Multiplier`] ??
          CONFIG.seasonality.QUARTERS[calendarQuarter],
      },
      firms: firmsData,
      demandHistory: demandHistory
        ? {
            demandR1: demandHistory.demandR1,
            demandR2: demandHistory.demandR2,
            demandR3: demandHistory.demandR3,
            totalDemand: demandHistory.totalDemand,
            seasonalMultiplier: demandHistory.seasonalMultiplier,
          }
        : null,
      activeEvents: activeEvents.map((e) => ({
        id: e._id,
        name: e.name,
        type: e.type,
        effect: e.effect,
        magnitude: e.magnitude,
        remainingQuarters: e.duration - (quarterNumber - e.startQuarter),
      })),
    };
  }
  // ============================================================================
  // ENROLLMENTS - FIXED
  // ============================================================================

  async getSimulationEnrollments(simulationId: string): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    const firms = await this.firmModel.find({ simulation: simObjectId });
    const result: any[] = [];

    for (const firm of firms) {
      const enrollments = await this.enrollmentModel
        .find({ firm: firm._id })
        .populate('user', 'email firstName lastName participantId');

      result.push({
        firm: {
          id: firm._id,
          firmNumber: firm.firmNumber,
          name: firm.name,
          color: firm.color,
        },
        enrollments: enrollments.map((e) => ({
          id: e._id,
          user: {
            id: (e.user as any)._id,
            email: (e.user as any).email,
            firstName: (e.user as any).firstName,
            lastName: (e.user as any).lastName,
            participantId: (e.user as any).participantId,
          },
          status: e.status,
          role: e.role,
          teamName: e.teamName,
          canSubmitDecisions: e.canSubmitDecisions,
          canViewReports: e.canViewReports,
          canViewCompetitorData: e.canViewCompetitorData,
          decisionsSubmitted: e.decisionsSubmitted,
          lastActivityAt: e.lastActivityAt,
        })),
        memberCount: enrollments.length,
      });
    }

    return { simulationId, firms: result };
  }

  async enrollParticipantsInFirm(
    simulationId: string,
    dto: EnrollParticipantsDto,
  ): Promise<EnrollmentResponseDto[]> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    let firm: FirmDocument | null = null;
    if (Types.ObjectId.isValid(dto.firmId)) {
      firm = await this.firmModel.findOne({
        _id: this.toObjectId(dto.firmId),
        simulation: simObjectId,
      });
    }
    if (!firm) {
      const firmNumber = parseInt(dto.firmId, 10);
      if (!isNaN(firmNumber)) {
        firm = await this.firmModel.findOne({
          simulation: simObjectId,
          firmNumber,
        });
      }
    }
    if (!firm) throw new NotFoundException(`Firm ${dto.firmId} not found`);

    const firmId = firm._id as Types.ObjectId;
    const enrollments: EnrollmentResponseDto[] = [];

    for (const participant of dto.participants) {
      const user = await this.userModel.findById(participant.participantId);
      if (!user)
        throw new NotFoundException(`User ${participant.participantId} not found`);

      const existingEnrollment = await this.enrollmentModel.findOne({
        simulation: simObjectId,
        user: this.toObjectId(participant.participantId),
      });
      if (existingEnrollment) {
        // Update existing enrollment instead of creating duplicate
        existingEnrollment.firm = firmId;
        existingEnrollment.firmNumber = firm.firmNumber;
        existingEnrollment.status = EnrollmentStatus.ACTIVE;
        existingEnrollment.role = participant.role ?? EnrollmentRole.TEAM_MEMBER;
        existingEnrollment.teamName = dto.teamName;
        existingEnrollment.canSubmitDecisions = dto.canSubmitDecisions ?? true;
        existingEnrollment.canViewReports = dto.canViewReports ?? true;
        existingEnrollment.canViewCompetitorData =
          dto.canViewCompetitorData ?? false;
        await existingEnrollment.save();
        // Keep existing decisionsSubmitted count
      }

      // Count submitted decisions for this participant in this firm
      const submittedCount = await this.decisionModel.countDocuments({
        firm: firmId,
        submittedBy: this.toObjectId(participant.participantId),
        status: { $in: ['SUBMITTED', 'PROCESSED'] },
      });

      const enrollment =
        existingEnrollment ||
        new this.enrollmentModel({
          simulation: simObjectId,
          firm: firmId,
          user: this.toObjectId(participant.participantId),
          firmNumber: firm.firmNumber,
          status: EnrollmentStatus.ACTIVE,
          role: participant.role ?? 'TEAM_MEMBER',
          teamName: dto.teamName,
          canSubmitDecisions: dto.canSubmitDecisions ?? true,
          canViewReports: dto.canViewReports ?? true,
          canViewCompetitorData: dto.canViewCompetitorData ?? false,
          decisionsSubmitted: submittedCount, // Set actual count
        });

      const savedEnrollment = existingEnrollment
        ? enrollment
        : await enrollment.save();

      if (!existingEnrollment) {
        await this.firmModel.findByIdAndUpdate(firmId, {
          $addToSet: { members: participant.participantId },
        });
      }

      enrollments.push({
        id: (savedEnrollment._id as Types.ObjectId).toString(),
        simulation: simulationId,
        firm: {
          id: firmId.toString(),
          firmNumber: firm.firmNumber,
          name: firm.name,
        },
        user: {
          id: (user as any)._id.toString(),
          email: (user as any).email,
          firstName: (user as any).firstName,
          lastName: (user as any).lastName,
        },
        firmNumber: firm.firmNumber,
        status: savedEnrollment.status,
        role: savedEnrollment.role,
        teamName: savedEnrollment.teamName,
        canSubmitDecisions: savedEnrollment.canSubmitDecisions,
        canViewReports: savedEnrollment.canViewReports,
        canViewCompetitorData: savedEnrollment.canViewCompetitorData,
        decisionsSubmitted: savedEnrollment.decisionsSubmitted,
        createdAt: savedEnrollment['createdAt'],
        updatedAt: savedEnrollment['updatedAt'],
      });
    }

    return enrollments;
  }

  // ============================================================================
  // FIRM DETAILS - FIXED
  // ============================================================================

  async getFirmDetails(simulationId: string, firmId: string): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const firm = await this.resolveFirm(simulationId, firmId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    const currentState = await this.quarterStateModel
      .findOne({ firm: firm._id, quarter: simulation.currentQuarter })
      .lean();
    const enrollments = await this.enrollmentModel
      .find({ firm: firm._id })
      .populate('user', 'email firstName lastName');
    const recentKpis = await this.kpiHistoryModel
      .find({ firm: firm._id })
      .sort({ quarter: -1 })
      .limit(4);

    return {
      firm: {
        id: firm._id,
        firmNumber: firm.firmNumber,
        name: firm.name,
        color: firm.color,
        currentCash: firm.currentCash,
        currentCsi: firm.currentCsi,
        currentMarketShare: firm.currentMarketShare,
        cumulativeRevenue: firm.cumulativeRevenue,
        cumulativeProfit: firm.cumulativeProfit,
        techOwned: firm.techOwned,
      },
      currentState: currentState
        ? {
            quarter: currentState.quarter,
            cash: currentState.cash,
            rawMaterialUnits: currentState.rawMaterialUnits,
            finishedGoodsUnits: currentState.finishedGoodsUnits,
            retailerInventory: currentState.retailerInventory,
            csi: currentState.csi,
            marketShare: currentState.marketShare,
            perfectOrder: currentState.perfectOrder,
            dcCentralOpen: currentState.dcCentralOpen,
            dcCentralInventory: currentState.dcCentralInventory,
            dcWestOpen: currentState.dcWestOpen,
            dcWestInventory: currentState.dcWestInventory,
            greenScore: currentState.greenScore,
            vmiActive: currentState.vmiActive,
            warrantyTier: currentState.warrantyTier,
            additionalCapacity: currentState.additionalCapacity,
            expansionInProgress: currentState.expansionInProgress,
          }
        : null,
      enrollments: enrollments.map((e) => ({
        id: e._id,
        user: {
          id: (e.user as any)._id,
          email: (e.user as any).email,
          firstName: (e.user as any).firstName,
          lastName: (e.user as any).lastName,
        },
        status: e.status,
        role: e.role,
      })),
      recentKpis: recentKpis.reverse(),
    };
  }

  async getFirmKpiHistory(
    simulationId: string,
    firmId: string,
    quarters?: number,
  ): Promise<any> {
    const firm = await this.resolveFirm(simulationId, firmId);
    let query = this.kpiHistoryModel
      .find({ firm: firm._id })
      .sort({ quarter: 1 });
    if (quarters)
      query = this.kpiHistoryModel
        .find({ firm: firm._id })
        .sort({ quarter: -1 })
        .limit(quarters);
    const kpis = await query;
    return {
      firmId: firm._id,
      firmNumber: firm.firmNumber,
      kpiHistory: quarters ? kpis.reverse() : kpis,
    };
  }

  async getFirmStateHistory(
    simulationId: string,
    firmId: string,
  ): Promise<any> {
    const firm = await this.resolveFirm(simulationId, firmId);
    const states = await this.quarterStateModel
      .find({ firm: firm._id })
      .sort({ quarter: 1 })
      .select('-__v');
    return {
      firmId: firm._id,
      firmNumber: firm.firmNumber,
      stateHistory: states,
    };
  }

  // ============================================================================
  // ADVANCED MODULE DATA - FIXED
  // ============================================================================

  async getWarrantyClaimsHistory(
    simulationId: string,
    firmId: string,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const firm = await this.resolveFirm(simulationId, firmId);
    const claims = await this.warrantyClaimModel
      .find({ simulation: simObjectId, firm: firm._id })
      .sort({ quarter: 1 });
    return {
      firmId: firm._id,
      firmNumber: firm.firmNumber,
      warrantyClaims: claims,
    };
  }

  async getGreenScoreHistory(
    simulationId: string,
    firmId: string,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const firm = await this.resolveFirm(simulationId, firmId);
    const history = await this.greenScoreHistoryModel
      .find({ simulation: simObjectId, firm: firm._id })
      .sort({ quarter: 1 });
    return {
      firmId: firm._id,
      firmNumber: firm.firmNumber,
      greenScoreHistory: history,
    };
  }

  async getIntelligenceReports(
    simulationId: string,
    firmId: string,
    quarter?: number,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const firm = await this.resolveFirm(simulationId, firmId);
    const query: any = { simulation: simObjectId, firm: firm._id };
    if (quarter) query.quarter = quarter;
    const reports = await this.intelligenceReportModel
      .find(query)
      .sort({ quarter: -1, reportType: 1 });

    // Build report catalog with metadata (titles, costs, descriptions)
    const INTEL = CONFIG.intelligence.REPORTS;
    const reportCatalog = {
      MARKET_TRENDS: {
        name: INTEL.MARKET_TRENDS.name,
        cost: INTEL.MARKET_TRENDS.cost,
        description: 'Seasonal outlook and demand direction',
        isFree: true,
      },
      COMPETITOR_PRICING: {
        name: INTEL.COMPETITOR_PRICING.name,
        cost: INTEL.COMPETITOR_PRICING.cost,
        description: "Other firms' prices (1 quarter lag)",
        isFree: true,
      },
      REGIONAL_DEMAND: {
        name: INTEL.REGIONAL_DEMAND.name,
        cost: INTEL.REGIONAL_DEMAND.cost,
        description: 'R1/R2/R3 demand breakdown and trends',
        isFree: false,
      },
      RETAIL_CHANNEL: {
        name: INTEL.RETAIL_CHANNEL.name,
        cost: INTEL.RETAIL_CHANNEL.cost,
        description: 'Retailer inventory, coverage, sell-through',
        isFree: false,
      },
      COMPETITOR_CAPACITY: {
        name: INTEL.COMPETITOR_CAPACITY.name,
        cost: INTEL.COMPETITOR_CAPACITY.cost,
        description: 'Expansion plans and utilization',
        isFree: false,
      },
      SUPPLIER_RISK: {
        name: INTEL.SUPPLIER_RISK.name,
        cost: INTEL.SUPPLIER_RISK.cost,
        description: 'Early warning on disruptions',
        isFree: false,
      },
      CUSTOMER_SENTIMENT: {
        name: INTEL.CUSTOMER_SENTIMENT.name,
        cost: INTEL.CUSTOMER_SENTIMENT.cost,
        description: 'CSI trends and churn by competitor',
        isFree: false,
      },
    };

    // Calculate total subscription cost for the most recent quarter
    const latestQuarter = reports.length > 0 ? reports[0].quarter : null;
    const latestReports = latestQuarter
      ? reports.filter((r) => r.quarter === latestQuarter)
      : [];
    const totalSubscriptionCost = latestReports.reduce(
      (sum, r) => sum + (r.cost || 0),
      0,
    );

    return {
      firmId: firm._id,
      firmNumber: firm.firmNumber,
      intelligenceReports: reports,
      reportCatalog,
      latestQuarter,
      totalSubscriptionCost,
      reportsAvailable: latestReports.length,
    };
  }

  // ============================================================================
  // EVENTS - FIXED
  // ============================================================================

  async getSimulationEvents(
    simulationId: string,
    activeOnly?: boolean,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    const query: any = { simulation: simObjectId };
    if (activeOnly) query.isActive = true;

    const events = await this.eventModel.find(query).sort({ startQuarter: -1 });

    return {
      simulationId,
      currentQuarter: simulation.currentQuarter,
      events: events.map((e) => ({
        id: e._id,
        type: e.type,
        name: e.name,
        description: e.description,
        effect: e.effect,
        magnitude: e.magnitude,
        startQuarter: e.startQuarter,
        duration: e.duration,
        isActive: e.isActive,
        source: e.source,
        affectedFirms: e.affectedFirms,
      })),
    };
  }

  async triggerEvent(
    simulationId: string,
    userId: string,
    eventDto: TriggerEventDto,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    const EVENT_CONFIG = {
      SUPPLY_DISRUPTION: {
        name: 'Supply Chain Disruption',
        effect: 'PARTS_DELAYED',
        defaultMagnitude: 0.5,
        defaultDuration: 1,
      },
      DEMAND_SURGE: {
        name: 'Viral Demand Surge',
        effect: 'DEMAND_SPIKE',
        defaultMagnitude: 0.3,
        defaultDuration: 1,
      },
      COMPETITOR_STUMBLE: {
        name: 'Competitor PR Crisis',
        effect: 'STEAL_INPLAY',
        defaultMagnitude: 0.25,
        defaultDuration: 1,
      },
      ECONOMIC_DOWNTURN: {
        name: 'Economic Slowdown',
        effect: 'DEMAND_DROP',
        defaultMagnitude: 0.2,
        defaultDuration: 2,
      },
      RAW_MATERIAL_SPIKE: {
        name: 'Raw Material Cost Spike',
        effect: 'COST_INCREASE',
        defaultMagnitude: 0.25,
        defaultDuration: 1,
      },
    };

    const config = EVENT_CONFIG[eventDto.type];
    if (!config)
      throw new BadRequestException(`Invalid event type: ${eventDto.type}`);

    const event = new this.eventModel({
      simulation: simObjectId,
      type: eventDto.type,
      effect: config.effect,
      name: eventDto.name || config.name,
      description: eventDto.description || `Facilitator-triggered ${config.name}`,
      startQuarter: simulation.currentQuarter,
      duration: eventDto.duration || config.defaultDuration,
      magnitude: eventDto.magnitude || config.defaultMagnitude,
      isActive: true,
      source: 'FACILITATOR_TRIGGERED',
      triggeredBy: this.toObjectId(userId),
      // GAS behavior: ALL events apply to ALL firms equally
      // Empty array = affects ALL firms (matching GAS behavior)
      // Only COMPETITOR_STUMBLE might logically target specific firms in future
      affectedFirms: [],
    });

    const savedEvent = await event.save();

    return {
      message: 'Event triggered successfully',
      event: {
        id: savedEvent._id,
        type: savedEvent.type,
        name: savedEvent.name,
        effect: savedEvent.effect,
        magnitude: savedEvent.magnitude,
        startQuarter: savedEvent.startQuarter,
        duration: savedEvent.duration,
      },
    };
  }

  // ============================================================================
  // FEATURE TOGGLES - FIXED
  // ============================================================================

  async updateFeatureToggles(
    simulationId: string,
    featuresDto: UpdateFeaturesDto,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    simulation.features = { ...simulation.features, ...featuresDto };
    await simulation.save();

    return {
      simulationId,
      features: simulation.features,
      message: 'Feature toggles updated. Changes take effect on next quarter.',
    };
  }

  async updateModuleSchedule(
    simulationId: string,
    dto: { mode?: string; modules?: any[] },
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    // Merge incoming changes into the existing schedule
    simulation.moduleSchedule = mergeScheduleUpdate(
      simulation.moduleSchedule,
      dto,
    );
    simulation.markModified('moduleSchedule');

    // Apply any modules now eligible for the current quarter
    const syncResult = syncFeaturesFromSchedule(
      simulation.moduleSchedule,
      simulation.features as any,
      simulation.currentQuarter,
    );
    simulation.features = syncResult.features as any;
    if (syncResult.opened.length > 0) {
      simulation.markModified('features');
    }

    await simulation.save();

    return {
      simulationId,
      moduleSchedule: simulation.moduleSchedule,
      features: simulation.features,
      openedNow: syncResult.opened,
      message:
        syncResult.opened.length > 0
          ? `Schedule updated. Modules opened immediately: ${syncResult.opened.join(', ')}`
          : 'Schedule updated.',
    };
  }

  async getModuleSchedule(simulationId: string): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    const status = getScheduleStatus(
      simulation.moduleSchedule,
      simulation.features as any,
      simulation.currentQuarter,
    );

    return {
      simulationId,
      currentQuarter: simulation.currentQuarter,
      moduleSchedule: simulation.moduleSchedule,
      status,
      pacing: {
        quarterDurationDays: simulation.quarterDurationDays,
        quarterStartedAt: simulation.quarterStartedAt,
        quarterEndsAt: simulation.quarterEndsAt,
      },
    };
  }

  // ============================================================================
  // UI CONTROLS - QUARTER DATA VISIBILITY
  // ============================================================================

  async setShowQuarterData(
    simulationId: string,
    showQuarterData: boolean,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    simulation.showQuarterData = showQuarterData;
    await simulation.save();

    return {
      simulationId,
      showQuarterData: simulation.showQuarterData,
      message: `Quarter data visibility set to ${showQuarterData ? 'visible' : 'hidden'}`,
    };
  }

  async getQuarterDataVisibility(simulationId: string): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation)
      throw new NotFoundException(`Simulation ${simulationId} not found`);

    return {
      simulationId,
      showQuarterData: simulation.showQuarterData,
    };
  }

  // ============================================================================
  // ACCESS CONTROL
  // ============================================================================

  async checkUserAccess(
    userId: string,
    simulationId: string,
    requiredRole?: string[],
  ): Promise<{ hasAccess: boolean; role: string; firmId?: string }> {
    const user = await this.userModel.findById(userId);
    if (!user) return { hasAccess: false, role: 'none' };
    if (user.role === UserRole.ADMINISTRATOR)
      return { hasAccess: true, role: UserRole.ADMINISTRATOR };

    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (simulation?.owner?.toString() === userId)
      return { hasAccess: true, role: 'owner' };

    const enrollment = await this.enrollmentModel.findOne({
      simulation: simObjectId,
      user: this.toObjectId(userId),
      status: EnrollmentStatus.ACTIVE,
    });
    if (enrollment) {
      if (requiredRole && !requiredRole.includes(enrollment.role))
        return {
          hasAccess: false,
          role: enrollment.role,
          firmId: enrollment.firm?.toString() ?? undefined,
        };
      return {
        hasAccess: true,
        role: enrollment.role,
        firmId: enrollment.firm?.toString() ?? undefined,
      };
    }
    return { hasAccess: false, role: 'none' };
  }

  async findSimulationsByFacilitator(facilitatorId: string): Promise<any[]> {
    const objectId = this.toObjectId(facilitatorId);
    const simulations = await this.simulationModel
      .find({ $or: [{ owner: objectId }, { facilitatorIds: { $in: [objectId] } }] })
      .sort({ createdAt: -1 });
    return Promise.all(
      simulations.map(async (sim) => {
        const simId = sim._id as Types.ObjectId;
        const firms = await this.firmModel.find({ simulation: simId });
        const enrollmentCount = await this.enrollmentModel.countDocuments({
          simulation: simId,
          status: EnrollmentStatus.ACTIVE,
        });
        return {
          ...sim.toObject(),
          firms: firms.map((f) => ({
            id: f._id,
            firmNumber: f.firmNumber,
            name: f.name,
            color: f.color,
            memberCount: f.members?.length ?? 0,
          })),
          enrollmentCount,
        };
      }),
    );
  }

  async findSimulationsByParticipant(participantId: string): Promise<any[]> {
    const enrollments = await this.enrollmentModel
      .find({
        user: this.toObjectId(participantId),
        status: { $in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.PENDING_FIRM_ASSIGNMENT] },
      })
      .populate('simulation')
      .populate('firm');
    return enrollments.map((enrollment) => ({
      simulation: enrollment.simulation,
      firm: enrollment.firm
        ? {
            id: (enrollment.firm as any)._id,
            firmNumber: (enrollment.firm as any).firmNumber,
            name: (enrollment.firm as any).name,
            color: (enrollment.firm as any).color,
          }
        : null,
      enrollment: {
        id: enrollment._id,
        status: enrollment.status,
        role: enrollment.role,
        teamName: enrollment.teamName,
        canSubmitDecisions: enrollment.canSubmitDecisions,
        canViewReports: enrollment.canViewReports,
        canViewCompetitorData: enrollment.canViewCompetitorData,
        decisionsSubmitted: enrollment.decisionsSubmitted,
      },
    }));
  }

  // ============================================================================
  // AUTO-ADVANCE CHECK WRAPPER
  // ============================================================================

  /**
   * Wraps a simulation fetch with the auto-advance check. Use from every
   * read method that surfaces a simulation to a caller. If the window has
   * expired, this carries forward missing submissions and advances the
   * quarter, then returns the fresh document.
   */
  private async withAutoAdvanceCheck(
    sim: SimulationDocument | null,
  ): Promise<SimulationDocument | null> {
    if (!sim) return sim;

    const result = await maybeAutoAdvance(sim, {
      decisionModel: this.decisionModel,
      firmModel: this.firmModel,
      simulationModel: this.simulationModel,
      advanceQuarter: this.advanceQuarter.bind(this),
    });

    if (result.advanced) {
      console.log(
        `[autoAdvance] ${sim._id} advanced Q${result.fromQuarter} → ` +
          `Q${result.toQuarter} (carried forward: ${result.carriedForwardFirms?.join(', ') || 'none'})`,
      );
      const reloaded = await this.simulationModel.findById(sim._id);
      if (reloaded) return reloaded as SimulationDocument;
    }

    return sim;
  }

  // ============================================================================
  // HELPER: RESOLVE FIRM
  // ============================================================================


  private async resolveFirm(
    simulationId: string,
    firmId: string,
  ): Promise<FirmDocument> {
    const simObjectId = this.toObjectId(simulationId);
    let firm: FirmDocument | null = null;

    if (Types.ObjectId.isValid(firmId)) {
      firm = await this.firmModel.findOne({
        _id: this.toObjectId(firmId),
        simulation: simObjectId,
      });
    }

    if (!firm) {
      const firmNumber = parseInt(firmId, 10);
      if (!isNaN(firmNumber)) {
        firm = await this.firmModel.findOne({
          simulation: simObjectId,
          firmNumber,
        });
      }
    }

    if (!firm) {
      throw new NotFoundException(
        `Firm ${firmId} not found in simulation ${simulationId}`,
      );
    }

    return firm;
  }

  // Add this to simulation.service.ts

  async advanceQuarter(simulationId: string): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);

    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    // Check if all firms have submitted decisions for current quarter
    const firms = await this.firmModel.find({ simulation: simObjectId });

    const submittedDecisions = await this.decisionModel.countDocuments({
      simulation: simObjectId,
      quarter: simulation.currentQuarter,
      status: { $in: [DecisionStatus.SUBMITTED, DecisionStatus.PROCESSED] },
    });

    if (submittedDecisions < firms.length) {
      throw new BadRequestException(
        `Not all firms have submitted decisions. ${submittedDecisions}/${firms.length} submitted.`,
      );
    }

    // Generate demand data for current quarter if it doesn't exist
    let demandData = await this.demandHistoryModel.findOne({
      simulation: simObjectId,
      quarter: simulation.currentQuarter,
    });

    if (!demandData) {
      // Generate demand if not already created
      await this.generateAndRecordDemand(
        simObjectId,
        simulation.currentQuarter,
        simulation.demandVariability || 0.05,
        simulation.features?.seasonality ?? true,
        simulation.seasonality,
      );
      demandData = await this.demandHistoryModel.findOne({
        simulation: simObjectId,
        quarter: simulation.currentQuarter,
      });
    }

    const quarterResults: any[] = [];
    const shareMetrics: Array<{
      firmId: Types.ObjectId;
      price: number;
      fillRate: number;
      csi: number;
      cumRevenue: number;
      marketing: number;
      currentShare: number;
    }> = [];

    for (const firm of firms) {
      const decision = await this.decisionModel.findOne({
        firm: firm._id,
        quarter: simulation.currentQuarter,
      });

      const prevState = await this.quarterStateModel.findOne({
        firm: firm._id,
        quarter: simulation.currentQuarter - 1,
      });

      if (decision && prevState && demandData) {
        // Mark decision as processed
        decision.status = DecisionStatus.PROCESSED;
        decision.processedAt = new Date();
        await decision.save();

        // Score the firm's own forecast against realised demand. This was
        // previously only done for pre-history quarters, so every live quarter
        // had no ForecastLog and MAPE silently defaulted to 0 on the scorecard
        // and in the SCRM demand-volatility category.
        await this.recordForecastAccuracy(
          simObjectId,
          firm._id as Types.ObjectId,
          simulation.currentQuarter,
          {
            r1: decision.forecastR1 || 0,
            r2: decision.forecastR2 || 0,
            r3: decision.forecastR3 || 0,
          },
          {
            demandR1: demandData.demandR1,
            demandR2: demandData.demandR2,
            demandR3: demandData.demandR3,
          },
        );

        // Process the quarter
        const result = await this.processQuarter(
          simObjectId,
          firm,
          simulation.currentQuarter,
          prevState,
          decision.toObject(),
          demandData as any,
          simulation.features,
        );

        quarterResults.push({
          firmId: firm._id,
          firmNumber: firm.firmNumber,
          result,
        });

        shareMetrics.push({
          firmId: firm._id as Types.ObjectId,
          price: decision.priceP1 ?? CONFIG.market.PRODUCTS.P1.basePrice,
          fillRate: result.fillRate ?? 0,
          csi: result.csi ?? 0,
          cumRevenue: (prevState.cumulativeRevenue ?? 0) + (result.revenue ?? 0),
          marketing: decision.marketingBudget ?? 0,
          currentShare: prevState.marketShare ?? 1 / firms.length,
        });
      }
    }

    // ======================================================================
    // COMPETITIVE MARKET SHARE - second pass, needs every firm's result
    // ======================================================================
    // GAS runs this after the per-firm loop and writes the new share onto the
    // quarter just processed, so it drives the following quarter's demand.
    if (shareMetrics.length > 1) {
      const newShares = this.calculateMarketShareChanges(shareMetrics);
      for (let i = 0; i < shareMetrics.length; i++) {
        await this.quarterStateModel.updateOne(
          {
            simulation: simObjectId,
            firm: shareMetrics[i].firmId,
            quarter: simulation.currentQuarter,
          },
          { $set: { marketShare: newShares[i] } },
        );
        const qr = quarterResults.find(
          (r) => r.firmId.toString() === shareMetrics[i].firmId.toString(),
        );
        if (qr) qr.result.marketShare = newShares[i];
      }
    }

    if (quarterResults.length > 0) {
      await this.recordKpiHistory(
        simObjectId,
        firms,
        simulation.currentQuarter,
        quarterResults.map((qr) => qr.result) as QuarterResult[], // Extract the actual results
      );

      for (const firmResult of quarterResults) {
        await this.generateTenQReport(
          simObjectId,
          firmResult.firmId,
          simulation.currentQuarter,
        );
      }
    }

    // Advance to next quarter
    const previousQuarter = simulation.currentQuarter;
    simulation.currentQuarter += 1;
    const nextQuarter = simulation.currentQuarter;

    // Sync features from schedule for the new quarter
    const syncResult = syncFeaturesFromSchedule(
      simulation.moduleSchedule,
      simulation.features as any,
      nextQuarter,
    );
    simulation.features = syncResult.features as any;
    if (syncResult.opened.length > 0) {
      simulation.markModified('features');
      console.log(
        `[Q${nextQuarter}] Auto-opened modules: ${syncResult.opened.join(', ')}`,
      );
    }

    // Open the next quarter's window
    const newStartedAt = new Date();
    simulation.quarterStartedAt = newStartedAt;
    simulation.quarterEndsAt = new Date(
      newStartedAt.getTime() +
        simulation.quarterDurationDays * 24 * 60 * 60 * 1000,
    );

    if (previousQuarter === 3 && nextQuarter === 4) {
      simulation.status = SimulationStatus.IN_PROGRESS;
    }

    // Create next quarter's initial states for all firms by copying previous quarter's state
    // This ensures inventory is carried forward and participants have data to work with
    for (const firm of firms) {
      const prevQuarterState = await this.quarterStateModel.findOne({
        simulation: simObjectId,
        firm: firm._id,
        quarter: previousQuarter,
      });

      if (prevQuarterState) {
        // Check if next quarter state already exists (in case of re-processing)
        const existingNextState = await this.quarterStateModel.findOne({
          simulation: simObjectId,
          firm: firm._id,
          quarter: nextQuarter,
        });

        if (!existingNextState) {
          await this.quarterStateModel.create({
            simulation: simObjectId,
            firm: firm._id,
            quarter: nextQuarter,
            cash: prevQuarterState.cash,
            accountsReceivable: prevQuarterState.accountsReceivable,
            fixedAssets: prevQuarterState.fixedAssets,
            accountsPayable: prevQuarterState.accountsPayable,
            shortTermDebt: prevQuarterState.shortTermDebt,
            longTermDebt: prevQuarterState.longTermDebt,
            rawMaterialUnits: prevQuarterState.rawMaterialUnits,
            finishedGoodsUnits: prevQuarterState.finishedGoodsUnits,
            inTransitUnits: prevQuarterState.inTransitUnits,
            ordersInTransit: prevQuarterState.ordersInTransit,
            capacityUnits: prevQuarterState.capacityUnits,
            csi: prevQuarterState.csi,
            marketShare: prevQuarterState.marketShare,
            cumulativeRevenue: prevQuarterState.cumulativeRevenue,
            cumulativeProfit: prevQuarterState.cumulativeProfit,
            retailerInventory: prevQuarterState.retailerInventory,
            retailerMode: prevQuarterState.retailerMode,
            customersLoyal: prevQuarterState.customersLoyal,
            customersInPlay: prevQuarterState.customersInPlay,
            prevPriceP1: prevQuarterState.prevPriceP1,
            perfectOrder: prevQuarterState.perfectOrder,
            techMaintenanceCost: prevQuarterState.techMaintenanceCost,
            expansionInProgress: prevQuarterState.expansionInProgress,
            additionalCapacity: prevQuarterState.additionalCapacity,
            expansionMaintenance: prevQuarterState.expansionMaintenance,
            dcCentralOpen: prevQuarterState.dcCentralOpen,
            dcCentralInventory: prevQuarterState.dcCentralInventory,
            dcWestOpen: prevQuarterState.dcWestOpen,
            dcWestInventory: prevQuarterState.dcWestInventory,
            dcTotalOpex: prevQuarterState.dcTotalOpex,
            greenScore: prevQuarterState.greenScore,
            disposalMethod: prevQuarterState.disposalMethod,
            vmiActive: prevQuarterState.vmiActive,
            warrantyTier: prevQuarterState.warrantyTier,
            centralWarrantyNetwork: prevQuarterState.centralWarrantyNetwork,
            westWarrantyNetwork: prevQuarterState.westWarrantyNetwork,
          });
        }
      }
    }

    // Generate demand for the next quarter so it's available for participants
    const nextQuarterDemand = await this.demandHistoryModel.findOne({
      simulation: simObjectId,
      quarter: nextQuarter,
    });

    if (!nextQuarterDemand) {
      await this.generateAndRecordDemand(
        simObjectId,
        nextQuarter,
        simulation.demandVariability || 0.05,
        simulation.features?.seasonality ?? true,
        simulation.seasonality,
      );
    }

    await simulation.save();

    return {
      message: `Quarter advanced to ${simulation.currentQuarter}`,
      previousQuarter,
      currentQuarter: simulation.currentQuarter,
      simulationStatus: simulation.status,
      firmCount: firms.length,
      processedResults: quarterResults,
    };
  }

  // ============================================================================
  // 10-Q REPORT GENERATION (ALIGNED WITH GAS)
  // ============================================================================

  /**
   * Generate 10-Q report for a firm - ALIGNED WITH GAS flexeemaster.gs
   * Pulls data from KPI history, QuarterState, and related records
   */
  private async generateTenQReport(
    simulationId: Types.ObjectId,
    firmId: Types.ObjectId,
    quarter: number,
  ): Promise<TenQReportDocument | null> {
    try {
      // Get KPI data for this quarter
      const kpiData = await this.kpiHistoryModel.findOne({
        simulation: simulationId,
        firm: firmId,
        quarter,
      });

      if (!kpiData) {
        return null;
      }

      // Get quarter state for balance sheet and inventory data
      const quarterState = await this.quarterStateModel.findOne({
        simulation: simulationId,
        firm: firmId,
        quarter,
      });

      if (!quarterState) {
        return null;
      }

      // Get KPI history for YTD calculations (rolling 4 quarters)
      const startQuarter = Math.max(1, quarter - 3);
      const kpiHistory = await this.kpiHistoryModel.find({
        simulation: simulationId,
        firm: firmId,
        quarter: { $gte: startQuarter, $lte: quarter },
      });

      const C = CONFIG.costs;
      const F = CONFIG.financial;

      // ========================================================================
      // INCOME STATEMENT (directly from KPI or calculated from state)
      // ========================================================================

      const revenue = kpiData.financial?.revenue || 0;
      const cogs = kpiData.financial?.cogs || 0;
      const grossProfit = revenue - cogs;  // dollar value
      const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;  // percentage
      const unitsSold = kpiData.operations?.unitsSold || 0;
      const unitsProduced = kpiData.operations?.unitsProduced || 0;

      // Calculate operating expenses breakdown (matching GAS)
      // GAS calculates these from actual quarterly data
      const holdingCost =
        (quarterState.rawMaterialUnits + quarterState.finishedGoodsUnits) *
        F.HOLDING_COST_PER_UNIT;
      const laborCost = revenue * 0.15; // Estimate from revenue
      const qualityCost = revenue * 0.01; // Fixed 1% of revenue
      const freightCost = unitsSold * 3; // Fixed $3 per unit sold

      // Tech maintenance: count owned tech from learning data
      const numTech = kpiData.learning?.techSystemsCount || 0;
      const techMaintenance = (numTech * 500000 * 0.15) / 4; // Quarterly portion

      const marketing = revenue * 0.08; // Estimate marketing budget
      const totalOpex =
        laborCost +
        holdingCost +
        marketing +
        techMaintenance +
        qualityCost +
        freightCost;
      const operatingIncome = grossProfit - totalOpex;

      // Interest expense from actual debt
      const interest =
        ((quarterState.shortTermDebt + quarterState.longTermDebt) *
          F.CREDIT_LINE_RATE) /
        4;

      const netIncome = kpiData.financial?.netIncome || 0;

      // ========================================================================
      // BALANCE SHEET (from QuarterState)
      // ========================================================================

      const cash = quarterState.cash || 0;
      const accountsReceivable = quarterState.accountsReceivable || 0;
      const fixedAssets = quarterState.fixedAssets || 0;
      const accountsPayable = quarterState.accountsPayable || 0;
      const shortTermDebt = quarterState.shortTermDebt || 0;
      const longTermDebt = quarterState.longTermDebt || 0;

      const inventoryValue =
        kpiData.inventory?.inventoryValue ||
        quarterState.rawMaterialUnits * C.RAW_MATERIAL_COST +
          quarterState.finishedGoodsUnits * C.STANDARD_COGS;

      const totalCurrentAssets = cash + accountsReceivable + inventoryValue;
      const totalAssets = totalCurrentAssets + fixedAssets;
      const totalLiabilities = accountsPayable + shortTermDebt + longTermDebt;
      const equity = totalAssets - totalLiabilities;

      // ========================================================================
      // INVENTORY REPORT (matching GAS calculations)
      // ========================================================================

      const rawUnits = quarterState.rawMaterialUnits || 0;
      const fgUnits = quarterState.finishedGoodsUnits || 0;
      const inTransit = quarterState.inTransitUnits || 0;
      const retailerInv = quarterState.retailerInventory || 0;

      const rawValue = rawUnits * C.RAW_MATERIAL_COST;
      const fgValue = fgUnits * C.STANDARD_COGS;

      // Days of supply calculations (based on daily usage - GAS uses 90 days per quarter)
      const dailySales = unitsSold > 0 ? unitsSold / 90 : 0;
      const dailyProduction = unitsProduced > 0 ? unitsProduced / 90 : 0;

      const rawDOS = dailyProduction > 0 ? rawUnits / dailyProduction : 0;
      const fgDOS = dailySales > 0 ? fgUnits / dailySales : 0;

      // Total pipeline
      const totalPipeline = rawUnits + fgUnits + inTransit + retailerInv;

      // Inventory turnover (annualized COGS / inventory value)
      const invTurnover = inventoryValue > 0 ? (cogs * 4) / inventoryValue : 0;

      // Weeks of supply (FG + retailer inventory / weekly sales)
      const weeksOfSupply =
        dailySales > 0 ? (fgUnits + retailerInv) / (dailySales * 7) : 0;

      // ========================================================================
      // CASH FLOW STATEMENT
      // ========================================================================

      // Get previous quarter state for cash change calculation
      const prevQuarterState = await this.quarterStateModel.findOne({
        simulation: simulationId,
        firm: firmId,
        quarter: quarter - 1,
      });

      const prevCash = prevQuarterState?.cash || 0;
      const cashChange = cash - prevCash;

      const cashFromOperations = netIncome + holdingCost * 0.1; // Simple approximation

      // ========================================================================
      // KEY METRICS
      // ========================================================================

      const fillRate = kpiData.customer?.fillRate || 0;
      const csi = kpiData.customer?.csi || 0;
      const marketShare = kpiData.customer?.marketShare || 0;
      const perfectOrder = kpiData.operations?.perfectOrder || 0;
      const forecastAccuracy = 1 - (kpiData.operations?.mape || 0); // Inverse of MAPE
      const mape = kpiData.operations?.mape || 0;

      // Extract PO components from quarter state
      const poComponents = {
        onTime: quarterState.perfectOrder?.onTime || 0,
        inFull: quarterState.perfectOrder?.inFull || 0,
        damageFree: quarterState.perfectOrder?.damageFree || 0,
        documentation: quarterState.perfectOrder?.documentation || 0,
      };

      // ========================================================================
      // YTD TOTALS (matching GAS YTD calculation)
      // ========================================================================

      // Sum cashFromOperations from all quarters (Q1 to current)
      const previousTenQReports = await this.tenqReportModel.find({
        simulation: simulationId,
        firm: firmId,
        quarter: { $lt: quarter },
      });

      const ytdCashFromOperations =
        previousTenQReports.reduce(
          (sum, report) => sum + (report.cashFlow?.cashFromOperations || 0),
          0,
        ) + cashFromOperations;

      const ytdTotals = this.calculateYtdTotals(kpiHistory, ytdCashFromOperations);

      // ========================================================================
      // CREATE 10-Q REPORT DOCUMENT
      // ========================================================================

      const tenqData: Partial<TenQReportDocument> = {
        simulation: simulationId,
        firm: firmId,
        quarter,
        incomeStatement: {
          revenue,
          cogs,
          grossProfit,
          grossMarginPct: revenue > 0 ? ((grossProfit / revenue) * 100) : 0,
          laborCost,
          holdingCost,
          marketing,
          techMaintenance,
          qualityCost,
          freightCost,
          totalOpex,
          operatingIncome,
          interest,
          netIncome,
        },
        balanceSheet: {
          cash,
          accountsReceivable,
          inventoryValue,
          totalCurrentAssets,
          fixedAssets,
          totalAssets,
          accountsPayable,
          shortTermDebt,
          longTermDebt,
          totalLiabilities,
          equity,
        },
        cashFlow: {
          netIncome,
          depreciation: 0,
          workingCapitalChange: 0,
          cashFromOperations,
          capitalExpenditures: 0,
          cashUsedInvesting: 0,
          debtChange: 0,
          dividends: 0,
          cashFromFinancing: 0,
          netCashChange: cashChange,
          beginningCash: prevCash,
          endingCash: cash,
        },
        inventoryReport: {
          rawMaterialUnits: rawUnits,
          rawMaterialValue: rawValue,
          rawDaysOfSupply: Math.round(rawDOS),
          finishedGoodsUnits: fgUnits,
          finishedGoodsValue: fgValue,
          finishedGoodsDaysOfSupply: Math.round(fgDOS),
          inTransitUnits: inTransit,
          retailerInventory: retailerInv,
          totalPipeline,
          totalInventoryValue: inventoryValue,
          inventoryTurnover: parseFloat(invTurnover.toFixed(1)),
          weeksOfSupply: parseFloat(weeksOfSupply.toFixed(1)),
        },
        keyMetrics: {
          unitsProduced,
          unitsSold,
          fillRate,
          csi,
          marketShare,
          perfectOrder,
          forecastAccuracy,
          mape,
          poComponents,
        },
        ytdTotals,
        generatedAt: new Date(),
      };

      // Create and save the 10-Q report
      const report = new this.tenqReportModel(tenqData);
      return await report.save();
    } catch (error) {
      console.error(`Error generating 10-Q report for Q${quarter}: ${error}`);
      return null;
    }
  }

  /**
   * Calculate year-to-date totals from KPI history (4-quarter rolling)
   * Matches GAS YTD calculation logic
   */
  private calculateYtdTotals(history: KpiHistoryDocument[], cashGenerated: number = 0): {
    revenue: number;
    netIncome: number;
    unitsSold: number;
    avgFillRate: number;
    avgCsi: number;
    cashGenerated: number;
  } {
    if (history.length === 0) {
      return {
        revenue: 0,
        netIncome: 0,
        unitsSold: 0,
        avgFillRate: 0,
        avgCsi: 0,
        cashGenerated: 0,
      };
    }

    // Sum all quarters
    const revenue = history.reduce(
      (sum, h) => sum + (h.financial?.revenue || 0),
      0,
    );
    const netIncome = history.reduce(
      (sum, h) => sum + (h.financial?.netIncome || 0),
      0,
    );
    const unitsSold = history.reduce(
      (sum, h) => sum + (h.operations?.unitsSold || 0),
      0,
    );

    // Average metrics (GAS uses averages for these)
    const avgFillRate =
      history.reduce((sum, h) => sum + (h.customer?.fillRate || 0), 0) /
      history.length;
    const avgCsi =
      history.reduce((sum, h) => sum + (h.customer?.csi || 0), 0) /
      history.length;

    return {
      revenue,
      netIncome,
      unitsSold,
      avgFillRate,
      avgCsi,
      cashGenerated,
    };
  }
  private async processCustomerPoolsAndSCRM(
    simulationId: Types.ObjectId,
    firmId: Types.ObjectId,
    quarter: number,
    prevState: QuarterStateDocument,
    decisions: any,
    features: FeatureFlags,
    newCSI: number,
    fillRate: number,
    stockoutUnits: number,
    actualProduction: number,
    newCash: number,
    dcCentralOpen: boolean,
    dcWestOpen: boolean,
  ): Promise<{
    customersLoyal: number;
    customersInPlay: number;
    customersCompetitor: number;
    scrmRiskScore: number;
    scrmRiskLevel: string;
    segmentAllocation: {
      champions: number;
      growth: number;
      atRisk: number;
      other: number;
    } | null;
  }> {
    const M = CUSTOMER_POOLS_CONFIG.market;

    let customersLoyal =
      prevState.customersLoyal ||
      Math.round(
        M.TOTAL_MARKET_SIZE *
          prevState.marketShare *
          CUSTOMER_POOLS_CONFIG.customer.POOLS.LOYAL_PERCENT,
      );
    let customersInPlay =
      prevState.customersInPlay ||
      Math.round(
        M.TOTAL_MARKET_SIZE *
          prevState.marketShare *
          CUSTOMER_POOLS_CONFIG.customer.POOLS.IN_PLAY_PERCENT,
      );
    let customersCompetitor = prevState.customersCompetitor || 0;

    let segmentAllocation: {
      champions: number;
      growth: number;
      atRisk: number;
      other: number;
    } | null = null;
    let scrmRiskScore = 0;
    let scrmRiskLevel = 'LOW';

    if (features.customerChurn) {
      const customerDecisions: SCRMDecisions = {
        priceP1: decisions.priceP1,
        marketingBudget: decisions.marketingBudget,
        segmentChampions: decisions.segmentChampions || 25,
        segmentGrowth: decisions.segmentGrowth || 25,
        segmentAtRisk: decisions.segmentAtRisk || 25,
        segmentOther: decisions.segmentOther || 25,
      };

      const isPriceLeader = false; // TODO: Compare with other firms
      const isCsiLeader = false; // TODO: Compare with other firms

      const customerResult: CustomerPoolsResult = processCustomerPools(
        M.TOTAL_MARKET_SIZE,
        prevState.marketShare,
        customersLoyal,
        customersInPlay,
        customersCompetitor,
        prevState.prevPriceP1,
        customerDecisions,
        fillRate,
        stockoutUnits,
        newCSI,
        isPriceLeader,
        isCsiLeader,
      );

      customersLoyal = customerResult.loyalCustomers;
      customersInPlay = customerResult.inPlayCustomers;
      customersCompetitor = customerResult.competitorCustomers;

      if (features.analyticsMode) {
        segmentAllocation = {
          champions: (decisions.segmentChampions || 25) / 100,
          growth: (decisions.segmentGrowth || 25) / 100,
          atRisk: (decisions.segmentAtRisk || 25) / 100,
          other: (decisions.segmentOther || 25) / 100,
        };
      }

      // Get actual MAPE from forecast history
      let demandMape = 0.15;
      const recentForecasts = await this.forecastLogModel
        .find({ simulation: simulationId, firm: firmId })
        .sort({ quarter: -1 })
        .limit(4)
        .exec();

      if (recentForecasts.length > 0) {
        const mapeSum = recentForecasts.reduce(
          (sum, f) => sum + (f.mape || 0),
          0,
        );
        demandMape = mapeSum / recentForecasts.length;
      }

      // Calculate perfectOrder % from fill rate and other factors
      // Perfect Order = On-Time * In-Full * Damage-Free * Documentation
      const perfectOrderPercent = fillRate * 0.96; // Approximate: fill rate is primary driver

      // SCRM calculation uses ALL data from QuarterState, NOT decisions
      // GAS lines 2176-2384
      // Estimate quarterly revenue from market size and average price
      const estimatedTotalRevenue = CONFIG.market.TOTAL_MARKET_SIZE * 333; // 600k units * $333 avg price ≈ $200M

      const inventoryValue =
        prevState.rawMaterialUnits * CONFIG.costs.RAW_MATERIAL_COST +
        prevState.finishedGoodsUnits * CONFIG.costs.STANDARD_COGS;

      // Calculate SCRM with all 5 risk categories as per GAS
      const scrmResult: SCRMRiskResult = calculateSCRMRiskAssessment(
        // Category 1: Supplier Concentration (25%)
        decisions.orderGlobal || 0,
        decisions.orderRegional || 0,

        // Category 2: Inventory Buffer (20%)
        prevState.rawMaterialUnits,
        prevState.finishedGoodsUnits,
        estimatedTotalRevenue,

        // Category 3: Demand Volatility (15%)
        demandMape,
        quarter,

        // Category 4: Financial Health (15%)
        newCash,
        prevState.shortTermDebt,
        prevState.longTermDebt,
        prevState.accountsReceivable,
        prevState.fixedAssets,
        inventoryValue,

        // Category 5: Operational (25%)
        actualProduction,
        perfectOrderPercent,
        prevState.ordersInTransit,

        // Context
        dcCentralOpen,
        dcWestOpen,
      );

      scrmRiskScore = scrmResult.totalScore;
      scrmRiskLevel = scrmResult.level.level;

      // Persist SCRM history
      await this.scrmHistoryModel.create({
        simulation: simulationId,
        firm: firmId,
        quarter,
        totalRiskScore: scrmResult.totalScore,
        riskLevel: scrmResult.level.level,
        riskColor: scrmResult.level.color,
        riskDescription: scrmResult.level.description,
        breakdown: scrmResult.breakdown,
        details: scrmResult.details,
        customersLoyal,
        customersInPlay,
        customersCompetitor,
        customerMovements: {
          churnedToCompetitor: customerResult.churnedToCompetitor,
          degradedFromLoyal: customerResult.degradedFromLoyal,
          wonBackFromCompetitor: customerResult.wonBackFromCompetitor,
          newEntrants: customerResult.newEntrants,
          growthConverted: customerResult.growthConverted,
          atRiskSaved: customerResult.atRiskSaved,
        },
        inputs: scrmResult.inputs,
        recommendations: scrmResult.recommendations,
      });
    }

    return {
      customersLoyal,
      customersInPlay,
      customersCompetitor,
      scrmRiskScore,
      scrmRiskLevel,
      segmentAllocation,
    };
  }

  /**
   * Get SCRM data for a specific simulation and quarter
   * Returns risk assessment and customer metrics for all firms
   */
  async getSCRMDataByQuarter(
    simulationId: string,
    quarterNumber: number,
  ): Promise<any> {
    const simulation = await this.simulationModel.findById(simulationId);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }

    if (quarterNumber < 1 || quarterNumber > simulation.currentQuarter) {
      throw new BadRequestException(
        `Invalid quarter. Simulation is currently at Q${simulation.currentQuarter}`,
      );
    }

    // Get SCRM history for all firms in this simulation for the specified quarter
    const scrmData = await this.scrmHistoryModel
      .find({
        simulation: new Types.ObjectId(simulationId),
        quarter: quarterNumber,
      })
      .populate('firm', 'firmNumber firmName')
      .sort({ firmNumber: 1 })
      .exec();

    if (!scrmData || scrmData.length === 0) {
      throw new NotFoundException(
        `No SCRM data found for Q${quarterNumber} in this simulation`,
      );
    }

    return {
      simulation: {
        id: simulation._id,
        name: simulation.name,
      },
      quarter: quarterNumber,
      timestamp: new Date(),
      firms: scrmData.map((history: any) => ({
        firm: {
          id: history.firm._id,
          name: history.firm.firmName,
          number: history.firm.firmNumber,
        },
        riskAssessment: {
          totalRiskScore: history.totalRiskScore,
          riskLevel: history.riskLevel,
          riskColor: history.riskColor,
          riskDescription: history.riskDescription,
        },
        breakdown: history.breakdown,
        customerMetrics: {
          loyal: history.customersLoyal,
          inPlay: history.customersInPlay,
          competitor: history.customersCompetitor,
        },
        customerMovements: history.customerMovements,
        segmentAllocation: history.segmentAllocation,
        retentionMetrics: {
          retentionBonus: history.retentionBonus,
          csiImpact: history.csiImpact,
        },
        inputs: history.inputs,
        recommendations: history.recommendations,
        createdAt: history.createdAt,
      })),
    };
  }

  /**
   * Get SCRM data for a specific firm across all quarters
   */
  async getSCRMHistoryByFirm(
    simulationId: string,
    firmId: string,
  ): Promise<any> {
    const simulation = await this.simulationModel.findById(simulationId);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }

    // Resolve firm ID if numeric firmNumber is provided
    let resolvedFirmId = firmId;
    if (!Types.ObjectId.isValid(firmId)) {
      const firm = await this.firmModel.findOne({
        simulation: new Types.ObjectId(simulationId),
        firmNumber: parseInt(firmId, 10),
      });
      if (!firm) {
        throw new NotFoundException('Firm not found');
      }
      resolvedFirmId = (firm._id as Types.ObjectId).toString();
    }

    // Get SCRM history for this firm across all quarters
    const scrmHistory = await this.scrmHistoryModel
      .find({
        simulation: new Types.ObjectId(simulationId),
        firm: new Types.ObjectId(resolvedFirmId),
      })
      .sort({ quarter: 1 })
      .exec();

    if (!scrmHistory || scrmHistory.length === 0) {
      throw new NotFoundException('No SCRM history found for this firm');
    }

    const firm = scrmHistory[0];

    return {
      simulation: {
        id: simulation._id,
        name: simulation.name,
      },
      firm: {
        id: firm.firm,
        name: (scrmHistory[0] as any).firm?.firmName || 'Unknown',
      },
      quarters: scrmHistory.map((history: any) => ({
        quarter: history.quarter,
        riskAssessment: {
          totalRiskScore: history.totalRiskScore,
          riskLevel: history.riskLevel,
          riskColor: history.riskColor,
          riskDescription: history.riskDescription,
        },
        breakdown: history.breakdown,
        customerMetrics: {
          loyal: history.customersLoyal,
          inPlay: history.customersInPlay,
          competitor: history.customersCompetitor,
        },
        customerMovements: history.customerMovements,
        segmentAllocation: history.segmentAllocation,
        retentionMetrics: {
          retentionBonus: history.retentionBonus,
          csiImpact: history.csiImpact,
        },
        recommendations: history.recommendations,
        createdAt: history.createdAt,
      })),
    };
  }

  // ============================================================================
  // NEW: MARKET EXPANSION PROCESSOR (R4-R6)
  // ============================================================================

  private processMarketExpansion(
    decisions: any,
    prevState: any,
    quarter: number,
  ): {
    r4Active: boolean;
    r5Active: boolean;
    r6Active: boolean;
    r4EntryQuarter: number | null;
    r5EntryQuarter: number | null;
    r6EntryQuarter: number | null;
    totalCost: number;
    demand: { r4: number; r5: number; r6: number };
  } {
    const EXP = CONFIG.market.EXPANSION_REGIONS;
    let totalCost = 0;
    const demand = { r4: 0, r5: 0, r6: 0 };

    // R4 (Canada)
    let r4Active = prevState.r4Active || false;
    let r4EntryQuarter = prevState.r4EntryQuarter || null;
    if (decisions.enterR4 && !r4Active) {
      r4Active = true;
      r4EntryQuarter = quarter;
      totalCost += EXP[4].entryCost;
    }
    if (r4Active) {
      totalCost += EXP[4].ongoingCost;
      const quartersActive = quarter - (r4EntryQuarter || quarter);
      const rampUp = Math.min(
        1,
        quartersActive / CONFIG.market.EXPANSION_RAMP_UP_QUARTERS,
      );
      demand.r4 = Math.round(EXP[4].marketSize * rampUp * EXP[4].culturalFit);
    }

    // R5 (EU)
    let r5Active = prevState.r5Active || false;
    let r5EntryQuarter = prevState.r5EntryQuarter || null;
    if (decisions.enterR5 && !r5Active) {
      r5Active = true;
      r5EntryQuarter = quarter;
      totalCost += EXP[5].entryCost;
    }
    if (r5Active) {
      totalCost += EXP[5].ongoingCost;
      const quartersActive = quarter - (r5EntryQuarter || quarter);
      const rampUp = Math.min(
        1,
        quartersActive / CONFIG.market.EXPANSION_RAMP_UP_QUARTERS,
      );
      // Check for regulatory delay
      if (Math.random() < EXP[5].regulatoryRisk) {
        demand.r5 = 0; // Regulatory delay this quarter
      } else {
        demand.r5 = Math.round(EXP[5].marketSize * rampUp * EXP[5].culturalFit);
      }
    }

    // R6 (APAC)
    let r6Active = prevState.r6Active || false;
    let r6EntryQuarter = prevState.r6EntryQuarter || null;
    if (decisions.enterR6 && !r6Active) {
      r6Active = true;
      r6EntryQuarter = quarter;
      totalCost += EXP[6].entryCost;
    }
    if (r6Active) {
      totalCost += EXP[6].ongoingCost;
      const quartersActive = quarter - (r6EntryQuarter || quarter);
      const rampUp = Math.min(
        1,
        quartersActive / CONFIG.market.EXPANSION_RAMP_UP_QUARTERS,
      );
      if (Math.random() < EXP[6].regulatoryRisk) {
        demand.r6 = 0;
      } else {
        demand.r6 = Math.round(EXP[6].marketSize * rampUp * EXP[6].culturalFit);
      }
    }

    return {
      r4Active,
      r5Active,
      r6Active,
      r4EntryQuarter,
      r5EntryQuarter,
      r6EntryQuarter,
      totalCost,
      demand,
    };
  }

  // ============================================================================
  // NEW: DISPOSAL AND GREEN SCORE PROCESSOR
  // ============================================================================

  private processDisposalAndGreenScore(
    disposalMethod: DisposalMethod,
    unitsToDispose: number,
    ecoPackaging: boolean,
    unitsSold: number,
    currentGreenScore: number,
  ): {
    disposalCost: number;
    disposalRecovery: number;
    ecoPackagingCost: number;
    newGreenScore: number;
  } {
    const disposalConfig = CONFIG.disposal[disposalMethod];
    const disposalCost = unitsToDispose * disposalConfig.costPerUnit;
    const disposalRecovery = unitsToDispose * disposalConfig.recoveryPerUnit;

    let ecoPackagingCost = 0;
    let ecoPackagingBonus = 0;
    if (ecoPackaging) {
      ecoPackagingCost =
        unitsSold * CONFIG.greenScore.ECO_PACKAGING.costPerUnit;
      ecoPackagingBonus = CONFIG.greenScore.ECO_PACKAGING.greenScoreChange;
    }

    const newGreenScore = Math.max(
      0,
      Math.min(
        100,
        currentGreenScore + disposalConfig.greenScoreChange + ecoPackagingBonus,
      ),
    );

    return { disposalCost, disposalRecovery, ecoPackagingCost, newGreenScore };
  }

  // ============================================================================
  // NEW: TECHNOLOGY PURCHASES PROCESSOR
  // ============================================================================

  private processTechnologyPurchases(
    techPurchases: Record<string, boolean>,
    currentTech: string[],
    availableCash: number,
  ): {
    maintenanceCost: number;
    newTech: string[];
    purchaseCost: number;
  } {
    const TECH = CONFIG.technology.SYSTEMS;

    // Mapping from frontend camelCase to backend SNAKE_CASE
    const techKeyToType: Record<string, string> = {
      erp: 'ERP',
      controlTower: 'CONTROL_TOWER',
      aps: 'APS',
      demandSensing: 'DEMAND_SENSING',
      wms: 'WMS',
      tms: 'TMS',
      oms: 'OMS',
      analytics: 'ANALYTICS',
    };

    let maintenanceCost = 0;
    const newTech: string[] = [];
    let purchaseCost = 0;

    // Calculate maintenance for existing tech
    for (const tech of currentTech) {
      const techConfig = TECH[tech];
      if (techConfig) {
        maintenanceCost +=
          (techConfig.cost * CONFIG.technology.MAINTENANCE_RATE) / 4;
      }
    }

    // Process new purchases
    for (const [techKey, purchased] of Object.entries(techPurchases)) {
      const techType = techKeyToType[techKey]; // Convert camelCase to SNAKE_CASE
      if (!techType) continue; // Unknown tech key

      if (purchased && !currentTech.includes(techType)) {
        const techConfig = TECH[techType];
        if (techConfig && availableCash - purchaseCost >= techConfig.cost) {
          newTech.push(techType); // Now correctly adds 'CONTROL_TOWER' instead of 'CONTROLTOWER'
          purchaseCost += techConfig.cost;
          maintenanceCost +=
            (techConfig.cost * CONFIG.technology.MAINTENANCE_RATE) / 4;
        }
      }
    }

    return { maintenanceCost, newTech, purchaseCost };
  }

  // ============================================================================
  // NEW: INTELLIGENCE CENTER PROCESSOR
  // ============================================================================

  private async processIntelligenceCenter(
    simulationId: Types.ObjectId,
    firmId: Types.ObjectId,
    quarter: number,
    subscriptions: Record<string, boolean>,
    firmState: any,
    demandData: any,
  ): Promise<{ totalCost: number }> {
    const INTEL = CONFIG.intelligence.REPORTS;
    const M = CONFIG.market;
    let totalCost = 0;

    // ========================================================================
    // GATHER CROSS-FIRM DATA (for competitor reports)
    // Query all firms' previous quarter states for competitive intelligence
    // Uses previous quarter data (1-quarter lag, matching GAS behavior)
    // ========================================================================
    const allFirms = await this.firmModel.find({ simulation: simulationId });
    const currentFirm = allFirms.find(
      (f) => (f._id as Types.ObjectId).toString() === firmId.toString(),
    );
    const firmNumber = currentFirm?.firmNumber || 1;

    const allFirmStates: Record<number, any> = {};
    for (const firm of allFirms) {
      const state = await this.quarterStateModel.findOne({
        simulation: simulationId,
        firm: firm._id,
        quarter: quarter - 1,
      });
      // Get previous quarter's decision for pricing data
      const prevDecision = await this.decisionModel.findOne({
        simulation: simulationId,
        firm: firm._id,
        quarter: quarter - 1,
      });
      // Get previous quarter's KPI for production data
      const prevKpi = await this.kpiHistoryModel.findOne({
        simulation: simulationId,
        firm: firm._id,
        quarter: quarter - 1,
      });
      if (state) {
        allFirmStates[firm.firmNumber] = {
          firmNumber: firm.firmNumber,
          priceP1: prevDecision?.priceP1 || state.prevPriceP1 || 500,
          priceP2: prevDecision?.priceP2 || 850,
          csi: state.csi || 80,
          customersLoyal: state.customersLoyal || 0,
          customersInPlay: state.customersInPlay || 0,
          customersChurned: prevKpi?.customer?.customersChurned || 0,
          retailerInventory: state.retailerInventory || 0,
          retailerMode: state.retailerMode || 'NORMAL',
          additionalCapacity: state.additionalCapacity || 0,
          expansionInProgress: state.expansionInProgress || [],
          capacityUnits: state.capacityUnits || 250000,
          unitsProduced: prevKpi?.operations?.unitsProduced || 0,
          marketShare: state.marketShare || 0.33,
        };
      }
    }

    // ========================================================================
    // QUERY ACTIVE EVENTS (for supplier risk awareness)
    // ========================================================================
    const activeEvents = await this.eventModel.find({
      simulation: simulationId,
      isActive: true,
    });
    const upcomingEventTypes = activeEvents.map(
      (e) => e.type || e.effect || '',
    );

    // ========================================================================
    // CALENDAR QUARTER & SEASON NAMES (matching GAS logic)
    // ========================================================================
    const calendarQuarter =
      demandData.calendarQuarter || ((quarter - 1) % 4) + 1;
    const seasonNames: Record<number, string> = {
      1: 'Q1 - Post-Holiday (-15%)',
      2: 'Q2 - Spring (Baseline)',
      3: 'Q3 - Summer (Baseline)',
      4: 'Q4 - Holiday (+25%)',
    };
    const nextCalendarQuarter = (calendarQuarter % 4) + 1;

    // ========================================================================
    // FREE REPORTS - Always generated regardless of subscriptions
    // ========================================================================

    // --- MARKET TRENDS REPORT (Free) ---
    const marketTrendsContent = this.generateMarketTrendsReport(
      quarter,
      calendarQuarter,
      nextCalendarQuarter,
      seasonNames,
      demandData.totalDemand || 0,
    );
    await this.intelligenceReportModel.create({
      simulation: simulationId,
      firm: firmId,
      quarter,
      reportType: 'MARKET_TRENDS',
      title: INTEL.MARKET_TRENDS.name,
      subtitle: '(Free)',
      cost: 0,
      isFree: true,
      content: marketTrendsContent,
      lines: marketTrendsContent.lines || [],
      generatedAt: new Date(),
    });

    // --- COMPETITOR PRICING REPORT (Free - Last Quarter) ---
    const competitorPricingContent = this.generateCompetitorPricingReport(
      allFirmStates,
      firmNumber,
    );
    await this.intelligenceReportModel.create({
      simulation: simulationId,
      firm: firmId,
      quarter,
      reportType: 'COMPETITOR_PRICING',
      title: INTEL.COMPETITOR_PRICING.name,
      subtitle: '(Free - Last Quarter)',
      cost: 0,
      isFree: true,
      content: competitorPricingContent,
      lines: competitorPricingContent.lines || [],
      generatedAt: new Date(),
    });

    // ========================================================================
    // PAID REPORTS - Only generated if subscribed
    // ========================================================================

    if (subscriptions.REGIONAL_DEMAND || subscriptions.regionalDemand) {
      totalCost += INTEL.REGIONAL_DEMAND.cost;
      const content = this.generateRegionalDemandReport(demandData);
      await this.intelligenceReportModel.create({
        simulation: simulationId,
        firm: firmId,
        quarter,
        reportType: 'REGIONAL_DEMAND',
        title: INTEL.REGIONAL_DEMAND.name,
        subtitle: `($${(INTEL.REGIONAL_DEMAND.cost / 1000).toFixed(0)}K subscription)`,
        cost: INTEL.REGIONAL_DEMAND.cost,
        isFree: false,
        content,
        lines: content.lines || [],
        generatedAt: new Date(),
      });
    }

    if (subscriptions.RETAIL_CHANNEL || subscriptions.retailChannel) {
      totalCost += INTEL.RETAIL_CHANNEL.cost;
      const content = this.generateRetailChannelReport(
        allFirmStates,
        firmNumber,
        demandData.totalDemand || 0,
      );
      await this.intelligenceReportModel.create({
        simulation: simulationId,
        firm: firmId,
        quarter,
        reportType: 'RETAIL_CHANNEL',
        title: INTEL.RETAIL_CHANNEL.name,
        subtitle: `($${(INTEL.RETAIL_CHANNEL.cost / 1000).toFixed(0)}K subscription)`,
        cost: INTEL.RETAIL_CHANNEL.cost,
        isFree: false,
        content,
        lines: content.lines || [],
        generatedAt: new Date(),
      });
    }

    if (subscriptions.COMPETITOR_CAPACITY || subscriptions.competitorCapacity) {
      totalCost += INTEL.COMPETITOR_CAPACITY.cost;
      const content = this.generateCompetitorCapacityReport(
        allFirmStates,
        firmNumber,
      );
      await this.intelligenceReportModel.create({
        simulation: simulationId,
        firm: firmId,
        quarter,
        reportType: 'COMPETITOR_CAPACITY',
        title: INTEL.COMPETITOR_CAPACITY.name,
        subtitle: `($${(INTEL.COMPETITOR_CAPACITY.cost / 1000).toFixed(0)}K subscription)`,
        cost: INTEL.COMPETITOR_CAPACITY.cost,
        isFree: false,
        content,
        lines: content.lines || [],
        generatedAt: new Date(),
      });
    }

    if (subscriptions.SUPPLIER_RISK || subscriptions.supplierRisk) {
      totalCost += INTEL.SUPPLIER_RISK.cost;
      const content = this.generateSupplierRiskReport(
        quarter,
        calendarQuarter,
        upcomingEventTypes,
      );
      await this.intelligenceReportModel.create({
        simulation: simulationId,
        firm: firmId,
        quarter,
        reportType: 'SUPPLIER_RISK',
        title: INTEL.SUPPLIER_RISK.name,
        subtitle: `($${(INTEL.SUPPLIER_RISK.cost / 1000).toFixed(0)}K subscription)`,
        cost: INTEL.SUPPLIER_RISK.cost,
        isFree: false,
        content,
        lines: content.lines || [],
        generatedAt: new Date(),
      });
    }

    if (subscriptions.CUSTOMER_SENTIMENT || subscriptions.customerSentiment) {
      totalCost += INTEL.CUSTOMER_SENTIMENT.cost;
      const content = this.generateCustomerSentimentReport(
        allFirmStates,
        firmNumber,
      );
      await this.intelligenceReportModel.create({
        simulation: simulationId,
        firm: firmId,
        quarter,
        reportType: 'CUSTOMER_SENTIMENT',
        title: INTEL.CUSTOMER_SENTIMENT.name,
        subtitle: `($${(INTEL.CUSTOMER_SENTIMENT.cost / 1000).toFixed(0)}K subscription)`,
        cost: INTEL.CUSTOMER_SENTIMENT.cost,
        isFree: false,
        content,
        lines: content.lines || [],
        generatedAt: new Date(),
      });
    }

    return { totalCost };
  }

  // ============================================================================
  // INTELLIGENCE REPORT GENERATORS (ported from GAS)
  // ============================================================================

  /**
   * Market Trends Report (Free)
   * Shows seasonal outlook and demand direction
   */
  private generateMarketTrendsReport(
    quarter: number,
    calendarQuarter: number,
    nextCalendarQuarter: number,
    seasonNames: Record<number, string>,
    lastQuarterDemand: number,
  ): any {
    let trend = 'STABLE';
    let trendLabel = 'Stable';
    if (nextCalendarQuarter === 4) {
      trend = 'INCREASING';
      trendLabel = 'Increasing (Holiday)';
    }
    if (nextCalendarQuarter === 1) {
      trend = 'DECREASING';
      trendLabel = 'Decreasing (Post-Holiday)';
    }

    return {
      currentSeason: seasonNames[calendarQuarter],
      nextQuarterSeason: seasonNames[nextCalendarQuarter],
      trend,
      trendLabel,
      lastQuarterDemandUnits: Math.round(lastQuarterDemand),
      lastQuarterDemandK: Math.round(lastQuarterDemand / 1000),
      seasonalPattern: {
        Q4_Holiday: '+25% demand surge',
        Q1_PostHoliday: '-15% slowdown',
        Q2_Q3: 'Baseline demand',
      },
      lines: [
        `Current Season: ${seasonNames[calendarQuarter]}`,
        `Next Quarter: ${seasonNames[nextCalendarQuarter]}`,
        `Trend: ${trendLabel}`,
        '',
        `Last Quarter Demand: ${Math.round(lastQuarterDemand / 1000)}K units`,
        '',
        'Seasonal Pattern:',
        'Q4 Holiday: +25% demand surge',
        'Q1 Post-Holiday: -15% slowdown',
        'Q2-Q3: Baseline demand',
      ],
    };
  }

  /**
   * Competitor Pricing Report (Free - Last Quarter)
   * Shows all firms' P1/P2 prices with market averages and undercut alerts
   */
  private generateCompetitorPricingReport(
    allFirmStates: Record<number, any>,
    firmNumber: number,
  ): any {
    const firms: any[] = [];
    let totalP1 = 0;
    let totalP2 = 0;
    let count = 0;

    for (const [fNum, state] of Object.entries(allFirmStates)) {
      const fn = Number(fNum);
      const p1 = state.priceP1 || 500;
      const p2 = state.priceP2 || 850;
      totalP1 += p1;
      totalP2 += p2;
      count++;
      firms.push({
        firmNumber: fn,
        isYou: fn === firmNumber,
        priceP1: p1,
        priceP2: p2,
      });
    }

    const avgP1 = count > 0 ? Math.round(totalP1 / count) : 500;
    const avgP2 = count > 0 ? Math.round(totalP2 / count) : 850;

    // Detect undercutting
    const myP1 = allFirmStates[firmNumber]?.priceP1 || 500;
    let undercutAlert: any = null;
    for (const [fNum, state] of Object.entries(allFirmStates)) {
      const fn = Number(fNum);
      if (fn === firmNumber) continue;
      if ((state.priceP1 || 500) < myP1) {
        if (!undercutAlert || state.priceP1 < undercutAlert.price) {
          undercutAlert = {
            firmNumber: fn,
            price: state.priceP1,
          };
        }
      }
    }

    // Build display lines (matching GAS format)
    const lines: string[] = ['         P1 Price    P2 Price'];
    for (const f of firms) {
      const marker = f.isYou ? ' (You)' : '';
      lines.push(
        `Firm ${f.firmNumber}${marker}:  $${f.priceP1}        $${f.priceP2}`,
      );
    }
    lines.push('');
    lines.push(`Market Avg:  $${avgP1}        $${avgP2}`);
    if (undercutAlert) {
      lines.push('');
      lines.push(
        `WARNING: Firm ${undercutAlert.firmNumber} is undercutting at $${undercutAlert.price}`,
      );
    }

    return {
      firms,
      marketAverage: { p1: avgP1, p2: avgP2 },
      undercutAlert,
      lines,
    };
  }

  /**
   * Regional Demand Analysis ($50K)
   * R1/R2/R3 demand breakdown with growth rates and regional characteristics
   */
  private generateRegionalDemandReport(demandData: any): any {
    const M = CONFIG.market;
    const totalDemand = demandData.totalDemand || 0;
    const r1Demand =
      demandData.demandR1 || Math.round(totalDemand * M.REGIONS[1].marketShare);
    const r2Demand =
      demandData.demandR2 || Math.round(totalDemand * M.REGIONS[2].marketShare);
    const r3Demand =
      demandData.demandR3 || Math.round(totalDemand * M.REGIONS[3].marketShare);

    return {
      regions: {
        R1: {
          name: 'East',
          demand: r1Demand,
          demandK: Math.round(r1Demand / 1000),
          share: '40%',
          growthRate: `${(M.REGIONS[1].growthRate * 100).toFixed(0)}%`,
          characteristic: 'Balanced preferences',
        },
        R2: {
          name: 'Central',
          demand: r2Demand,
          demandK: Math.round(r2Demand / 1000),
          share: '35%',
          growthRate: `${(M.REGIONS[2].growthRate * 100).toFixed(0)}%`,
          characteristic: 'Price-sensitive (45% weight)',
        },
        R3: {
          name: 'West',
          demand: r3Demand,
          demandK: Math.round(r3Demand / 1000),
          share: '25%',
          growthRate: `${(M.REGIONS[3].growthRate * 100).toFixed(0)}%`,
          characteristic: 'Service-sensitive (40% quality weight)',
        },
      },
      tips: [
        'R2 responds strongly to price cuts',
        'R3 values quality and on-time delivery',
      ],
      lines: [
        'Region      Demand    Share    Growth',
        `R1 East     ${Math.round(r1Demand / 1000)}K       40%      ${(M.REGIONS[1].growthRate * 100).toFixed(0)}%`,
        `R2 Central  ${Math.round(r2Demand / 1000)}K       35%      ${(M.REGIONS[2].growthRate * 100).toFixed(0)}%`,
        `R3 West     ${Math.round(r3Demand / 1000)}K       25%      ${(M.REGIONS[3].growthRate * 100).toFixed(0)}%`,
        '',
        'Regional Characteristics:',
        'R1 East: Balanced preferences',
        'R2 Central: Price-sensitive (45% weight)',
        'R3 West: Service-sensitive (40% quality weight)',
        '',
        'TIP: R2 responds strongly to price cuts',
        'TIP: R3 values quality and on-time delivery',
      ],
    };
  }

  /**
   * Retail Channel Intelligence ($50K)
   * Retailer inventory, coverage months, and mode for all firms with alerts
   */
  private generateRetailChannelReport(
    allFirmStates: Record<number, any>,
    firmNumber: number,
    totalDemand: number,
  ): any {
    const firms: any[] = [];
    const alerts: any[] = [];

    for (const [fNum, state] of Object.entries(allFirmStates)) {
      const fn = Number(fNum);
      const retailInv = state.retailerInventory || 0;
      const retailMode = state.retailerMode || 'NORMAL';
      // Estimate coverage (assuming ~60K/quarter retail sales per firm)
      const estimatedMonthlySales = 20000;
      const coverage =
        estimatedMonthlySales > 0
          ? (retailInv / estimatedMonthlySales).toFixed(1)
          : '0.0';

      firms.push({
        firmNumber: fn,
        isYou: fn === firmNumber,
        retailerInventory: retailInv,
        retailerInventoryK: Math.round(retailInv / 1000),
        coverageMonths: parseFloat(coverage),
        retailerMode: retailMode,
      });

      // Competitor alerts
      if (fn !== firmNumber) {
        if (retailMode === 'PANIC') {
          alerts.push({
            firmNumber: fn,
            type: 'PANIC',
            message: `Firm ${fn} retailer panic ordering! Expect demand spike from their channel`,
          });
        }
        if (retailMode === 'CLEARANCE') {
          alerts.push({
            firmNumber: fn,
            type: 'CLEARANCE',
            message: `Firm ${fn} in clearance mode. Price competition may increase`,
          });
        }
      }
    }

    // Build display lines
    const lines: string[] = ['         Retail Inv  Coverage  Mode'];
    for (const f of firms) {
      const marker = f.isYou ? ' (You)' : '';
      const modeIcon =
        f.retailerMode === 'PANIC'
          ? ' WARNING'
          : f.retailerMode === 'CLEARANCE'
            ? ' DECLINING'
            : '';
      lines.push(
        `Firm ${f.firmNumber}${marker}:  ${f.retailerInventoryK}K       ${f.coverageMonths} mo   ${f.retailerMode}${modeIcon}`,
      );
    }
    lines.push('');
    lines.push('Channel Health Indicators:');
    lines.push('Target Coverage: 2.5 months');
    lines.push('PANIC Mode: < 1.0 mo (expect large orders)');
    lines.push('CLEARANCE: > 4.0 mo (discounting hurts brand)');

    for (const alert of alerts) {
      lines.push('');
      lines.push(`${alert.type}: ${alert.message}`);
    }

    return {
      firms,
      alerts,
      healthIndicators: {
        targetCoverage: 2.5,
        panicThreshold: 1.0,
        clearanceThreshold: 4.0,
      },
      lines,
    };
  }

  /**
   * Competitor Capacity Intel ($100K)
   * Base capacity, expansions, utilization, and expansion alerts
   */
  private generateCompetitorCapacityReport(
    allFirmStates: Record<number, any>,
    firmNumber: number,
  ): any {
    const firms: any[] = [];
    const expansionAlerts: any[] = [];
    const baseCapacity = 250000;

    for (const [fNum, state] of Object.entries(allFirmStates)) {
      const fn = Number(fNum);
      const addlCapacity = state.additionalCapacity || 0;
      const totalCapacity =
        (state.capacityUnits || baseCapacity) + addlCapacity;
      const production = state.unitsProduced || 0;
      const utilization =
        totalCapacity > 0 ? Math.round((production / totalCapacity) * 100) : 0;

      firms.push({
        firmNumber: fn,
        isYou: fn === firmNumber,
        baseCapacity: state.capacityUnits || baseCapacity,
        baseCapacityK: Math.round((state.capacityUnits || baseCapacity) / 1000),
        additionalCapacity: addlCapacity,
        additionalCapacityK: Math.round(addlCapacity / 1000),
        totalCapacity,
        totalCapacityK: Math.round(totalCapacity / 1000),
        utilization,
      });

      // Expansion alerts for competitors
      if (fn !== firmNumber) {
        const linesUnderConstruction = (state.expansionInProgress || []).length;
        if (linesUnderConstruction > 0) {
          expansionAlerts.push({
            firmNumber: fn,
            linesUnderConstruction,
            message: `Firm ${fn}: ${linesUnderConstruction} line(s) under construction`,
          });
        }
      }
    }

    // Build display lines
    const lines: string[] = ['         Base     Expansion  Total    Util%'];
    for (const f of firms) {
      const marker = f.isYou ? ' (You)' : '';
      lines.push(
        `Firm ${f.firmNumber}${marker}:  ${f.baseCapacityK}K    +${f.additionalCapacityK}K       ${f.totalCapacityK}K     ${f.utilization}%`,
      );
    }
    lines.push('');
    lines.push('Expansion Status:');
    if (expansionAlerts.length > 0) {
      for (const alert of expansionAlerts) {
        lines.push(`WARNING: ${alert.message}`);
      }
    } else {
      lines.push('No competitor expansions detected');
    }
    lines.push('');
    lines.push('Capacity Investment Options:');
    lines.push('Small Line: $8M, +50K (1 quarter)');
    lines.push('Medium Line: $15M, +100K (2 quarters)');
    lines.push('Large Line: $25M, +200K (3 quarters)');

    return {
      firms,
      expansionAlerts,
      investmentOptions: {
        small: { cost: 8000000, capacity: 50000, buildTime: 1 },
        medium: { cost: 15000000, capacity: 100000, buildTime: 2 },
        large: { cost: 25000000, capacity: 200000, buildTime: 3 },
      },
      lines,
    };
  }

  /**
   * Supplier Risk Monitor ($75K)
   * Risk assessment based on active events and seasonal patterns
   */
  private generateSupplierRiskReport(
    quarter: number,
    calendarQuarter: number,
    activeEventTypes: string[],
  ): any {
    let riskLevel = 'LOW';
    let riskIcon = 'GREEN';
    const riskDetails: string[] = [];
    const mitigationStrategies: string[] = [];

    // Check for supply-related events
    const hasSupplyEvent = activeEventTypes.some(
      (t) =>
        t.includes('SUPPLY') ||
        t.includes('PARTS_DELAYED') ||
        t.includes('DISRUPTION'),
    );

    if (hasSupplyEvent) {
      riskLevel = 'HIGH';
      riskIcon = 'RED';
      riskDetails.push('Supply disruption detected!');
      riskDetails.push('Recommend: Increase safety stock');
      riskDetails.push('Recommend: Use regional supplier backup');
    } else if (calendarQuarter === 4) {
      riskLevel = 'ELEVATED';
      riskIcon = 'YELLOW';
      riskDetails.push('Holiday season capacity constraints');
      riskDetails.push('Port congestion typical this period');
    } else {
      riskDetails.push('No immediate supply risks detected');
      riskDetails.push('Global supplier lead times normal');
    }

    mitigationStrategies.push('Maintain 2-week safety stock');
    mitigationStrategies.push('Regional supplier for urgent needs');
    mitigationStrategies.push('Monitor this report quarterly');

    const lines: string[] = [
      `Risk Level: ${riskLevel} (${riskIcon})`,
      '',
      'Current Conditions:',
      ...riskDetails,
      '',
      'Supplier Comparison:',
      'Global: $100/unit, 1 quarter lead time',
      'Regional: $115/unit, same quarter delivery',
      '',
      'Mitigation Strategies:',
      ...mitigationStrategies.map((s) => `- ${s}`),
    ];

    return {
      riskLevel,
      riskIcon,
      conditions: riskDetails,
      supplierComparison: {
        global: { costPerUnit: 100, leadTime: '1 quarter' },
        regional: { costPerUnit: 115, leadTime: 'Same quarter' },
      },
      mitigationStrategies,
      lines,
    };
  }

  /**
   * Customer Sentiment Tracker ($75K)
   * CSI trends, churn data, and customer pool breakdown across all firms
   */
  private generateCustomerSentimentReport(
    allFirmStates: Record<number, any>,
    firmNumber: number,
  ): any {
    const firms: any[] = [];

    for (const [fNum, state] of Object.entries(allFirmStates)) {
      const fn = Number(fNum);
      const csi = (state.csi || 80).toFixed(1);
      const churn = state.customersChurned || 0;

      let trend = 'STABLE';
      let trendIcon = 'FLAT';
      let status = 'Stable';
      if (parseFloat(csi) > 85) {
        trend = 'UP';
        trendIcon = 'UP';
        status = 'Strong';
      }
      if (parseFloat(csi) < 75) {
        trend = 'DOWN';
        trendIcon = 'DOWN';
        status = 'At Risk';
      }

      firms.push({
        firmNumber: fn,
        isYou: fn === firmNumber,
        csi: parseFloat(csi),
        trend,
        trendIcon,
        status,
        churnedK: Math.round(churn / 1000),
      });
    }

    // Own firm customer pool breakdown
    const myState = allFirmStates[firmNumber];
    const customerPool = myState
      ? {
          loyalCustomers: myState.customersLoyal || 0,
          loyalCustomersK: Math.round((myState.customersLoyal || 0) / 1000),
          atRiskPool: myState.customersInPlay || 0,
          atRiskPoolK: Math.round((myState.customersInPlay || 0) / 1000),
        }
      : {
          loyalCustomers: 0,
          loyalCustomersK: 0,
          atRiskPool: 0,
          atRiskPoolK: 0,
        };

    const csiDrivers = [
      'Fill rate (availability)',
      'Price competitiveness',
      'Warranty program tier',
      'Green Score',
    ];

    // Build display lines
    const lines: string[] = ['         CSI     Trend    Churn    Status'];
    for (const f of firms) {
      const marker = f.isYou ? ' (You)' : '';
      lines.push(
        `Firm ${f.firmNumber}${marker}:  ${f.csi}    ${f.trendIcon}        ${f.churnedK}K       ${f.status}`,
      );
    }
    lines.push('');
    lines.push('Customer Pool (Your Firm):');
    lines.push(`Loyal Customers: ${customerPool.loyalCustomersK}K`);
    lines.push(`At-Risk Pool: ${customerPool.atRiskPoolK}K`);
    lines.push('');
    lines.push('CSI Drivers:');
    for (const driver of csiDrivers) {
      lines.push(`- ${driver}`);
    }

    return {
      firms,
      customerPool,
      csiDrivers,
      lines,
    };
  }

  // ============================================================================
  // NEW: RANDOM EVENTS PROCESSOR
  // ============================================================================

  private async processRandomEvents(
    simulationId: Types.ObjectId,
    firmId: Types.ObjectId,
    quarter: number,
    prevState: any,
    techOwned: string[] = [],
  ): Promise<{
    costIncrease: number;
    demandModifier: number;
    partsDelayed: number;
    eventImpacts: any[];
  }> {
    let costIncrease = 0;
    let demandModifier = 1.0;
    let partsDelayed = 0;
    const eventImpacts: any[] = [];

    // Check if firm has Control Tower for mitigation
    const hasControlTower = techOwned.includes('CONTROL_TOWER');
    const mitigationRate = hasControlTower ? 0.1 : 0; // 10% reduction with Control Tower

    const activeEvents = await this.eventModel.find({
      simulation: simulationId,
      isActive: true,
      startQuarter: { $lte: quarter },
    });

    for (const event of activeEvents) {
      const eventEndQuarter = event.startQuarter + event.duration;

      // Skip if this firm is not affected (when affectedFirms is specified)
      if (
        event.affectedFirms &&
        event.affectedFirms.length > 0 &&
        !event.affectedFirms.some((f) => f.equals(firmId))
      ) {
        continue;
      }

      // Calculate effective magnitude after mitigation
      const rawMagnitude = event.magnitude;
      const effectiveMagnitude = rawMagnitude * (1 - mitigationRate);

      // Build impact record
      const impactRecord: any = {
        event: event._id,
        simulation: simulationId,
        firm: firmId,
        quarter,
        eventType: event.type,
        eventEffect: event.effect,
        source: event.source,
        triggeredBy: event.triggeredBy,
        rawMagnitude,
        mitigationApplied: mitigationRate,
        hasControlTower,
        effectiveMagnitude,
        impacts: {},
        firmContext: {
          cashBefore: prevState.cash,
          inventoryBefore: prevState.finishedGoodsUnits,
          marketShareBefore: prevState.marketShare,
          csiBefore: prevState.csi,
          ordersInTransit: prevState.ordersInTransit,
        },
        revenueImpact: 0,
        costImpact: 0,
        netImpact: 0,
      };

      // Apply event effects
      switch (event.effect) {
        case 'PARTS_DELAYED':
          const delayedUnits = Math.round(
            prevState.ordersInTransit * effectiveMagnitude,
          );
          partsDelayed += delayedUnits;
          impactRecord.impacts = {
            partsDelayed: delayedUnits,
            ordersAffected: prevState.ordersInTransit,
          };
          break;

        case 'DEMAND_SPIKE':
          const spikeModifier = 1 + effectiveMagnitude;
          demandModifier *= spikeModifier;
          impactRecord.impacts = {
            demandModifier: spikeModifier,
            demandChangePercent: effectiveMagnitude * 100,
          };
          break;

        case 'DEMAND_DROP':
          const dropModifier = 1 - effectiveMagnitude;
          demandModifier *= dropModifier;
          impactRecord.impacts = {
            demandModifier: dropModifier,
            demandChangePercent: -effectiveMagnitude * 100,
          };
          break;

        case 'COST_INCREASE':
          costIncrease += effectiveMagnitude;
          const estimatedProduction = prevState.capacityUnits * 0.8;
          // Cost impact: production * parts per unit * unit cost * magnitudeo
          const additionalCost =
            estimatedProduction *
            CONFIG.production.PARTS_PER_UNIT *
            SUPPLIER_CONFIG[SupplierType.GLOBAL].unitCost *
            effectiveMagnitude;
          impactRecord.impacts = {
            costIncreasePercent: effectiveMagnitude * 100,
            additionalCost,
          };
          impactRecord.costImpact = additionalCost;
          impactRecord.netImpact = -additionalCost;
          break;

        case 'STEAL_INPLAY':
          impactRecord.impacts = {
            marketShareChange: effectiveMagnitude * 100,
          };
          break;
      }

      eventImpacts.push(impactRecord);

      // Deactivate event if duration is complete
      if (quarter >= eventEndQuarter) {
        event.isActive = false;
        await event.save();
      }
    }

    // Persist all event impacts
    if (eventImpacts.length > 0) {
      await this.eventImpactModel.insertMany(eventImpacts);
    }

    return { costIncrease, demandModifier, partsDelayed, eventImpacts };
  }

  // ============================================================================
  // EVENT IMPACT TRACKING - Facilitator Dashboard Methods
  // ============================================================================

  /**
   * Get all event impacts for a simulation with optional filters
   */
  async getEventImpacts(
    simulationId: string,
    options?: {
      quarter?: number;
      source?: string;
      triggeredBy?: string;
      firmId?: string;
    },
  ): Promise<any[]> {
    const simObjectId = this.toObjectId(simulationId);
    const query: any = { simulation: simObjectId };

    if (options?.quarter !== undefined) query.quarter = options.quarter;
    if (options?.source) query.source = options.source;
    if (options?.triggeredBy)
      query.triggeredBy = this.toObjectId(options.triggeredBy);
    if (options?.firmId) query.firm = this.toObjectId(options.firmId);

    return this.eventImpactModel
      .find(query)
      .populate('event', 'name description')
      .populate('firm', 'name firmNumber color')
      .populate('triggeredBy', 'email firstName lastName')
      .sort({ quarter: -1, createdAt: -1 });
  }

  /**
   * Get summary of facilitator-triggered events for dashboard
   */
  async getFacilitatorEventSummary(simulationId: string): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);

    const summary = await this.eventImpactModel.aggregate([
      {
        $match: {
          simulation: simObjectId,
          source: 'FACILITATOR_TRIGGERED',
        },
      },
      {
        $group: {
          _id: { eventType: '$eventType', quarter: '$quarter' },
          firmsAffected: { $sum: 1 },
          avgRawMagnitude: { $avg: '$rawMagnitude' },
          avgEffectiveMagnitude: { $avg: '$effectiveMagnitude' },
          firmsWithMitigation: { $sum: { $cond: ['$hasControlTower', 1, 0] } },
          totalCostImpact: { $sum: '$costImpact' },
          totalNetImpact: { $sum: '$netImpact' },
        },
      },
      { $sort: { '_id.quarter': -1 } },
    ]);

    return { simulationId, impacts: summary };
  }

  /**
   * Get detailed view of a single event's impact across all firms
   */
  async getEventImpactDetails(eventId: string): Promise<any> {
    const eventObjectId = this.toObjectId(eventId);

    const [event, impacts] = await Promise.all([
      this.eventModel
        .findById(eventObjectId)
        .populate('triggeredBy', 'email firstName lastName'),
      this.eventImpactModel
        .find({ event: eventObjectId })
        .populate('firm', 'name firmNumber color'),
    ]);

    if (!event) throw new NotFoundException(`Event ${eventId} not found`);

    return {
      event: {
        id: event._id,
        type: event.type,
        effect: event.effect,
        name: event.name,
        description: event.description,
        source: event.source,
        triggeredBy: event.triggeredBy,
        startQuarter: event.startQuarter,
        duration: event.duration,
        magnitude: event.magnitude,
      },
      firmImpacts: impacts.map((imp) => ({
        firm: imp.firm,
        quarter: imp.quarter,
        rawMagnitude: imp.rawMagnitude,
        effectiveMagnitude: imp.effectiveMagnitude,
        mitigated: imp.hasControlTower,
        impacts: imp.impacts,
        netImpact: imp.netImpact,
      })),
      totals: {
        firmsAffected: impacts.length,
        firmsMitigated: impacts.filter((i) => i.hasControlTower).length,
        totalNetImpact: impacts.reduce((sum, i) => sum + (i.netImpact || 0), 0),
      },
    };
  }

  // ============================================================================
  // GREEN SCORE HELPERS - Using GAS config
  // ============================================================================

  private getGreenScoreEffect(score: number): {
    csiEffect: number;
    churnMultiplier: number;
    label: string;
  } {
    const effects = CONFIG.greenScore.SCORE_EFFECTS;
    if (score >= effects.EXCELLENT.min) return effects.EXCELLENT;
    if (score >= effects.GOOD.min) return effects.GOOD;
    if (score >= effects.AVERAGE.min) return effects.AVERAGE;
    if (score >= effects.BELOW_AVERAGE.min) return effects.BELOW_AVERAGE;
    return effects.POOR;
  }

  // ============================================================================
  // DC STATUS AND CARRIER ANALYSIS
  // ============================================================================

  /**
   * Get DC status for all firms
   * Endpoint: GET /simulations/:id/dc-status?quarter=X
   */
  async getDCStatus(simulationId: string, quarter?: number): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);

    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    // Check if regional DCs feature is enabled
    if (!simulation.features?.regionalDCs) {
      return {
        simulationId,
        featureEnabled: false,
        message: 'Regional DCs feature is not enabled for this simulation',
      };
    }

    const targetQuarter = quarter || simulation.currentQuarter;
    const firms = await this.firmModel.find({ simulation: simObjectId });

    const dcData = await Promise.all(
      firms.map(async (firm) => {
        const firmId = firm._id as Types.ObjectId;

        // Get quarter state for the target quarter
        const state = await this.quarterStateModel.findOne({
          simulation: simObjectId,
          firm: firmId,
          quarter: targetQuarter,
        });

        // Get decision for DC setup costs
        const decision = await this.decisionModel.findOne({
          simulation: simObjectId,
          firm: firmId,
          quarter: targetQuarter,
        });

        // Get previous state to detect new openings
        const prevState = await this.quarterStateModel.findOne({
          simulation: simObjectId,
          firm: firmId,
          quarter: targetQuarter - 1,
        });

        // Calculate setup costs incurred this quarter
        let setupCostThisQuarter = 0;
        if (state?.dcCentralOpen && !prevState?.dcCentralOpen) {
          setupCostThisQuarter += CONFIG.dc.CENTRAL.setupCost;
        }
        if (state?.dcWestOpen && !prevState?.dcWestOpen) {
          setupCostThisQuarter += CONFIG.dc.WEST.setupCost;
        }

        // Calculate quarterly opex
        let quarterlyOpex = 0;
        if (state?.dcCentralOpen) {
          quarterlyOpex += CONFIG.dc.CENTRAL.quarterlyOpex;
        }
        if (state?.dcWestOpen) {
          quarterlyOpex += CONFIG.dc.WEST.quarterlyOpex;
        }

        // Calculate service bonus
        let serviceBonus = CONFIG.dc.FACTORY_SERVICE_BONUS || 0.05;
        if (state?.dcCentralOpen)
          serviceBonus += CONFIG.dc.CENTRAL.serviceBonus;
        if (state?.dcWestOpen) serviceBonus += CONFIG.dc.WEST.serviceBonus;

        return {
          firmId: firmId.toString(),
          firmNumber: firm.firmNumber,
          firmName: firm.name,
          firmColor: firm.color,
          dcCentral: {
            open: state?.dcCentralOpen || false,
            inventory: state?.dcCentralInventory || 0,
            capacity: CONFIG.dc.CENTRAL.capacity,
            utilization: state?.dcCentralOpen
              ? ((state.dcCentralInventory || 0) / CONFIG.dc.CENTRAL.capacity) *
                100
              : 0,
          },
          dcWest: {
            open: state?.dcWestOpen || false,
            inventory: state?.dcWestInventory || 0,
            capacity: CONFIG.dc.WEST.capacity,
            utilization: state?.dcWestOpen
              ? ((state.dcWestInventory || 0) / CONFIG.dc.WEST.capacity) * 100
              : 0,
          },
          opex: quarterlyOpex,
          setupCostThisQuarter,
          serviceBonus,
          // Transfer activity from decision
          allocatedToCentral: decision?.allocateCentral || 0,
          allocatedToWest: decision?.allocateWest || 0,
          transferFromCentral: decision?.transferFromCentral || 0,
          transferFromWest: decision?.transferFromWest || 0,
        };
      }),
    );

    // Calculate aggregate stats
    const summary = {
      totalCentralOpen: dcData.filter((f) => f.dcCentral.open).length,
      totalWestOpen: dcData.filter((f) => f.dcWest.open).length,
      totalCentralInventory: dcData.reduce(
        (sum, f) => sum + f.dcCentral.inventory,
        0,
      ),
      totalWestInventory: dcData.reduce(
        (sum, f) => sum + f.dcWest.inventory,
        0,
      ),
      totalOpex: dcData.reduce((sum, f) => sum + f.opex, 0),
      totalSetupCost: dcData.reduce(
        (sum, f) => sum + f.setupCostThisQuarter,
        0,
      ),
      avgCentralUtilization:
        dcData.filter((f) => f.dcCentral.open).length > 0
          ? dcData
              .filter((f) => f.dcCentral.open)
              .reduce((sum, f) => sum + f.dcCentral.utilization, 0) /
            dcData.filter((f) => f.dcCentral.open).length
          : 0,
      avgWestUtilization:
        dcData.filter((f) => f.dcWest.open).length > 0
          ? dcData
              .filter((f) => f.dcWest.open)
              .reduce((sum, f) => sum + f.dcWest.utilization, 0) /
            dcData.filter((f) => f.dcWest.open).length
          : 0,
    };

    return {
      simulationId,
      quarter: targetQuarter,
      featureEnabled: true,
      summary,
      firms: dcData,
      dcConfig: {
        factory: {
          region: CONFIG.dc.FACTORY_REGION || 'R1',
          serviceBonus: CONFIG.dc.FACTORY_SERVICE_BONUS || 0.05,
        },
        central: {
          name: CONFIG.dc.CENTRAL.name || 'Central DC',
          location: CONFIG.dc.CENTRAL.location || 'Chicago',
          capacity: CONFIG.dc.CENTRAL.capacity,
          setupCost: CONFIG.dc.CENTRAL.setupCost,
          quarterlyOpex: CONFIG.dc.CENTRAL.quarterlyOpex,
          serviceBonus: CONFIG.dc.CENTRAL.serviceBonus || 0.03,
          regionServed: CONFIG.dc.CENTRAL.regionServed || 'R2',
        },
        west: {
          name: CONFIG.dc.WEST.name || 'West DC',
          location: CONFIG.dc.WEST.location || 'Los Angeles',
          capacity: CONFIG.dc.WEST.capacity,
          setupCost: CONFIG.dc.WEST.setupCost,
          quarterlyOpex: CONFIG.dc.WEST.quarterlyOpex,
          serviceBonus: CONFIG.dc.WEST.serviceBonus || 0.05,
          regionServed: CONFIG.dc.WEST.regionServed || 'R3',
        },
        transferCosts: CONFIG.dc.TRANSFER_COSTS || {
          DC_TO_DC: 5,
          DC_TO_FACTORY: 4,
        },
        disposalValueRate: CONFIG.dc.DISPOSAL_VALUE_RATE || 0.25,
      },
    };
  }

  // ============================================================================
  // CARRIER ANALYSIS - Get carrier selection and performance for all firms
  // Endpoint: GET /simulations/:id/carrier-analysis?quarter=X
  // ============================================================================

  async getCarrierAnalysis(
    simulationId: string,
    quarter?: number,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);

    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    // Check if multi-carrier feature is enabled
    if (!simulation.features?.multiCarrierSelection) {
      return {
        simulationId,
        featureEnabled: false,
        message:
          'Multi-Carrier Selection feature is not enabled for this simulation',
      };
    }

    const MC = CONFIG.carrier;
    const regionalDCsEnabled = simulation.features?.regionalDCs || false;
    const targetQuarter = quarter || simulation.currentQuarter;
    const firms = await this.firmModel.find({ simulation: simObjectId });

    const carrierData = await Promise.all(
      firms.map(async (firm) => {
        const firmId = firm._id as Types.ObjectId;

        // Get decision for carrier selection
        const decision = await this.decisionModel.findOne({
          simulation: simObjectId,
          firm: firmId,
          quarter: targetQuarter,
        });

        // Get KPI for units sold
        const kpi = await this.kpiHistoryModel.findOne({
          simulation: simObjectId,
          firm: firmId,
          quarter: targetQuarter,
        });

        // Get quarter state for DC status
        const state = await this.quarterStateModel.findOne({
          simulation: simObjectId,
          firm: firmId,
          quarter: targetQuarter,
        });

        const hasTMS = firm.techOwned?.includes(TechnologyType.TMS) || false;
        const unitsShipped = kpi?.operations?.unitsSold || 0;

        // Check if any DC is open
        const anyDCOpen = state?.dcCentralOpen || state?.dcWestOpen || false;

        // Determine effective carrier mode
        let modeKey = (decision?.carrier as string) || MC.DEFAULT_MODE;
        let effectiveMode = MC[modeKey] || MC[MC.DEFAULT_MODE];
        let forcedAir = false;
        let lastMileCost = 0;

        if (regionalDCsEnabled) {
          if (!anyDCOpen) {
            // No DCs open - forced to Air
            effectiveMode = MC[CarrierMode.AIR];
            modeKey = CarrierMode.AIR;
            forcedAir = true;
          } else {
            // DCs open - add last-mile cost
            lastMileCost = CONFIG.carrier.LAST_MILE_COST || 2.5;
          }
        }

        // Calculate base cost per unit
        let costPerUnit = effectiveMode.costPerUnit;

        // Apply volume discount if applicable
        let volumeDiscount = 0;
        let volumeDiscountAmount = 0;
        if (
          !forcedAir &&
          effectiveMode.volumeDiscountThreshold &&
          unitsShipped >= effectiveMode.volumeDiscountThreshold
        ) {
          volumeDiscount = effectiveMode.volumeDiscountRate;
          volumeDiscountAmount =
            unitsShipped * effectiveMode.costPerUnit * volumeDiscount;
          costPerUnit = costPerUnit * (1 - volumeDiscount);
        }

        // Total cost = mode cost + last-mile
        const totalCostPerUnit = costPerUnit + lastMileCost;
        const baseFreightCost = unitsShipped * effectiveMode.costPerUnit;
        let freightCost = unitsShipped * totalCostPerUnit;

        // TMS discount (applies to mode cost only)
        const tmsDiscount = hasTMS ? CONFIG.carrier.TMS_DISCOUNT || 0.08 : 0;
        const tmsDiscountAmount = unitsShipped * costPerUnit * tmsDiscount;
        freightCost = freightCost - tmsDiscountAmount;

        // Build display name
        let carrierName = effectiveMode.name;
        if (forcedAir) {
          carrierName = 'Air (No DC - Forced)';
        } else if (lastMileCost > 0) {
          carrierName = effectiveMode.name + ' + Last Mile';
        }

        return {
          firmId: firmId.toString(),
          firmNumber: firm.firmNumber,
          firmName: firm.name,
          firmColor: firm.color,
          carrier: modeKey,
          carrierName,
          unitsShipped,
          baseCostPerUnit: effectiveMode.costPerUnit,
          costPerUnit: totalCostPerUnit,
          lastMileCost,
          freightCost,
          volumeDiscount,
          volumeDiscountAmount,
          tmsDiscount,
          tmsDiscountAmount,
          onTimeRate: (effectiveMode.onTimeRate || 0) * 100,
          damageRate: effectiveMode.damageRate || 0,
          forcedAir,
          hasTMS,
          anyDCOpen,
        };
      }),
    );

    // Calculate aggregate stats
    const carrierCounts = carrierData.reduce(
      (acc, f) => {
        acc[f.carrier] = (acc[f.carrier] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const summary = {
      carrierDistribution: carrierCounts,
      totalFreightCost: carrierData.reduce((sum, f) => sum + f.freightCost, 0),
      avgOnTimeRate:
        carrierData.length > 0
          ? carrierData.reduce((sum, f) => sum + f.onTimeRate, 0) /
            carrierData.length
          : 0,
      firmsWithTMS: carrierData.filter((f) => f.hasTMS).length,
      firmsWithVolumeDiscount: carrierData.filter((f) => f.volumeDiscount > 0)
        .length,
      forcedAirCount: carrierData.filter((f) => f.forcedAir).length,
    };

    return {
      simulationId,
      quarter: targetQuarter,
      featureEnabled: true,
      regionalDCsEnabled,
      summary,
      firms: carrierData,
      carrierConfig: {
        [CarrierMode.INTERMODAL]: {
          name: MC[CarrierMode.INTERMODAL]?.name || 'Intermodal',
          costPerUnit: MC[CarrierMode.INTERMODAL]?.costPerUnit || 1.5,
          onTimeRate: MC[CarrierMode.INTERMODAL]?.onTimeRate || 0.8,
          damageRate: MC[CarrierMode.INTERMODAL]?.damageRate || 0.01,
          volumeDiscountThreshold:
            MC[CarrierMode.INTERMODAL]?.volumeDiscountThreshold,
          volumeDiscountRate:
            MC[CarrierMode.INTERMODAL]?.volumeDiscountRate || 0,
        },
        [CarrierMode.TRUCK]: {
          name: MC[CarrierMode.TRUCK]?.name || 'Truck (FTL)',
          costPerUnit: MC[CarrierMode.TRUCK]?.costPerUnit || 3.5,
          onTimeRate: MC[CarrierMode.TRUCK]?.onTimeRate || 0.93,
          damageRate: MC[CarrierMode.TRUCK]?.damageRate || 0.005,
          volumeDiscountThreshold:
            MC[CarrierMode.TRUCK]?.volumeDiscountThreshold || 75000,
          volumeDiscountRate: MC[CarrierMode.TRUCK]?.volumeDiscountRate || 0.05,
        },
        [CarrierMode.AIR]: {
          name: MC[CarrierMode.AIR]?.name || 'Air Freight',
          costPerUnit: MC[CarrierMode.AIR]?.costPerUnit || 12.0,
          onTimeRate: MC[CarrierMode.AIR]?.onTimeRate || 1.0,
          damageRate: MC[CarrierMode.AIR]?.damageRate || 0.0,
        },
        TMS_DISCOUNT: CONFIG.carrier.TMS_DISCOUNT || 0.08,
        LAST_MILE_COST: CONFIG.carrier.LAST_MILE_COST || 2.5,
      },
    };
  }

  // ============================================================================
  // ANALYTICS DASHBOARD
  // ============================================================================

  async getAnalyticsDashboard(
    simulationId: string,
    firmId: string,
    quarter?: number,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    const firm = await this.resolveFirm(simulationId, firmId);
    const firmObjectId = firm._id as Types.ObjectId;

    // Guard: analytics dashboard requires the ANALYTICS tech purchase
    const hasAnalytics = firm.techOwned?.includes(TechnologyType.ANALYTICS);
    if (!hasAnalytics) {
      return {
        simulationId,
        firmId: firmObjectId.toString(),
        firmNumber: firm.firmNumber,
        featureEnabled: false,
        message:
          'SC Analytics Dashboard not purchased. Buy the ANALYTICS tech ($1M) to unlock detailed KPI tracking.',
      };
    }

    const targetQuarter =
      quarter !== undefined ? Number(quarter) : simulation.currentQuarter;

    // Pull KPI history for this firm up to targetQuarter
    const kpiHistory = await this.kpiHistoryModel
      .find({
        simulation: simObjectId,
        firm: firmObjectId,
        quarter: { $lte: targetQuarter },
      })
      .sort({ quarter: 1 });

    if (kpiHistory.length === 0) {
      return {
        simulationId,
        firmId: firmObjectId.toString(),
        firmNumber: firm.firmNumber,
        featureEnabled: true,
        message: 'No KPI data available yet for this firm.',
        kpiHistory: [],
      };
    }

    // Current quarter snapshot
    const current = kpiHistory[kpiHistory.length - 1];
    const prev = kpiHistory.length >= 2 ? kpiHistory[kpiHistory.length - 2] : null;

    // ── FINANCIAL PANEL ──────────────────────────────────────────────────────
    const revenue = current.financial?.revenue ?? 0;
    const prevRevenue = prev?.financial?.revenue ?? revenue;
    const revenueGrowth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;

    const netIncome = current.financial?.netIncome ?? 0;
    const grossMarginPct = current.financial?.grossMarginPct ?? 0;
    const cash = current.financial?.cash ?? 0;

    const financialPanel = {
      revenue,
      revenueGrowth: parseFloat(revenueGrowth.toFixed(2)),
      netIncome,
      netMarginPct:
        revenue > 0 ? parseFloat(((netIncome / revenue) * 100).toFixed(2)) : 0,
      grossMarginPct: parseFloat(grossMarginPct.toFixed(2)),
      cash,
      cogs: current.financial?.cogs ?? 0,
      operatingExpenses: current.financial?.operatingExpenses ?? 0,
    };

    // ── CUSTOMER PANEL ───────────────────────────────────────────────────────
    const csi = current.customer?.csi ?? 80;
    const prevCsi = prev?.customer?.csi ?? csi;
    const marketShare = (current.customer?.marketShare ?? 0.333) * 100;
    const fillRate = (current.customer?.fillRate ?? 0.95) * 100;
    const returnRate = (current.customer?.returnRate ?? 0) * 100;

    const customerPanel = {
      csi: parseFloat(csi.toFixed(1)),
      csiTrend: parseFloat((csi - prevCsi).toFixed(1)),
      csiStatus: csi >= 80 ? 'OK' : csi >= 70 ? 'WARN' : 'CRITICAL',
      marketSharePct: parseFloat(marketShare.toFixed(2)),
      fillRatePct: parseFloat(fillRate.toFixed(1)),
      fillRateStatus:
        fillRate >= 95 ? 'OK' : fillRate >= 85 ? 'WARN' : 'CRITICAL',
      returnRatePct: parseFloat(returnRate.toFixed(2)),
      customersLoyal: current.customer?.customersLoyal ?? 0,
      customersInPlay: current.customer?.customersInPlay ?? 0,
      customersChurned: current.customer?.customersChurned ?? 0,
    };

    // ── OPERATIONS PANEL ─────────────────────────────────────────────────────
    const perfectOrder = (current.operations?.perfectOrder ?? 0.84) * 100;
    const capacityUtil = (current.operations?.capacityUtilization ?? 0) * 100;
    const defectRate = (current.operations?.defectRate ?? 0.03) * 100;
    const onTimeDelivery = (current.operations?.onTimeDelivery ?? 0.92) * 100;
    const mape = current.operations?.mape ?? 0;
    const forecastAccuracyPct = (1 - mape) * 100;

    // Capacity utilisation sweet spot: 70–85% is optimal (from GAS logic)
    const capStatus =
      capacityUtil >= 70 && capacityUtil <= 85
        ? 'OPTIMAL'
        : capacityUtil >= 60 && capacityUtil < 70
          ? 'UNDERUTILISED'
          : capacityUtil > 85 && capacityUtil <= 95
            ? 'HIGH'
            : 'CRITICAL';

    const operationsPanel = {
      perfectOrderPct: parseFloat(perfectOrder.toFixed(1)),
      perfectOrderStatus:
        perfectOrder >= 85 ? 'OK' : perfectOrder >= 75 ? 'WARN' : 'CRITICAL',
      capacityUtilPct: parseFloat(capacityUtil.toFixed(1)),
      capacityStatus: capStatus,
      defectRatePct: parseFloat(defectRate.toFixed(2)),
      defectStatus: defectRate < 2 ? 'OK' : defectRate < 4 ? 'WARN' : 'CRITICAL',
      onTimeDeliveryPct: parseFloat(onTimeDelivery.toFixed(1)),
      forecastAccuracyPct: parseFloat(forecastAccuracyPct.toFixed(1)),
      forecastStatus:
        forecastAccuracyPct >= 85
          ? 'OK'
          : forecastAccuracyPct >= 75
            ? 'WARN'
            : 'CRITICAL',
      unitsProduced: current.operations?.unitsProduced ?? 0,
      unitsSold: current.operations?.unitsSold ?? 0,
      totalCapacity: current.operations?.totalCapacity ?? 0,
    };

    // ── INVENTORY PANEL ──────────────────────────────────────────────────────
    const inventoryPanel = {
      rawMaterialUnits: current.inventory?.rawMaterialUnits ?? 0,
      finishedGoodsUnits: current.inventory?.finishedGoodsUnits ?? 0,
      inventoryValue: current.inventory?.inventoryValue ?? 0,
      inventoryTurnover: parseFloat(
        (current.inventory?.inventoryTurnover ?? 0).toFixed(2),
      ),
      weeksOfSupply: parseFloat(
        (current.inventory?.weeksOfSupply ?? 0).toFixed(1),
      ),
      retailerInventory: current.inventory?.retailerInventory ?? 0,
      inTransitUnits: current.inventory?.inTransitUnits ?? 0,
      rawMaterialStatus:
        (current.inventory?.rawMaterialUnits ?? 0) >= 300000
          ? 'OK'
          : (current.inventory?.rawMaterialUnits ?? 0) >= 150000
            ? 'WARN'
            : 'CRITICAL',
      finishedGoodsStatus:
        (current.inventory?.finishedGoodsUnits ?? 0) >= 50000
          ? 'OK'
          : (current.inventory?.finishedGoodsUnits ?? 0) >= 20000
            ? 'WARN'
            : 'CRITICAL',
    };

    // ── LEARNING & GROWTH PANEL ──────────────────────────────────────────────
    // Mirrors GAS updateBalancedScorecard_ learning section
    const techCount = current.learning?.techSystemsCount ?? firm.techOwned?.length ?? 0;
    const maturity = current.learning?.scMaturity ?? 'BASIC';
    const techInvestmentTotal = current.learning?.techInvestmentTotal ?? 0;

    const learningPanel = {
      techSystemsCount: techCount,
      techSystemsOwned: firm.techOwned ?? [],
      scMaturity: maturity,
      techInvestmentTotal,
      forecastAccuracyPct: parseFloat(forecastAccuracyPct.toFixed(1)),
      maturityStatus:
        maturity === 'ADVANCED' ? 'OK' : maturity === 'DEVELOPING' ? 'WARN' : 'BASIC',
    };

    // ── COST BREAKDOWN ───────────────────────────────────────────────────────
    const costBreakdown = current.costs
      ? {
          labor: current.costs.labor ?? 0,
          holding: current.costs.holding ?? 0,
          marketing: current.costs.marketing ?? 0,
          quality: current.costs.quality ?? 0,
          freight: current.costs.freight ?? 0,
          techMaintenance: current.costs.techMaintenance ?? 0,
          interest: current.costs.interest ?? 0,
          vmiSetup: current.costs.vmiSetup ?? 0,
          vmiOngoing: current.costs.vmiOngoing ?? 0,
          total: Object.values(current.costs).reduce(
            (sum: number, v: any) => sum + (typeof v === 'number' ? v : 0),
            0,
          ),
        }
      : null;

    // ── BSC SNAPSHOT ─────────────────────────────────────────────────────────
    const bscSnapshot = current.bsc
      ? {
          financial: current.bsc.financial ?? 0,
          customer: current.bsc.customer ?? 0,
          process: current.bsc.process ?? 0,
          learning: current.bsc.learning ?? 0,
          overall: current.bsc.overall ?? 0,
          rank: current.bsc.rank ?? null,
          grade: current.bsc.grade ?? null,
        }
      : null;

    // ── TREND SERIES (for charts) ─────────────────────────────────────────────
    const trendSeries = kpiHistory.map((k) => ({
      quarter: k.quarter,
      revenue: k.financial?.revenue ?? 0,
      netIncome: k.financial?.netIncome ?? 0,
      cash: k.financial?.cash ?? 0,
      csi: k.customer?.csi ?? 80,
      marketSharePct: (k.customer?.marketShare ?? 0.333) * 100,
      fillRatePct: (k.customer?.fillRate ?? 0.95) * 100,
      perfectOrderPct: (k.operations?.perfectOrder ?? 0.84) * 100,
      capacityUtilPct: (k.operations?.capacityUtilization ?? 0) * 100,
      forecastAccuracyPct: (1 - (k.operations?.mape ?? 0)) * 100,
      defectRatePct: (k.operations?.defectRate ?? 0.03) * 100,
      bscOverall: k.bsc?.overall ?? 0,
    }));

    return {
      simulationId,
      firmId: firmObjectId.toString(),
      firmNumber: firm.firmNumber,
      firmName: firm.name,
      firmColor: firm.color,
      quarter: targetQuarter,
      featureEnabled: true,
      panels: {
        financial: financialPanel,
        customer: customerPanel,
        operations: operationsPanel,
        inventory: inventoryPanel,
        learning: learningPanel,
      },
      costBreakdown,
      bscSnapshot,
      trendSeries,
    };
  }

  // ============================================================================
  // BALANCED SCORECARD
  // ============================================================================

  async getBalancedScorecard(
    simulationId: string,
    quarter?: number,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    const parsed =
      quarter !== undefined ? parseInt(String(quarter), 10) : NaN;
    const targetQuarter = Number.isFinite(parsed)
      ? parsed
      : simulation.currentQuarter;

    const firms = await this.firmModel
      .find({ simulation: simObjectId })
      .sort({ firmNumber: 1 });

    // Pull KPI records for ALL firms at targetQuarter in a single query
    const firmIds = firms.map((f) => f._id);
    const kpiRecords = await this.kpiHistoryModel.find({
      simulation: simObjectId,
      firm: { $in: firmIds },
      quarter: targetQuarter,
    });

    // Index by firm _id string for O(1) lookup
    const kpiByFirm = new Map<string, typeof kpiRecords[0]>();
    for (const k of kpiRecords) {
      kpiByFirm.set((k.firm as Types.ObjectId).toString(), k);
    }

    // ── BSC SCORE CALCULATION ─────────────────────────────────────────────
    // Mirrors GAS updateBalancedScorecard_ four-perspective scoring exactly.
    // Each perspective scores 0–100; overall = equal 25% weight per perspective.

    const scoreResults: Array<{
      firmId: string;
      firmNumber: number;
      firmName: string;
      firmColor: string;
      financial: {
        score: number;
        netIncomeMil: number;
        revenueMil: number;
        grossMarginPct: number;
        cashMil: number;
      };
      customer: {
        score: number;
        csi: number;
        marketSharePct: number;
        fillRatePct: number;
        returnRatePct: number;
      };
      process: {
        score: number;
        perfectOrderPct: number;
        capacityUtilPct: number;
        defectRatePct: number;
        onTimeDeliveryPct: number;
      };
      learning: {
        score: number;
        techCount: number;
        forecastAccuracyPct: number;
        maturityLevel: string;
        techInvestmentMil: number;
      };
      overall: number;
      grade: string;
      rank?: number;
    }> = [];

    for (const firm of firms) {
      const firmIdStr = (firm._id as Types.ObjectId).toString();
      const kpi = kpiByFirm.get(firmIdStr);

      // ── FINANCIAL PERSPECTIVE ──────────────────────────────────────────
      const netIncomeMil = kpi ? (kpi.financial?.netIncome ?? 0) / 1_000_000 : 0;
      const revenueMil = kpi ? (kpi.financial?.revenue ?? 0) / 1_000_000 : 0;
      const grossMarginPct = kpi ? (kpi.financial?.grossMarginPct ?? 35) : 35;
      const cashMil = kpi ? (kpi.financial?.cash ?? 0) / 1_000_000 : 0;

      const finScore = Math.min(
        100,
        (netIncomeMil > 5 ? 30 : Math.max(0, (netIncomeMil / 5) * 30)) +
          (revenueMil > 70 ? 25 : (revenueMil / 70) * 25) +
          (grossMarginPct > 35 ? 25 : (grossMarginPct / 35) * 25) +
          (cashMil > 20 ? 20 : (cashMil / 20) * 20),
      );

      // ── CUSTOMER PERSPECTIVE ───────────────────────────────────────────
      const csi = kpi ? (kpi.customer?.csi ?? 80) : 80;
      const marketSharePct = kpi ? (kpi.customer?.marketShare ?? 0.333) * 100 : 33.3;
      const fillRatePct = kpi ? (kpi.customer?.fillRate ?? 0.9) * 100 : 90;
      const returnRatePct = kpi ? (kpi.customer?.returnRate ?? 0) * 100 : 0;

      const custScore = Math.min(
        100,
        (csi > 85 ? 30 : ((csi - 50) / 35) * 30) +
          (marketSharePct > 35 ? 25 : (marketSharePct / 35) * 25) +
          (fillRatePct > 95 ? 25 : (fillRatePct / 95) * 25) +
          (returnRatePct < 1 ? 20 : Math.max(0, ((3 - returnRatePct) / 3) * 20)),
      );

      // ── PROCESS PERSPECTIVE ────────────────────────────────────────────
      const perfectOrderPct = kpi ? (kpi.operations?.perfectOrder ?? 0.84) * 100 : 84;
      const capacityUtilPct = kpi ? (kpi.operations?.capacityUtilization ?? 0) * 100 : 0;
      const defectRatePct = kpi ? (kpi.operations?.defectRate ?? 0.03) * 100 : 3;
      const onTimeDeliveryPct = kpi ? (kpi.operations?.onTimeDelivery ?? 0.92) * 100 : 92;

      // Capacity utilization sweet spot 70–85% = full 25 pts (GAS logic)
      const capScore =
        capacityUtilPct >= 70 && capacityUtilPct <= 85
          ? 25
          : capacityUtilPct < 70
            ? (capacityUtilPct / 70) * 25
            : Math.max(0, ((100 - capacityUtilPct) / 15) * 25);

      const procScore = Math.min(
        100,
        (perfectOrderPct > 90 ? 30 : (perfectOrderPct / 90) * 30) +
          capScore +
          (defectRatePct < 2 ? 25 : Math.max(0, ((5 - defectRatePct) / 5) * 25)) +
          (onTimeDeliveryPct > 95 ? 20 : (onTimeDeliveryPct / 95) * 20),
      );

      // ── LEARNING & GROWTH PERSPECTIVE ──────────────────────────────────
      const techCount = kpi
        ? (kpi.learning?.techSystemsCount ?? firm.techOwned?.length ?? 0)
        : (firm.techOwned?.length ?? 0);
      const mape = kpi ? (kpi.operations?.mape ?? 0) : 0;
      const forecastAccuracyPct = (1 - mape) * 100;
      const techInvestmentMil = kpi
        ? (kpi.learning?.techInvestmentTotal ?? techCount * 2_000_000) / 1_000_000
        : (techCount * 2_000_000) / 1_000_000;

      // Maturity: mirrors GAS updateBalancedScorecard_ maturity logic
      let maturityLevel = 'Basic';
      if (techCount >= 4 && perfectOrderPct > 85 && forecastAccuracyPct > 80) {
        maturityLevel = 'Advanced';
      } else if (techCount >= 2 && perfectOrderPct > 80) {
        maturityLevel = 'Developing';
      }

      const learnScore = Math.min(
        100,
        (techCount >= 4 ? 30 : (techCount / 4) * 30) +
          (forecastAccuracyPct > 85 ? 30 : (forecastAccuracyPct / 85) * 30) +
          (maturityLevel === 'Advanced' ? 20 : maturityLevel === 'Developing' ? 10 : 0) +
          (techInvestmentMil > 3 ? 20 : (techInvestmentMil / 3) * 20),
      );

      // ── OVERALL ────────────────────────────────────────────────────────
      const overall = (finScore + custScore + procScore + learnScore) / 4;
      const grade =
        overall >= 90
          ? 'A'
          : overall >= 80
            ? 'B'
            : overall >= 70
              ? 'C'
              : 'D';

      scoreResults.push({
        firmId: firmIdStr,
        firmNumber: firm.firmNumber,
        firmName: firm.name,
        firmColor: firm.color,
        financial: {
          score: parseFloat(finScore.toFixed(1)),
          netIncomeMil: parseFloat(netIncomeMil.toFixed(2)),
          revenueMil: parseFloat(revenueMil.toFixed(2)),
          grossMarginPct: parseFloat(grossMarginPct.toFixed(1)),
          cashMil: parseFloat(cashMil.toFixed(2)),
        },
        customer: {
          score: parseFloat(custScore.toFixed(1)),
          csi: parseFloat(csi.toFixed(1)),
          marketSharePct: parseFloat(marketSharePct.toFixed(2)),
          fillRatePct: parseFloat(fillRatePct.toFixed(1)),
          returnRatePct: parseFloat(returnRatePct.toFixed(2)),
        },
        process: {
          score: parseFloat(procScore.toFixed(1)),
          perfectOrderPct: parseFloat(perfectOrderPct.toFixed(1)),
          capacityUtilPct: parseFloat(capacityUtilPct.toFixed(1)),
          defectRatePct: parseFloat(defectRatePct.toFixed(2)),
          onTimeDeliveryPct: parseFloat(onTimeDeliveryPct.toFixed(1)),
        },
        learning: {
          score: parseFloat(learnScore.toFixed(1)),
          techCount,
          forecastAccuracyPct: parseFloat(forecastAccuracyPct.toFixed(1)),
          maturityLevel,
          techInvestmentMil: parseFloat(techInvestmentMil.toFixed(2)),
        },
        overall: parseFloat(overall.toFixed(1)),
        grade,
      });
    }

    // Assign ranks (1 = highest overall score)
    const sorted = [...scoreResults].sort((a, b) => b.overall - a.overall);
    sorted.forEach((s, i) => {
      s.rank = i + 1;
    });

    // Restore original firm order for output, with ranks attached
    const rankMap = new Map(sorted.map((s) => [s.firmId, s.rank]));
    scoreResults.forEach((s) => {
      s.rank = rankMap.get(s.firmId);
    });

    // Thresholds reference (mirrors GAS color coding)
    const gradeThresholds = {
      A: 90,
      B: 80,
      C: 70,
      D: 0,
    };

    const perspectiveWeights = {
      financial: 0.25,
      customer: 0.25,
      process: 0.25,
      learning: 0.25,
    };

    return {
      simulationId,
      quarter: targetQuarter,
      firms: scoreResults,
      gradeThresholds,
      perspectiveWeights,
      leader: sorted[0]
        ? { firmId: sorted[0].firmId, firmNumber: sorted[0].firmNumber, overall: sorted[0].overall }
        : null,
    };
  }

  // ============================================================================
  // SOP DASHBOARD
  // ============================================================================

  async getSOPDashboard(
    simulationId: string,
    firmId: string,
    quarter?: number,
  ): Promise<any> {
    const simObjectId = this.toObjectId(simulationId);
    const simulation = await this.simulationModel.findById(simObjectId);
    if (!simulation) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    const firm = await this.resolveFirm(simulationId, firmId);
    const firmObjectId = firm._id as Types.ObjectId;

    const targetQuarter =
      quarter !== undefined ? Number(quarter) : simulation.currentQuarter;

    // ── DEMAND OUTLOOK ────────────────────────────────────────────────────────────
    // Last 4 quarters of actual market demand (mirrors getDemandHistory_ in GAS)
    const fromDemand = Math.max(1, targetQuarter - 3);
    const demandHistory = await this.demandHistoryModel
      .find({
        simulation: simObjectId,
        quarter: { $gte: fromDemand, $lte: targetQuarter },
      })
      .sort({ quarter: 1 });

    const demandOutlook = demandHistory.map((d) => ({
      quarter: d.quarter,
      calendarQuarter: d.calendarQuarter,
      seasonLabel: d.seasonLabel ?? '',
      seasonalMultiplier: d.seasonalMultiplier,
      demandR1: d.demandR1,
      demandR2: d.demandR2,
      demandR3: d.demandR3,
      totalDemand: d.totalDemand,
      eventImpact: d.eventImpact ?? null,
    }));

    const currentDemand = demandHistory.find((d) => d.quarter === targetQuarter);
    const totalMarketDemand = currentDemand?.totalDemand ?? 0;

    // ── FORECAST HISTORY ─────────────────────────────────────────────────────────────
    // Last 4 quarters of firm's forecasts vs actuals (mirrors getForecastHistory_ in GAS)
    const forecastLogs = await this.forecastLogModel
      .find({
        simulation: simObjectId,
        firm: firmObjectId,
        quarter: { $gte: fromDemand, $lte: targetQuarter },
      })
      .sort({ quarter: 1 });

    const forecastHistory = forecastLogs.map((f) => ({
      quarter: f.quarter,
      forecast: f.forecast,
      actual: f.actual,
      error: f.error,
      ape: f.ape,
      mape: parseFloat((f.mape * 100).toFixed(1)),
      accuracyPct: parseFloat((f.accuracy * 100).toFixed(1)),
      bias: parseFloat((f.bias * 100).toFixed(2)),
    }));

    // Current-quarter forecast accuracy (mirrors getForecastAccuracy_ in GAS)
    const currentForecastLog = forecastLogs.find((f) => f.quarter === targetQuarter);
    const forecastAccuracy = currentForecastLog
      ? {
          mape: parseFloat((currentForecastLog.mape * 100).toFixed(1)),
          accuracyPct: parseFloat((currentForecastLog.accuracy * 100).toFixed(1)),
          bias: parseFloat((currentForecastLog.bias * 100).toFixed(2)),
          status:
            currentForecastLog.accuracy >= 0.85
              ? 'OK'
              : currentForecastLog.accuracy >= 0.75
                ? 'WARN'
                : 'CRITICAL',
        }
      : { mape: 0, accuracyPct: 0, bias: 0, status: 'NO_DATA' };

    // ── QUARTER STATE ──────────────────────────────────────────────────────────────────────
    const state = await this.quarterStateModel.findOne({
      simulation: simObjectId,
      firm: firmObjectId,
      quarter: targetQuarter,
    });

    // ── KPI SNAPSHOT ────────────────────────────────────────────────────────────────────────────
    const kpi = await this.kpiHistoryModel.findOne({
      simulation: simObjectId,
      firm: firmObjectId,
      quarter: targetQuarter,
    });

    // ── SUPPLY PLAN ─────────────────────────────────────────────────────────────────────────────────────
    const unitsProduced = kpi?.operations?.unitsProduced ?? 0;
    const totalCapacity = kpi?.operations?.totalCapacity ?? 0;
    const capacityUtilPct =
      totalCapacity > 0 ? (unitsProduced / totalCapacity) * 100 : 0;

    const supplyPlan = {
      unitsProduced,
      totalCapacity,
      capacityUtilPct: parseFloat(capacityUtilPct.toFixed(1)),
      capacityStatus:
        capacityUtilPct >= 70 && capacityUtilPct <= 85
          ? 'OPTIMAL'
          : capacityUtilPct >= 60 && capacityUtilPct < 70
            ? 'UNDERUTILISED'
            : capacityUtilPct > 85 && capacityUtilPct <= 95
              ? 'HIGH'
              : 'CRITICAL',
      additionalCapacity: kpi?.operations?.additionalCapacity ?? 0,
      expansionsInProgress: kpi?.operations?.expansionsInProgress ?? 0,
    };

    // ── INVENTORY POSITION ───────────────────────────────────────────────────────────────────
    const rawMaterialUnits = kpi?.inventory?.rawMaterialUnits ?? state?.rawMaterialUnits ?? 0;
    const finishedGoodsUnits = kpi?.inventory?.finishedGoodsUnits ?? state?.finishedGoodsUnits ?? 0;
    const retailerInventory = kpi?.inventory?.retailerInventory ?? state?.retailerInventory ?? 0;
    const inTransitUnits = kpi?.inventory?.inTransitUnits ?? state?.inTransitUnits ?? 0;

    const inventoryPosition = {
      rawMaterialUnits,
      rawMaterialStatus:
        rawMaterialUnits >= 300000
          ? 'OK'
          : rawMaterialUnits >= 150000
            ? 'WARN'
            : 'CRITICAL',
      finishedGoodsUnits,
      finishedGoodsStatus:
        finishedGoodsUnits >= 50000
          ? 'OK'
          : finishedGoodsUnits >= 20000
            ? 'WARN'
            : 'CRITICAL',
      inventoryValue: kpi?.inventory?.inventoryValue ?? 0,
      inventoryTurnover: parseFloat((kpi?.inventory?.inventoryTurnover ?? 0).toFixed(2)),
      weeksOfSupply: parseFloat((kpi?.inventory?.weeksOfSupply ?? 0).toFixed(1)),
      retailerInventory,
      retailerMode: state?.retailerMode ?? 'NORMAL',
      inTransitUnits,
    };

    // ── KEY METRICS ────────────────────────────────────────────────────────────────────────────
    // Mirrors updateMetricsSection_ in GAS — same status thresholds
    const fillRate = kpi?.customer?.fillRate ?? 0.95;
    const csi = kpi?.customer?.csi ?? 80;
    const perfectOrder = kpi?.operations?.perfectOrder ?? 0.84;
    const cash = kpi?.financial?.cash ?? state?.cash ?? 0;
    const shortTermDebt = state?.shortTermDebt ?? 0;

    const keyMetrics = {
      fillRate: {
        value: parseFloat((fillRate * 100).toFixed(1)),
        status: fillRate >= 0.95 ? 'OK' : fillRate >= 0.85 ? 'WARN' : 'CRITICAL',
      },
      csi: {
        value: parseFloat(csi.toFixed(1)),
        status: csi >= 80 ? 'OK' : csi >= 70 ? 'WARN' : 'CRITICAL',
      },
      perfectOrder: {
        value: parseFloat((perfectOrder * 100).toFixed(1)),
        status: perfectOrder >= 0.85 ? 'OK' : perfectOrder >= 0.75 ? 'WARN' : 'CRITICAL',
      },
      forecastAccuracy: {
        value: forecastAccuracy.accuracyPct,
        status: forecastAccuracy.status,
      },
      capacityUtil: {
        value: parseFloat(capacityUtilPct.toFixed(1)),
        status: supplyPlan.capacityStatus,
      },
      cash: {
        value: cash,
        status: cash >= 15_000_000 ? 'OK' : cash >= 5_000_000 ? 'WARN' : 'CRITICAL',
      },
      shortTermDebt: {
        value: shortTermDebt,
        status: shortTermDebt <= 50_000_000 ? 'OK' : shortTermDebt <= 100_000_000 ? 'WARN' : 'CRITICAL',
      },
    };

    // ── QUALITY SECTION ────────────────────────────────────────────────────────────────────────────────────
    // Mirrors updateQualitySection_ in GAS (built from KPI data)
    const qualitySection = kpi
      ? {
          inspectionLevel: 'BASIC',
          defectRatePct: parseFloat(((kpi.operations?.defectRate ?? 0) * 100).toFixed(2)),
          returnRatePct: parseFloat(((kpi.customer?.returnRate ?? 0) * 100).toFixed(2)),
          returnRateStatus:
            (kpi.customer?.returnRate ?? 0) < 0.01
              ? 'OK'
              : (kpi.customer?.returnRate ?? 0) < 0.02
                ? 'WARN'
                : 'CRITICAL',
        }
      : null;

    // ── LOGISTICS SECTION ────────────────────────────────────────────────────────────────────────────────────────────
    // Mirrors updateLogisticsSection_ in GAS
    const logisticsSection = state
      ? {
          carrierMode: state.carrierMode ?? 'TRUCK',
          freightCost: state.freightCost ?? 0,
          lastMileCost: state.lastMileCost ?? 0,
          volumeDiscount: state.volumeDiscount ?? 0,
          tmsDiscountPct: parseFloat(((state.tmsDiscount ?? 0) * 100).toFixed(1)),
          tmsDiscountApplied: (state.tmsDiscount ?? 0) > 0,
        }
      : null;

    // ── ALERTS ─────────────────────────────────────────────────────────────────────────────
    const alerts: Array<{ level: 'INFO' | 'WARN' | 'CRITICAL'; message: string }> = [];

    if (rawMaterialUnits < 300_000)
      alerts.push({ level: 'WARN', message: 'Raw materials low — consider increasing orders' });

    if (finishedGoodsUnits < 50_000)
      alerts.push({ level: 'WARN', message: 'Finished goods low — risk of stockouts next quarter' });

    if (state?.retailerMode === 'PANIC')
      alerts.push({ level: 'CRITICAL', message: 'Retailer in PANIC mode — shipping 50% more than normal' });

    if (state?.retailerMode === 'CLEARANCE')
      alerts.push({ level: 'WARN', message: 'Retailer in CLEARANCE mode — discounting your product' });

    if (fillRate < 0.90)
      alerts.push({ level: 'CRITICAL', message: 'Fill rate below 90% — customers experiencing stockouts' });

    if (csi < 75)
      alerts.push({ level: 'WARN', message: 'CSI below 75 — customer satisfaction declining' });

    if (forecastAccuracy.mape > 25)
      alerts.push({ level: 'WARN', message: 'Forecast error above 25% — review demand patterns' });

    if (qualitySection && qualitySection.returnRatePct > 2)
      alerts.push({ level: 'CRITICAL', message: 'Return rate above 2% — consider upgrading inspection level' });

    if (cash < 15_000_000)
      alerts.push({ level: 'WARN', message: 'Cash position low — monitor spending closely' });

    if (shortTermDebt > 50_000_000)
      alerts.push({ level: 'WARN', message: 'High short-term debt — interest costs are increasing' });

    if ((firm.techOwned?.length ?? 0) === 0)
      alerts.push({ level: 'INFO', message: 'No SC technology owned — consider investing for competitive advantage' });

    if (alerts.length === 0)
      alerts.push({ level: 'INFO', message: 'No critical issues detected this quarter' });

    return {
      simulationId,
      firmId: firmObjectId.toString(),
      firmNumber: firm.firmNumber,
      firmName: firm.name,
      firmColor: firm.color,
      quarter: targetQuarter,
      totalMarketDemand,
      demandOutlook,
      forecastHistory,
      forecastAccuracy,
      supplyPlan,
      inventoryPosition,
      keyMetrics,
      qualitySection,
      logisticsSection,
      alerts,
      generatedAt: new Date().toISOString(),
    };
  }
}
