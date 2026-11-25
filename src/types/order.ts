export type ConfigSelections = Record<string, number>;

export type IngredientConsumption = Record<string, number>;

export interface MenuOption {
  id: string;
  name: string;
  pricePoisha: number;
  ingredients: IngredientConsumption;
}

export interface OptionGroup {
  id: string;
  name: string;
  min?: number;
  max?: number;
  step?: number;
  maxDistinct?: number;
  maxPerOption?: number;
  options: MenuOption[];
}

export interface RequiresRule {
  id: string;
  type: "requires";
  optionId: string;
  requiredAnyOf: string[];
  message?: string;
}

export interface ExcludesRule {
  id: string;
  type: "excludes";
  optionId: string;
  excludedOptionIds: string[];
  message?: string;
}

export interface OverrideLimitRule {
  id: string;
  type: "overrideLimit";
  triggerOptionId: string;
  targetGroupId: string;
  max?: number;
  min?: number;
  message?: string;
}

export type MenuRule = RequiresRule | ExcludesRule | OverrideLimitRule;

export interface RuleViolation {
  id: string;
  kind: "group" | "rule";
  message: string;
}

export interface IngredientStockItem {
  id: string;
  name: string;
  initialStock: number;
}

export interface ExtrasDealPromo {
  id: string;
  name: string;
  type: "buyXGetCheapestFree";
  groupId: string;
  everyUnits: number;
}

export interface ComboDiscountPromo {
  id: string;
  name: string;
  type: "groupComboPercent";
  conditions: Array<{
    groupId: string;
    minUnits: number;
  }>;
  percentOff: number;
}

export interface ThresholdCartPromo {
  id: string;
  name: string;
  type: "cartThresholdFixed";
  minSubtotalPoisha: number;
  discountPoisha: number;
}

export interface CouponCartPromo {
  id: string;
  name: string;
  type: "cartCouponPercent";
  code: string;
  percentOff: number;
  maxDiscountPoisha: number;
  beforeHourDhaka: number;
}

export type UnitPromo = ExtrasDealPromo | ComboDiscountPromo;
export type CartPromo = ThresholdCartPromo | CouponCartPromo;

export interface PromoConfig {
  unitPromos: UnitPromo[];
  cartPromos: CartPromo[];
  vatPercent: number;
}

export interface MenuFixture {
  productId: string;
  productName: string;
  basePricePoisha: number;
  currency: "BDT";
  maxItemQuantity: number;
  groups: OptionGroup[];
  rules: MenuRule[];
  ingredients: IngredientStockItem[];
  promos: PromoConfig;
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  selections: ConfigSelections;
  createdAt: string;
  expiresAt: string;
  status: "active" | "expired";
}

export interface CartState {
  items: CartItem[];
  couponCode: string | null;
  version: number;
}

export interface PricingCartLineInput {
  id?: string;
  quantity: number;
  selections: ConfigSelections;
}

export interface PricingCartInput {
  items: PricingCartLineInput[];
  couponCode?: string | null;
}

export interface PricedOrderLine {
  productId: string;
  productName: string;
  quantity: number;
  selections: ConfigSelections;
  unitSubtotalPoisha: number;
  extrasDiscountPoisha: number;
  comboDiscountPoisha: number;
  unitPricePoisha: number;
  lineTotalPoisha: number;
}

export interface OrderCouponInfo {
  code: string | null;
  status: "applied" | "rejected" | "none";
  reason: string | null;
}

export interface OrderPricingSummary {
  subtotalPoisha: number;
  appliedPromoId: string | null;
  cartDiscountPoisha: number;
  discountedSubtotalPoisha: number;
  vatPoisha: number;
  payablePoisha: number;
  payableBdt: number;
}

export type PaymentMethod = "card" | "bkash" | "cash";

export interface Order {
  id: string;
  createdAt: string;
  paymentMethod: PaymentMethod;
  moneyUnit: "poisha";
  items: PricedOrderLine[];
  coupon: OrderCouponInfo;
  pricing: OrderPricingSummary;
}

export interface SeedOrderLine {
  qty: number;
  options: ConfigSelections;
}

export interface SeedOrder {
  id: string;
  createdAt: string;
  paymentMethod: PaymentMethod;
  couponCode: string | null;
  lines: SeedOrderLine[];
}

export interface SeedOrdersFile {
  schemaVersion: number;
  currency: string;
  note: string;
  orders: SeedOrder[];
}
