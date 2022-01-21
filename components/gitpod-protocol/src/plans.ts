/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export type Currency = 'USD' | 'EUR';
export namespace Currency {
  export const getAll = (): Currency[] => {
    return ['USD', 'EUR'];
  };
  export const getSymbol = (c: Currency) => {
    return c === 'USD' ? '$' : '€';
  };
}

/**
 * Different plans of the same type MAY have different prices ($/€, for example) but MUST have the same feature set.
 */
export type PlanType =
  | 'free'
  | 'free-50'
  | 'free-open-source'
  | 'student'
  | 'basic'
  | 'personal'
  | 'professional'
  | 'professional-new';
export type HoursPerMonthType = number | 'unlimited';
export interface Plan {
  chargebeeId: string;
  githubId?: number;
  githubPlanNumber?: number;

  name: string;
  currency: Currency;
  /** In full currencies (Euro, US Dollar, ...) */
  pricePerMonth: number;
  hoursPerMonth: HoursPerMonthType;
  type: PlanType;
  team?: boolean;
}
export namespace Plan {
  export const is = (o: any): o is Plan => {
    return (
      'chargebeeId' in o &&
      'name' in o &&
      'currency' in o &&
      'pricePerMonth' in o &&
      'hoursPerMonth' in o &&
      'type' in o
    );
  };
}

export const MAX_PARALLEL_WORKSPACES = 16;

export interface Coupon {
  id: string;
  isGithubStudentCoupon?: boolean;
}
export namespace Coupon {
  export const is = (o: any): o is Coupon => {
    return 'id' in o;
  };
}
export namespace Coupons {
  export const INTERNAL_GITPOD_GHSP: Coupon = {
    id: 'INTERNAL_GITPOD_GHSP',
    isGithubStudentCoupon: true,
  };
  export const INTERNAL_GITPOD_GHSP_2: Coupon = {
    id: 'INTERNAL_GITPOD_GHSP_2',
    isGithubStudentCoupon: true,
  };
  export const GITHUBSTUDENTPACKFORFACULTY: Coupon = {
    id: 'GITHUBSTUDENTPACKFORFACULTY',
    isGithubStudentCoupon: true,
  };
  export const isGithubStudentCoupon = (id: string): boolean | undefined => {
    const c = getAllCoupons().find((ic) => ic.id === id);
    if (!c) {
      return undefined;
    }
    return !!c.isGithubStudentCoupon;
  };
  export const getAllCoupons = (): Coupon[] => {
    return Object.keys(Coupons)
      .map((k) => (Coupons as any)[k])
      .filter((a) => typeof a === 'object' && Coupon.is(a));
  };
}

// Theoretical maximum of workspace hours: 16 workspaces for 24h a day for 31 days as permitted by the v3 unlimited plan
// Other unlimited hour plans are restricted by the number of Parallel Workspaces they can start.
export const ABSOLUTE_MAX_USAGE = MAX_PARALLEL_WORKSPACES * 24 * 31;

/**
 * Version history:
 *  - v1:
 *    - Free
 *    - Basic
 *    - Professional
 *    - Team Professional
 *  - v2:
 *    - Free
 *    - Personal
 *    - Unlimited: rebranded professional with unlimited hours
 *    - Team Unlimited: rebranded professional with unlimited hours
 *    - dropped: Basic
 *  - v2.5:
 *    + Student Unlimited
 *    + Team Unlimited Student
 *  - V3:
 *    - Free: reduced to 50h (stays default, but not advertised directly anymore)
 *    - Personal (8/9)
 *    - Professional (23/25)
 *    - Unlimited (35/39)
 *  - v4:
 *    - Professional Open Source (free)
 *  - v5:
 *    - Unleashed: rebranded Unlimited
 */
export namespace Plans {
  /**
   * The old default plan (v1): 100h hours for public repos
   */
  export const FREE: Plan = {
    chargebeeId: 'free',
    githubId: 2034,
    githubPlanNumber: 1,

    type: 'free',
    name: 'Open Source',
    currency: 'USD',
    pricePerMonth: 0,
    hoursPerMonth: 100,
  };

  /**
   * The new default plan (v3): 50h hours for public repos
   */
  export const FREE_50: Plan = {
    chargebeeId: 'free-50',
    githubId: 4902,
    githubPlanNumber: 5,

    type: 'free-50',
    name: 'Open Source',
    currency: 'USD',
    pricePerMonth: 0,
    hoursPerMonth: 50,
  };

  /**
   * Users created after this date get the FREE_50 plan (v3) instead of the (old) FREE plan (v1)
   */
  export const FREE_50_START_DATE = '2019-12-19T00:00:00.000Z';

  /**
   * The 'Professional Open Source' plan was introduced to offer professional open-souce developers unlimited hours.
   */
  export const FREE_OPEN_SOURCE: Plan = {
    chargebeeId: 'free-open-source',
    type: 'free-open-source',
    name: 'Professional Open Source',
    currency: 'USD',
    pricePerMonth: 0,
    hoursPerMonth: 'unlimited',
  };

  /**
   * The 'Student Unleashed' plans were introduced to give students access to the highly-priced unlimited plans.
   */
  export const PROFESSIONAL_STUDENT_EUR: Plan = {
    chargebeeId: 'professional-student-eur',
    type: 'student',
    name: 'Student Unleashed',
    currency: 'EUR',
    pricePerMonth: 8,
    hoursPerMonth: 'unlimited',
  };

  /**
   * The 'Student Unleashed' plans were introduced to give students access to the highly-priced unlimited plans.
   */
  export const PROFESSIONAL_STUDENT_USD: Plan = {
    chargebeeId: 'professional-student-usd',
    type: 'student',
    name: 'Student Unleashed',
    currency: 'USD',
    pricePerMonth: 9,
    hoursPerMonth: 'unlimited',
  };

  /**
   * The 'Student Unleashed' plans were introduced to give students access to the highly-priced unlimited plans.
   */
  export const TEAM_PROFESSIONAL_STUDENT_EUR: Plan = {
    chargebeeId: 'team-professional-student-eur',
    type: 'student',
    name: 'Team Student Unleashed',
    team: true,
    currency: 'EUR',
    pricePerMonth: 8,
    hoursPerMonth: 'unlimited',
  };

  /**
   * The 'Student Unleashed' plans were introduced to give students access to the highly-priced unlimited plans.
   */
  export const TEAM_PROFESSIONAL_STUDENT_USD: Plan = {
    chargebeeId: 'team-professional-student-usd',
    type: 'student',
    name: 'Team Student Unleashed',
    team: true,
    currency: 'USD',
    pricePerMonth: 9,
    hoursPerMonth: 'unlimited',
  };

  /**
   * The 'basic' plan was the original differentiator between FREE and Professional (v1) but got discarded soon.
   */
  export const BASIC_EUR: Plan = {
    chargebeeId: 'basic-eur',
    type: 'basic',
    name: 'Standard',
    currency: 'EUR',
    pricePerMonth: 17,
    hoursPerMonth: 100,
  };

  /**
   * The 'basic' plan was the original differentiator between FREE and Professional (v1) but got discarded soon.
   */
  export const BASIC_USD: Plan = {
    chargebeeId: 'basic-usd',
    githubId: 2035,
    githubPlanNumber: 2,

    type: 'basic',
    name: 'Standard',
    currency: 'USD',
    pricePerMonth: 19,
    hoursPerMonth: 100,
  };

  /**
   * The 'personal' plan was introduced to superseed the 'basic' plan (introduced with v2) to be more attractive to hobbyists.
   */
  export const PERSONAL_EUR: Plan = {
    chargebeeId: 'personal-eur',
    type: 'personal',
    name: 'Personal',
    currency: 'EUR',
    pricePerMonth: 8,
    hoursPerMonth: 100,
  };

  /**
   * The 'personal' plan was introduced to superseed the 'basic' plan (introduced with v2) to be more attractive to hobbyists.
   */
  export const PERSONAL_USD: Plan = {
    chargebeeId: 'personal-usd',
    githubId: 2274,
    githubPlanNumber: 4,

    type: 'personal',
    name: 'Personal',
    currency: 'USD',
    pricePerMonth: 9,
    hoursPerMonth: 100,
  };

  /**
   * This is the 'new' Professional plan (v3), which is meant to fit well between Personal (9$/8€) on the left and
   * Unleashed (39$/35€) on the right.
   */
  export const PROFESSIONAL_NEW_EUR: Plan = {
    chargebeeId: 'professional-new-eur',
    type: 'professional-new',
    name: 'Professional',
    currency: 'EUR',
    pricePerMonth: 23,
    hoursPerMonth: 'unlimited',
  };

  /**
   * This is the 'new' Professional plan (v3), which is meant to fit well between Personal (9$/8€) on the left and
   * Unleashed (39$/35€) on the right.
   */
  export const PROFESSIONAL_NEW_USD: Plan = {
    chargebeeId: 'professional-new-usd',
    type: 'professional-new',
    name: 'Professional',
    currency: 'USD',
    pricePerMonth: 25,
    hoursPerMonth: 'unlimited',
  };

  /**
   * This is the 'new' Team Professional plan (v3), which is meant to fit well between Personal (9$/8€) on the left and
   * Unleashed (39$/35€) on the right.
   */
  export const TEAM_PROFESSIONAL_NEW_EUR: Plan = {
    chargebeeId: 'team-professional-new-eur',
    type: 'professional-new',
    name: 'Team Professional',
    currency: 'EUR',
    team: true,
    pricePerMonth: 23,
    hoursPerMonth: 'unlimited',
  };

  /**
   * This is the 'new' Team Professional plan (v3), which is meant to fit well between Personal (9$/8€) on the left and
   * Unleashed (39$/35€) on the right.
   */
  export const TEAM_PROFESSIONAL_NEW_USD: Plan = {
    chargebeeId: 'team-professional-new-usd',
    type: 'professional-new',
    name: 'Team Professional',
    currency: 'USD',
    team: true,
    pricePerMonth: 25,
    hoursPerMonth: 'unlimited',
  };

  /**
   * This is the 'Unleashed' plan (v1, rebranded v2, v5)
   * It was originally introduced as 'Professional', and we cannot update the ids, so it stays that way in the code.
   */
  export const PROFESSIONAL_EUR: Plan = {
    chargebeeId: 'professional-eur',
    type: 'professional',
    name: 'Unleashed',
    currency: 'EUR',
    pricePerMonth: 35,
    hoursPerMonth: 'unlimited',
  };

  /**
   * This is the 'Unleashed' plan (v1, rebranded v2, v5)
   * It was originally introduced as 'Professional', and we cannot update the ids, so it stays that way in the code.
   */
  export const PROFESSIONAL_USD: Plan = {
    chargebeeId: 'professional-usd',
    githubId: 2036,
    githubPlanNumber: 3,

    type: 'professional',
    name: 'Unleashed',
    currency: 'USD',
    pricePerMonth: 39,
    hoursPerMonth: 'unlimited',
  };

  /**
   * This is the Team-'Unleashed' plan (v1, rebranded v2, v5)
   * It was originally introduced as 'Professional', and we cannot update the ids, so it stays that way in the code.
   */
  export const TEAM_PROFESSIONAL_USD: Plan = {
    chargebeeId: 'team-professional-usd',
    type: 'professional',
    name: 'Team Unleashed',
    currency: 'USD',
    team: true,
    pricePerMonth: 39,
    hoursPerMonth: 'unlimited',
  };

  /**
   * This is the Team-'Unleashed' plan (v1, rebranded v2, v5)
   * It was originally introduced as 'Professional', and we cannot update the ids, so it stays that way in the code.
   */
  export const TEAM_PROFESSIONAL_EUR: Plan = {
    chargebeeId: 'team-professional-eur',
    type: 'professional',
    name: 'Team Unleashed',
    currency: 'EUR',
    team: true,
    pricePerMonth: 35,
    hoursPerMonth: 'unlimited',
  };

  const getAllPlans = (): Plan[] => {
    return Object.keys(Plans)
      .map((k) => (Plans as any)[k])
      .filter((a) => typeof a === 'object' && Plan.is(a));
  };

  /**
   * This function returns all individual plans that might be active (= we have subscriptions for) at the moment
   */
  export function getAvailablePlans(currency: Currency): Plan[] {
    const availablePaidPlans = [
      Plans.BASIC_EUR,
      Plans.BASIC_USD,
      Plans.PERSONAL_EUR,
      Plans.PERSONAL_USD,
      Plans.PROFESSIONAL_NEW_EUR,
      Plans.PROFESSIONAL_NEW_USD,
      Plans.PROFESSIONAL_EUR,
      Plans.PROFESSIONAL_USD,
    ];
    return [Plans.FREE, Plans.FREE_50, Plans.FREE_OPEN_SOURCE, ...availablePaidPlans.filter((p) => p.currency)];
  }

  export const getAvailableTeamPlans = (currency?: Currency): Plan[] => {
    const teamPlans = getAllPlans().filter((p) => !!p.team);
    return currency ? teamPlans.filter((p) => p.currency === currency) : teamPlans;
  };

  export function getById(id: string | undefined): Plan | undefined {
    if (id === undefined) {
      return undefined;
    }
    return getAllPlans().find((p) => p.chargebeeId === id) || undefined;
  }

  export function getByTypeAndCurrency(type: PlanType, currency: Currency): Plan | undefined {
    return getAllPlans()
      .filter((p) => p.type)
      .find((p) => p.currency === currency);
  }

  export function getProPlan(currency: Currency): Plan {
    switch (currency) {
      case 'EUR':
        return Plans.PROFESSIONAL_EUR;
      case 'USD':
        return Plans.PROFESSIONAL_USD;
    }
  }

  export function getNewProPlan(currency: Currency): Plan {
    switch (currency) {
      case 'EUR':
        return Plans.PROFESSIONAL_NEW_EUR;
      case 'USD':
        return Plans.PROFESSIONAL_NEW_USD;
    }
  }

  export function getStudentProPlan(currency: Currency): Plan {
    switch (currency) {
      case 'EUR':
        return Plans.PROFESSIONAL_STUDENT_EUR;
      case 'USD':
        return Plans.PROFESSIONAL_STUDENT_USD;
    }
  }

  export function getBasicPlan(currency: Currency): Plan {
    switch (currency) {
      case 'EUR':
        return Plans.BASIC_EUR;
      case 'USD':
        return Plans.BASIC_USD;
    }
  }

  export function getPersonalPlan(currency: Currency): Plan {
    switch (currency) {
      case 'EUR':
        return Plans.PERSONAL_EUR;
      case 'USD':
        return Plans.PERSONAL_USD;
    }
  }

  export function getFreePlan(userCreationDate: string): Plan {
    return userCreationDate < Plans.FREE_50_START_DATE ? Plans.FREE : Plans.FREE_50;
  }

  export function isFreePlan(chargebeeId: string | undefined): boolean {
    return (
      chargebeeId === Plans.FREE.chargebeeId ||
      chargebeeId === Plans.FREE_50.chargebeeId ||
      chargebeeId === Plans.FREE_OPEN_SOURCE.chargebeeId
    );
  }

  export function isFreeNonTransientPlan(chargebeeId: string | undefined): boolean {
    return chargebeeId === Plans.FREE_OPEN_SOURCE.chargebeeId;
  }

  export function getHoursPerMonth(plan: Plan): number {
    return plan.hoursPerMonth == 'unlimited' ? ABSOLUTE_MAX_USAGE : plan.hoursPerMonth;
  }

  /**
   * Returns the maximum number of parallel workspaces for the given plan
   * @param plan
   */
  export function getParallelWorkspacesById(planId: string | undefined): number {
    return getParallelWorkspaces(Plans.getById(planId));
  }

  /**
   * Returns the maximum number of parallel workspaces for the given plan
   * @param plan
   */
  export function getParallelWorkspaces(plan: Plan | undefined): number {
    const DEFAULT = 4;
    if (!plan) {
      return DEFAULT;
    }

    switch (plan.type) {
      case 'professional-new':
        return 8;

      case 'professional':
      case 'student':
        return 16;
    }
    return DEFAULT;
  }

  /**
   * This declares the plan structure we have in Gitpod: All entries in a sub-array have the same arity in this structure.
   * This is used to impose a partial order on plan types (cmp. compareTypes(...)).
   * The order inside the sub-array carries meaning, too: The first one is the current, preferred plan (we advertise) for the given arity.
   * This is used to be able to get the next "higher" plan (cmp. getNextHigherPlanType).
   */
  const planStructure: PlanType[][] = [
    ['free-50', 'free', 'free-open-source'],
    ['personal', 'basic'],
    ['professional-new'],
    ['professional', 'student'],
  ];

  function getPlanTypeArity(type: PlanType) {
    return planStructure.findIndex((types: PlanType[]) => types.includes(type));
  }

  function getPlanTypeForArity(arity: number): PlanType | undefined {
    if (arity >= planStructure.length) {
      return undefined;
    }
    return planStructure[arity][0];
  }

  /**
   * Returns the preferred plan type with the next higher arity
   * @param type
   */
  export function getNextHigherPlanType(type: PlanType): PlanType {
    const arity = getPlanTypeArity(type);
    const nextHigherType = getPlanTypeForArity(arity + 1);
    return nextHigherType || 'professional';
  }

  /**
   * This imposes a partial order on the plan types
   * @param planTypeA
   * @param planTypeB
   */
  export function compareTypes(planTypeA: PlanType, planTypeB: PlanType) {
    const va = getPlanTypeArity(planTypeA);
    const vb = getPlanTypeArity(planTypeB);
    return va < vb ? -1 : va > vb ? 1 : 0;
  }

  export function subscriptionChange(fromType: PlanType, toType: PlanType): 'upgrade' | 'downgrade' | 'none' {
    const cmp = Plans.compareTypes(fromType, toType);
    if (cmp < 0) {
      return 'upgrade';
    } else if (cmp > 0) {
      return 'downgrade';
    } else {
      return 'none';
    }
  }

  export interface Feature {
    title: string;
    emph?: boolean;
    link?: string;
    tooltip?: string;
  }
  export namespace Feature {
    export const getFeaturesFor = (p: Plan): Feature[] => {
      switch (p.type) {
        case 'free':
          return [{ title: 'Public repositories' }];

        case 'free-50':
          return [{ title: 'Public repositories' }];

        case 'free-open-source':
          return [{ title: 'Public repositories' }];

        case 'student':
          return [
            { title: 'Private & Public repos' },
            {
              title: `${Plans.getParallelWorkspaces(p)} Parallel Workspaces`,
              tooltip: 'The number of workspaces running at the same time',
            },
            {
              title: 'Team Manageable',
              link: '/teams/',
              tooltip: 'Setup Gitpod for an entire Team with a single invoice and credit card',
            },
            { title: '1h Timeout', tooltip: 'Workspaces without user activity are stopped after 1 hour' },
            {
              title: '3h Timeout Boost',
              tooltip: 'You can manually boost the timeout to 3 hours within a running workspace',
            },
          ];

        case 'basic':
          return [
            { title: 'Private & Public repos' },
            {
              title: `${Plans.getParallelWorkspaces(p)} Parallel Workspaces`,
              tooltip: 'The number of workspaces running at the same time.',
            },
          ];

        // Personal
        case 'personal':
          return [
            { title: 'Private & Public repos' },
            {
              title: `${Plans.getParallelWorkspaces(p)} Parallel Workspaces`,
              tooltip: 'The number of workspaces running at the same time',
            },
            { title: '30min Timeout', tooltip: 'Workspaces without user activity are stopped after 30 minutes' },
          ];

        // Professional
        case 'professional-new':
          return [
            { title: 'Private & Public repos' },
            {
              title: `${Plans.getParallelWorkspaces(p)} Parallel Workspaces`,
              tooltip: 'The number of workspaces running at the same time',
            },
            {
              title: 'Team Manageable',
              link: '/teams/',
              tooltip: 'Setup Gitpod for an entire Team with a single invoice and credit card',
            },
            { title: '30min Timeout', tooltip: 'Workspaces without user activity are stopped after 30 minutes' },
          ];

        // Unleashed
        case 'professional':
          return [
            { title: 'Private & Public repos' },
            {
              title: `${Plans.getParallelWorkspaces(p)} Parallel Workspaces`,
              tooltip: 'The number of workspaces running at the same time',
            },
            {
              title: 'Team Manageable',
              link: '/teams/',
              tooltip: 'Setup Gitpod for an entire Team with a single invoice and credit card',
            },
            { title: '1h Timeout', tooltip: 'Workspaces without user activity are stopped after 1 hour' },
            {
              title: '3h Timeout Boost',
              tooltip: 'You can manually boost the timeout to 3 hours within a running workspace',
            },
          ];
      }
    };
  }
}
