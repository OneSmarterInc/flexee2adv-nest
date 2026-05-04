import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  KpiHistory,
  KpiHistoryDocument,
  IntelligenceReport,
  IntelligenceReportDocument,
  WarrantyClaim,
  WarrantyClaimDocument,
  TenQReport,
  TenQReportDocument,
  GreenScoreHistory,
  GreenScoreHistoryDocument,
} from '../../entities/index.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(KpiHistory.name)
    private kpiHistoryModel: Model<KpiHistoryDocument>,
    @InjectModel(IntelligenceReport.name)
    private intelReportModel: Model<IntelligenceReportDocument>,
    @InjectModel(WarrantyClaim.name)
    private warrantyClaimModel: Model<WarrantyClaimDocument>,
    @InjectModel(TenQReport.name)
    private tenqReportModel: Model<TenQReportDocument>,
    @InjectModel(GreenScoreHistory.name)
    private greenScoreHistoryModel: Model<GreenScoreHistoryDocument>,
  ) {}

  /**
   * Get complete KPI history for a firm
   */
  async getKpiHistory(
    simulationId: string,
    firmId: string,
  ): Promise<KpiHistoryDocument[]> {
    const simId = new Types.ObjectId(simulationId);
    const frmId = new Types.ObjectId(firmId);

    return this.kpiHistoryModel.find({
      simulation: simId,
      firm: frmId,
    });
  }

  /**
   * Get KPI history for a quarter range
   */
  async getKpiHistoryByRange(
    simulationId: string,
    firmId: string,
    startQuarter: number,
    endQuarter: number,
  ): Promise<KpiHistoryDocument[]> {
    const simId = new Types.ObjectId(simulationId);
    const frmId = new Types.ObjectId(firmId);

    return this.kpiHistoryModel.find({
      simulation: simId,
      firm: frmId,
      quarter: { $gte: startQuarter, $lte: endQuarter },
    });
  }

  /**
   * Get VMI data for a specific quarter
   */
  async getVmiData(
    simulationId: string,
    firmId: string,
    quarter: number,
  ) {
    const simId = new Types.ObjectId(simulationId);
    const frmId = new Types.ObjectId(firmId);

    const kpiHistory = await this.kpiHistoryModel.findOne({
      simulation: simId,
      firm: frmId,
      quarter,
    });

    if (!kpiHistory || !kpiHistory.vmi) {
      return null;
    }

    return {
      quarter,
      firmId,
      vmi: kpiHistory.vmi,
      costs: {
        vmiSetup: kpiHistory.costs?.vmiSetup || 0,
        vmiOngoing: kpiHistory.costs?.vmiOngoing || 0,
      },
    };
  }

  /**
   * Get VMI trend data for a quarter range
   */
  async getVmiTrend(
    simulationId: string,
    firmId: string,
    startQuarter: number,
    endQuarter: number,
  ) {
    const simId = new Types.ObjectId(simulationId);
    const frmId = new Types.ObjectId(firmId);

    const kpiHistories = await this.kpiHistoryModel.find({
      simulation: simId,
      firm: frmId,
      quarter: { $gte: startQuarter, $lte: endQuarter },
    }).sort({ quarter: 1 });

    const vmiTrend = kpiHistories.map((kpi) => ({
      quarter: kpi.quarter,
      vmi: {
        active: kpi.vmi?.active || false,
        setupCost: kpi.vmi?.setupCost || 0,
        ongoingCost: kpi.vmi?.ongoingCost || 0,
        totalCostThisQuarter: kpi.vmi?.totalCostThisQuarter || 0,
        retailerMode: kpi.vmi?.retailerMode || 'NORMAL',
        coverageMonths: kpi.vmi?.coverageMonths || 0,
        clearancePrevented: kpi.vmi?.clearancePrevented || false,
        panicPrevented: kpi.vmi?.panicPrevented || false,
        revenueProtected: kpi.vmi?.revenueProtected || 0,
        csiProtected: kpi.vmi?.csiProtected || 0,
        cumulativeTotalCost: kpi.vmi?.cumulativeTotalCost || 0,
        cumulativeRevenueProtected: kpi.vmi?.cumulativeRevenueProtected || 0,
        cumulativeNetBenefit: kpi.vmi?.cumulativeNetBenefit || 0,
      },
      costs: {
        vmiSetup: kpi.costs?.vmiSetup || 0,
        vmiOngoing: kpi.costs?.vmiOngoing || 0,
      },
    }));

    return {
      firmId,
      startQuarter,
      endQuarter,
      quarterCount: vmiTrend.length,
      trend: vmiTrend,
      summary: this.calculateVmiSummary(vmiTrend),
    };
  }

  /**
   * Calculate VMI summary statistics for trend analysis
   */
  private calculateVmiSummary(vmiTrend: any[]) {
    if (vmiTrend.length === 0) {
      return null;
    }

    const latestQuarter = vmiTrend[vmiTrend.length - 1];
    const totalSetupCost = vmiTrend.reduce((sum, q) => sum + (q.costs?.vmiSetup || 0), 0);
    const totalOngoingCost = vmiTrend.reduce((sum, q) => sum + (q.costs?.vmiOngoing || 0), 0);
    const avgCoverageMonths = vmiTrend.reduce((sum, q) => sum + (q.vmi?.coverageMonths || 0), 0) / vmiTrend.length;
    const clearancesPreventedCount = vmiTrend.filter((q) => q.vmi?.clearancePrevented).length;
    const panicsPreventedCount = vmiTrend.filter((q) => q.vmi?.panicPrevented).length;

    return {
      totalSetupCost,
      totalOngoingCost,
      totalCost: totalSetupCost + totalOngoingCost,
      cumulativeNetBenefit: latestQuarter.vmi?.cumulativeNetBenefit || 0,
      cumulativeRevenueProtected: latestQuarter.vmi?.cumulativeRevenueProtected || 0,
      avgCoverageMonths: Math.round(avgCoverageMonths * 100) / 100,
      clearancesPreventedCount,
      panicsPreventedCount,
      vmiActive: latestQuarter.vmi?.active || false,
    };
  }

  /**
   * Get intelligence reports for a quarter
   */
  async getIntelligenceReports(
    simulationId: string,
    firmId: string,
    quarter: number,
  ): Promise<IntelligenceReportDocument[]> {
    const simId = new Types.ObjectId(simulationId);
    const frmId = new Types.ObjectId(firmId);

    return this.intelReportModel.find({
      simulation: simId,
      firm: frmId,
      quarter,
    });
  }

  /**
   * Get warranty claims for a quarter
   */
  async getWarrantyClaims(
    simulationId: string,
    firmId: string,
    quarter: number,
  ): Promise<WarrantyClaimDocument[]> {
    const simId = new Types.ObjectId(simulationId);
    const frmId = new Types.ObjectId(firmId);

    return this.warrantyClaimModel.find({
      simulation: simId,
      firm: frmId,
      quarter,
    });
  }

  /**
   * Get competitor comparison data for a quarter
   */
  async getCompetitorComparison(
    simulationId: string,
    firmId: string,
    quarter: number,
  ) {
    const simId = new Types.ObjectId(simulationId);
    const frmId = new Types.ObjectId(firmId);

    const firmKpi = await this.kpiHistoryModel.findOne({
      simulation: simId,
      firm: frmId,
      quarter,
    });

    const allKpis = await this.kpiHistoryModel.find({
      simulation: simId,
      quarter,
    });

    // Build a full peers array sorted by BSC overall (revenue fallback)
    // Each object is flat so the frontend can read p.grossMarginPct, p.perfectOrder etc.
    const sortedByScore = [...allKpis].sort(
      (a, b) =>
        (b.bsc?.overall || b.financial?.revenue || 0) -
        (a.bsc?.overall || a.financial?.revenue || 0),
    );

    const peers = sortedByScore.map((kpi, index) => {
      const isCurrentFirm = kpi.firm.toString() === firmId;
      const rev = kpi.financial?.revenue || 0;
      const cogs = kpi.financial?.cogs || 0;

      return {
        firmId: kpi.firm.toString(),
        rank: index + 1,
        isCurrentFirm,
        isYou: isCurrentFirm,

        // Financial — flat for direct frontend reads
        revenue: rev,
        netIncome: kpi.financial?.netIncome || 0,
        grossMarginPct:
          kpi.financial?.grossMarginPct ?? (rev > 0 ? ((rev - cogs) / rev) * 100 : 0),

        // Customer
        marketShare: kpi.customer?.marketShare || 0,
        csi: kpi.customer?.csi || 0,
        fillRate: kpi.customer?.fillRate || 0,

        // Operations
        perfectOrder: kpi.operations?.perfectOrder || 0,
        mape: kpi.operations?.mape || 0,

        // BSC
        score: kpi.bsc?.overall || 0,
        bscOverall: kpi.bsc?.overall || 0,
        grade: kpi.bsc?.grade || '—',
      };
    });

    // Keep existing ranking arrays for dashboard backward-compat
    const rankings = {
      byRevenue: [...allKpis]
        .sort((a, b) => (b.financial?.revenue || 0) - (a.financial?.revenue || 0))
        .map((kpi, index) => ({
          firmId: kpi.firm.toString(),
          rank: index + 1,
          revenue: kpi.financial?.revenue,
          isCurrentFirm: kpi.firm.toString() === firmId,
        })),
      byMarketShare: [...allKpis]
        .sort((a, b) => (b.customer?.marketShare || 0) - (a.customer?.marketShare || 0))
        .map((kpi, index) => ({
          firmId: kpi.firm.toString(),
          rank: index + 1,
          marketShare: kpi.customer?.marketShare,
          isCurrentFirm: kpi.firm.toString() === firmId,
        })),
      byCsi: [...allKpis]
        .sort((a, b) => (b.customer?.csi || 0) - (a.customer?.csi || 0))
        .map((kpi, index) => ({
          firmId: kpi.firm.toString(),
          rank: index + 1,
          csi: kpi.customer?.csi,
          isCurrentFirm: kpi.firm.toString() === firmId,
        })),
      byFillRate: [...allKpis]
        .sort((a, b) => (b.customer?.fillRate || 0) - (a.customer?.fillRate || 0))
        .map((kpi, index) => ({
          firmId: kpi.firm.toString(),
          rank: index + 1,
          fillRate: kpi.customer?.fillRate,
          isCurrentFirm: kpi.firm.toString() === firmId,
        })),
    };

    return {
      currentFirmId: firmId,
      quarter,
      peers,
      firmData: firmKpi,
      benchmarks: rankings,
      totalFirms: allKpis.length,
    };
  }

  /**
   * Get balanced scorecard for a quarter
   */
  async getBalancedScorecard(
    simulationId: string,
    firmId: string,
    quarter: number,
  ) {
    const simId = new Types.ObjectId(simulationId);
    const frmId = new Types.ObjectId(firmId);

    const kpiData = await this.kpiHistoryModel.findOne({
      simulation: simId,
      firm: frmId,
      quarter,
    });

    if (!kpiData) {
      return null;
    }

    return {
      quarter,
      firmId: firmId.toString(),
      scorecard: kpiData.bsc,
      allMetrics: {
        financial: kpiData.financial,
        customer: kpiData.customer,
        operations: kpiData.operations,
        inventory: kpiData.inventory,
        learning: kpiData.learning,
      },
    };
  }

  /**
   * Get financial summary for all firms in a quarter
   */
  async getFinancialSummary(simulationId: string, quarter: number) {
    const simId = new Types.ObjectId(simulationId);

    const kpis = await this.kpiHistoryModel.find({
      simulation: simId,
      quarter,
    });

    const summary = kpis.map((kpi) => ({
      firmId: kpi.firm.toString(),
      revenue: kpi.financial?.revenue,
      netIncome: kpi.financial?.netIncome,
      grossMarginPct: kpi.financial?.grossMarginPct,
      csi: kpi.customer?.csi,
      marketShare: kpi.customer?.marketShare,
      fillRate: kpi.customer?.fillRate,
      cogs: kpi.financial?.cogs,
      operatingExpenses: kpi.financial?.operatingExpenses,
    }));

    // Calculate totals
    const totals = {
      totalRevenue: summary.reduce((sum, s) => sum + (s.revenue || 0), 0),
      avgNetIncome:
        summary.reduce((sum, s) => sum + (s.netIncome || 0), 0) / summary.length,
      avgGrossMarginPct:
        summary.reduce((sum, s) => sum + (s.grossMarginPct || 0), 0) /
        summary.length,
      avgCsi:
        summary.reduce((sum, s) => sum + (s.csi || 0), 0) / summary.length,
      avgFillRate:
        summary.reduce((sum, s) => sum + (s.fillRate || 0), 0) / summary.length,
    };

    return {
      quarter,
      firmCount: summary.length,
      firmSummaries: summary,
      totals,
    };
  }

  /**
   * Get green score history for a firm
   */
  async getGreenScoreHistory(
    simulationId: string,
    firmId: string,
  ): Promise<GreenScoreHistoryDocument[]> {
    const simId = new Types.ObjectId(simulationId);
    const frmId = new Types.ObjectId(firmId);

    return this.greenScoreHistoryModel.find({
      simulation: simId,
      firm: frmId,
    });
  }
}