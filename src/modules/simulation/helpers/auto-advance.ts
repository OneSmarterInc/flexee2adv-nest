// ============================================================================
// FILE: src/modules/simulation/helpers/auto-advance.ts
// ============================================================================
// Auto-advance logic: if a simulation's quarter window has expired
// (quarterEndsAt < now), carry forward missing decisions and trigger
// advanceQuarter, then reload the document.
// ============================================================================

import { Model, Types } from 'mongoose';
import {
  SimulationDocument,
  FirmDocument,
  DecisionDocument,
  DecisionStatus,
} from '@/entities/index.entity';

export interface AutoAdvanceContext {
  decisionModel: Model<DecisionDocument>;
  firmModel: Model<FirmDocument>;
  simulationModel: Model<any>;
  advanceQuarter: (simulationId: string) => Promise<any>;
}

/**
 * Check if a simulation's quarter window has expired. If so:
 *   1. Carry forward missing decisions (UNSUBMITTED → SUBMITTED)
 *   2. Trigger advanceQuarter()
 *   3. Return { advanced: true, fromQuarter, toQuarter, carriedForwardFirms }
 *
 * If the window hasn't expired or autoAdvance is disabled:
 *   Return { advanced: false }
 */
export async function maybeAutoAdvance(
  simulation: SimulationDocument,
  context: AutoAdvanceContext,
): Promise<{
  advanced: boolean;
  fromQuarter?: number;
  toQuarter?: number;
  carriedForwardFirms?: string[];
}> {
  // No window set — skip
  if (!simulation.quarterEndsAt) {
    return { advanced: false };
  }

  // Window hasn't expired — skip
  if (new Date() < new Date(simulation.quarterEndsAt)) {
    return { advanced: false };
  }

  // Window expired — auto-advance
  try {
    const fromQuarter = simulation.currentQuarter;
    const firms = await context.firmModel.find({
      simulation: simulation._id,
    });

    // Carry forward missing decisions
    const carriedForwardFirms: string[] = [];
    for (const firm of firms) {
      const decision = await context.decisionModel.findOne({
        firm: firm._id,
        quarter: fromQuarter,
      });

      if (!decision || decision.status === DecisionStatus.DRAFT) {
        // Create or update to SUBMITTED
        if (!decision) {
          await context.decisionModel.create({
            firm: firm._id,
            simulation: simulation._id as Types.ObjectId,
            quarter: fromQuarter,
            status: DecisionStatus.SUBMITTED,
            decisions: {},
            submittedAt: new Date(),
          });
        } else {
          decision.status = DecisionStatus.SUBMITTED;
          decision.submittedAt = new Date();
          await decision.save();
        }
        carriedForwardFirms.push(firm.firmNumber.toString());
      }
    }

    // Advance the quarter
    await context.advanceQuarter((simulation._id as Types.ObjectId).toString());

    return {
      advanced: true,
      fromQuarter,
      toQuarter: fromQuarter + 1,
      carriedForwardFirms,
    };
  } catch (error) {
    console.error('[maybeAutoAdvance] Error:', error);
    return { advanced: false };
  }
}
