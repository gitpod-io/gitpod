/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable, inject } from "inversify";
import { User } from "@gitpod/gitpod-protocol";
import { AccountingDB } from "@gitpod/gitpod-db/lib/accounting-db";
import { EligibilityService } from "../user/eligibility-service";

const COUPON_GITHUB_STUDENT_PACK = "INTERNAL_GITPOD_GHSP_2";
const COUPON_GITHUB_TEACHER_PACK = "INTERNAL_GITPOD_GHTT";

@injectable()
export class ChargebeeCouponComputer {
    @inject(EligibilityService) protected readonly eligibilityService: EligibilityService;
    @inject(AccountingDB) protected readonly accountingDB: AccountingDB;

    public async getAvailableCouponIds(user: User): Promise<string[]> {
        const result: string[] = [];

        const { student, faculty } = await this.eligibilityService.getGitHubEducationPack(user);
        if (student || faculty) {
            // `student` and `faculty` are mutually exclusive
            const coupon = student ? COUPON_GITHUB_STUDENT_PACK : COUPON_GITHUB_TEACHER_PACK;

            if (!(await this.hasUsedCouponBefore(user, coupon))) {
                result.push(coupon);
            }
        }

        return result;
    }

    protected async hasUsedCouponBefore(user: User, couponId: string): Promise<boolean> {
        /*
         * We need to prevent users from using the same coupon multiple times. We store the info with which coupons a
         * subscription was created for exactlly that purpose.
         * Background:
         * Coupons are overriden on upgrade, so simply checking the Chargebee API does not suffice: Some users noted that
         * and managed to get free Student subscriptions over and over again, using it as an entry point to upgrade to
         * a paid subscription without actually paying it (because we allow to checkout for 0$ invoices).
         * To avoid that we now store the info which coupons were initially applied and check that to see if a student
         * is eligible.
         */
        return this.accountingDB.hadSubscriptionCreatedWithCoupon(user.id, couponId);
    }

    // Get the coupons that are currently applied to the user's currently active subscriptions.
    public async getAppliedCouponIds(user: User, date: Date): Promise<string[]> {
        const appliedCouponIds = [];
        const subscriptions = await this.accountingDB.findActiveSubscriptionsForUser(user.id, date.toISOString());
        for (const subscription of subscriptions) {
            if (!subscription.paymentReference) {
                continue;
            }
            const additionalData = await this.accountingDB.findSubscriptionAdditionalData(subscription.paymentReference);
            if (!additionalData || !additionalData.coupons) {
                continue;
            }
            for (const coupon of additionalData.coupons) {
                if (coupon.apply_till && coupon.apply_till * 1000 < date.getTime()) {
                    continue;
                }
                appliedCouponIds.push(coupon.coupon_id);
            }
        }
        return appliedCouponIds;
    }
}