/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TypeORM, testContainer } from "@gitpod/gitpod-db/lib";
import * as chai from "chai";
import { v4 as uuidv4 } from "uuid";
import { fixInvoice } from "./fix-stripe-job";
const expect = chai.expect;

describe("Fix Stripe Job", () => {
    const typeORM = testContainer.get<TypeORM>(TypeORM);

    const wipeRepo = async () => {
        const conn = await typeORM.getConnection();
        await conn.query("DELETE FROM d_b_stripe_customer");
        await conn.query("DELETE FROM d_b_usage");
        await conn.query("DELETE FROM d_b_cost_center");
    };

    it("fix invoice", async () => {
        await wipeRepo();
        const c = await typeORM.getConnection();
        const newAttributionID = "team:" + uuidv4();
        const oldAttributionID = "user:" + uuidv4();
        const now = new Date();
        const lastMonth = new Date(now);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        await c.query(
            `INSERT into d_b_cost_center (id, spendingLimit, creationTime, billingStrategy, nextBillingTime, billingCycleStart) VALUES (?, ?, ?, ?, ?,?)`,
            [newAttributionID, 500, lastMonth.toISOString(), "stripe", now.toISOString(), lastMonth.toISOString()],
        );
        await c.query(
            `INSERT into d_b_usage (id, attributionId, description, creditCents, effectiveTime, kind, draft) VALUES (?, ?, ?, ?, ?,?,?)`,
            [uuidv4(), oldAttributionID, "Credits", -2000, now.toISOString(), "invoice", 0],
        );

        await fixInvoice(c, oldAttributionID, newAttributionID);

        const costCenter = await c.query(`SELECT * FROM d_b_cost_center WHERE id = ? order by creationTime DESC`, [
            newAttributionID,
        ]);
        expect(costCenter.length).to.be.eq(2);
        expect(costCenter[0].nextBillingTime).to.be.eq(nextMonth.toISOString());
        let usage = await c.query(`SELECT * FROM d_b_usage WHERE attributionId = ?`, [oldAttributionID]);
        expect(usage.length).to.be.eq(0);
        usage = await c.query(`SELECT * FROM d_b_usage WHERE attributionId = ?`, [newAttributionID]);
        expect(usage.length).to.be.eq(1);
    });
});
