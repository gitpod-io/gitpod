/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test } from "@testdeck/mocha";
import * as chai from "chai";

import { generateAsyncGenerator } from "./generate-async-generator";
import { Disposable } from "./util/disposable";
import EventIterator from "event-iterator";

const expect = chai.expect;

function watchWith(times: number, listener: (value: number) => void): Disposable {
    let i = 0;
    const cancel = setInterval(() => {
        if (i < times) {
            listener(i++);
        }
    }, 100);
    return {
        dispose: () => {
            clearInterval(cancel);
        },
    };
}

const error = new Error("Test error");
interface Ref {
    isDisposed: boolean;
    result: number[];
    watchStarted: boolean;
}

interface Option {
    errorAfter?: number;
    times: number;
    abortAfterMs?: number;
    setupError?: boolean;
}

function watchIterator(ref: Ref, opts: Option) {
    const abortController = new AbortController();
    setTimeout(() => {
        abortController.abort();
    }, opts.abortAfterMs ?? 600);
    return generateAsyncGenerator<number>(
        (sink) => {
            try {
                if (opts.setupError) {
                    throw error;
                }
                ref.watchStarted = true;
                const dispose = watchWith(opts.times, (v) => {
                    if (opts.errorAfter && opts.errorAfter === v) {
                        sink.fail(error);
                        return;
                    }
                    sink.push(v);
                });
                return () => {
                    ref.isDisposed = true;
                    dispose.dispose();
                };
            } catch (e) {
                sink.fail(e as any as Error);
            }
        },
        { signal: abortController.signal },
    );
}

@suite
class TestGenerateAsyncGenerator {
    @test public async "happy path"() {
        const ref: Ref = { isDisposed: false, result: [], watchStarted: false };
        const it: EventIterator<number> = watchIterator(ref, { times: 5 });
        try {
            for await (const v of it) {
                ref.result.push(v);
            }
            expect.fail("should throw error");
        } catch (e) {
            if (ref.watchStarted) {
                expect(ref.isDisposed).to.be.equal(true);
            }
            expect(e.message).to.be.equal("Abort error");
            expect(ref.result.length).to.be.equal(5);
            ref.result.forEach((v, i) => expect(v).to.be.equal(i));
            expect(ref.isDisposed).to.be.equal(true);
        }
    }

    @test public async "should be stopped after abort signal is triggered"() {
        const ref: Ref = { isDisposed: false, result: [], watchStarted: false };
        const it = watchIterator(ref, { times: 5, abortAfterMs: 120 });
        try {
            for await (const v of it) {
                ref.result.push(v);
            }
            expect.fail("should throw error");
        } catch (e) {
            if (ref.watchStarted) {
                expect(ref.isDisposed).to.be.equal(true);
            }
            expect(e.message).to.be.equal("Abort error");
            expect(ref.result[0]).to.be.equal(0);
            expect(ref.result.length).to.be.equal(1);
            ref.result.forEach((v, i) => expect(v).to.be.equal(i));
            expect(ref.isDisposed).to.be.equal(true);
        }
    }

    @test public async "should throw error if setup throws"() {
        const ref: Ref = { isDisposed: false, result: [], watchStarted: false };
        const it = watchIterator(ref, { times: 5, setupError: true });
        try {
            for await (const v of it) {
                ref.result.push(v);
            }
            expect.fail("should throw error");
        } catch (e) {
            if (ref.watchStarted) {
                expect(ref.isDisposed).to.be.equal(true);
            }
            expect(e).to.be.equal(error);
            expect(ref.result.length).to.be.equal(0);
            ref.result.forEach((v, i) => expect(v).to.be.equal(i));
            expect(ref.isDisposed).to.be.equal(false);
        }
    }

    @test public async "should propagate errors from sink.next"() {
        const ref: Ref = { isDisposed: false, result: [], watchStarted: false };
        const it = watchIterator(ref, { times: 5, errorAfter: 2 });
        try {
            for await (const v of it) {
                ref.result.push(v);
            }
            expect.fail("should throw error");
        } catch (e) {
            if (ref.watchStarted) {
                expect(ref.isDisposed).to.be.equal(true);
            }
            expect(e).to.be.equal(error);
            expect(ref.result.length).to.be.equal(2);
            ref.result.forEach((v, i) => expect(v).to.be.equal(i));
            expect(ref.isDisposed).to.be.equal(true);
        }
    }

    @test public async "should not start iterator if pre throw error in an iterator"() {
        const ref: Ref = { isDisposed: false, result: [], watchStarted: false };
        const it = this.mockWatchWorkspaceStatus(ref, { times: 5, errorAfter: 2 });
        try {
            for await (const v of it) {
                ref.result.push(v);
            }
            expect.fail("should throw error");
        } catch (e) {
            expect(ref.watchStarted).to.be.equal(false);
            if (ref.watchStarted) {
                expect(ref.isDisposed).to.be.equal(true);
            }
            expect(e.message).to.be.equal("Should throw error");
            expect(ref.result.length).to.be.equal(0);
            ref.result.forEach((v, i) => expect(v).to.be.equal(i));
            expect(ref.isDisposed).to.be.equal(false);
        }
    }

    async *mockWatchWorkspaceStatus(ref: Ref, option: Option): AsyncIterable<number> {
        const shouldThrow = true;
        if (shouldThrow) {
            throw new Error("Should throw error");
        }
        const it = watchIterator(ref, option);
        for await (const item of it) {
            yield item;
        }
    }
}

module.exports = new TestGenerateAsyncGenerator(); // Only to circumvent no usage warning :-/
