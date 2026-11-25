import type {
  ConfigSelections,
  MenuOption,
  MenuRule,
  OptionGroup,
  OverrideLimitRule,
  RuleViolation,
} from "@/types/order";

export interface EffectiveGroupLimits {
  min: number | undefined;
  max: number | undefined;
  minOverrideRule: OverrideLimitRule | null;
  maxOverrideRule: OverrideLimitRule | null;
}

function buildOptionLookup(groups: OptionGroup[]): Map<string, MenuOption> {
  const lookup = new Map<string, MenuOption>();
  for (const group of groups) {
    for (const option of group.options) {
      lookup.set(option.id, option);
    }
  }
  return lookup;
}

export function getEffectiveGroupLimits(
  group: OptionGroup,
  config: ConfigSelections,
  rules: MenuRule[]
): EffectiveGroupLimits {
  let min = group.min;
  let max = group.max;
  let minOverrideRule: OverrideLimitRule | null = null;
  let maxOverrideRule: OverrideLimitRule | null = null;

  for (const rule of rules) {
    if (rule.type !== "overrideLimit" || rule.targetGroupId !== group.id) {
      continue;
    }
    const triggerQty = config[rule.triggerOptionId] ?? 0;
    if (triggerQty <= 0) {
      continue;
    }
    if (rule.min !== undefined) {
      min = rule.min;
      minOverrideRule = rule;
    }
    if (rule.max !== undefined) {
      max = rule.max;
      maxOverrideRule = rule;
    }
  }

  return { min, max, minOverrideRule, maxOverrideRule };
}

function formatOptionName(
  optionLookup: Map<string, MenuOption>,
  optionId: string
): string {
  return optionLookup.get(optionId)?.name ?? optionId;
}

function formatRangeSuffix(min?: number, max?: number): string {
  if (min !== undefined && max !== undefined) {
    return `${min}-${max}`;
  }
  if (min !== undefined) {
    return `at least ${min}`;
  }
  if (max !== undefined) {
    return `at most ${max}`;
  }
  return "";
}

export function validate(
  config: ConfigSelections,
  groups: OptionGroup[],
  rules: MenuRule[]
): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const optionLookup = buildOptionLookup(groups);

  for (const group of groups) {
    const { min, max, minOverrideRule, maxOverrideRule } =
      getEffectiveGroupLimits(group, config, rules);

    let totalQty = 0;
    let distinctCount = 0;

    for (const option of group.options) {
      const qty = Math.max(0, config[option.id] ?? 0);
      totalQty += qty;
      if (qty > 0) {
        distinctCount += 1;
      }

      if (group.maxPerOption !== undefined && qty > group.maxPerOption) {
        violations.push({
          id: group.id,
          kind: "group",
          message: `${option.name} in ${group.name} cannot exceed ${group.maxPerOption}`,
        });
      }
    }

    if (min !== undefined && totalQty < min) {
      violations.push({
        id: minOverrideRule ? minOverrideRule.id : group.id,
        kind: minOverrideRule ? "rule" : "group",
        message:
          minOverrideRule?.message ??
          `${group.name} requires at least ${min} selection${min === 1 ? "" : "s"}`,
      });
    }

    if (max !== undefined && totalQty > max) {
      const triggerName = maxOverrideRule
        ? formatOptionName(optionLookup, maxOverrideRule.triggerOptionId)
        : null;
      violations.push({
        id: maxOverrideRule ? maxOverrideRule.id : group.id,
        kind: maxOverrideRule ? "rule" : "group",
        message:
          maxOverrideRule?.message ??
          (triggerName
            ? `${group.name} max is ${max} when ${triggerName} is selected`
            : `${group.name} allows at most ${max} selection${max === 1 ? "" : "s"}`),
      });
    }

    if (group.step !== undefined && group.step > 0 && totalQty % group.step !== 0) {
      const rangeText = formatRangeSuffix(min, max);
      violations.push({
        id: group.id,
        kind: "group",
        message: rangeText
          ? `${group.name} total must be ${rangeText} in steps of ${group.step}`
          : `${group.name} total must be a multiple of ${group.step}`,
      });
    }

    if (group.maxDistinct !== undefined && distinctCount > group.maxDistinct) {
      violations.push({
        id: group.id,
        kind: "group",
        message: `${group.name} allows at most ${group.maxDistinct} distinct options`,
      });
    }
  }

  for (const rule of rules) {
    if (rule.type === "requires") {
      if ((config[rule.optionId] ?? 0) <= 0) {
        continue;
      }
      const satisfied = rule.requiredAnyOf.some(
        (targetId) => (config[targetId] ?? 0) > 0
      );
      if (!satisfied) {
        const optionName = formatOptionName(optionLookup, rule.optionId);
        const requiredNames = rule.requiredAnyOf
          .map((id) => formatOptionName(optionLookup, id))
          .join(" or ");
        violations.push({
          id: rule.id,
          kind: "rule",
          message: rule.message ?? `${optionName} requires ${requiredNames}`,
        });
      }
    } else if (rule.type === "excludes") {
      if ((config[rule.optionId] ?? 0) <= 0) {
        continue;
      }
      const conflicts = rule.excludedOptionIds.filter(
        (targetId) => (config[targetId] ?? 0) > 0
      );
      if (conflicts.length > 0) {
        const optionName = formatOptionName(optionLookup, rule.optionId);
        const conflictNames = conflicts
          .map((id) => formatOptionName(optionLookup, id))
          .join(" or ");
        violations.push({
          id: rule.id,
          kind: "rule",
          message:
            rule.message ??
            `${optionName} cannot be combined with ${conflictNames}`,
        });
      }
    }
  }

  return violations;
}
