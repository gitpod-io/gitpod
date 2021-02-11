/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import "reflect-metadata";

import { suite, test } from "@testdeck/mocha";
import * as chai from 'chai';
import { EnvvarPrefixParser } from "./envvar-prefix-context-parser";
import { WithEnvvarsContext } from "@gitpod/gitpod-protocol";
const expect = chai.expect;

@suite
class TestEnvvarPrefixParser {
    protected parser: EnvvarPrefixParser;

    public before() {
        this.parser = new EnvvarPrefixParser();
    }

    @test
    public testFindPrefixGood() {
        expect(this.findPrefix("foo=bar/http...")).to.be.equal("foo=bar/");
        expect(this.findPrefix("foo1=bar1,foo2=bar2/http...")).to.be.equal("foo1=bar1,foo2=bar2/");
    }

    @test
    public testFindPrefixSomewhatOk() {
        expect(this.findPrefix("foo==bar,,foo2=bar2/http...")).to.be.equal("foo==bar,,foo2=bar2/");
        expect(this.findPrefix("foo1=bar1,foo2=bar2/http...")).to.be.equal("foo1=bar1,foo2=bar2/");
    }

    @test
    public testFindPrefixBad() {
        expect(this.findPrefix("foo==bar,,/http...")).to.be.undefined;
    }

    @test
    public async testHandleGood() {
        expect(await this.parseAndFormat("foo=bar/")).to.deep.equal({ "foo": "bar" });
        expect(await this.parseAndFormat("foo1=bar1,foo2=bar2/")).to.deep.equal({ "foo1": "bar1", "foo2": "bar2" });
        expect(await this.parseAndFormat("foo1=bar1,foo2=bar2,foo3=bar3/")).to.deep.equal({ "foo1": "bar1", "foo2": "bar2", "foo3": "bar3" });
        expect(await this.parseAndFormat("foo1=bar1,foo2=bar2,foo3=bar3,foo4=bar4/")).to.deep.equal({ "foo1": "bar1", "foo2": "bar2", "foo3": "bar3", "foo4": "bar4" });
    }

    @test
    public async testHandleDuplicate() {
        expect(await this.parseAndFormat("foo1=bar1,foo2=bar21,foo2=bar22/")).to.deep.equal({ "foo1": "bar1", "foo2": "bar22" });
        expect(await this.parseAndFormat("foo1=bar11,foo1=bar12,foo3=bar31,foo3=bar32/")).to.deep.equal({ "foo1": "bar12", "foo3": "bar32" });
    }

    @test
    public async testHandleBad() {
        expect(await this.parseAndFormat("foo1=/")).to.be.undefined;
        expect(await this.parseAndFormat("=bar/")).to.be.undefined;
        expect(await this.parseAndFormat("foo1==bar1,foo2=bar2/")).to.deep.equal({ "foo2": "bar2" });
        expect(await this.parseAndFormat("foo==bar,,foo2=bar2/")).to.deep.equal({ "foo2": "bar2" });
        expect(await this.parseAndFormat("fo% 1=bar1,foo2=bar2/")).to.deep.equal({ "foo2": "bar2" });
    }

    protected async parseAndFormat(prefix: string) {
        const result = await this.parser.handle(/*user=*/undefined as any, prefix, undefined as any);
        if (WithEnvvarsContext.is(result)) {
            const r: { [key: string]: string } = {};
            result.envvars.forEach(e => r[e.name] = e.value);
            return r;
        }
        return undefined
    }

    protected findPrefix(url: string) {
        return this.parser.findPrefix(/*user=*/undefined as any, url);
    }
}

module.exports = new TestEnvvarPrefixParser()
