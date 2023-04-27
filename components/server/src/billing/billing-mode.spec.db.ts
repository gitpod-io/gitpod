/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { DBUser, TeamDB, TypeORM, UserDB } from "@gitpod/gitpod-db/lib";
import { dbContainerModule } from "@gitpod/gitpod-db/lib/container-module";
import { DBTeam } from "@gitpod/gitpod-db/lib/typeorm/entity/db-team";
import { DBTeamMembership } from "@gitpod/gitpod-db/lib/typeorm/entity/db-team-membership";
import { Team, User } from "@gitpod/gitpod-protocol";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import * as chai from "chai";
import { Container, ContainerModule } from "inversify";
import { suite, test, timeout } from "mocha-typescript";
import Stripe from "stripe";
import { Config } from "../config";
import { BillingModes, BillingModesImpl } from "./billing-mode";
import * as deepEqualInAnyOrder from "deep-equal-in-any-order";
import { CostCenter_BillingStrategy } from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { UsageService } from "../user/usage-service";
chai.use(deepEqualInAnyOrder);
const expect = chai.expect;

type StripeSubscription = Pick<Stripe.Subscription, "id"> & { customer: string };
class UsageServiceMock implements UsageService {
    constructor(protected readonly subscription?: StripeSubscription) {}

    async getCurrentBalance(attributionId: AttributionId): Promise<{ usedCredits: number; usageLimit: number }> {
        throw new Error("Mock: not implemented");
    }

    async getCurrentBillingStategy(attributionId: AttributionId): Promise<CostCenter_BillingStrategy | undefined> {
        let billingStrategy = CostCenter_BillingStrategy.BILLING_STRATEGY_OTHER;
        if (this.subscription !== undefined) {
            billingStrategy = CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE;
        }
        return billingStrategy;
    }
}

@suite
class BillingModeSpec {
    @test(timeout(20000))
    public async testBillingModes() {
        const userId = "123";
        const teamName = "team-123";
        const stripeCustomerId = "customer-123";
        // const stripeTeamCustomerId = "customer-t-123";
        const creationDate = "2022-01-01T19:00:00.000Z";
        const now = "2022-01-15T20:00:00.000Z";
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

        function stripeSubscription() {
            return {
                id: "stripe-123",
                customer: stripeCustomerId,
            };
        }

        // function stripeTeamSubscription() {
        //     return {
        //         id: "stripe-123",
        //         customer: stripeTeamCustomerId,
        //         isTeam: true,
        //     };
        // }

        interface Test {
            name: string;
            subject: User | Pick<Team, "name">;
            config: {
                enablePayment: boolean;
                stripeSubscription?: StripeSubscription & { isTeam?: boolean };
            };
            expectation: BillingMode;
            only?: true;
        }
        const tests: Test[] = [
            // user: payment?
            {
                name: "payment disabled",
                subject: user(),
                config: {
                    enablePayment: false,
                },
                expectation: {
                    mode: "none",
                },
            },
            // user: usage-based
            {
                name: "user: stripe paid",
                subject: user(),
                config: {
                    enablePayment: true,
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
                },
                expectation: {
                    mode: "usage-based",
                },
            },
            // team: payment?
            {
                name: "payment disabled",
                subject: team(),
                config: {
                    enablePayment: false,
                },
                expectation: {
                    mode: "none",
                },
            },
            // team: usage-based
            {
                name: "team: usage-based free",
                subject: team(),
                config: {
                    enablePayment: true,
                },
                expectation: {
                    mode: "usage-based",
                    paid: false,
                },
            },
            {
                name: "team: stripe paid",
                subject: team(),
                config: {
                    enablePayment: true,
                    stripeSubscription: stripeSubscription(),
                },
                expectation: {
                    mode: "usage-based",
                    paid: true,
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
                    bind(BillingModes).to(BillingModesImpl).inSingletonScope();

                    bind(UsageService).toConstantValue(new UsageServiceMock(test.config.stripeSubscription));
                }),
            );

            // Wipe DB
            const typeorm = testContainer.get<TypeORM>(TypeORM);
            const manager = await typeorm.getConnection();
            await manager.getRepository(DBTeam).delete({});
            await manager.getRepository(DBTeamMembership).delete({});
            await manager.getRepository(DBUser).delete({});

            // Prepare test config
            const userDB = testContainer.get<UserDB>(UserDB);
            const teamDB = testContainer.get<TeamDB>(TeamDB);

            let isTeam = false;
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
                if (isTeam) {
                    attributionId = { kind: "team", teamId: team.id };
                }
            }
            if (!attributionId) {
                throw new Error("Invalid test data: no subject configured!");
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
