/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {
    AccountingDB,
    DBUser,
    TeamDB,
    TeamSubscription2DB,
    TeamSubscriptionDB,
    TypeORM,
    UserDB,
} from "@gitpod/gitpod-db/lib";
import { dbContainerModule } from "@gitpod/gitpod-db/lib/container-module";
import { DBSubscription } from "@gitpod/gitpod-db/lib/typeorm/entity/db-subscription";
import { DBTeam } from "@gitpod/gitpod-db/lib/typeorm/entity/db-team";
import { DBTeamMembership } from "@gitpod/gitpod-db/lib/typeorm/entity/db-team-membership";
import { DBTeamSubscription } from "@gitpod/gitpod-db/lib/typeorm/entity/db-team-subscription";
import { DBTeamSubscription2 } from "@gitpod/gitpod-db/lib/typeorm/entity/db-team-subscription-2";
import { DBTeamSubscriptionSlot } from "@gitpod/gitpod-db/lib/typeorm/entity/db-team-subscription-slot";
import { SubscriptionService } from "@gitpod/gitpod-payment-endpoint/lib/accounting";
import { Team, User } from "@gitpod/gitpod-protocol";
import { Subscription } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { ConfigCatClientFactory } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { Attributes, Client } from "@gitpod/gitpod-protocol/lib/experiments/types";
import { Plan, Plans } from "@gitpod/gitpod-protocol/lib/plans";
import {
    TeamSubscription,
    TeamSubscription2,
    TeamSubscriptionSlot,
} from "@gitpod/gitpod-protocol/lib/team-subscription-protocol";
import * as chai from "chai";
import { Container, ContainerModule } from "inversify";
import { suite, test, timeout } from "mocha-typescript";
import Stripe from "stripe";
import { Config } from "../../../src/config";
import { BillingModes, BillingModesImpl } from "./billing-mode";
import * as deepEqualInAnyOrder from "deep-equal-in-any-order";
import {
    UsageServiceDefinition,
    UsageServiceClient,
    GetCostCenterResponse,
    CostCenter_BillingStrategy,
    GetBalanceResponse,
    SetCostCenterResponse,
    ReconcileUsageResponse,
    ListUsageRequest_Ordering,
    ListUsageResponse,
    ResetUsageResponse,
    ResetUsageRequest,
} from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { CallOptions } from "nice-grpc-common";
chai.use(deepEqualInAnyOrder);
const expect = chai.expect;

type StripeSubscription = Pick<Stripe.Subscription, "id"> & { customer: string };
class UsageServiceClientMock implements UsageServiceClient {
    constructor(protected readonly subscription?: StripeSubscription) {}

    async getCostCenter(
        request: { attributionId?: string | undefined },
        options?: CallOptions | undefined,
    ): Promise<GetCostCenterResponse> {
        if (!request.attributionId) {
            return { costCenter: undefined };
        }

        let billingStrategy = CostCenter_BillingStrategy.BILLING_STRATEGY_OTHER;
        if (this.subscription !== undefined) {
            billingStrategy = CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE;
        }

        return {
            costCenter: {
                attributionId: request.attributionId,
                billingStrategy,
                nextBillingTime: new Date(), // does not matter here.
                spendingLimit: 1234,
            },
        };
    }

    async getBalance(
        request: { attributionId?: string | undefined },
        options?: CallOptions | undefined,
    ): Promise<GetBalanceResponse> {
        throw new Error("Mock: not implemented");
    }

    async setCostCenter(
        request: {
            costCenter?:
                | {
                      attributionId?: string | undefined;
                      spendingLimit?: number | undefined;
                      billingStrategy?: CostCenter_BillingStrategy | undefined;
                      nextBillingTime?: Date | undefined;
                  }
                | undefined;
        },
        options?: CallOptions | undefined,
    ): Promise<SetCostCenterResponse> {
        throw new Error("Mock: not implemented");
    }

    async reconcileUsage(
        request: { from?: Date | undefined; to?: Date | undefined },
        options?: CallOptions | undefined,
    ): Promise<ReconcileUsageResponse> {
        throw new Error("Mock: not implemented");
    }

    async listUsage(
        request: {
            attributionId?: string | undefined;
            from?: Date | undefined;
            to?: Date | undefined;
            order?: ListUsageRequest_Ordering | undefined;
            pagination?: { perPage?: number | undefined; page?: number | undefined } | undefined;
        },
        options?: CallOptions | undefined,
    ): Promise<ListUsageResponse> {
        throw new Error("Mock: not implemented");
    }

    async resetUsage(request: ResetUsageRequest, options?: CallOptions | undefined): Promise<ResetUsageResponse> {
        throw new Error("Mock: not implemented");
    }
}

class ConfigCatClientMock implements Client {
    constructor(protected readonly featureFlags: { [key: string]: boolean }) {}

    async getValueAsync<T>(experimentName: string, defaultValue: T, attributes: Attributes): Promise<T> {
        return !!this.featureFlags[experimentName] as any as T;
    }

    dispose() {}
}

@suite
class BillingModeSpec {
    @test(timeout(20000))
    public async testBillingModes() {
        const userId = "123";
        const teamName = "team-123";
        const stripeCustomerId = "customer-123";
        const stripeTeamCustomerId = "customer-t-123";
        const creationDate = "2022-01-01T19:00:00.000Z";
        const cancellationDate = "2022-01-15T19:00:00.000Z";
        const now = "2022-01-15T20:00:00.000Z";
        const endDate = "2022-01-16T19:00:00.000Z";
        function user(): User {
            return {
                id: userId,
                name: `user-${userId}`,
                creationDate,
                identities: [],
            };
        }

        function team(): Pick<Team, "name"> {
            return {
                name: teamName,
            };
        }

        type TestSubscription = Subscription & { type: "personal" | "team-old" | "team2" };
        function subscription(plan: Plan, cancellationDate?: string, endDate?: string): TestSubscription {
            const s = Subscription.create({
                startDate: creationDate,
                userId,
                planId: plan.chargebeeId,
                amount: Plans.getHoursPerMonth(plan),
                cancellationDate,
                endDate: endDate || cancellationDate,
            });
            return {
                ...s,
                type: "personal",
            };
        }
        function teamSubscription(plan: Plan, cancellationDate?: string, endDate?: string): TestSubscription {
            const s = subscription(plan, cancellationDate, endDate);
            return {
                ...s,
                type: "team-old",
            };
        }
        function teamSubscription2(plan: Plan, cancellationDate?: string, endDate?: string): TestSubscription {
            const s = teamSubscription(plan, cancellationDate, endDate);
            return {
                ...s,
                type: "team2",
            };
        }

        function stripeSubscription() {
            return {
                id: "stripe-123",
                customer: stripeCustomerId,
            };
        }

        function stripeTeamSubscription() {
            return {
                id: "stripe-123",
                customer: stripeTeamCustomerId,
                isTeam: true,
            };
        }

        interface Test {
            name: string;
            subject: User | Pick<Team, "name">;
            config: {
                enablePayment: boolean;
                usageBasedPricingEnabled: boolean;
                subscriptions?: TestSubscription[];
                stripeSubscription?: StripeSubscription & { isTeam?: boolean };
            };
            expectation: BillingMode;
            only?: true;
        }
        const tests: Test[] = [
            // user: payment?
            {
                name: "payment disabled (ubb: true)",
                subject: user(),
                config: {
                    enablePayment: false,
                    usageBasedPricingEnabled: true,
                },
                expectation: {
                    mode: "none",
                },
            },
            {
                name: "payment disabled (ubb: false)",
                subject: user(),
                config: {
                    enablePayment: false,
                    usageBasedPricingEnabled: false,
                },
                expectation: {
                    mode: "none",
                },
            },
            {
                name: "payment enabled (ubb: false)",
                subject: user(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: false,
                },
                expectation: {
                    mode: "chargebee",
                },
            },
            // user: chargebee
            {
                name: "user: chargebee paid personal",
                subject: user(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: false,
                    subscriptions: [subscription(Plans.PERSONAL_EUR)],
                },
                expectation: {
                    mode: "chargebee",
                },
            },
            {
                name: "user: chargebee paid team seat",
                subject: user(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: false,
                    subscriptions: [teamSubscription(Plans.TEAM_PROFESSIONAL_EUR)],
                },
                expectation: {
                    mode: "chargebee",
                },
            },
            {
                name: "user: chargebee paid personal + team seat",
                subject: user(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: false,
                    subscriptions: [subscription(Plans.PERSONAL_EUR), teamSubscription(Plans.TEAM_PROFESSIONAL_EUR)],
                },
                expectation: {
                    mode: "chargebee",
                },
            },
            // user: transition chargebee -> UBB
            {
                name: "user: chargebee paid personal (cancelled) + team seat",
                subject: user(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: true,
                    subscriptions: [
                        subscription(Plans.PERSONAL_EUR, cancellationDate, endDate),
                        teamSubscription(Plans.TEAM_PROFESSIONAL_EUR),
                    ],
                },
                expectation: {
                    mode: "chargebee",
                    canUpgradeToUBB: true,
                    teamNames: ["Team Subscription 'Team Unleashed' (owner: user-123)"],
                },
            },
            {
                name: "user: chargebee paid personal (cancelled) + team seat (cancelled)",
                subject: user(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: true,
                    subscriptions: [
                        subscription(Plans.PERSONAL_EUR, cancellationDate, endDate),
                        teamSubscription(Plans.TEAM_PROFESSIONAL_EUR, cancellationDate, endDate),
                    ],
                },
                expectation: {
                    mode: "chargebee",
                    canUpgradeToUBB: true,
                    teamNames: ["Team Subscription 'Team Unleashed' (owner: user-123)"],
                },
            },
            {
                name: "user: chargebee paid personal (cancelled) + team seat (active) + stripe",
                subject: user(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: true,
                    subscriptions: [
                        subscription(Plans.PERSONAL_EUR, cancellationDate, endDate),
                        teamSubscription(Plans.TEAM_PROFESSIONAL_EUR),
                    ],
                    stripeSubscription: stripeTeamSubscription(),
                },
                expectation: {
                    mode: "usage-based",
                    hasChargebeeTeamSubscription: true,
                },
            },
            // user: usage-based
            {
                name: "user: stripe free, chargebee paid personal (inactive) + team seat (inactive)",
                subject: user(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: true,
                    subscriptions: [
                        subscription(Plans.PERSONAL_EUR, cancellationDate, cancellationDate),
                        teamSubscription(Plans.TEAM_PROFESSIONAL_EUR, cancellationDate, cancellationDate),
                    ],
                },
                expectation: {
                    mode: "usage-based",
                },
            },
            {
                name: "user: stripe paid, chargebee paid personal (inactive) + team seat (inactive)",
                subject: user(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: true,
                    subscriptions: [
                        subscription(Plans.PERSONAL_EUR, cancellationDate, cancellationDate),
                        teamSubscription(Plans.TEAM_PROFESSIONAL_EUR, cancellationDate, cancellationDate),
                    ],
                    stripeSubscription: stripeSubscription(),
                },
                expectation: {
                    mode: "usage-based",
                },
            },
            {
                name: "user: stripe paid",
                subject: user(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: true,
                    stripeSubscription: stripeSubscription(),
                },
                expectation: {
                    mode: "usage-based",
                },
            },
            {
                name: "user: stripe free",
                subject: user(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: true,
                },
                expectation: {
                    mode: "usage-based",
                },
            },
            // team: payment?
            {
                name: "payment disabled (ubb: true)",
                subject: team(),
                config: {
                    enablePayment: false,
                    usageBasedPricingEnabled: true,
                },
                expectation: {
                    mode: "none",
                },
            },
            {
                name: "payment disabled (ubb: false)",
                subject: team(),
                config: {
                    enablePayment: false,
                    usageBasedPricingEnabled: false,
                },
                expectation: {
                    mode: "none",
                },
            },
            {
                name: "payment enabled (ubb: false)",
                subject: team(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: false,
                },
                expectation: {
                    mode: "chargebee",
                },
            },
            // team: chargebee
            {
                name: "team: chargebee paid",
                subject: team(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: false,
                    subscriptions: [teamSubscription2(Plans.TEAM_PROFESSIONAL_EUR)],
                },
                expectation: {
                    mode: "chargebee",
                    paid: true,
                },
            },
            {
                name: "team: chargebee paid (UBB)",
                subject: team(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: true,
                    subscriptions: [teamSubscription2(Plans.TEAM_PROFESSIONAL_EUR)],
                },
                expectation: {
                    mode: "chargebee",
                    paid: true,
                    teamNames: ["team-123"],
                },
            },
            // team: transition chargebee -> UBB
            {
                name: "team: chargebee paid (TeamSubscription2, cancelled)",
                subject: team(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: true,
                    subscriptions: [teamSubscription2(Plans.TEAM_PROFESSIONAL_EUR, cancellationDate, endDate)],
                },
                expectation: {
                    mode: "chargebee",
                    canUpgradeToUBB: true,
                    teamNames: ["team-123"],
                },
            },
            {
                name: "team: chargebee paid (old TeamSubscription, cancelled)",
                subject: team(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: true,
                    subscriptions: [teamSubscription(Plans.TEAM_PROFESSIONAL_EUR, cancellationDate, endDate)],
                },
                expectation: {
                    mode: "usage-based",
                },
            },
            // team: usage-based
            {
                name: "team: usage-based free",
                subject: team(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: true,
                },
                expectation: {
                    mode: "usage-based",
                },
            },
            {
                name: "team: stripe free, chargebee (inactive)",
                subject: team(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: true,
                    subscriptions: [teamSubscription2(Plans.TEAM_PROFESSIONAL_EUR, cancellationDate, cancellationDate)],
                },
                expectation: {
                    mode: "usage-based",
                },
            },
            {
                name: "team: stripe paid, chargebee (inactive)",
                subject: team(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: true,
                    subscriptions: [teamSubscription2(Plans.TEAM_PROFESSIONAL_EUR, cancellationDate, cancellationDate)],
                    stripeSubscription: stripeSubscription(),
                },
                expectation: {
                    mode: "usage-based",
                    paid: true,
                },
            },
            {
                name: "team: stripe paid",
                subject: team(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: true,
                    stripeSubscription: stripeSubscription(),
                },
                expectation: {
                    mode: "usage-based",
                    paid: true,
                },
            },
        ];

        const onlyTest = tests.find((t) => t.only);
        for (const test of onlyTest ? [onlyTest] : tests) {
            // Setup test code, environment and data
            const testContainer = new Container();
            testContainer.load(dbContainerModule);
            testContainer.load(
                new ContainerModule((bind, unbind, isBound, rebind) => {
                    bind(Config).toConstantValue({ enablePayment: test.config.enablePayment } as Config);
                    bind(SubscriptionService).toSelf().inSingletonScope();
                    bind(BillingModes).to(BillingModesImpl).inSingletonScope();

                    bind(UsageServiceDefinition.name).toConstantValue(
                        new UsageServiceClientMock(test.config.stripeSubscription),
                    );
                    bind(ConfigCatClientFactory).toConstantValue(
                        () =>
                            new ConfigCatClientMock({
                                isUsageBasedBillingEnabled: test.config.usageBasedPricingEnabled,
                            }),
                    );
                }),
            );

            // Wipe DB
            const typeorm = testContainer.get<TypeORM>(TypeORM);
            const manager = await typeorm.getConnection();
            await manager.getRepository(DBSubscription).delete({});
            await manager.getRepository(DBTeamSubscription).delete({});
            await manager.getRepository(DBTeamSubscription2).delete({});
            await manager.getRepository(DBTeamSubscriptionSlot).delete({});
            await manager.getRepository(DBTeam).delete({});
            await manager.getRepository(DBTeamMembership).delete({});
            await manager.getRepository(DBUser).delete({});

            // Prepare test config
            const userDB = testContainer.get<UserDB>(UserDB);
            const teamDB = testContainer.get<TeamDB>(TeamDB);
            const accountingDB = testContainer.get<AccountingDB>(AccountingDB);
            const teamSubscriptionDB = testContainer.get<TeamSubscriptionDB>(TeamSubscriptionDB);
            const teamSubscription2DB = testContainer.get<TeamSubscription2DB>(TeamSubscription2DB);

            let isTeam = false;
            let teamId: string | undefined = undefined;
            let teamMembershipId: string | undefined = undefined;
            let attributionId: AttributionId | undefined = undefined;
            if (User.is(test.subject)) {
                const user = test.subject;
                await userDB.storeUser(user);
                attributionId = { kind: "user", userId };
            } else {
                isTeam = true;
            }
            if (isTeam || test.config.stripeSubscription?.isTeam) {
                const team = await teamDB.createTeam(userId, teamName);
                const membership = await teamDB.findTeamMembership(userId, team.id);
                if (!membership) {
                    throw new Error(`${test.name}: Invalid test data: expected membership for team to exist!`);
                }
                teamMembershipId = membership.id;
                teamId = team.id;
                if (isTeam) {
                    attributionId = { kind: "team", teamId: team.id };
                }
            }
            if (!attributionId) {
                throw new Error("Invalid test data: no subject configured!");
            }
            for (const sub of test.config.subscriptions || []) {
                const plan = Plans.getById(sub.planId!);
                if (plan?.team) {
                    if (sub.type === "team2") {
                        if (!teamId) {
                            throw new Error("Cannot create TeamSubscription2 without teamId!");
                        }
                        // TeamSubscription2 - only relevant for teams (for BillingMode)
                        const ts2 = TeamSubscription2.create({
                            teamId,
                            planId: plan.chargebeeId,
                            excludeFromMoreResources: false,
                            paymentReference: "some-cb-ref",
                            quantity: 10,
                            startDate: sub.startDate,
                            cancellationDate: sub.cancellationDate,
                            endDate: sub.endDate,
                        });
                        await teamSubscription2DB.storeEntry(ts2);
                        sub.teamMembershipId = teamMembershipId;
                        await accountingDB.storeSubscription(sub);
                    } else if (sub.type === "team-old") {
                        // TeamSubscription - only relevant for users (for BillingMode)
                        const ts = TeamSubscription.create({
                            userId,
                            planId: plan.chargebeeId,
                            quantity: 10,
                            paymentReference: "some-cb-ref",
                            excludeFromMoreResources: false,
                            startDate: sub.startDate,
                            cancellationDate: sub.cancellationDate,
                            endDate: sub.endDate,
                        });
                        await teamSubscriptionDB.storeTeamSubscriptionEntry(ts);
                        const slot = TeamSubscriptionSlot.create({
                            teamSubscriptionId: ts.id,
                            assigneeId: userId,
                            cancellationDate: sub.cancellationDate,
                            subscriptionId: sub.uid,
                        });
                        await teamSubscriptionDB.storeSlot(slot);
                        sub.teamSubscriptionSlotId = slot.id;
                        await accountingDB.storeSubscription(sub);
                    } else {
                        throw new Error("Bad test data: team plan of wrong type!");
                    }
                } else {
                    await accountingDB.storeSubscription(sub);
                }
            }

            // Run test
            const cut = testContainer.get<BillingModes>(BillingModes);
            const actual = await cut.getBillingMode(attributionId, new Date(now));
            expect(
                actual,
                `${test.name}: Expected BillingMode to be '${JSON.stringify(
                    test.expectation,
                )}' but got '${JSON.stringify(actual)}'`,
            ).to.deep.equalInAnyOrder(test.expectation);
        }
    }
}

module.exports = new BillingModeSpec();
