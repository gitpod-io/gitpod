/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Entity, Column, PrimaryColumn, Index } from "typeorm";
import { TypeORM } from "../../typeorm/typeorm";
import { Transformer } from "../../typeorm/transformer";
import { Subscription, PaymentData } from "@gitpod/gitpod-protocol/lib/accounting-protocol";

@Entity()
@Index("ind_user_paymentReference", ["userId", "paymentReference"])
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBSubscription implements Subscription {

    @PrimaryColumn("uuid")
    uid: string;

    @Column(TypeORM.UUID_COLUMN_TYPE)
    userId: string;

    @Column()
    startDate: string;

    @Column({
        default: '',
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED
    })
    endDate?: string;

    @Column({
        default: '',
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED
    })
    cancellationDate?: string;

    @Column('double')
    amount: number;

    @Column('double', { nullable: true })
    firstMonthAmount?: number;

    @Column({ default: 'free' })
    @Index("ind_planId")
    planId: string;

    @Column({
        default: '',
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED
    })
    paymentReference?: string;

    @Column("simple-json", { nullable: true })
    paymentData?: PaymentData;

    @Column({
        default: '',
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED
    })
    teamSubscriptionSlotId?: string;

    @Column({
        default: false
    })
    deleted?: boolean;
}

@Entity()
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
export class DBSubscriptionAdditionalData {

    @PrimaryColumn()
    paymentReference: string;

    @Column({
        default: 0
    })
    mrr: number;

    @Column("simple-json", { nullable: true })
    coupons?: CouponData[];

    @Column()
    lastInvoiceAmount: number;

    @Column({
        default: '',
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED
    })
    lastInvoice?: string;

    @Column({
        default: '',
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED
    })
    nextBilling?: string;

    @Column({
        type: 'timestamp',
        precision: 6,
        transformer: Transformer.MAP_ISO_STRING_TO_TIMESTAMP_DROP
    })
    lastModified?: string;
}

export interface CouponData {
    /*
     * Used to uniquely identify the coupon. string, max chars=50
     */
    coupon_id: string;

    /*
     * The date till the coupon is to be applied.
     * Applicable for "limited months" coupons.
     * optional, timestamp(UTC) in seconds
     */
    apply_till?: number;

    /*
     * Number of times this coupon has been applied for this subscription.
     */
    applied_count: number;

    /*
     * The coupon code used to redeem the coupon.
     * Will be present only when associated code for a coupon is used.
     */
    coupon_code?: string;
}

@Entity()
// on DB but not Typeorm: @Index("ind_lastModified", ["_lastModified"])   // DBSync
@Index("ind_userId_softDeletedTime", ["userId", "softDeletedTime"])
export class DBPaymentSourceInfo {
    @PrimaryColumn()
    id: string;

    @PrimaryColumn({
        type: "bigint"
    })
    @Index("ind_resourceVersion")   // Necessary for certain operations: https://dev.mysql.com/doc/refman/8.0/en/order-by-optimization.html
    resourceVersion: number;

    @Column(TypeORM.UUID_COLUMN_TYPE)
    userId: string;

    @Column()
    status: PaymentSourceStatus;

    @Column()
    cardExpiryMonth: number;

    @Column()
    cardExpiryYear: number;

    @Column({
        type: "varchar",
        length: 30,
        default: '',
        transformer: Transformer.MAP_EMPTY_STR_TO_UNDEFINED
    })
    softDeletedTime?: string;
}
export type PaymentSourceStatus = "valid" | "expiring" | "expired" | "invalid" | "pending_verification";