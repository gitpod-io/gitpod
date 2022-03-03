/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { suite, test, slow, timeout } from 'mocha-typescript';
import * as chai from 'chai';
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);

import { Queue } from '..';
import { fail } from 'assert';
import { Deferred } from './deferred';

const expect = chai.expect;

@suite
class QueueSpec {
    queue: Queue;
    seq: number[];

    before() {
        this.queue = new Queue();
        this.seq = [];
    }

    async exec(seqNr: number, nextTick: boolean = false, sleep: number = 0) {
        return this.queue.enqueue(async () => {
            const push = async () => {
                if (sleep > 0)
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            this.seq.push(seqNr);
                            resolve(undefined);
                        }, sleep);
                    });
                else this.seq.push(seqNr);
            };

            if (nextTick)
                return new Promise((resolve) => {
                    process.nextTick(() => {
                        push().then(resolve);
                    });
                });
            else await push();
        });
    }
    execError(seqNr: number): Deferred<boolean> {
        const deferred = new Deferred<boolean>();
        this.queue
            .enqueue(async () => {
                this.seq.push(seqNr);
                throw new Error('test error');
            })
            .then(() => {
                deferred.reject(false);
            })
            .catch(() => {
                deferred.resolve(true);
            });

        return deferred;
    }

    protected expectArray<T>(actual: T[], expected: T[]) {
        expect(actual).to.have.lengthOf(expected.length);
        const expIt = expected.entries();
        for (const act of actual) {
            const {
                value: [, exp],
            } = expIt.next();
            expect(act).to.deep.equal(exp);
        }
    }

    @test public async isExecutedInOrder() {
        this.exec(1);
        await this.exec(2);

        this.expectArray(this.seq, [1, 2]);
    }

    @test public async isExecutedInOrderSkipTick() {
        this.exec(1, true);
        await this.exec(2);

        this.expectArray(this.seq, [1, 2]);
    }

    @test @timeout(3000) @slow(3000) public async isExecutedInOrderSleep() {
        this.exec(1, false, 2000);
        await this.exec(2);

        this.expectArray(this.seq, [1, 2]);
    }

    @test public async continueDespiteError() {
        this.exec(1);
        const receivedError = this.execError(2);
        await this.exec(3);

        expect(receivedError.isResolved).to.equal(true);
        expect(await receivedError.promise).to.equal(true);
        this.expectArray(this.seq, [1, 2, 3]);
    }

    @test public async mustCatchError() {
        const f = async () => {
            throw new Error();
        };
        try {
            const p = this.queue.enqueue(async () => {
                return f();
            });

            p.catch((err) => {
                // Silence unhandled promise rejection messages
            });
        } catch (err) {
            fail('We expect to catch no error');
        }
    }

    @test public async expectUncaughtError() {
        const f = async () => {
            throw new Error();
        };
        const p = this.queue.enqueue(async () => {
            return f();
        });
        p.then((r) => {
            fail('Expected to catch error!');
        }).catch((err) => {
            // Silence unhandled promise rejection messages
        });
    }
}
module.exports = new QueueSpec();
