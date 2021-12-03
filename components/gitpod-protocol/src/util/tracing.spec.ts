/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { suite, test } from "mocha-typescript"
import * as chai from "chai"
import { TraceContext } from "./tracing";
import { MockTracer } from "opentracing";

const expect = chai.expect

@suite class TestTracing {

    @test public async testTracingContext_addNestedTags() {
        const tracer = new MockTracer();
        const span = tracer.startSpan('testTracingContext_addNestedTags');
        TraceContext.addNestedTags({ span }, {
            rpc: {
                system: "jsonrpc",
                jsonrpc: {
                    version: "1.0",
                    method: "test",
                    parameters: ["abc", "def"],
                },
            },
        });

        const mockSpan = tracer.report().spans[0];
        expect(mockSpan.tags()).to.deep.equal({
            "rpc.system": "jsonrpc",
            "rpc.jsonrpc.version": "1.0",
            "rpc.jsonrpc.method": "test",
            "rpc.jsonrpc.parameters.0": "abc",
            "rpc.jsonrpc.parameters.1": "def",
        });
    }

    @test public async testTracingContext_addJsonRPCParameters() {
        const tracer = new MockTracer();
        const span = tracer.startSpan('testTracingContext_addJsonRPCParameters');
        const ctx = { span };
        TraceContext.addJsonRPCParameters(ctx, {
            one: "one",
            two: {
                name: "two",
                some: "shape",
                containing: "PII",
            },
            three: "three",
        });

        const mockSpan = tracer.report().spans[0];
        expect(mockSpan.tags()).to.deep.equal({
            "rpc.jsonrpc.parameters.one": "one",
            "rpc.jsonrpc.parameters.two.containing": "PII",
            "rpc.jsonrpc.parameters.two.name": "two",
            "rpc.jsonrpc.parameters.two.some": "shape",
            "rpc.jsonrpc.parameters.three": "three",
            "rpc.system": "jsonrpc",
        });
    }

}
module.exports = new TestTracing()
