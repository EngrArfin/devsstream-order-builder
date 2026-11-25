import { describe, expect, it } from "vitest";
import { MENU_FIXTURE } from "@/mocks/menuFixture";
import type { MenuRule, OptionGroup } from "@/types/order";
import { getEffectiveGroupLimits, validate } from "./rules";

const { groups, rules } = MENU_FIXTURE;

describe("Rules engine (validate)", () => {
  it("accepts valid configurations A, B, C and mixed Scrambled x1 + Fried x1", () => {
    const configA = { toast: 1, scrambled: 2, sausage: 1, ketchup: 1 };
    const configB = {
      croissant: 1,
      omelette: 2,
      fried: 2,
      sausage: 1,
      bacon: 1,
      hashbrown: 1,
      mushroom: 1,
      hollandaise: 1,
    };
    const configC = {
      paratha: 1,
      fried: 2,
      tofu: 1,
      cheese: 2,
      beans: 1,
      mushroom: 1,
      chili: 1,
    };
    const mixedEggs = { toast: 1, scrambled: 1, fried: 1, sausage: 1 };

    expect(validate(configA, groups, rules)).toEqual([]);
    expect(validate(configB, groups, rules)).toEqual([]);
    expect(validate(configC, groups, rules)).toEqual([]);
    expect(validate(mixedEggs, groups, rules)).toEqual([]);
  });

  it("TC-01: blocks Scrambled x3 for breaking eggs step 2", () => {
    const violations = validate(
      { toast: 1, scrambled: 3, sausage: 1 },
      groups,
      rules
    );

    expect(violations).toHaveLength(1);
    expect(violations[0].id).toBe("eggs");
    expect(violations[0].message.toLowerCase()).toContain("steps of 2");
  });

  it("TC-02: blocks Croissant + 3 extras via overrideLimit (max 2 wins over base max 4)", () => {
    const config = {
      croissant: 1,
      fried: 2,
      sausage: 1,
      hashbrown: 1,
      mushroom: 1,
      beans: 1,
    };
    const extrasGroup = groups.find((g) => g.id === "extras")!;
    expect(getEffectiveGroupLimits(extrasGroup, config, rules).max).toBe(2);

    const violations = validate(config, groups, rules);
    expect(violations).toHaveLength(1);
    expect(violations[0].id).toBe("R3");
    expect(violations[0].message.toLowerCase()).toContain("max is 2");
  });

  it("TC-03: blocks Hollandaise with only Fried eggs (requires Scrambled or Omelette)", () => {
    const violations = validate(
      { toast: 1, fried: 2, sausage: 1, hollandaise: 1 },
      groups,
      rules
    );

    expect(violations).toHaveLength(1);
    expect(violations[0].id).toBe("R1");
    expect(violations[0].message).toContain("Hollandaise");
  });

  it("TC-04: lists all violations when Tofu + Beef Bacon and Chili + Hollandaise both exist", () => {
    const violations = validate(
      {
        toast: 1,
        scrambled: 2,
        tofu: 1,
        bacon: 1,
        chili: 1,
        hollandaise: 1,
      },
      groups,
      rules
    );

    expect(violations).toHaveLength(2);
    expect(violations.map((v) => v.id)).toEqual(["R2", "R4"]);
  });

  it("enforces maxDistinct and maxPerOption on sauce group and returns all group violations", () => {
    const violations = validate(
      {
        ketchup: 2,
        hollandaise: 1,
        chili: 1,
      },
      groups,
      rules
    );

    const ids = violations.map((v) => v.id);
    expect(ids).toContain("bread");
    expect(ids).toContain("eggs");
    expect(ids).toContain("protein");
    expect(ids).toContain("sauce");
    expect(ids).toContain("R1");
    expect(ids).toContain("R4");
    expect(
      violations.some((v) => v.message.includes("cannot exceed 1"))
    ).toBe(true);
    expect(
      violations.some((v) => v.message.includes("2 distinct options"))
    ).toBe(true);
  });

  it("works generically with a completely different menu fixture without hardcoded IDs", () => {
    const customGroups: OptionGroup[] = [
      {
        id: "base",
        name: "Bowl Base",
        min: 1,
        max: 1,
        options: [
          { id: "rice", name: "Rice", pricePoisha: 0, ingredients: {} },
          { id: "quinoa", name: "Quinoa", pricePoisha: 5000, ingredients: {} },
        ],
      },
      {
        id: "toppings",
        name: "Toppings",
        min: 0,
        max: 3,
        options: [
          { id: "corn", name: "Corn", pricePoisha: 1000, ingredients: {} },
          { id: "avocado", name: "Avocado", pricePoisha: 4000, ingredients: {} },
          { id: "nuts", name: "Cashews", pricePoisha: 3000, ingredients: {} },
        ],
      },
    ];
    const customRules: MenuRule[] = [
      {
        id: "CR1",
        type: "overrideLimit",
        triggerOptionId: "quinoa",
        targetGroupId: "toppings",
        max: 1,
      },
    ];

    const violations = validate(
      { quinoa: 1, corn: 1, avocado: 1 },
      customGroups,
      customRules
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].id).toBe("CR1");
    expect(violations[0].message).toContain("Toppings max is 1 when Quinoa is selected");
  });
});
