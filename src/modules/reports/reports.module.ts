import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { TenqReportController } from './tenq-report.controller';
import { TenqReportService } from './tenq-report.service';
import {
  KpiHistory,
  KpiHistorySchema,
  IntelligenceReport,
  IntelligenceReportSchema,
  WarrantyClaim,
  WarrantyClaimSchema,
  TenQReport,
  TenQReportSchema,
  GreenScoreHistory,
  GreenScoreHistorySchema,
} from '../../entities/index.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KpiHistory.name, schema: KpiHistorySchema },
      { name: IntelligenceReport.name, schema: IntelligenceReportSchema },
      { name: WarrantyClaim.name, schema: WarrantyClaimSchema },
      { name: TenQReport.name, schema: TenQReportSchema },
      { name: GreenScoreHistory.name, schema: GreenScoreHistorySchema },
    ]),
  ],
  controllers: [ReportsController, TenqReportController],
  providers: [ReportsService, TenqReportService],
  exports: [ReportsService, TenqReportService],
})
export class ReportsModule {}