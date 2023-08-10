/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import "mocha";
import * as chai from "chai";
import { WithSpan } from "./open-telemetry-tracing";
import { trace } from "@opentelemetry/api";
import { SimpleSpanProcessor, InMemorySpanExporter } from "@opentelemetry/tracing";
import { NodeTracerProvider } from "@opentelemetry/node";
import { AsyncHooksContextManager } from "@opentelemetry/context-async-hooks";
import { context } from "@opentelemetry/api";

const contextManager = new AsyncHooksContextManager();
context.setGlobalContextManager(contextManager);
const memoryExporter = new InMemorySpanExporter();
const tracerProvider = new NodeTracerProvider(); // or BasicTracerProvider based on your setup

tracerProvider.addSpanProcessor(new SimpleSpanProcessor(memoryExporter));
trace.setGlobalTracerProvider(tracerProvider);

const expect = chai.expect;

class ClassA {
    @WithSpan()
    methodA() {
        return "hello";
    }
}
class ClassB {
    constructor(private a: ClassA) {}

    @WithSpan()
    methodB() {
        return this.a.methodA();
    }
}

describe("open-telemetry-tracing", () => {
    const tracer = trace.getTracer("server");

    it.only("should trace", () => {
        const a = new ClassA();
        const b = new ClassB(a);
        memoryExporter.reset();
        tracer.startActiveSpan("test", (span) => {
            expect(b.methodB()).to.equal("hello");
            span.end();
        });
        const spans = memoryExporter.getFinishedSpans();
        for (const span of spans) {
            console.log(span.name, span.attributes, span.parentSpanId, span.duration, span.status, span.ended);
        }
        expect(spans.length).to.equal(3);
        expect(spans[0].name).to.equal("ClassA#methodA");
        expect(spans[0].parentSpanId).to.equal(spans[1].spanContext().spanId);
        expect(spans[1].name).to.equal("ClassB#methodB");
        expect(spans[1].parentSpanId).to.equal(spans[2].spanContext().spanId);
        expect(spans[2].name).to.equal("test");
        expect(spans[2].parentSpanId).to.be.undefined;
    });
});
