/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


/**
 * The subset of actually available fields and methods which are not exported but we care about
 */
interface TestSuiteContext extends Mocha.ISuiteCallbackContext {
    title: string;
    beforeEach: (cb: (this: Mocha.IHookCallbackContext) => void) => void;
}

/**
 * Skips all tests of the marked Suite if the passed function returns true
 * @param doSkip A function which takes a TestSuite and decides if it should be skipped
 */
export function skipIf(doSkip: (suite: TestSuiteContext) => boolean): MochaTypeScript.SuiteTrait {
    const trait: MochaTypeScript.SuiteTrait = function(this: Mocha.ISuiteCallbackContext, ctx: Mocha.ISuiteCallbackContext, ctor: Function): void {
        const suite = ctx as any as TestSuiteContext;  // No idea why those fields are not exported in the types
        const skip = doSkip(suite);
        suite.beforeEach(function(this: Mocha.IHookCallbackContext) {
            if (skip) {
                this.skip();
            }
        })
    };

    // Mark as "trait": mimics the behavior of https://github.com/testdeck/testdeck/blob/9d2dd6a458c2c86c945f6f2999b8278b7528a7a7/index.ts#L433
    (trait as any)["__mts_isTrait"] = true;
    return trait;
}

/**
 * Skips a Mocha TestSuite if a certain env var is not set and prints its
 * @param name The name of the env var the TestSuite depends on being present
 */
export function skipIfEnvVarNotSet(name: string): MochaTypeScript.SuiteTrait {
    return skipIf((suite) => {
        const skip = process.env[name] === undefined;
        if (skip) {
            console.log(`Skipping suite ${suite.title} because env var '${name}' is not set`);
        }
        return skip;
    });
}