// ============================================================================
// FILE: src/modules/simulation/helpers/module-schedule.ts
// ============================================================================
// Helpers for working with the rich-shape ModuleSchedule. No legacy support
// — Corporate edition starts fresh with the DA-aligned shape.
//
// What's here:
//   buildAllOpenDefault   — every module enabled, all unlock at Q4
//   buildAllOffDefault    — every module disabled
//   buildScheduleFromDto  — construct a schedule from faculty input
//   mergeScheduleUpdate   — merge a partial update into existing schedule
//   syncFeaturesFromSchedule — flip FeatureToggles for modules past their unlock
//   getScheduleStatus     — derive OPEN/SCHEDULED/LOCKED per module for the UI
// ============================================================================

import {
  ModuleSchedule,
  ModuleScheduleMode,
  AdvancedModuleId,
} from '@/entities/index.entity';

// Canonical display/iteration order for the nine advanced modules.
// The `order` field on each AdvancedModuleConfig is derived from this.
export const ADVANCED_MODULE_ORDER: AdvancedModuleId[] = [
  'vmi',
  'regionalDCs',
  'multiCarrierSelection',
  'capacityExpansion',
  'intelligenceCenter',
  'returnsGreenScore',
  'analyticsMode',
  'productInnovation',
  'marketExpansion',
];

const orderIndex = (id: AdvancedModuleId): number =>
  ADVANCED_MODULE_ORDER.indexOf(id) + 1;

const FIRST_DECISION_QUARTER = 4;

/**
 * Every module enabled, all unlocking at Q4 (first decision quarter).
 * Used when faculty creates a sim without specifying any schedule.
 */
export function buildAllOpenDefault(): ModuleSchedule {
  return {
    mode: ModuleScheduleMode.ALL_OPEN,
    modules: ADVANCED_MODULE_ORDER.map((id) => ({
      moduleId: id,
      order: orderIndex(id),
      unlocksAtQuarter: FIRST_DECISION_QUARTER,
      enabled: true,
    })),
  };
}

/**
 * Every module disabled. Useful for a "blank slate" template where
 * faculty wants to opt modules in one at a time.
 */
export function buildAllOffDefault(): ModuleSchedule {
  return {
    mode: ModuleScheduleMode.CUSTOM,
    modules: ADVANCED_MODULE_ORDER.map((id) => ({
      moduleId: id,
      order: orderIndex(id),
      unlocksAtQuarter: FIRST_DECISION_QUARTER,
      enabled: false,
    })),
  };
}

/**
 * Build a schedule from faculty input. Any module not mentioned in the DTO
 * gets the all-open default (enabled, unlocks at Q4). Unknown moduleIds in
 * the DTO are dropped. Mode defaults to CUSTOM if the DTO doesn't say.
 */
export function buildScheduleFromDto(
  dto?: {
    mode?: string;
    modules?: Array<{
      moduleId: string;
      order?: number;
      unlocksAtQuarter?: number;
      enabled?: boolean;
    }>;
  },
): ModuleSchedule {
  if (!dto || !Array.isArray(dto.modules) || dto.modules.length === 0) {
    return buildAllOpenDefault();
  }

  const byId = new Map(
    dto.modules
      .filter((m) =>
        ADVANCED_MODULE_ORDER.includes(m.moduleId as AdvancedModuleId),
      )
      .map((m) => [m.moduleId as AdvancedModuleId, m]),
  );

  return {
    mode: (dto.mode as ModuleScheduleMode) ?? ModuleScheduleMode.CUSTOM,
    modules: ADVANCED_MODULE_ORDER.map((id) => {
      const fromDto = byId.get(id);
      return {
        moduleId: id,
        order: orderIndex(id),
        unlocksAtQuarter: fromDto?.unlocksAtQuarter ?? FIRST_DECISION_QUARTER,
        enabled: fromDto?.enabled ?? !!fromDto, // explicit OR present-in-dto
      };
    }),
  };
}

/**
 * Merge a partial update into an existing schedule. Used by PATCH endpoints.
 * Only modules present in the DTO are touched; everything else stays.
 */
export function mergeScheduleUpdate(
  current: ModuleSchedule,
  update: {
    mode?: string;
    modules?: Array<{
      moduleId: string;
      unlocksAtQuarter?: number;
      enabled?: boolean;
    }>;
  },
): ModuleSchedule {
  const incomingById = new Map(
    (update.modules ?? []).map((m) => [m.moduleId, m]),
  );
  return {
    mode: (update.mode as ModuleScheduleMode) ?? current.mode,
    modules: current.modules.map((m) => {
      const incoming = incomingById.get(m.moduleId);
      if (!incoming) return m;
      return {
        ...m,
        unlocksAtQuarter: incoming.unlocksAtQuarter ?? m.unlocksAtQuarter,
        enabled: incoming.enabled ?? m.enabled,
      };
    }),
  };
}

/**
 * Sync the FeatureToggles object from the schedule. Any enabled module
 * whose unlock quarter has arrived flips its feature toggle to true.
 * Idempotent — never closes an open module.
 */
export function syncFeaturesFromSchedule(
  schedule: ModuleSchedule,
  features: Record<string, boolean>,
  currentQuarter: number,
): { features: Record<string, boolean>; opened: string[] } {
  const opened: string[] = [];
  const next = { ...features };

  for (const m of schedule.modules) {
    if (!m.enabled) continue;
    if (currentQuarter < m.unlocksAtQuarter) continue;
    if (next[m.moduleId] === true) continue;

    next[m.moduleId] = true;
    opened.push(m.moduleId);
  }

  return { features: next, opened };
}

/**
 * Derive per-module status for the cockpit UI.
 *   OPEN      — feature toggle is on
 *   SCHEDULED — enabled, unlock quarter is in the future
 *   LOCKED    — disabled
 */
export function getScheduleStatus(
  schedule: ModuleSchedule,
  features: Record<string, boolean>,
  currentQuarter: number,
) {
  return schedule.modules.map((m) => {
    const isOpen = features[m.moduleId] === true;
    let state: 'OPEN' | 'SCHEDULED' | 'LOCKED' = 'LOCKED';
    if (!m.enabled) {
      state = 'LOCKED';
    } else if (isOpen) {
      state = 'OPEN';
    } else if (m.unlocksAtQuarter > currentQuarter) {
      state = 'SCHEDULED';
    }
    return {
      moduleId: m.moduleId,
      order: m.order,
      unlocksAtQuarter: m.unlocksAtQuarter,
      enabled: m.enabled,
      currentlyOpen: isOpen,
      state,
      quartersUntilOpen:
        state === 'SCHEDULED' ? m.unlocksAtQuarter - currentQuarter : 0,
    };
  });
}
