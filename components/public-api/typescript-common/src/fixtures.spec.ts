/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { glob } from "glob";
import { join } from "path";
import { assert, expect } from "chai";

const isForce = process.argv.includes("-force");
const isUpdating = process.argv.includes("-update");

/**
 * Golden file testing, which is align to our fixtures.go test.
 * It takes a glob pattern and a function to generate the test results from input.
 *
 * Write input JSON files then use `yarn test:forceUpdate` to generate golden files.
 *
 * @example
 * describe("fixtures", () => {
 *     it("should be able to run fixtures", async () => {
 *         await startFixtureTest("../fixtures/toOrg*.json", (input) => {
 *             input.id = Number(input.id);
 *             return input;
 *         });
 *     });
 * });
 *
 * @param path glob pattern to find input JSON files
 * @param testResult function to generate the test results from input
 */
export async function startFixtureTest(path: string, testResult: (input: any) => Promise<any>) {
    const files = glob.sync(join(__dirname, path));
    if (files.length === 0) {
        assert.fail(
            "no input files found with glob " +
                path +
                `. Try \`node scripts/new-fixtures.js ${path.split("/").pop()?.replace("_*.json", "")} 1\``,
        );
    }

    for (const file of files) {
        const input = JSON.parse(readFileSync(file).toString());
        let result: any | undefined;
        let err: Error | undefined;
        try {
            result = await testResult(input);
        } catch (e) {
            err = e;
        }
        const goldenFile = file.replace(".json", ".golden");
        const actual = JSON.parse(JSON.stringify({ result, err: err?.message ?? "" }));
        if (isUpdating) {
            if (!existsSync(goldenFile) || isForce) {
                writeFileSync(goldenFile, JSON.stringify(actual, null, 4) + "\n");
                console.log("wrote new gold standard in %s", goldenFile.split("/").pop());
            } else {
                console.log("not overwriting golden file %s", goldenFile.split("/").pop());
            }
        }
        if (!existsSync(goldenFile)) {
            assert.fail(
                "no golden file for " + file.split("/").pop() + " file. Try `yarn test:forceUpdate` to generate it",
            );
        }
        const expected = JSON.parse(readFileSync(goldenFile).toString());
        expect(
            actual,
            "excepted golden results for " +
                file.split("/").pop() +
                " file. Did we changed testResult function? If so, try `yarn test:forceUpdate`. If not, check your testResult function",
        ).to.deep.equal(expected);
    }
}
