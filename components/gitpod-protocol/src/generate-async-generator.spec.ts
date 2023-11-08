/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test } from "@testdeck/mocha";
import * as chai from "chai";

import { generateAsyncGenerator } from "./generate-async-generator";
import { Disposable } from "./util/disposable";

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
            console.log("clean");
            clearInterval(cancel);
        },
    };
}

const error = new Error("Test error");
function watchIterator(
    resultRef: { isDisposed: boolean; result: number[] },
    option: { errorAfter?: number; times: number; abortAfterMs?: number; setupError?: boolean },
) {
    const abortController = new AbortController();
    setTimeout(() => {
        abortController.abort();
    }, option.abortAfterMs ?? 600);
    return generateAsyncGenerator<number>(
        (sink) => {
            try {
                if (option.setupError) {
                    throw error;
                }
                const dispose = watchWith(option.times, (v) => {
                    if (option.errorAfter && option.errorAfter === v) {
                        sink.fail(error);
                        return;
                    }
                    sink.push(v);
                });
                return () => {
                    resultRef.isDisposed = true;
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
        const ref: { isDisposed: boolean; result: number[] } = { isDisposed: false, result: [] };
        const it = watchIterator(ref, { times: 5 });
        try {
            for await (const v of it) {
                ref.result.push(v);
            }
            expect.fail("should throw error");
        } catch (e) {
            expect(e.message).to.be.equal("Abort error");
            expect(ref.result.length).to.be.equal(5);
            expect(ref.isDisposed).to.be.equal(true);
        }
    }

    @test public async "should be stopped after abort signal is triggered"() {
        const ref: { isDisposed: boolean; result: number[] } = { isDisposed: false, result: [] };
        const it = watchIterator(ref, { times: 5, abortAfterMs: 120 });
        try {
            for await (const v of it) {
                ref.result.push(v);
            }
            expect.fail("should throw error");
        } catch (e) {
            expect(e.message).to.be.equal("Abort error");
            expect(ref.result[0]).to.be.equal(0);
            expect(ref.result.length).to.be.equal(1);
            expect(ref.isDisposed).to.be.equal(true);
        }
    }

    @test public async "should throw error if setup throws"() {
        const ref: { isDisposed: boolean; result: number[] } = { isDisposed: false, result: [] };
        const it = watchIterator(ref, { times: 5, setupError: true });
        try {
            for await (const v of it) {
                ref.result.push(v);
            }
            expect.fail("should throw error");
        } catch (e) {
            expect(e).to.be.equal(error);
            expect(ref.result.length).to.be.equal(0);
            expect(ref.isDisposed).to.be.equal(false);
        }
    }

    @test public async "should propagate errors from sink.next"() {
        const ref: { isDisposed: boolean; result: number[] } = { isDisposed: false, result: [] };
        const it = watchIterator(ref, { times: 5, errorAfter: 2 });
        try {
            for await (const v of it) {
                ref.result.push(v);
            }
            expect.fail("should throw error");
        } catch (e) {
            expect(e).to.be.equal(error);
            expect(ref.result.length).to.be.equal(2);
            expect(ref.isDisposed).to.be.equal(true);
        }
    }
}

module.exports = new TestGenerateAsyncGenerator(); // Only to circumvent no usage warning :-/
