/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import * as chai from 'chai';
const expect = chai.expect;
import { suite, test } from 'mocha-typescript';

import { Subscription } from '@gitpod/gitpod-protocol/lib/accounting-protocol';

import { orderByEndDateDescThenStartDateDesc, orderByStartDateAscEndDateAsc } from './accounting-util';

const d1 = new Date(Date.UTC(2000, 0, 1)).toISOString();
const d2 = new Date(Date.UTC(2000, 0, 2)).toISOString();
const d3 = new Date(Date.UTC(2000, 0, 3)).toISOString();
const d4 = new Date(Date.UTC(2000, 0, 4)).toISOString();

const s1 = { startDate: d1, endDate: d3 } as Subscription;
const s2 = { startDate: d2, endDate: d4 } as Subscription;
const s3 = { startDate: d1, endDate: d4 } as Subscription;
const s5 = { startDate: d2, endDate: undefined } as Subscription;
const s6 = { startDate: d1, endDate: undefined } as Subscription;
const s7 = { startDate: '2018-11-20T15:25:48.000Z', endDate: '2018-11-27T15:25:48.000Z' } as Subscription;
const s8 = { startDate: '2018-11-27T15:25:48.000Z', endDate: undefined } as Subscription;

@suite
class AccountingUtilSpec {
    @test test_orderByEndDateDescThenStartDateDesc_overlap() {
        expect([s1, s2].sort(orderByEndDateDescThenStartDateDesc)).to.deep.equal([s2, s1]);
        expect([s2, s1].sort(orderByEndDateDescThenStartDateDesc)).to.deep.equal([s2, s1]);
    }

    @test test_orderByEndDateDescThenStartDateDesc_sameEndDate() {
        expect([s2, s3].sort(orderByEndDateDescThenStartDateDesc)).to.deep.equal([s2, s3]);
        expect([s3, s2].sort(orderByEndDateDescThenStartDateDesc)).to.deep.equal([s2, s3]);
    }

    @test test_orderByEndDateDescThenStartDateDesc_sameStartDate() {
        expect([s1, s3].sort(orderByEndDateDescThenStartDateDesc)).to.deep.equal([s3, s1]);
        expect([s3, s1].sort(orderByEndDateDescThenStartDateDesc)).to.deep.equal([s3, s1]);
    }

    @test test_orderByEndDateDescThenStartDateDesc_OpenEndDate1() {
        expect([s1, s5].sort(orderByEndDateDescThenStartDateDesc)).to.deep.equal([s5, s1]);
        expect([s5, s1].sort(orderByEndDateDescThenStartDateDesc)).to.deep.equal([s5, s1]);
    }

    @test test_orderByEndDateDescThenStartDateDesc_OpenEndDate2() {
        expect([s2, s6].sort(orderByEndDateDescThenStartDateDesc)).to.deep.equal([s6, s2]);
        expect([s6, s2].sort(orderByEndDateDescThenStartDateDesc)).to.deep.equal([s6, s2]);
    }

    @test test_orderByEndDateDescThenStartDateDesc_OpenEndDate3() {
        expect([s8, s7].sort(orderByEndDateDescThenStartDateDesc)).to.deep.equal([s8, s7]);
        expect([s7, s8].sort(orderByEndDateDescThenStartDateDesc)).to.deep.equal([s8, s7]);
    }

    @test test_orderByStartDateAscEndDateAsc_overlap() {
        expect([s1, s2].sort(orderByStartDateAscEndDateAsc)).to.deep.equal([s1, s2]);
        expect([s2, s1].sort(orderByStartDateAscEndDateAsc)).to.deep.equal([s1, s2]);
    }

    @test test_orderByStartDateAscEndDateAsc_sameEndDate() {
        expect([s2, s3].sort(orderByStartDateAscEndDateAsc)).to.deep.equal([s3, s2]);
        expect([s3, s2].sort(orderByStartDateAscEndDateAsc)).to.deep.equal([s3, s2]);
    }

    @test test_orderByStartDateAscEndDateAsc_sameStartDate() {
        expect([s1, s3].sort(orderByStartDateAscEndDateAsc)).to.deep.equal([s1, s3]);
        expect([s3, s1].sort(orderByStartDateAscEndDateAsc)).to.deep.equal([s1, s3]);
    }

    @test test_orderByStartDateAscEndDateAsc_OpenEndDate1() {
        expect([s1, s6].sort(orderByStartDateAscEndDateAsc)).to.deep.equal([s1, s6]);
        expect([s6, s1].sort(orderByStartDateAscEndDateAsc)).to.deep.equal([s1, s6]);
    }

    @test test_orderByStartDateAscEndDateAsc_OpenEndDate2() {
        expect([s1, s5].sort(orderByStartDateAscEndDateAsc)).to.deep.equal([s1, s5]);
        expect([s5, s1].sort(orderByStartDateAscEndDateAsc)).to.deep.equal([s1, s5]);
    }

    @test test_orderByStartDateAscEndDateAsc_OpenEndDate3() {
        expect([s2, s6].sort(orderByStartDateAscEndDateAsc)).to.deep.equal([s6, s2]);
        expect([s6, s2].sort(orderByStartDateAscEndDateAsc)).to.deep.equal([s6, s2]);
    }
}

export const t = new AccountingUtilSpec();
