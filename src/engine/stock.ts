import type {
  CartItem,
  ConfigSelections,
  IngredientStockItem,
  MenuFixture,
  MenuOption,
  OptionGroup,
} from "@/types/order";

export interface StockShortage {
  ingredientId: string;
  name: string;
  missing: number;
}

export interface StockCheckResult {
  ok: boolean;
  shortages: StockShortage[];
  message: string | null;
  availableByIngredient: Record<string, number>;
  requiredByIngredient: Record<string, number>;
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

export function computeConfigIngredients(
  selections: ConfigSelections,
  groups: OptionGroup[]
): Record<string, number> {
  const lookup = buildOptionLookup(groups);
  const usage: Record<string, number> = {};

  for (const [optionId, rawQty] of Object.entries(selections)) {
    const qty = Math.max(0, rawQty);
    if (qty === 0) {
      continue;
    }
    const option = lookup.get(optionId);
    if (!option) {
      continue;
    }
    for (const [ingredientId, perUnit] of Object.entries(option.ingredients)) {
      if (perUnit <= 0) {
        continue;
      }
      usage[ingredientId] = (usage[ingredientId] ?? 0) + perUnit * qty;
    }
  }

  return usage;
}

export function computeLineIngredients(
  selections: ConfigSelections,
  quantity: number,
  groups: OptionGroup[]
): Record<string, number> {
  const safeQty = Math.max(0, quantity);
  const unitUsage = computeConfigIngredients(selections, groups);
  const totalUsage: Record<string, number> = {};

  for (const [ingredientId, amount] of Object.entries(unitUsage)) {
    totalUsage[ingredientId] = amount * safeQty;
  }

  return totalUsage;
}

export function computeRemainingStock(
  ingredients: IngredientStockItem[],
  soldByIngredient: Record<string, number>,
  cartItems: CartItem[],
  groups: OptionGroup[],
  excludeCartItemId?: string
): Record<string, number> {
  const remaining: Record<string, number> = {};

  for (const ingredient of ingredients) {
    const sold = Math.max(0, soldByIngredient[ingredient.id] ?? 0);
    remaining[ingredient.id] = Math.max(0, ingredient.initialStock - sold);
  }

  for (const item of cartItems) {
    if (item.status !== "active") {
      continue;
    }
    if (excludeCartItemId && item.id === excludeCartItemId) {
      continue;
    }

    const itemUsage = computeLineIngredients(
      item.selections,
      item.quantity,
      groups
    );
    for (const [ingredientId, used] of Object.entries(itemUsage)) {
      if (ingredientId in remaining) {
        remaining[ingredientId] = remaining[ingredientId] - used;
      }
    }
  }

  for (const ingredient of ingredients) {
    remaining[ingredient.id] = Math.max(0, remaining[ingredient.id]);
  }

  return remaining;
}

export function checkStockAvailability(
  selections: ConfigSelections,
  quantity: number,
  menu: Pick<MenuFixture, "groups" | "ingredients">,
  soldByIngredient: Record<string, number>,
  cartItems: CartItem[],
  editingCartItemId?: string
): StockCheckResult {
  const availableByIngredient = computeRemainingStock(
    menu.ingredients,
    soldByIngredient,
    cartItems,
    menu.groups,
    editingCartItemId
  );
  const requiredByIngredient = computeLineIngredients(
    selections,
    quantity,
    menu.groups
  );

  const shortages: StockShortage[] = [];
  for (const ingredient of menu.ingredients) {
    const required = requiredByIngredient[ingredient.id] ?? 0;
    const available = availableByIngredient[ingredient.id] ?? 0;
    if (required > available) {
      shortages.push({
        ingredientId: ingredient.id,
        name: ingredient.name,
        missing: required - available,
      });
    }
  }

  const message =
    shortages.length > 0
      ? `Short: ${shortages.map((s) => `${s.missing} ${s.name}`).join(", ")}`
      : null;

  return {
    ok: shortages.length === 0,
    shortages,
    message,
    availableByIngredient,
    requiredByIngredient,
  };
}

export function getMaxAddableForOption(
  optionId: string,
  currentSelections: ConfigSelections,
  itemQuantity: number,
  menu: Pick<MenuFixture, "groups" | "ingredients">,
  soldByIngredient: Record<string, number>,
  cartItems: CartItem[],
  editingCartItemId?: string
): number {
  const lookup = buildOptionLookup(menu.groups);
  const option = lookup.get(optionId);
  if (!option) {
    return 0;
  }

  const ingredientEntries = Object.entries(option.ingredients).filter(
    ([, perUnit]) => perUnit > 0
  );
  if (ingredientEntries.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  const safeItemQty = Math.max(1, itemQuantity);
  const available = computeRemainingStock(
    menu.ingredients,
    soldByIngredient,
    cartItems,
    menu.groups,
    editingCartItemId
  );
  const draftUsage = computeLineIngredients(
    currentSelections,
    safeItemQty,
    menu.groups
  );

  let maxAddable = Number.POSITIVE_INFINITY;
  for (const [ingredientId, perUnit] of ingredientEntries) {
    const remainingAfterDraft =
      (available[ingredientId] ?? 0) - (draftUsage[ingredientId] ?? 0);
    const possible = Math.max(
      0,
      Math.floor(remainingAfterDraft / (perUnit * safeItemQty))
    );
    if (possible < maxAddable) {
      maxAddable = possible;
    }
  }

  return maxAddable;
}
