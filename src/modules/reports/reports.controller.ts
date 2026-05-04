import {
  Controller,
  Get,
  Param,
  BadRequestException,
  NotFoundException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  /**
   * Get VMI data for a specific quarter
   */
  @Get('vmi/:simulationId/:firmId/:quarter')
  async getVmiData(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Param('quarter') quarter: string,
  ) {
    const quarterNum = parseInt(quarter);
    if (isNaN(quarterNum) || quarterNum < 1) {
      throw new BadRequestException('Quarter must be a positive number');
    }

    const vmiData = await this.reportsService.getVmiData(
      simulationId,
      firmId,
      quarterNum,
    );

    if (!vmiData) {
      throw new NotFoundException(
        `No VMI data found for simulation ${simulationId}, firm ${firmId}, quarter ${quarterNum}`,
      );
    }

    return vmiData;
  }

  /**
   * Get VMI trend data for a quarter range
   */
  @Get('vmi/:simulationId/:firmId/:startQuarter/:endQuarter')
  async getVmiTrend(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Param('startQuarter') startQuarter: string,
    @Param('endQuarter') endQuarter: string,
  ) {
    const start = parseInt(startQuarter);
    const end = parseInt(endQuarter);

    if (isNaN(start) || isNaN(end) || start > end) {
      throw new BadRequestException(
        'Invalid quarter range. Start must be <= End',
      );
    }

    const vmiTrend = await this.reportsService.getVmiTrend(
      simulationId,
      firmId,
      start,
      end,
    );

    return vmiTrend;
  }

  /**
   * Get KPI history for specific quarters
   */
  @Get('kpi-history/:simulationId/:firmId/:startQuarter/:endQuarter')
  async getKpiHistoryByRange(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Param('startQuarter') startQuarter: string,
    @Param('endQuarter') endQuarter: string,
  ) {
    const start = parseInt(startQuarter);
    const end = parseInt(endQuarter);

    if (isNaN(start) || isNaN(end) || start > end) {
      throw new BadRequestException(
        'Invalid quarter range. Start must be <= End',
      );
    }

    const history = await this.reportsService.getKpiHistoryByRange(
      simulationId,
      firmId,
      start,
      end,
    );
    return history;
  }

  /**
   * Get KPI history for a firm
   */
  @Get('kpi-history/:simulationId/:firmId')
  async getKpiHistory(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
  ) {
    const history = await this.reportsService.getKpiHistory(
      simulationId,
      firmId,
    );
    return history;
  }

  /**
   * Get intelligence reports for a firm
   */
  @Get('intelligence/:simulationId/:firmId/:quarter')
  async getIntelligenceReports(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Param('quarter') quarter: string,
  ) {
    const quarterNum = parseInt(quarter);
    if (isNaN(quarterNum) || quarterNum < 1) {
      throw new BadRequestException('Quarter must be a positive number');
    }

    const reports = await this.reportsService.getIntelligenceReports(
      simulationId,
      firmId,
      quarterNum,
    );

    return reports;
  }

  /**
   * Get warranty claims for a firm
   */
  @Get('warranty-claims/:simulationId/:firmId/:quarter')
  async getWarrantyClaims(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Param('quarter') quarter: string,
  ) {
    const quarterNum = parseInt(quarter);
    if (isNaN(quarterNum) || quarterNum < 1) {
      throw new BadRequestException('Quarter must be a positive number');
    }

    const claims = await this.reportsService.getWarrantyClaims(
      simulationId,
      firmId,
      quarterNum,
    );

    return claims;
  }

  /**
   * Get competitor comparison report
   */
  @Get('competitor-comparison/:simulationId/:firmId/:quarter')
  async getCompetitorComparison(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Param('quarter') quarter: string,
  ) {
    const quarterNum = parseInt(quarter);
    if (isNaN(quarterNum) || quarterNum < 1) {
      throw new BadRequestException('Quarter must be a positive number');
    }

    const comparison = await this.reportsService.getCompetitorComparison(
      simulationId,
      firmId,
      quarterNum,
    );

    return comparison;
  }

  /**
   * Get balanced scorecard for a firm
   */
  @Get('balanced-scorecard/:simulationId/:firmId/:quarter')
  async getBalancedScorecard(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
    @Param('quarter') quarter: string,
  ) {
    const quarterNum = parseInt(quarter);
    if (isNaN(quarterNum) || quarterNum < 1) {
      throw new BadRequestException('Quarter must be a positive number');
    }

    const scorecard = await this.reportsService.getBalancedScorecard(
      simulationId,
      firmId,
      quarterNum,
    );

    if (!scorecard) {
      throw new NotFoundException(
        `Balanced Scorecard not found for firm ${firmId}, quarter ${quarterNum}`,
      );
    }

    return scorecard;
  }

  /**
   * Get financial summary for comparison across firms
   */
  @Get('financial-summary/:simulationId/:quarter')
  async getFinancialSummary(
    @Param('simulationId') simulationId: string,
    @Param('quarter') quarter: string,
  ) {
    const quarterNum = parseInt(quarter);
    if (isNaN(quarterNum) || quarterNum < 1) {
      throw new BadRequestException('Quarter must be a positive number');
    }

    const summary = await this.reportsService.getFinancialSummary(
      simulationId,
      quarterNum,
    );

    return summary;
  }

  /**
   * Get green score history for a firm
   */
  @Get('green-score/:simulationId/:firmId')
  async getGreenScoreHistory(
    @Param('simulationId') simulationId: string,
    @Param('firmId') firmId: string,
  ) {
    const history = await this.reportsService.getGreenScoreHistory(
      simulationId,
      firmId,
    );

    return history;
  }
}