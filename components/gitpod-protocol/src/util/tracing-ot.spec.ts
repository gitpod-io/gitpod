/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { SpanExporter, ReadableSpan, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { ExportResult, ExportResultCode } from "@opentelemetry/core";
import { expect } from "chai";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getActiveSpan, span } from "./tracing-ot";
import { HrTime } from "@opentelemetry/api";

describe("Tracing open telemetry", () => {
    let mockExporter: MockSpanExporter;
    let sdk: NodeSDK;

    before(() => {
        mockExporter = new MockSpanExporter();
        sdk = new NodeSDK({
            traceExporter: mockExporter,
            spanProcessor: new SimpleSpanProcessor(mockExporter),
        });

        sdk.start();
    });

    beforeEach(() => {
        mockExporter.clear();
    });

    after(() => {
        sdk.shutdown();
    });

    it("should create a span for the tested method", () => {
        // Sample class and method that you'd like to test
        class TestClass {
            @span
            testMethod() {
                return "result";
            }
        }

        const instance = new TestClass();
        instance.testMethod();
        const exportedSpans = mockExporter.spans;
        expect(exportedSpans).to.have.lengthOf(1);
        expect(exportedSpans[0].name).to.equal("TestClass.testMethod");
    });

    it("should have an appropriate duration for the async method", async () => {
        class TestClass {
            @span
            async testAsyncMethod() {
                return new Promise((resolve) => setTimeout(() => resolve("result"), 101));
            }
        }

        const instance = new TestClass();
        await instance.testAsyncMethod();

        const exportedSpans = mockExporter.spans;
        const duration = durationBetween(exportedSpans[0].startTime, exportedSpans[0].endTime);
        expect(duration).to.be.at.least(100); // Here 100 represents milliseconds
    });

    it("should set custom attributes on the span", () => {
        class TestClass {
            @span
            testMethodWithAttributes() {
                // Setting an attribute on the current span as an example
                getActiveSpan()?.setAttribute("custom", "value");
                return "result";
            }
        }

        const instance = new TestClass();
        instance.testMethodWithAttributes();

        const exportedSpans = mockExporter.spans;
        expect(exportedSpans[0].attributes).to.have.property("custom", "value");
    });

    it("should record events on the span", () => {
        class TestClass {
            @span
            testMethodWithEvent() {
                // Adding an event to the current span as an example
                getActiveSpan()?.addEvent("testEvent");
                return "result";
            }
        }

        const instance = new TestClass();
        instance.testMethodWithEvent();

        const exportedSpans = mockExporter.spans;
        expect(exportedSpans[0].events[0].name).to.equal("testEvent");
    });

    it("should create nested spans", () => {
        @span
        class TestClass {
            outerMethod() {
                this.innerMethod();
            }

            innerMethod() {
                return "inner result";
            }
        }

        const instance = new TestClass();
        instance.outerMethod();

        const exportedSpans = mockExporter.spans;
        expect(exportedSpans).to.have.lengthOf(2);
        expect(exportedSpans[0].parentSpanId).to.equal(exportedSpans[1].spanContext().spanId);
    });

    it("should add errors to the span", () => {
        class TestClass {
            @span
            testMethodWithError() {
                throw new Error("test error");
            }
        }

        const instance = new TestClass();
        try {
            instance.testMethodWithError();
            expect.fail("should have thrown");
        } catch (error) {
            // Ignore
        }

        const exportedSpans = mockExporter.spans;
        expect(exportedSpans[0].status.code).to.equal(2);
        expect(exportedSpans[0].status.message).to.equal("test error");
        expect(exportedSpans[0].events[0].name).to.equal("exception");
    });

    it("should ignore properties", () => {
        @span
        class TestClass {
            get testProperty() {
                return "test";
            }
        }

        const instance = new TestClass();
        instance.testProperty;

        const exportedSpans = mockExporter.spans;
        expect(exportedSpans).to.have.lengthOf(0);
    });
});

function hrTimeToMilliseconds(hrTime: HrTime): number {
    const [seconds, nanoseconds] = hrTime;
    return seconds * 1000 + nanoseconds / 1e6;
}

function durationBetween(startTime: HrTime, endTime: HrTime): number {
    return hrTimeToMilliseconds(endTime) - hrTimeToMilliseconds(startTime);
}

class MockSpanExporter implements SpanExporter {
    private _spans: ReadableSpan[] = [];

    export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
        this._spans.push(...spans);
        resultCallback({
            code: ExportResultCode.SUCCESS,
        });
    }

    shutdown(): Promise<void> {
        return Promise.resolve();
    }

    forceFlush?(): Promise<void> {
        return Promise.resolve();
    }

    get spans(): ReadableSpan[] {
        return this._spans;
    }

    clear(): void {
        this._spans = [];
    }
}
