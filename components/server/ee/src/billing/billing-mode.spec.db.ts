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
import { StripeService } from "../user/stripe-service";
import { BillingModes, BillingModesImpl } from "./billing-mode";
import * as deepEqualInAnyOrder from "deep-equal-in-any-order";
chai.use(deepEqualInAnyOrder);
const expect = chai.expect;

type StripeSubscription = Pick<Stripe.Subscription, "id"> & { customer: string };
class StripeServiceMock extends StripeService {
    constructor(protected readonly subscription?: StripeSubscription) {
        super();
    }

    async findUncancelledSubscriptionByCustomer(customerId: string): Promise<Stripe.Subscription | undefined> {
        if (this.subscription?.customer === customerId) {
            return this.subscription as Stripe.Subscription;
        }
        return undefined;
    }

    async findCustomerByUserId(userId: string): Promise<Stripe.Customer | undefined> {
        const customerId = this.subscription?.customer;
        if (!customerId) {
            return undefined;
        }
        return {
            id: customerId,
        } as Stripe.Customer;
    }

    async findCustomerByTeamId(teamId: string): Promise<Stripe.Customer | undefined> {
        return this.findCustomerByUserId(teamId);
    }
}

class ConfigCatClientMock implements Client {
    constructor(protected readonly usageBasedPricingEnabled: boolean) {}

    async getValueAsync<T>(experimentName: string, defaultValue: T, attributes: Attributes): Promise<T> {
        return this.usageBasedPricingEnabled as any as T;
    }

    dispose() {}
}

@suite
class BillingModeSpec {
    @test(timeout(10000))
    public async testBillingModes() {
        const userId = "123";
        const stripeCustomerId = "customer-123";
        const creationDate = "2022-01-01T19:00:00.000Z";
        const cancellationDate = "2022-01-15T19:00:00.000Z";
        const now = "2022-01-15T20:00:00.000Z";
        const endDate = "2022-01-16T19:00:00.000Z";
        function user(): User {
            return {
                id: userId,
                creationDate,
                identities: [],
            };
        }

        function team(): Pick<Team, "name"> {
            return {
                name: "team-123",
            };
        }

        function subscription(plan: Plan, cancellationDate?: string, endDate?: string): Subscription {
            return Subscription.create({
                startDate: creationDate,
                userId,
                planId: plan.chargebeeId,
                amount: Plans.getHoursPerMonth(plan),
                cancellationDate,
                endDate: endDate || cancellationDate,
            });
        }

        function stripeSubscription(): StripeSubscription {
            return {
                id: "stripe-123",
                customer: stripeCustomerId,
            };
        }

        interface Test {
            name: string;
            subject: User | Pick<Team, "name">;
            config: {
                enablePayment: boolean;
                usageBasedPricingEnabled: boolean;
                subscriptions?: Subscription[];
                stripeSubscription?: StripeSubscription;
            };
            expectation: BillingMode;
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
                    tier: "free",
                },
            },
            // user: chargebee
            {
                name: "user: chargbee paid personal",
                subject: user(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: false,
                    subscriptions: [subscription(Plans.PERSONAL_EUR)],
                },
                expectation: {
                    mode: "chargebee",
                    tier: "paid",
                    planIds: [Plans.PERSONAL_EUR.chargebeeId],
                    hasPersonalPlan: true,
                },
            },
            {
                name: "user: chargbee paid team seat",
                subject: user(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: false,
                    subscriptions: [subscription(Plans.TEAM_PROFESSIONAL_EUR)],
                },
                expectation: {
                    mode: "chargebee",
                    tier: "paid",
                    planIds: [Plans.TEAM_PROFESSIONAL_EUR.chargebeeId],
                    hasPersonalPlan: false,
                },
            },
            {
                name: "user: chargbee paid personal + team seat",
                subject: user(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: false,
                    subscriptions: [subscription(Plans.PERSONAL_EUR), subscription(Plans.TEAM_PROFESSIONAL_EUR)],
                },
                expectation: {
                    mode: "chargebee",
                    tier: "paid",
                    planIds: [Plans.PERSONAL_EUR.chargebeeId, Plans.TEAM_PROFESSIONAL_EUR.chargebeeId],
                    hasPersonalPlan: true,
                },
            },
            // user: transition chargebee -> UBB
            {
                name: "user: chargbee paid personal (cancelled) + team seat",
                subject: user(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: false,
                    subscriptions: [
                        subscription(Plans.PERSONAL_EUR, cancellationDate, endDate),
                        subscription(Plans.TEAM_PROFESSIONAL_EUR),
                    ],
                },
                expectation: {
                    mode: "chargebee",
                    tier: "paid",
                    planIds: [Plans.PERSONAL_EUR.chargebeeId, Plans.TEAM_PROFESSIONAL_EUR.chargebeeId],
                    hasPersonalPlan: true,
                },
            },
            {
                name: "user: chargbee paid personal (cancelled) + team seat (cancelled)",
                subject: user(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: true,
                    subscriptions: [
                        subscription(Plans.PERSONAL_EUR, cancellationDate, endDate),
                        subscription(Plans.TEAM_PROFESSIONAL_EUR, cancellationDate, endDate),
                    ],
                },
                expectation: {
                    mode: "chargebee",
                    tier: "paid_cancelled_and_ubb",
                    planIds: [Plans.PERSONAL_EUR.chargebeeId, Plans.TEAM_PROFESSIONAL_EUR.chargebeeId],
                },
            },
            // user: usage-based
            {
                name: "user: stripe free, chargbee paid personal (inactive) + team seat (inactive)",
                subject: user(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: true,
                    subscriptions: [
                        subscription(Plans.PERSONAL_EUR, cancellationDate, cancellationDate),
                        subscription(Plans.TEAM_PROFESSIONAL_EUR, cancellationDate, cancellationDate),
                    ],
                },
                expectation: {
                    mode: "usage-based",
                    tier: "free",
                },
            },
            {
                name: "user: stripe paid, chargbee paid personal (inactive) + team seat (inactive)",
                subject: user(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: true,
                    subscriptions: [
                        subscription(Plans.PERSONAL_EUR, cancellationDate, cancellationDate),
                        subscription(Plans.TEAM_PROFESSIONAL_EUR, cancellationDate, cancellationDate),
                    ],
                    stripeSubscription: stripeSubscription(),
                },
                expectation: {
                    mode: "usage-based",
                    tier: "paid",
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
                    tier: "paid",
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
                    tier: "free",
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
                    tier: "free",
                },
            },
            // team: chargebee
            {
                name: "team: chargbee paid",
                subject: team(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: false,
                    subscriptions: [subscription(Plans.TEAM_PROFESSIONAL_EUR)],
                },
                expectation: {
                    mode: "chargebee",
                    tier: "paid",
                    planIds: [Plans.TEAM_PROFESSIONAL_EUR.chargebeeId],
                },
            },
            // team: transition chargebee -> UBB
            {
                name: "team: chargbee paid (cancelled)",
                subject: team(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: true,
                    subscriptions: [subscription(Plans.TEAM_PROFESSIONAL_EUR, cancellationDate, endDate)],
                },
                expectation: {
                    mode: "chargebee",
                    tier: "paid_cancelled_and_ubb",
                    planIds: [Plans.TEAM_PROFESSIONAL_EUR.chargebeeId],
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
                    tier: "free",
                },
            },
            {
                name: "team: stripe free, chargbee (inactive)",
                subject: team(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: true,
                    subscriptions: [subscription(Plans.TEAM_PROFESSIONAL_EUR, cancellationDate, cancellationDate)],
                },
                expectation: {
                    mode: "usage-based",
                    tier: "free",
                },
            },
            {
                name: "team: stripe paid, chargbee (inactive)",
                subject: team(),
                config: {
                    enablePayment: true,
                    usageBasedPricingEnabled: true,
                    subscriptions: [subscription(Plans.TEAM_PROFESSIONAL_EUR, cancellationDate, cancellationDate)],
                    stripeSubscription: stripeSubscription(),
                },
                expectation: {
                    mode: "usage-based",
                    tier: "paid",
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
                    tier: "paid",
                },
            },
        ];

        for (const test of tests) {
            // Setup test code, environment and data
            const testContainer = new Container();
            testContainer.load(dbContainerModule);
            testContainer.load(
                new ContainerModule((bind, unbind, isBound, rebind) => {
                    bind(Config).toConstantValue({ enablePayment: test.config.enablePayment } as Config);
                    bind(SubscriptionService).toSelf().inSingletonScope();
                    bind(BillingModes).to(BillingModesImpl).inSingletonScope();

                    bind(StripeService).toConstantValue(new StripeServiceMock(test.config.stripeSubscription));
                    bind(ConfigCatClientFactory).toConstantValue(
                        () => new ConfigCatClientMock(test.config.usageBasedPricingEnabled),
                    );
                }),
            );

            const userDB = testContainer.get<UserDB>(UserDB);
            const teamDB = testContainer.get<TeamDB>(TeamDB);
            const accountingDB = testContainer.get<AccountingDB>(AccountingDB);
            const teamSubscriptionDB = testContainer.get<TeamSubscriptionDB>(TeamSubscriptionDB);
            const teamSubscription2DB = testContainer.get<TeamSubscription2DB>(TeamSubscription2DB);

            let teamId: string | undefined = undefined;
            let teamMembershipId: string | undefined = undefined;
            let attributionId: AttributionId | undefined = undefined;
            if (User.is(test.subject)) {
                const user = test.subject;
                await userDB.storeUser(user);
                attributionId = { kind: "user", userId };
            } else {
                const team = await teamDB.createTeam(userId, test.subject.name);
                teamId = team.id;
                attributionId = { kind: "team", teamId: team.id };
                const membership = await teamDB.findTeamMembership(userId, teamId);
                if (!membership) {
                    throw new Error(`${test.name}: Invalid test data: expected membership for team to exist!`);
                }
                teamMembershipId = membership.id;
            }
            if (!attributionId) {
                throw new Error("Invalid test data: no subject configured!");
            }
            for (const sub of test.config.subscriptions || []) {
                const plan = Plans.getById(sub.planId!);
                if (plan?.team) {
                    if (teamId) {
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
                    } else {
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
        }
    }
}

module.exports = new BillingModeSpec();
