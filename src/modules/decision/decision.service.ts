// src/services/decision.service.ts
// FIXED VERSION — All bugs resolved:
//
//  FIX 1  — Q1 parts validation: skip when no latestState (quarter 1 cold start)
//  FIX 2  — frontendKeyMap values changed to camelCase ("erp", "controlTower"…)
//  FIX 3  — ownedTechKeys now returns camelCase keys, not uppercase type names
//  FIX 4  — p3Cost fixed to GAS CONFIG.market.P3_CONFIG.LAUNCH_COST ($2M not $7M)
//  FIX 5  — toResponseDto now includes forecastMethod (frontend prefill)
//  FIX 6  — $setOnInsert includes all advanced defaults (warrantyTier, carrier…)
//  FIX 7  — validateDecision now checks pricing ranges (P1 $250–$1000, P2 $425–$1500)
//  FIX 8  — Segment validation uses explicit null guard (not ?? 25 default bypass)
//  FIX 9  — validateDecision skips parts check on Q1 (no prior state exists)

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Decision,
  DecisionDocument,
  DecisionStatus,
  Firm,
  FirmDocument,
  QuarterState,
  QuarterStateDocument,
  Technology,
  TechnologyDocument,
  Simulation,
  SimulationDocument,
  Enrollment,
  EnrollmentDocument,
  User,
  UserDocument,
  INSPECTION_CONFIG,
  SHIPPING_CONFIG,
  SUPPLIER_CONFIG,
  TECHNOLOGY_DEFINITIONS,
  TechnologyType,
  InspectionLevel,
  ShippingMode,
  SupplierType,
  WarrantyTier,
  DisposalMethod,
  CarrierMode,
  CARRIER_CONFIG,
  WARRANTY_TIER_CONFIG,
  DISPOSAL_METHOD_CONFIG,
  CAPACITY_EXPANSION_CONFIG,
  DC_CONFIG,
  VMI_CONFIG,
  CreditHistory,
  CreditHistoryDocument,
} from '../../entities/index.entity';
import {
  CreateDecisionDto,
  UpdateDecisionDto,
  DecisionResponseDto,
  FirmStateResponseDto,
} from './dto/decision.dto';
import { SimulationService } from '../simulation/simulation.service';

// FIX 2 & 3: Canonical map between backend type names and frontend camelCase keys
// Backend TechnologyType enum values: "ERP", "CONTROL_TOWER", "APS", "DEMAND_SENSING", "WMS", "TMS", "OMS", "ANALYTICS"
// Frontend techPurchases / techMap keys: "erp", "controlTower", "aps", "demandSensing", "wms", "tms", "oms", "analytics"
const TECH_TYPE_TO_FRONTEND_KEY: Record<string, string> = {
  ERP:            'erp',
  CONTROL_TOWER:  'controlTower',
  APS:            'aps',
  DEMAND_SENSING: 'demandSensing',
  WMS:            'wms',
  TMS:            'tms',
  OMS:            'oms',
  ANALYTICS:      'analytics',
};

@Injectable()
export class DecisionService {
  constructor(
    @InjectModel(Decision.name) private decisionModel: Model<DecisionDocument>,
    @InjectModel(Firm.name) private firmModel: Model<FirmDocument>,
    @InjectModel(QuarterState.name)
    private quarterStateModel: Model<QuarterStateDocument>,
    @InjectModel(Technology.name)
    private technologyModel: Model<TechnologyDocument>,
    @InjectModel(Simulation.name)
    private simulationModel: Model<SimulationDocument>,
    @InjectModel(Enrollment.name)
    private enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private simulationService: SimulationService,
    @InjectModel(CreditHistory.name)
    private creditHistoryModel: Model<CreditHistoryDocument>,
  ) {}

  // ============================================================================
  // CREATE DECISION (Draft)
  // ============================================================================

  async create(dto: CreateDecisionDto): Promise<DecisionResponseDto> {
    const existing = await this.decisionModel.findOne({
      firm: dto.firm,
      quarter: dto.quarter,
    });

    if (existing) {
      throw new BadRequestException(
        `Decision already exists for firm ${dto.firm} quarter ${dto.quarter}`,
      );
    }

    const decision = new this.decisionModel({
      ...dto,
      simulation: new Types.ObjectId(dto.simulation),
      firm: new Types.ObjectId(dto.firm),
      status: DecisionStatus.DRAFT,
    });

    const saved = await decision.save();
    return this.toResponseDto(saved);
  }

  // ============================================================================
  // UPDATE DECISION (Draft only)
  // ============================================================================

  async update(
    id: string,
    dto: UpdateDecisionDto,
  ): Promise<DecisionResponseDto> {
    const decisionId = new Types.ObjectId(id);

    const decision = await this.decisionModel.findById(decisionId);
    if (!decision) {
      throw new NotFoundException(`Decision ${id} not found`);
    }

    if (decision.status !== DecisionStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot update decision with status ${decision.status}`,
      );
    }

    // Sync techPurchases object → flat fields (what GAS simulation reads)
    if (dto.techPurchases) {
      const tp = dto.techPurchases as any;
      (dto as any).purchaseERP           = tp.erp           ?? false;
      (dto as any).purchaseControlTower  = tp.controlTower  ?? false;
      (dto as any).purchaseAPS           = tp.aps           ?? false;
      (dto as any).purchaseDemandSensing = tp.demandSensing ?? false;
      (dto as any).purchaseWMS           = tp.wms           ?? false;
      (dto as any).purchaseTMS           = tp.tms           ?? false;
      (dto as any).purchaseOMS           = tp.oms           ?? false;
      (dto as any).purchaseAnalytics     = tp.analytics     ?? false;
    }

    // Sync flat intel fields → intelSubscriptions object
    if ((dto as any).intelRegionalDemand !== undefined) {
      (dto as any).intelSubscriptions = {
        regionalDemand:     (dto as any).intelRegionalDemand     ?? false,
        retailChannel:      (dto as any).intelRetailChannel      ?? false,
        competitorCapacity: (dto as any).intelCompetitorCapacity ?? false,
        supplierRisk:       (dto as any).intelSupplierRisk       ?? false,
        customerSentiment:  (dto as any).intelCustomerSentiment  ?? false,
      };
    }

    const updated = await this.decisionModel.findByIdAndUpdate(
      decisionId,
      { $set: dto },
      { new: true, runValidators: false },
    );

    if (!updated) {
      throw new NotFoundException(`Decision ${id} not found`);
    }

    return this.toResponseDto(updated);
  }

  // ============================================================================
  // SUBMIT DECISION
  // ============================================================================

  async submit(id: string, userId?: string): Promise<DecisionResponseDto> {
    const decision = await this.decisionModel.findById(id);

    if (!decision) {
      throw new NotFoundException(`Decision ${id} not found`);
    }

    if (decision.status !== DecisionStatus.DRAFT) {
      throw new BadRequestException(
        `Decision already submitted with status ${decision.status}`,
      );
    }

    await this.validateDecision(decision);

    const latestState = await this.quarterStateModel
      .findOne({ firm: decision.firm })
      .sort({ quarter: -1 });
    const availableCash = latestState?.cash ?? 50000000;

    await this.saveFinancingInfo(decision, availableCash);

    decision.status = DecisionStatus.SUBMITTED;
    decision.submittedAt = new Date();
    if (userId) {
      decision.submittedBy = new Types.ObjectId(userId);
    }

    const saved = await decision.save();

    if (userId) {
      await this.enrollmentModel.updateOne(
        { user: new Types.ObjectId(userId), firm: decision.firm },
        { $inc: { decisionsSubmitted: 1 } },
      );
    }

    const simulation = await this.simulationModel.findById(decision.simulation);
    if (!simulation) {
      throw new NotFoundException(`Simulation not found`);
    }

    const allFirms = await this.firmModel.find({
      simulation: decision.simulation,
    });

    const submittedDecisions = await this.decisionModel.countDocuments({
      simulation: decision.simulation,
      quarter: decision.quarter,
      status: { $in: [DecisionStatus.SUBMITTED, DecisionStatus.PROCESSED] },
    });

    if (submittedDecisions === allFirms.length) {
      console.log(
        `All ${allFirms.length} firms submitted for quarter ${decision.quarter}. Auto-advancing.`,
      );
      try {
        const simId =
          typeof decision.simulation === 'string'
            ? decision.simulation
            : ((decision.simulation as any)?.toString?.() ?? decision.simulation);
        await this.simulationService.advanceQuarter(simId);
      } catch (err) {
        console.error('Auto-advance failed:', decision.simulation, err);
      }
    }

    return this.toResponseDto(saved);
  }

  // ============================================================================
  // GET DECISION BY ID
  // ============================================================================

  async findById(id: string): Promise<DecisionResponseDto> {
    const decision = await this.decisionModel.findById(id);
    if (!decision) {
      throw new NotFoundException(`Decision ${id} not found`);
    }
    return this.toResponseDto(decision);
  }

  // ============================================================================
  // GET DECISION BY FIRM AND QUARTER
  // ============================================================================

  async findByFirmAndQuarter(
    firmId: string,
    quarter: number,
  ): Promise<DecisionResponseDto | null> {
    const decision = await this.decisionModel.findOne({ firm: firmId, quarter });
    return decision ? this.toResponseDto(decision) : null;
  }

  // ============================================================================
  // GET OR CREATE DECISION (for Decision Cockpit UI)
  // ============================================================================

  async getOrCreateForQuarter(
    simulationId: string,
    firmId: string,
    quarter: number,
  ): Promise<DecisionResponseDto> {
    let decision = await this.decisionModel.findOne({
      simulation: new Types.ObjectId(simulationId),
      firm: new Types.ObjectId(firmId),
      quarter,
    });

    if (!decision) {
      const prevDecision = await this.decisionModel.findOne({
        firm: new Types.ObjectId(firmId),
        quarter: quarter - 1,
      });

      decision = new this.decisionModel({
        simulation: new Types.ObjectId(simulationId),
        firm: new Types.ObjectId(firmId),
        quarter,
        status: DecisionStatus.DRAFT,
        ...this.buildDecisionDefaults(prevDecision),
      });

      decision = await decision.save();
    }

    return this.toResponseDto(decision);
  }

  // ============================================================================
  // GET FIRM STATE (for Decision Cockpit UI)
  // ============================================================================

  async getFirmState(firmId: string): Promise<FirmStateResponseDto> {
    const firm = await this.firmModel.findById(firmId);
    if (!firm) {
      throw new NotFoundException(`Firm ${firmId} not found`);
    }

    const latestState = await this.quarterStateModel
      .findOne({ firm: firmId })
      .sort({ quarter: -1 });

    const technologies = await this.technologyModel.find({
      firm: firmId,
      isActive: true,
    });

    return {
      id: (firm._id as Types.ObjectId).toString(),
      firmNumber: firm.firmNumber,
      name: firm.name,
      quarter: latestState?.quarter ?? 0,
      cash: latestState?.cash ?? 50000000,
      rawMaterials: latestState?.rawMaterialUnits ?? 0,
      finishedGoods: latestState?.finishedGoodsUnits ?? 0,
      inTransit: latestState?.inTransitUnits ?? 0,
      retailerInventory: latestState?.retailerInventory ?? 0,
      csi: latestState?.csi ?? 80,
      marketShare: latestState?.marketShare ?? 0.3333,
      perfectOrder: latestState?.perfectOrder?.overall ?? 0.84,
      retailerMode: latestState?.retailerMode ?? 'NORMAL',
      techOwned: technologies.map((t) => t.type),
    };
  }

  // ============================================================================
  // VALIDATE DECISION
  // ============================================================================

  private async validateDecision(decision: DecisionDocument): Promise<void> {
    const errors: string[] = [];

    // Get state going INTO this quarter (state produced by previous quarter's processing)
    // FIX: Query specifically for the previous quarter (quarter - 1), not just the latest state overall
    // This prevents using the current quarter's state if it's already been processed
    const latestState = await this.quarterStateModel
      .findOne({ 
        firm: decision.firm,
        quarter: decision.quarter - 1,
      });

    const simulation = await this.simulationModel.findById(decision.simulation);
    const currentQuarter = decision.quarter;

    // ── CAPACITY ─────────────────────────────────────────────────────────────
    const baseCapacityPerShift = latestState?.capacityUnits ?? 250000;
    const additionalCapacity   = latestState?.additionalCapacity ?? 0;
    const expansionInProgress  = latestState?.expansionInProgress ?? [];

    const completingThisQuarter = (expansionInProgress as any[])
      .filter((exp) => exp.completesQ <= currentQuarter)
      .reduce((sum, exp) => sum + (exp.capacity || 0), 0);

    const effectiveAdditionalCapacity = additionalCapacity + completingThisQuarter;
    const baseCapacity  = baseCapacityPerShift * decision.shifts;
    const maxCapacity   = baseCapacity + effectiveAdditionalCapacity;

    const productInnovationEnabled = simulation?.features?.productInnovation ?? false;
    const p3Production = productInnovationEnabled ? (decision.productionP3 ?? 0) : 0;
    const totalProduction =
      (decision.productionP1 ?? 0) +
      (decision.productionP2 ?? 0) +
      p3Production;

    if (totalProduction > maxCapacity) {
      let msg = `Production (${totalProduction.toLocaleString()}) exceeds capacity (${maxCapacity.toLocaleString()}) for ${decision.shifts} shift(s)`;
      if (effectiveAdditionalCapacity > 0) {
        msg += ` (includes +${effectiveAdditionalCapacity.toLocaleString()} from expansions)`;
      }
      errors.push(msg);
    }

    // FIX 1 & 9 (REVISED): Multi-quarter procurement inventory validation
    // Skip on Q1 only (cold start: no prior state exists, GAS bootstraps initial inventory)
    // ALWAYS validate if Q2+, regardless of current inventory level
    // 
    // Key distinction:
    // - Regional orders: arrive same quarter (COUNT for this quarter's production)
    // - Global orders: ~45-day lead time, arrive next quarter (DON'T count this quarter)
    const isFirstQuarter = currentQuarter <= 1 || !latestState;

    if (!isFirstQuarter) {
      const partsPerUnit   = 3;
      const partsNeeded    = totalProduction * partsPerUnit;
      
      // FIX: Calculate pending orders arriving this quarter (global orders from prior quarters)
      const pendingOrdersArrivingThisQuarter = await this.calculatePendingOrders(
        decision.firm.toString(),
        currentQuarter,
      );

      // Parts available THIS quarter: current inventory + in-transit + same-quarter orders + arriving global orders
      const currentRawMaterials = latestState.rawMaterialUnits ?? 0;
      const currentInTransit    = latestState.inTransitUnits ?? 0;
      const regionalOrdersSame  = decision.orderRegional ?? 0;
      const globalOrdersArriving = pendingOrdersArrivingThisQuarter.inTransitFromPriorQuarters;
      
      const partsAvailable = currentRawMaterials + currentInTransit + regionalOrdersSame + globalOrdersArriving;

      if (partsAvailable < partsNeeded) {
        const shortfall = partsNeeded - partsAvailable;
        const breakdown =
          `(${currentRawMaterials.toLocaleString()} raw materials + ` +
          `${currentInTransit.toLocaleString()} prior in-transit + ` +
          `${globalOrdersArriving.toLocaleString()} global orders arriving + ` +
          `${regionalOrdersSame.toLocaleString()} regional orders)`;
        errors.push(
          `Insufficient parts for Q${currentQuarter} production. ` +
          `Need: ${partsNeeded.toLocaleString()} (${totalProduction.toLocaleString()} units × 3 parts/unit). ` +
          `Available: ${partsAvailable.toLocaleString()} ${breakdown}. ` +
          `Shortfall: ${shortfall.toLocaleString()} parts. ` +
          `Increase regional orders ($${SUPPLIER_CONFIG[SupplierType.REGIONAL].unitCost}/unit, same-quarter delivery) or reduce production.`,
        );
      }
      
      // Track inventory carryover for next quarter
      const inventoryAfterProduction = partsAvailable - partsNeeded;
      if (inventoryAfterProduction > 0) {
        console.log(
          `[Firm ${decision.firm} Q${currentQuarter}] Inventory forecast: ` +
          `${inventoryAfterProduction.toLocaleString()} parts will carry to Q${currentQuarter + 1}`,
        );
      }
    }

    // Supplier order limits. These are published on the supplier cards but were
    // never enforced, so an order well beyond a supplier's stated capacity
    // (e.g. 1.3M units against a 500K regional cap) passed validation.
    const globalCfg = SUPPLIER_CONFIG[SupplierType.GLOBAL];
    const regionalCfg = SUPPLIER_CONFIG[SupplierType.REGIONAL];
    const orderGlobalQty = decision.orderGlobal ?? 0;
    const orderRegionalQty = decision.orderRegional ?? 0;

    if (orderGlobalQty > 0 && orderGlobalQty < globalCfg.minOrder) {
      errors.push(
        `Global order (${orderGlobalQty.toLocaleString()} units) is below ` +
          `${globalCfg.name}'s minimum of ${globalCfg.minOrder.toLocaleString()} units.`,
      );
    }
    if (orderGlobalQty > globalCfg.maxOrder) {
      errors.push(
        `Global order (${orderGlobalQty.toLocaleString()} units) exceeds ` +
          `${globalCfg.name}'s capacity of ${globalCfg.maxOrder.toLocaleString()} units per quarter.`,
      );
    }
    if (orderRegionalQty > regionalCfg.maxOrder) {
      errors.push(
        `Regional order (${orderRegionalQty.toLocaleString()} units) exceeds ` +
          `${regionalCfg.name}'s capacity of ${regionalCfg.maxOrder.toLocaleString()} units per quarter.`,
      );
    }

    // FIX 7: Pricing validation (GAS: P1 $250–$1000, P2 $425–$1500)
    const priceP1 = decision.priceP1 ?? 500;
    const priceP2 = decision.priceP2 ?? 850;
    if (priceP1 < 250 || priceP1 > 1000) {
      errors.push(`P1 price ($${priceP1}) must be between $250 and $1,000`);
    }
    if (priceP2 < 425 || priceP2 > 1500) {
      errors.push(`P2 price ($${priceP2}) must be between $425 and $1,500`);
    }

    // FIX 8: Segment validation — use actual stored values, not ?? 25 defaults that mask null
    const champions = decision.segmentChampions;
    const growth    = decision.segmentGrowth;
    const atRisk    = decision.segmentAtRisk;
    const other     = decision.segmentOther;

    // If all four are null/undefined the decision was created with defaults — treat as 100
    if (champions !== null && champions !== undefined &&
        growth    !== null && growth    !== undefined &&
        atRisk    !== null && atRisk    !== undefined &&
        other     !== null && other     !== undefined) {
      const segmentTotal = champions + growth + atRisk + other;
      if (Math.abs(segmentTotal - 100) > 1) {
        errors.push(
          `Customer segment allocation (${segmentTotal}%) must sum to 100%. ` +
          `Adjust Champions + Growth + At-Risk + Other.`,
        );
      }
    }

    // Shift validation (GAS: 1–3)
    if (decision.shifts < 1 || decision.shifts > 3) {
      errors.push(`Shifts must be between 1 and 3`);
    }

    // DC allocation validation
    const regionalDCsEnabled = simulation?.features?.regionalDCs ?? false;
    if (regionalDCsEnabled) {
      if (decision.dcCentralStatus === 'YES' || latestState?.dcCentralOpen) {
        if ((decision.allocateCentral ?? 0) > DC_CONFIG.CENTRAL.capacity) {
          errors.push(
            `Central DC allocation (${(decision.allocateCentral ?? 0).toLocaleString()}) ` +
            `exceeds capacity (${DC_CONFIG.CENTRAL.capacity.toLocaleString()})`,
          );
        }
      }
      if (decision.dcWestStatus === 'YES' || latestState?.dcWestOpen) {
        if ((decision.allocateWest ?? 0) > DC_CONFIG.WEST.capacity) {
          errors.push(
            `West DC allocation (${(decision.allocateWest ?? 0).toLocaleString()}) ` +
            `exceeds capacity (${DC_CONFIG.WEST.capacity.toLocaleString()})`,
          );
        }
      }
    }

    // Market expansion validation
    const marketExpansionEnabled = simulation?.features?.marketExpansion ?? false;
    if (marketExpansionEnabled) {
      if (decision.enterR4 && (decision.forecastR4 ?? 0) <= 0) {
        errors.push('R4 forecast must be greater than 0 when entering the market');
      }
      if (decision.enterR5 && (decision.forecastR5 ?? 0) <= 0) {
        errors.push('R5 forecast must be greater than 0 when entering the market');
      }
      if (decision.enterR6 && (decision.forecastR6 ?? 0) <= 0) {
        errors.push('R6 forecast must be greater than 0 when entering the market');
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Decision validation failed',
        errors,
      });
    }
  }

  // ============================================================================
  // CALCULATE ESTIMATED COST
  // ============================================================================

  private calculateEstimatedCost(
    decision: DecisionDocument,
    state?: QuarterStateDocument,
  ): number {
    const totalProduction =
      (decision.productionP1 ?? 0) +
      (decision.productionP2 ?? 0) +
      (decision.productionP3 ?? 0);

    const procurementCost =
      (decision.orderGlobal  ?? 0) * SUPPLIER_CONFIG[SupplierType.GLOBAL].unitCost +
      (decision.orderRegional ?? 0) * SUPPLIER_CONFIG[SupplierType.REGIONAL].unitCost;

    const shiftMultiplier =
      decision.shifts === 1 ? 1.0 : decision.shifts === 2 ? 1.15 : 1.5;
    const laborCost = totalProduction * 20 * shiftMultiplier;

    const qualityCost =
      totalProduction * (INSPECTION_CONFIG[decision.inspectionLevel]?.cost ?? 0);

    const freightCost =
      totalProduction * (SHIPPING_CONFIG[decision.shippingMode]?.cost ?? 0);

    // Technology purchases
    let techCost = 0;
    const tp = decision.techPurchases || {};
    if (tp.erp)           techCost += TECHNOLOGY_DEFINITIONS[TechnologyType.ERP].cost;
    if (tp.controlTower)  techCost += TECHNOLOGY_DEFINITIONS[TechnologyType.CONTROL_TOWER].cost;
    if (tp.aps)           techCost += TECHNOLOGY_DEFINITIONS[TechnologyType.APS].cost;
    if (tp.demandSensing) techCost += TECHNOLOGY_DEFINITIONS[TechnologyType.DEMAND_SENSING].cost;
    if (tp.wms)           techCost += TECHNOLOGY_DEFINITIONS[TechnologyType.WMS].cost;
    if (tp.tms)           techCost += TECHNOLOGY_DEFINITIONS[TechnologyType.TMS].cost;
    if (tp.oms)           techCost += TECHNOLOGY_DEFINITIONS[TechnologyType.OMS].cost;
    if (tp.analytics)     techCost += TECHNOLOGY_DEFINITIONS[TechnologyType.ANALYTICS].cost;

    // Capacity expansion (GAS CONFIG.capacityExpansion.EXPANSION_OPTIONS)
    let expansionCost = 0;
    if (decision.buildSmallLine)  expansionCost += CAPACITY_EXPANSION_CONFIG.SMALL_LINE?.cost  ?? 8_000_000;
    if (decision.buildMediumLine) expansionCost += CAPACITY_EXPANSION_CONFIG.MEDIUM_LINE?.cost ?? 15_000_000;
    if (decision.buildLargeLine)  expansionCost += CAPACITY_EXPANSION_CONFIG.LARGE_LINE?.cost  ?? 25_000_000;

    // DC setup (only charged when first opening)
    let dcCost = 0;
    if (decision.dcCentralStatus === 'YES' && !state?.dcCentralOpen) {
      dcCost += DC_CONFIG.CENTRAL.setupCost;
    }
    if (decision.dcWestStatus === 'YES' && !state?.dcWestOpen) {
      dcCost += DC_CONFIG.WEST.setupCost;
    }

    // VMI setup (one-time: GAS CONFIG.vmi.SETUP_COST = $2M)
    let vmiCost = 0;
    if (decision.enableVMI && !state?.vmiActive) {
      vmiCost += VMI_CONFIG.SETUP_COST;
    }

    // FIX 4: P3 launch cost — GAS CONFIG.market.P3_CONFIG.LAUNCH_COST = $2M (not $7M)
    // The $1M minimum marketing is part of marketingBudget, not a separate cost
    let p3Cost = 0;
    if (decision.launchP3 && !state?.p3Launched) {
      p3Cost = 2_000_000; // GAS: LAUNCH_COST: 2000000
    }

    return (
      procurementCost +
      laborCost +
      qualityCost +
      freightCost +
      (decision.marketingBudget ?? 0) +
      techCost +
      expansionCost +
      dcCost +
      vmiCost +
      p3Cost
    );
  }

  // ============================================================================
  // CALCULATE FINANCING INFO
  // ============================================================================

  private async calculateFinancingInfo(
    firmId: string,
    estimatedCost: number,
    availableCash: number,
    quarterState: QuarterStateDocument | null,
  ): Promise<{
    borrowingNeeded: number;
    interestCost: number;
    totalCostWithInterest: number;
    creditTierName: string;
    creditLimit: number;
    annualRate: number;
    canBorrow: boolean;
    borrowingWarning?: string;
  }> {
    const state =
      quarterState ||
      (await this.quarterStateModel.findOne({ firm: firmId }).sort({ quarter: -1 }));

    const metrics = {
      cash: state?.cash || availableCash,
      accountsReceivable: state?.accountsReceivable || 0,
      inventoryValue:
        (state?.rawMaterialUnits || 0) * 150 +
        (state?.finishedGoodsUnits || 0) * 250,
      fixedAssets: state?.fixedAssets || 0,
      accountsPayable: state?.accountsPayable || 0,
      shortTermDebt: state?.shortTermDebt || 0,
      longTermDebt: state?.longTermDebt || 0,
      revenue: 0,
      netIncome: 0,
      operatingIncome: 0,
      interestExpense: 0,
    };

    const creditScore = this.calculateCreditworthinessScore(metrics);
    const tier        = this.determineCreditTier(creditScore.totalScore);
    const creditLimit = 50_000_000 * tier.creditMultiplier;

    let borrowingNeeded = 0;
    let borrowingWarning: string | undefined;

    if (estimatedCost > availableCash) {
      borrowingNeeded = estimatedCost - availableCash;
      const totalDebt = (state?.shortTermDebt || 0) + borrowingNeeded;
      if (totalDebt > creditLimit) {
        borrowingWarning =
          `Warning: Total debt ($${totalDebt.toLocaleString()}) exceeds credit limit ($${creditLimit.toLocaleString()})`;
      }
    }

    const quarterlyRate          = tier.annualRate / 4;
    const interestOnExistingDebt = (state?.shortTermDebt || 0) * quarterlyRate;
    const interestOnNewBorrowing = borrowingNeeded * quarterlyRate * 0.5;
    const totalInterestCost      = interestOnExistingDebt + interestOnNewBorrowing;

    return {
      borrowingNeeded,
      interestCost: totalInterestCost,
      totalCostWithInterest: estimatedCost + totalInterestCost,
      creditTierName: tier.name,
      creditLimit,
      annualRate: tier.annualRate,
      canBorrow: borrowingNeeded > 0 ? borrowingNeeded <= creditLimit : true,
      borrowingWarning,
    };
  }

  private calculateCreditworthinessScore(metrics: any): {
    currentRatioScore: number;
    debtToEquityScore: number;
    profitMarginScore: number;
    interestCoverageScore: number;
    cashFlowScore: number;
    totalScore: number;
  } {
    const W = { CURRENT_RATIO: 20, DEBT_TO_EQUITY: 25, PROFIT_MARGIN: 20, INTEREST_COVERAGE: 15, CASH_FLOW: 20 };
    const T = {
      CURRENT_RATIO:     { excellent: 2.0, good: 1.5, fair: 1.0, poor: 0.5 },
      DEBT_TO_EQUITY:    { excellent: 0.3, good: 0.5, fair: 1.0, poor: 2.0 },
      PROFIT_MARGIN:     { excellent: 0.15, good: 0.1, fair: 0.05, poor: 0.0 },
      INTEREST_COVERAGE: { excellent: 5.0, good: 3.0, fair: 1.5, poor: 1.0 },
      CASH_FLOW:         { excellent: 3.0, good: 2.0, fair: 1.0, poor: 0.5 },
    };
    const CASH_FLOOR = 10_000_000;

    const currentAssets      = metrics.cash + metrics.accountsReceivable + metrics.inventoryValue;
    const currentLiabilities = metrics.accountsPayable + metrics.shortTermDebt;
    const totalDebt          = metrics.shortTermDebt + metrics.longTermDebt;
    const totalAssets        = currentAssets + metrics.fixedAssets;
    const equity             = totalAssets - (currentLiabilities + metrics.longTermDebt);

    const currentRatio    = currentLiabilities > 0 ? currentAssets / currentLiabilities : 999;
    const debtToEquity    = equity > 0 ? totalDebt / equity : 999;
    const profitMargin    = metrics.revenue > 0 ? metrics.netIncome / metrics.revenue : 0;
    const interestCoverage = metrics.interestExpense > 0 ? metrics.operatingIncome / metrics.interestExpense : 999;
    const cashFloorRatio  = metrics.cash / CASH_FLOOR;

    const score = (value: number, thresholds: any, lower: boolean) => {
      if (!lower) {
        if (value >= thresholds.excellent) return 1.0;
        if (value >= thresholds.good)      return 0.8;
        if (value >= thresholds.fair)      return 0.6;
        if (value >= thresholds.poor)      return 0.3;
        return 0.1;
      } else {
        if (value <= thresholds.excellent) return 1.0;
        if (value <= thresholds.good)      return 0.8;
        if (value <= thresholds.fair)      return 0.6;
        if (value <= thresholds.poor)      return 0.3;
        return 0.1;
      }
    };

    const currentRatioScore    = W.CURRENT_RATIO    * score(currentRatio,    T.CURRENT_RATIO,     false);
    const debtToEquityScore    = W.DEBT_TO_EQUITY   * score(debtToEquity,    T.DEBT_TO_EQUITY,    true);
    const profitMarginScore    = W.PROFIT_MARGIN     * score(profitMargin,    T.PROFIT_MARGIN,     false);
    const interestCoverageScore = W.INTEREST_COVERAGE * score(interestCoverage, T.INTEREST_COVERAGE, false);
    const cashFlowScore        = W.CASH_FLOW         * score(cashFloorRatio,  T.CASH_FLOW,         false);

    const totalScore = Math.min(100, Math.max(0, Math.round(
      currentRatioScore + debtToEquityScore + profitMarginScore + interestCoverageScore + cashFlowScore,
    )));

    return {
      currentRatioScore:     Math.round(currentRatioScore),
      debtToEquityScore:     Math.round(debtToEquityScore),
      profitMarginScore:     Math.round(profitMarginScore),
      interestCoverageScore: Math.round(interestCoverageScore),
      cashFlowScore:         Math.round(cashFlowScore),
      totalScore,
    };
  }

  private determineCreditTier(score: number): {
    name: string; minScore: number; creditMultiplier: number; annualRate: number;
  } {
    if (score >= 80) return { name: 'Excellent',   minScore: 80, creditMultiplier: 2.00, annualRate: 0.08 };
    if (score >= 60) return { name: 'Good',         minScore: 60, creditMultiplier: 1.50, annualRate: 0.12 };
    if (score >= 40) return { name: 'Fair',         minScore: 40, creditMultiplier: 1.00, annualRate: 0.18 };
    if (score >= 20) return { name: 'Poor',         minScore: 20, creditMultiplier: 0.50, annualRate: 0.24 };
    return             { name: 'Distressed',  minScore:  0, creditMultiplier: 0.25, annualRate: 0.30 };
  }

  // ============================================================================
  // CONVERT TO RESPONSE DTO
  // ============================================================================

  private toResponseDto(decision: DecisionDocument): DecisionResponseDto {
    const totalForecast =
      (decision.forecastR1 ?? 0) + (decision.forecastR2 ?? 0) + (decision.forecastR3 ?? 0);
    const totalProduction =
      (decision.productionP1 ?? 0) + (decision.productionP2 ?? 0) + (decision.productionP3 ?? 0);

    const totalEstimatedCost = this.calculateEstimatedCost(decision);

    const procurementCost =
      (decision.orderGlobal  ?? 0) * SUPPLIER_CONFIG[SupplierType.GLOBAL].unitCost +
      (decision.orderRegional ?? 0) * SUPPLIER_CONFIG[SupplierType.REGIONAL].unitCost;

    const shiftMultiplier =
      decision.shifts === 1 ? 1.0 : decision.shifts === 2 ? 1.15 : 1.5;
    const estimatedLaborCost   = totalProduction * 20 * shiftMultiplier;
    const estimatedQualityCost = totalProduction * (INSPECTION_CONFIG[decision.inspectionLevel]?.cost ?? 0);
    const estimatedFreightCost = totalProduction * (SHIPPING_CONFIG[decision.shippingMode]?.cost ?? 0);

    let techPurchaseCost = 0;
    const tp = decision.techPurchases || {};
    if (tp.erp)           techPurchaseCost += TECHNOLOGY_DEFINITIONS[TechnologyType.ERP].cost;
    if (tp.controlTower)  techPurchaseCost += TECHNOLOGY_DEFINITIONS[TechnologyType.CONTROL_TOWER].cost;
    if (tp.aps)           techPurchaseCost += TECHNOLOGY_DEFINITIONS[TechnologyType.APS].cost;
    if (tp.demandSensing) techPurchaseCost += TECHNOLOGY_DEFINITIONS[TechnologyType.DEMAND_SENSING].cost;
    if (tp.wms)           techPurchaseCost += TECHNOLOGY_DEFINITIONS[TechnologyType.WMS].cost;
    if (tp.tms)           techPurchaseCost += TECHNOLOGY_DEFINITIONS[TechnologyType.TMS].cost;
    if (tp.oms)           techPurchaseCost += TECHNOLOGY_DEFINITIONS[TechnologyType.OMS].cost;
    if (tp.analytics)     techPurchaseCost += TECHNOLOGY_DEFINITIONS[TechnologyType.ANALYTICS].cost;

    return {
      id:         (decision._id as Types.ObjectId).toString(),
      simulation: decision.simulation.toString(),
      firm:       decision.firm.toString(),
      quarter:    decision.quarter,
      status:     decision.status,

      // FIX 5: forecastMethod was missing — frontend needs it for prefill
      forecastMethod: decision.forecastMethod ?? 'GUT',

      forecastR1: decision.forecastR1,
      forecastR2: decision.forecastR2,
      forecastR3: decision.forecastR3,
      totalForecast,

      orderGlobal:    decision.orderGlobal,
      orderRegional:  decision.orderRegional,
      procurementCost,

      productionP1:   decision.productionP1,
      productionP2:   decision.productionP2,
      productionP3:   decision.productionP3,
      totalProduction,
      shifts:         decision.shifts,

      priceP1: decision.priceP1,
      priceP2: decision.priceP2,

      marketingBudget: decision.marketingBudget,

      inspectionLevel: decision.inspectionLevel,
      shippingMode:    decision.shippingMode,

      techPurchases:      decision.techPurchases || {},
      techPurchaseCost,

      estimatedLaborCost,
      estimatedQualityCost,
      estimatedFreightCost,
      totalEstimatedCost,

      financeNote: 'Loans available if cash insufficient — interest charged at credit tier rate',
      carrier: decision.carrier,

      // Warranty
      warrantyTier:           decision.warrantyTier,
      centralWarrantyNetwork: decision.centralWarrantyNetwork,
      westWarrantyNetwork:    decision.westWarrantyNetwork,

      // Green Score
      disposalMethod: decision.disposalMethod,
      ecoPackaging:   decision.ecoPackaging,

      // Regional DCs
      dcCentralStatus: decision.dcCentralStatus,
      dcWestStatus:    decision.dcWestStatus,
      allocateCentral: decision.allocateCentral,
      allocateWest:    decision.allocateWest,

      // Inventory Transfers
      transferFromCentral:   decision.transferFromCentral,
      transferFromCentralTo: decision.transferFromCentralTo,
      transferFromWest:      decision.transferFromWest,
      transferFromWestTo:    decision.transferFromWestTo,

      // Capacity Expansion
      buildSmallLine:  decision.buildSmallLine,
      buildMediumLine: decision.buildMediumLine,
      buildLargeLine:  decision.buildLargeLine,

      // VMI
      enableVMI: decision.enableVMI,

      // Intelligence
      intelRegionalDemand:    decision.intelRegionalDemand,
      intelRetailChannel:     decision.intelRetailChannel,
      intelCompetitorCapacity:decision.intelCompetitorCapacity,
      intelSupplierRisk:      decision.intelSupplierRisk,
      intelCustomerSentiment: decision.intelCustomerSentiment,

      // Product Innovation
      launchP3: decision.launchP3,
      p3Config: decision.p3Config,
      p3Price:  decision.p3Price,

      // Market Expansion
      enterR4:    decision.enterR4,
      forecastR4: decision.forecastR4,
      enterR5:    decision.enterR5,
      forecastR5: decision.forecastR5,
      enterR6:    decision.enterR6,
      forecastR6: decision.forecastR6,

      // Supplier Selection
      primarySupplier:       decision.primarySupplier,
      secondarySupplier:     decision.secondarySupplier,
      primaryAllocation:     decision.primaryAllocation,
      emergencyRegionalOrder:decision.emergencyRegionalOrder,

      // Customer Segments
      segmentChampions: decision.segmentChampions,
      segmentGrowth:    decision.segmentGrowth,
      segmentAtRisk:    decision.segmentAtRisk,
      segmentOther:     decision.segmentOther,

      createdAt:   decision['createdAt'],
      updatedAt:   decision['updatedAt'],
      submittedAt: decision.submittedAt,
    };
  }

  // ============================================================================
  // SAVE FINANCING INFORMATION
  // ============================================================================

  private async saveFinancingInfo(
    decision: DecisionDocument,
    availableCash: number,
  ): Promise<void> {
    const quarterState = await this.quarterStateModel
      .findOne({ firm: decision.firm })
      .sort({ quarter: -1 });

    const estimatedCost  = this.calculateEstimatedCost(decision, quarterState || undefined);
    const financingInfo  = await this.calculateFinancingInfo(
      decision.firm.toString(), estimatedCost, availableCash, quarterState,
    );

    decision.estimatedTotalCost   = estimatedCost;
    decision.borrowingNeeded      = financingInfo.borrowingNeeded;
    decision.interestCost         = financingInfo.interestCost;
    decision.creditLineRate       = financingInfo.annualRate;
    decision.totalCostWithInterest = financingInfo.totalCostWithInterest;
  }

  // ============================================================================
  // BUILD DECISION DEFAULTS (shared between getOrCreateForQuarter and $setOnInsert)
  // ============================================================================

  // FIX 6: All advanced fields now included in defaults so new decisions always
  // have warrantyTier, disposalMethod, carrier, primarySupplier, etc.
  private buildDecisionDefaults(prev: DecisionDocument | null): Record<string, any> {
    return {
      // Forecasting
      // Defaults are market-scale, matching the "last demand" figure shown next
      // to each input (demand_history is market-wide). They used to be
      // firm-scale (80k/70k/50k), so the form prefilled one scale while the
      // on-screen reference showed another - students forecast against
      // whichever they happened to read.
      forecastR1:     prev?.forecastR1     ?? 240000,
      forecastR2:     prev?.forecastR2     ?? 210000,
      forecastR3:     prev?.forecastR3     ?? 150000,
      forecastMethod: prev?.forecastMethod ?? 'GUT',

      // Supplier (Analytics Mode)
      primarySupplier:        prev?.primarySupplier        ?? 'SUP001',
      secondarySupplier:      prev?.secondarySupplier      ?? 'NONE',
      primaryAllocation:      prev?.primaryAllocation      ?? 100,
      emergencyRegionalOrder: prev?.emergencyRegionalOrder ?? 0,

      // Procurement
      orderGlobal:   prev?.orderGlobal  ?? 600000,
      orderRegional: prev?.orderRegional ?? 0,

      // Production
      productionP1: prev?.productionP1 ?? 120000,
      productionP2: prev?.productionP2 ?? 80000,
      productionP3: prev?.productionP3 ?? 0,
      shifts:       prev?.shifts       ?? 1,

      // Product Innovation
      launchP3: prev?.launchP3 ?? false,
      p3Config: prev?.p3Config ?? 'STANDARD',
      p3Price:  prev?.p3Price  ?? 549,

      // Market Expansion
      enterR4:    prev?.enterR4    ?? false,
      forecastR4: prev?.forecastR4 ?? 0,
      enterR5:    prev?.enterR5    ?? false,
      forecastR5: prev?.forecastR5 ?? 0,
      enterR6:    prev?.enterR6    ?? false,
      forecastR6: prev?.forecastR6 ?? 0,

      // Pricing
      priceP1: prev?.priceP1 ?? 500,
      priceP2: prev?.priceP2 ?? 850,

      // Marketing + Segments
      marketingBudget:  prev?.marketingBudget  ?? 5000000,
      segmentChampions: prev?.segmentChampions ?? 25,
      segmentGrowth:    prev?.segmentGrowth    ?? 25,
      segmentAtRisk:    prev?.segmentAtRisk    ?? 25,
      segmentOther:     prev?.segmentOther     ?? 25,

      // Quality & Logistics
      inspectionLevel: prev?.inspectionLevel ?? InspectionLevel.BASIC,
      shippingMode:    prev?.shippingMode    ?? ShippingMode.STANDARD,

      // Multi-Carrier
      carrier: prev?.carrier ?? CarrierMode.TRUCK,

      // Technology (flat fields for GAS compatibility)
      purchaseERP:           false,
      purchaseControlTower:  false,
      purchaseAPS:           false,
      purchaseDemandSensing: false,
      purchaseWMS:           false,
      purchaseTMS:           false,
      purchaseOMS:           false,
      purchaseAnalytics:     false,
      techPurchases:         {},

      // Capacity Expansion
      buildSmallLine:  false,
      buildMediumLine: false,
      buildLargeLine:  false,

      // Regional DCs
      dcCentralStatus: prev?.dcCentralStatus ?? 'NO',
      dcWestStatus:    prev?.dcWestStatus    ?? 'NO',
      allocateCentral: prev?.allocateCentral ?? 0,
      allocateWest:    prev?.allocateWest    ?? 0,

      // Inventory Transfers
      transferFromCentral:   0,
      transferFromCentralTo: 'NONE',
      transferFromWest:      0,
      transferFromWestTo:    'NONE',

      // Warranty
      warrantyTier:           prev?.warrantyTier           ?? WarrantyTier.STANDARD,
      centralWarrantyNetwork: prev?.centralWarrantyNetwork ?? false,
      westWarrantyNetwork:    prev?.westWarrantyNetwork    ?? false,

      // Green Score
      disposalMethod: prev?.disposalMethod ?? DisposalMethod.RECYCLE,
      ecoPackaging:   prev?.ecoPackaging   ?? false,

      // Intelligence
      intelRegionalDemand:     prev?.intelRegionalDemand     ?? false,
      intelRetailChannel:      prev?.intelRetailChannel      ?? false,
      intelCompetitorCapacity: prev?.intelCompetitorCapacity ?? false,
      intelSupplierRisk:       prev?.intelSupplierRisk       ?? false,
      intelCustomerSentiment:  prev?.intelCustomerSentiment  ?? false,

      // VMI
      enableVMI: prev?.enableVMI ?? false,
    };
  }

  // ============================================================================
  // CALCULATE PENDING ORDERS (Orders in transit from previous quarters)
  // ============================================================================

  private async calculatePendingOrders(
    firmId: string,
    currentQuarter: number,
  ): Promise<{
    inTransitFromPriorQuarters: number;
    globalOrdersArriving: { placedQuarter: number; quantity: number; arrivalQuarter: number }[];
    pendingOrderDetails: string;
  }> {
    // Global orders take ~45 days (roughly 0.5 quarters)
    // Q3 order placed → arrives ~Q3.5 (during Q4)
    // This calculates which prior orders should be in-transit THIS quarter
    const GLOBAL_LEAD_TIME_QUARTERS = 0.5; // 45 days ≈ 0.5 quarters

    const priorDecisions = await this.decisionModel.find({
      firm: new Types.ObjectId(firmId),
      quarter: { $lt: currentQuarter },
      status: { $in: [DecisionStatus.SUBMITTED, DecisionStatus.PROCESSED] },
    });

    let totalInTransit = 0;
    const arrivingOrders: { placedQuarter: number; quantity: number; arrivalQuarter: number }[] = [];

    priorDecisions.forEach((decision) => {
      const global = decision.orderGlobal ?? 0;
      if (global <= 0) return;

      // Calculate expected arrival quarter
      // Placed in Q3 (3.0) + 0.5 → arrives Q3.5 (rounds to Q4)
      const expectedArrivalQuarter = Math.ceil(decision.quarter + GLOBAL_LEAD_TIME_QUARTERS);

      // If order SHOULD arrive this quarter, count it as in-transit arriving
      if (expectedArrivalQuarter === currentQuarter) {
        totalInTransit += global;
        arrivingOrders.push({
          placedQuarter: decision.quarter,
          quantity: global,
          arrivalQuarter: expectedArrivalQuarter,
        });
      }
    });

    const details = arrivingOrders
      .map((o) => `Q${o.placedQuarter}: ${o.quantity.toLocaleString()} units → Q${o.arrivalQuarter}`)
      .join('; ') || 'None';

    return {
      inTransitFromPriorQuarters: totalInTransit,
      globalOrdersArriving: arrivingOrders,
      pendingOrderDetails: details,
    };
  }

  // ============================================================================
  // GET QUARTER DECISION DATA - Comprehensive endpoint
  // ============================================================================

  async getQuarterDecisionData(
    simulationId: string,
    firmId: string,
    quarter: number,
  ): Promise<any> {
    const firm = await this.firmModel.findById(firmId);
    if (!firm) {
      throw new NotFoundException(`Firm ${firmId} not found`);
    }

    const prevDecision = await this.decisionModel.findOne({
      firm: firmId,
      quarter: quarter - 1,
    });

    // FIX 6: $setOnInsert now uses buildDecisionDefaults which includes ALL fields
    const decision = await this.decisionModel.findOneAndUpdate(
      {
        simulation: new Types.ObjectId(simulationId),
        firm:       new Types.ObjectId(firmId),
        quarter,
      },
      {
        $setOnInsert: {
          simulation: new Types.ObjectId(simulationId),
          firm:       new Types.ObjectId(firmId),
          quarter,
          status: DecisionStatus.DRAFT,
          ...this.buildDecisionDefaults(prevDecision),
        },
      },
      { upsert: true, new: true, lean: false },
    );

    // State going INTO this quarter = state produced after previous quarter processing
    const currentState = await this.quarterStateModel.findOne({
      firm: firmId,
      quarter: quarter - 1,
    });

    const previousState = await this.quarterStateModel.findOne({
      firm: firmId,
      quarter: quarter - 2,
    });

    // FIX: Track pending orders from previous quarters (global orders with 45-day lead time)
    const pendingOrders = await this.calculatePendingOrders(firmId, quarter);
    const totalInTransitUnits = (currentState?.inTransitUnits ?? 0) + pendingOrders.inTransitFromPriorQuarters;

    // Log pending orders for visibility
    if (pendingOrders.inTransitFromPriorQuarters > 0) {
      console.log(
        `[Order Tracking Q${quarter}] Firm ${firm.name} has ${pendingOrders.inTransitFromPriorQuarters.toLocaleString()} units arriving: ${pendingOrders.pendingOrderDetails}`,
      );
    }

    const technologies = await this.technologyModel.find({
      firm: firmId,
      isActive: true,
    });

    const ownedTechDetails = technologies.map((t) => ({
      type:            t.type,
      name:            t.name,
      category:        t.category,
      purchaseQuarter: t.purchaseQuarter,
      effects:         t.effects,
    }));

    // FIX 3: ownedKeys returns camelCase frontend keys (not uppercase type names)
    // so frontend ownedTypes.includes("ERP") check works correctly
    const ownedTechKeys = ownedTechDetails.map(
      (t) => TECH_TYPE_TO_FRONTEND_KEY[t.type] ?? t.type,
    );

    const inspectionOptions = Object.entries(INSPECTION_CONFIG).map(([key, cfg]) => ({
      level: key, cost: cfg.cost, detection: cfg.detection, labor: cfg.labor,
    }));

    const shippingOptions = Object.entries(SHIPPING_CONFIG).map(([key, cfg]) => ({
      mode:        key,
      id:          key,
      label:       key === 'STANDARD' ? 'Standard Ground ($3/unit)' :
                   key === 'EXPRESS'  ? 'Express Ground ($5/unit)'  : 'Air Freight ($10/unit)',
      cost:        cfg.cost,
      days:        cfg.days,
      onTimeBonus: cfg.onTimeBonus,
    }));

    const carrierOptions = Object.entries(CARRIER_CONFIG).map(([key, cfg]) => ({
      id:                      key,
      type:                    key,
      label:                   cfg.name,
      name:                    cfg.name,
      costPerUnit:             cfg.costPerUnit,
      onTimeRate:              cfg.onTimeRate,
      damageRate:              cfg.damageRate,
      volumeDiscountThreshold: cfg.volumeDiscountThreshold,
      volumeDiscountRate:      cfg.volumeDiscountRate,
    }));

    const warrantyOptions = Object.entries(WARRANTY_TIER_CONFIG).map(([key, cfg]) => ({
      tier:            key,
      name:            cfg.name,
      pricePerUnit:    cfg.pricePerUnit,
      includesPart:    cfg.includesPart,
      includesService: cfg.includesService,
      csiPenalty:      cfg.csiPenalty,
      churnMultiplier: cfg.churnMultiplier,
    }));

    const disposalOptions = Object.entries(DISPOSAL_METHOD_CONFIG).map(([key, cfg]) => ({
      method:          key,
      name:            cfg.name,
      costPerUnit:     cfg.costPerUnit,
      recoveryPerUnit: cfg.recoveryPerUnit,
      greenScoreChange:cfg.greenScoreChange,
    }));

    const capacityOptions = Object.entries(CAPACITY_EXPANSION_CONFIG).map(([key, cfg]) => ({
      type:            key,
      name:            cfg.name,
      cost:            cfg.cost,
      unitsPerQuarter: cfg.unitsPerQuarter,
      buildTime:       cfg.buildTime,
      maintenance:     cfg.maintenance,
    }));

    // Build current state with correct aliases
    const currentStateResponse = currentState
      ? {
          quarter:            currentState.quarter,
          cash:               currentState.cash,
          accountsReceivable: currentState.accountsReceivable,
          accountsPayable:    currentState.accountsPayable,
          shortTermDebt:      currentState.shortTermDebt,
          longTermDebt:       currentState.longTermDebt,
          rawMaterialUnits:   currentState.rawMaterialUnits,
          finishedGoodsUnits: currentState.finishedGoodsUnits,
          // FIX: Include pending orders in in-transit calculation
          inTransitUnits:     currentState.inTransitUnits + pendingOrders.inTransitFromPriorQuarters,
          // Aliases for frontend (FIX 12 in frontend)
          rawMaterials:       currentState.rawMaterialUnits,
          finishedGoods:      currentState.finishedGoodsUnits,
          inTransit:          currentState.inTransitUnits + pendingOrders.inTransitFromPriorQuarters,
          ordersInTransit:    currentState.ordersInTransit,
          // FIX: Show breakdown of where in-transit comes from
          pendingOrderArrivals: pendingOrders.globalOrdersArriving,
          retailerInventory:  currentState.retailerInventory,
          csi:                currentState.csi,
          marketShare:        currentState.marketShare,
          perfectOrder:       currentState.perfectOrder,
          retailerMode:       currentState.retailerMode,
          customersLoyal:     currentState.customersLoyal,
          customersInPlay:    currentState.customersInPlay,
          cumulativeRevenue:  currentState.cumulativeRevenue,
          cumulativeProfit:   currentState.cumulativeProfit,
          // DC
          dcCentralOpen:       currentState.dcCentralOpen      ?? false,
          dcCentralInventory:  currentState.dcCentralInventory ?? 0,
          dcWestOpen:          currentState.dcWestOpen         ?? false,
          dcWestInventory:     currentState.dcWestInventory    ?? 0,
          dcTotalOpex:         currentState.dcTotalOpex        ?? 0,
          // Green Score
          greenScore:    currentState.greenScore    ?? 50,
          disposalMethod:currentState.disposalMethod ?? DisposalMethod.RECYCLE,
          // VMI
          vmiActive: currentState.vmiActive ?? false,
          // Warranty
          warrantyTier:           currentState.warrantyTier           ?? WarrantyTier.STANDARD,
          centralWarrantyNetwork: currentState.centralWarrantyNetwork ?? false,
          westWarrantyNetwork:    currentState.westWarrantyNetwork    ?? false,
          // Capacity
          capacityUnits:        currentState.capacityUnits       ?? 250000,
          additionalCapacity:   currentState.additionalCapacity  ?? 0,
          expansionInProgress:  currentState.expansionInProgress ?? [],
          expansionMaintenance: currentState.expansionMaintenance ?? 0,
          techMaintenanceCost:  currentState.techMaintenanceCost  ?? 0,
          // Market Expansion
          r4Active:       currentState.r4Active       ?? false,
          r5Active:       currentState.r5Active       ?? false,
          r6Active:       currentState.r6Active       ?? false,
          r4EntryQuarter: currentState.r4EntryQuarter ?? null,
          r5EntryQuarter: currentState.r5EntryQuarter ?? null,
          r6EntryQuarter: currentState.r6EntryQuarter ?? null,
          // Product Innovation
          p3Launched:     currentState.p3Launched     ?? false,
          p3LaunchQuarter:currentState.p3LaunchQuarter ?? null,
          p3Config:       currentState.p3Config        ?? null,
        }
      : {
          // Q1 cold-start defaults
          quarter: 0,
          cash: 50_000_000,
          accountsReceivable: 0, accountsPayable: 0,
          shortTermDebt: 0,      longTermDebt: 0,
          rawMaterialUnits: 0,   finishedGoodsUnits: 0, inTransitUnits: 0,
          rawMaterials: 0,       finishedGoods: 0,      inTransit: 0,
          ordersInTransit: 0,    retailerInventory: 0,
          csi: 80,               marketShare: 0.3333,
          perfectOrder: { onTime:0.92, inFull:0.95, damageFree:0.97, documentation:0.99, overall:0.84 },
          retailerMode: 'NORMAL',
          customersLoyal: 0,     customersInPlay: 0,
          cumulativeRevenue: 0,  cumulativeProfit: 0,
          dcCentralOpen: false,  dcCentralInventory: 0,
          dcWestOpen: false,     dcWestInventory: 0,    dcTotalOpex: 0,
          greenScore: 50,        disposalMethod: DisposalMethod.RECYCLE,
          vmiActive: false,
          warrantyTier: WarrantyTier.STANDARD,
          centralWarrantyNetwork: false, westWarrantyNetwork: false,
          capacityUnits: 250000, additionalCapacity: 0,
          expansionInProgress: [], expansionMaintenance: 0, techMaintenanceCost: 0,
          r4Active: false, r5Active: false, r6Active: false,
          r4EntryQuarter: null, r5EntryQuarter: null, r6EntryQuarter: null,
          p3Launched: false, p3LaunchQuarter: null, p3Config: null,
        };

    // Capacity constraints for frontend validation
    const baseCapacityPerShift        = currentStateResponse.capacityUnits;
    const additionalCapacity          = currentStateResponse.additionalCapacity;
    const expansionInProgress         = currentStateResponse.expansionInProgress || [];
    const completingThisQuarter       = (expansionInProgress as any[])
      .filter((exp) => exp.completesQ <= quarter)
      .reduce((sum, exp) => sum + (exp.capacity || 0), 0);
    const effectiveAdditionalCapacity = additionalCapacity + completingThisQuarter;
    const totalCapacityPerShift       = baseCapacityPerShift + effectiveAdditionalCapacity;

    return {
      decision: this.toResponseDto(decision),
      firmState: {
        id:               (firm._id as Types.ObjectId).toString(),
        firmNumber:       firm.firmNumber,
        name:             firm.name,
        color:            firm.color,
        quarter,
        cumulativeRevenue:firm.cumulativeRevenue,
        cumulativeProfit: firm.cumulativeProfit,
        currentState:     currentStateResponse,
        previousState: previousState
          ? {
              quarter:           previousState.quarter,
              cash:              previousState.cash,
              rawMaterialUnits:  previousState.rawMaterialUnits,
              finishedGoodsUnits:previousState.finishedGoodsUnits,
              retailerInventory: previousState.retailerInventory,
              csi:               previousState.csi,
              marketShare:       previousState.marketShare,
              perfectOrder:      previousState.perfectOrder,
              cumulativeRevenue: previousState.cumulativeRevenue,
              cumulativeProfit:  previousState.cumulativeProfit,
              customersLoyal:    previousState.customersLoyal,
              customersInPlay:   previousState.customersInPlay,
              greenScore:        previousState.greenScore,
              capacityUnits:     previousState.capacityUnits     ?? 250000,
              additionalCapacity:previousState.additionalCapacity ?? 0,
              expansionInProgress:previousState.expansionInProgress ?? [],
            }
          : null,
      },
      technologies: {
        owned:    ownedTechDetails,
        // FIX 3: camelCase keys so frontend ownedTypes.includes("erp") works
        ownedKeys:ownedTechKeys,
        available: Object.entries(TECHNOLOGY_DEFINITIONS).map(([key, tech]) => ({
          type:       key,
          // FIX 2: frontendKey is camelCase ("erp", "controlTower"…) not "purchaseERP"
          frontendKey:TECH_TYPE_TO_FRONTEND_KEY[key] ?? key.toLowerCase(),
          name:       tech.name,
          category:   tech.category,
          cost:       tech.cost,
          benefit:    tech.benefit,
          effects:    tech.effects,
        })),
      },
      configurations: {
        inspectionLevels: inspectionOptions,
        shippingModes:    shippingOptions,
        carriers:         carrierOptions,
        warrantyTiers:    warrantyOptions,
        disposalMethods:  disposalOptions,
        capacityExpansion:capacityOptions,
        // GAS CONFIG.suppliers.PROFILES (6 suppliers — verified against GAS source)
        suppliers: [
          { id:'SUP001', label:'SUP001 — GlobalTech Mfg (China)',         country:'China',   unitCost:42.50, leadTimeDays:45, onTimeDelivery:0.88, defectRate:0.025, tariffRate:0.25, freightPerUnit:5.00, riskLevel:'MEDIUM', capacity:500000 },
          { id:'SUP002', label:'SUP002 — Precision Parts Inc (USA)',       country:'USA',     unitCost:58.00, leadTimeDays:14, onTimeDelivery:0.96, defectRate:0.008, tariffRate:0,    freightPerUnit:2.00, riskLevel:'LOW',    capacity:200000 },
          { id:'SUP003', label:'SUP003 — EuroComponents GmbH (Germany)',  country:'Germany', unitCost:54.00, leadTimeDays:21, onTimeDelivery:0.94, defectRate:0.012, tariffRate:0.05, freightPerUnit:3.00, riskLevel:'LOW',    capacity:300000 },
          { id:'SUP004', label:'SUP004 — Pacific Rim Supply (Vietnam)',    country:'Vietnam', unitCost:38.00, leadTimeDays:52, onTimeDelivery:0.82, defectRate:0.035, tariffRate:0.05, freightPerUnit:5.00, riskLevel:'HIGH',   capacity:400000 },
          { id:'SUP005', label:'SUP005 — MexiParts SA (Mexico)',           country:'Mexico',  unitCost:48.00, leadTimeDays:10, onTimeDelivery:0.91, defectRate:0.018, tariffRate:0,    freightPerUnit:2.50, riskLevel:'MEDIUM', capacity:250000 },
          { id:'SUP006', label:'SUP006 — IndiaSource Ltd (India)',         country:'India',   unitCost:36.00, leadTimeDays:42, onTimeDelivery:0.84, defectRate:0.030, tariffRate:0.05, freightPerUnit:4.50, riskLevel:'HIGH',   capacity:600000 },
        ],
      },
      advancedFeatures: {
        dcCentral: {
          name:        DC_CONFIG.CENTRAL.name,
          location:    DC_CONFIG.CENTRAL.location,
          setupCost:   DC_CONFIG.CENTRAL.setupCost,
          quarterlyOpex:DC_CONFIG.CENTRAL.quarterlyOpex,
          capacity:    DC_CONFIG.CENTRAL.capacity,
          serviceBonus:DC_CONFIG.CENTRAL.serviceBonus,
          regionServed:DC_CONFIG.CENTRAL.regionServed,
        },
        dcWest: {
          name:        DC_CONFIG.WEST.name,
          location:    DC_CONFIG.WEST.location,
          setupCost:   DC_CONFIG.WEST.setupCost,
          quarterlyOpex:DC_CONFIG.WEST.quarterlyOpex,
          capacity:    DC_CONFIG.WEST.capacity,
          serviceBonus:DC_CONFIG.WEST.serviceBonus,
          regionServed:DC_CONFIG.WEST.regionServed,
        },
        vmi: {
          setupCost:    VMI_CONFIG.SETUP_COST,
          quarterlyCost:VMI_CONFIG.QUARTERLY_COST,
          effects:      VMI_CONFIG.EFFECTS,
        },
      },
      constraints: {
        production: {
          maxPerShift:               250000,
          baseCapacity:              baseCapacityPerShift,
          additionalCapacity,
          completingThisQuarter,
          effectiveAdditionalCapacity,
          totalCapacityPerShift,
          expansionInProgress,
          maxTotal:    totalCapacityPerShift * decision.shifts,
          partsPerUnit:3,
          minShifts:   1,
          maxShifts:   3,
        },
        financial: {
          minCash:           10_000_000,
          maxMarketingBudget:(currentStateResponse.cash ?? 50_000_000) * 0.2,
          cashFloor:         10_000_000,
        },
        pricing: {
          maxPrice: { P1: 1000, P2: 1500, P3: 1200 },
          minPrice: { P1: 250,  P2: 425,  P3: 300  },
        },
        procurement: {
          globalLeadTime:     SUPPLIER_CONFIG[SupplierType.GLOBAL].leadTime,
          regionalLeadTime:   SUPPLIER_CONFIG[SupplierType.REGIONAL].leadTime,
          globalCostPerUnit:  SUPPLIER_CONFIG[SupplierType.GLOBAL].unitCost,
          regionalCostPerUnit:SUPPLIER_CONFIG[SupplierType.REGIONAL].unitCost,
        },
        inventory: {
          maxRawMaterial:              (currentStateResponse.cash ?? 50_000_000) * 0.15,
          maxFinishedGoods:            (currentStateResponse.cash ?? 50_000_000) * 0.15,
          targetRetailerInventoryMonths:3,
        },
        dc: {
          dcCentralCapacity:       DC_CONFIG.CENTRAL.capacity,
          dcWestCapacity:          DC_CONFIG.WEST.capacity,
          transferCostDcToDc:      DC_CONFIG.TRANSFER_COSTS.DC_TO_DC,
          transferCostDcToFactory: DC_CONFIG.TRANSFER_COSTS.DC_TO_FACTORY,
        },
      },
      marketInfo: {
        quarter,
        calendarQuarter:  ((quarter - 1) % 4) + 1,
        firmMarketShare:  currentStateResponse.marketShare ?? 0.3333,
        firmCsi:          currentStateResponse.csi         ?? 80,
        isFirstQuarter:   quarter <= 1 || !currentState,
      },
    };
  }

  // ============================================================================
  // GET SUBMISSION STATUS
  // ============================================================================

  async getSubmissionStatus(
    simulationId: string,
    quarter?: number,
  ): Promise<any> {
    const sim = await this.simulationModel.findById(new Types.ObjectId(simulationId));
    if (!sim) {
      throw new NotFoundException(`Simulation ${simulationId} not found`);
    }

    const targetQuarter = quarter ?? sim.currentQuarter;
    const firms = await this.firmModel.find({
      simulation: new Types.ObjectId(simulationId),
    });

    const submissionStatus = await Promise.all(
      firms.map(async (firm) => {
        const decision = await this.decisionModel.findOne({
          firm: firm._id,
          quarter: targetQuarter,
        });
        return {
          firmId:      firm._id,
          firmNumber:  firm.firmNumber,
          firmName:    firm.name,
          decisionId:  decision?._id,
          status:      decision?.status ?? 'NOT_CREATED',
          submittedAt: decision?.submittedAt,
        };
      }),
    );

    const allSubmitted = submissionStatus.every(
      (s) =>
        s.status === DecisionStatus.SUBMITTED ||
        s.status === DecisionStatus.PROCESSED,
    );

    return {
      simulationId,
      quarter: targetQuarter,
      totalFirms:    firms.length,
      submittedCount:submissionStatus.filter(
        (s) => s.status === DecisionStatus.SUBMITTED || s.status === DecisionStatus.PROCESSED,
      ).length,
      allSubmitted,
      submissions: submissionStatus,
    };
  }
}