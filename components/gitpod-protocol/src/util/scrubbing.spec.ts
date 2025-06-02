/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { suite, test } from "@testdeck/mocha";
import { TrustedValue, scrubber } from "./scrubbing";
const expect = chai.expect;

@suite
export class ScrubbingTest {
    @test public testValue_EmptyString() {
        expect(scrubber.scrub("")).to.equal("");
    }
    @test public testValue_Email() {
        expect(scrubber.scrub("foo@bar.com")).to.equal("[redacted:email]");
    }
    @test public testValue_EmailInText() {
        expect(scrubber.scrub("The email is foo@bar.com or bar@foo.com")).to.equal(
            "The email is [redacted:email] or [redacted:email]",
        );
    }

    @test public testKeyValue_Email() {
        expect(scrubber.scrub({ email: "testvalue" })).to.deep.equal({ email: "[redacted]" });
    }
    @test public testKeyValue_AuthorEmail() {
        expect(scrubber.scrub({ author_email: "testvalue" })).to.deep.equal({ author_email: "[redacted]" });
    }
    @test public testKeyValue_Token() {
        expect(scrubber.scrub({ token: "testvalue" })).to.deep.equal({ token: "[redacted]" });
    }
    @test public testKeyValue_OwnerToken() {
        expect(scrubber.scrub({ owner_token: "testvalue" })).to.deep.equal({ owner_token: "[redacted]" });
    }

    @test public testKeyValue_NestedObject() {
        expect(scrubber.scrub({ key: { owner_token: "testvalue" } }, true)).to.deep.equal({
            key: { owner_token: "[redacted]" },
        });
    }
    @test public testKeyValue_NoNestedObject() {
        expect(scrubber.scrub({ key: { owner_token: "testvalue" } }, false)).to.deep.equal({
            key: "[redacted:nested:object}]",
        });
    }

    @test public testKeyValue_NestedArray() {
        expect(scrubber.scrub([["foo@bar.com"]])).to.deep.equal([["[redacted:email]"]]);
    }

    @test public testKeyValue_NoNestedArray() {
        expect(scrubber.scrub([["foo@bar.com"]], false)).to.deep.equal(["[redacted:nested:array]"]);
    }

    @test public testKeyValue_Scrubbable() {
        const scrubbedValue = new TrustedValue(scrubber.scrubValue("foo@bar.com"));
        expect(scrubber.scrub({ key: scrubbedValue })).to.deep.equal({ key: "[redacted:email]" });
    }

    @test public testAnalyticsProperties_URLScrubbing() {
        // Test case that mirrors the analytics.track() usage pattern
        const mockInstance = {
            id: "test-instance-123",
            workspaceId: "test-workspace-456",
            stoppingTime: "2023-01-01T00:00:00.000Z",
            status: {
                conditions: [
                    {
                        message:
                            "Content initialization failed: cannot initialize workspace: git initializer gitClone: git clone --depth=1 --shallow-submodules https://gitlab.com/acme-corp/web/frontend/services/deployment-manager.git --config http.version=HTTP/1.1 . failed (exit status 128):",
                    },
                    {
                        message: "Another error with URL: https://github.com/user/repo.git",
                    },
                    {
                        message: "Error without URL",
                    },
                    {
                        message: "API call to https://api.example.com/endpoint failed",
                    },
                ],
                timeout: false,
            },
        };

        // This mirrors the exact usage in workspace-instance-controller.ts
        const scrubbedProperties = scrubber.scrub({
            instanceId: mockInstance.id,
            workspaceId: mockInstance.workspaceId,
            stoppingTime: new Date(mockInstance.stoppingTime),
            conditions: mockInstance.status.conditions,
            timeout: mockInstance.status.timeout,
        });

        // Verify workspaceId is hashed (field-based scrubbing)
        expect(scrubbedProperties.workspaceId).to.match(/^\[redacted:md5:[a-f0-9]{32}\]$/);

        // Verify instanceId is not scrubbed (not in sensitive fields)
        expect(scrubbedProperties.instanceId).to.equal("test-instance-123");

        // Verify URLs in nested conditions are hashed (pattern-based scrubbing)
        expect(scrubbedProperties.conditions[0].message).to.include("[redacted:md5:");
        expect(scrubbedProperties.conditions[0].message).to.include(":url]");
        expect(scrubbedProperties.conditions[0].message).to.not.include("gitlab.com");

        expect(scrubbedProperties.conditions[1].message).to.include("[redacted:md5:");
        expect(scrubbedProperties.conditions[1].message).to.include(":url]");
        expect(scrubbedProperties.conditions[1].message).to.not.include("github.com");

        // Verify non-URL message is unchanged
        expect(scrubbedProperties.conditions[2].message).to.equal("Error without URL");

        // Verify non-.git URL is NOT scrubbed
        expect(scrubbedProperties.conditions[3].message).to.equal(
            "API call to https://api.example.com/endpoint failed",
        );
        expect(scrubbedProperties.conditions[3].message).to.not.include("[redacted:md5:");

        // Verify other properties are preserved
        expect(scrubbedProperties.timeout).to.equal(false);
        // Date objects get converted to empty objects by the scrubber since they don't have enumerable properties
        expect(scrubbedProperties.stoppingTime).to.be.an("object");
    }

    @test public testURL_PatternScrubbing() {
        // Test individual URL scrubbing for .git URLs
        const urlMessage = "git clone https://gitlab.com/acme-corp/web/frontend/services/deployment-manager.git failed";
        const scrubbedMessage = scrubber.scrubValue(urlMessage);

        expect(scrubbedMessage).to.include("[redacted:md5:");
        expect(scrubbedMessage).to.include(":url]");
        expect(scrubbedMessage).to.not.include("gitlab.com");
        expect(scrubbedMessage).to.include("git clone");
        expect(scrubbedMessage).to.include("failed");
    }

    @test public testURL_NonGitURLsNotScrubbed() {
        // Test that non-.git URLs are NOT scrubbed
        const apiMessage = "API call to https://api.example.com/endpoint failed";
        const scrubbedMessage = scrubber.scrubValue(apiMessage);

        // Non-.git URLs should remain unchanged
        expect(scrubbedMessage).to.equal("API call to https://api.example.com/endpoint failed");
        expect(scrubbedMessage).to.not.include("[redacted:md5:");
    }

    @test public testURL_MixedURLTypes() {
        // Test message with both .git and non-.git URLs
        const mixedMessage = "Clone from https://github.com/user/repo.git then visit https://docs.gitpod.io/configure";
        const scrubbedMessage = scrubber.scrubValue(mixedMessage);

        // .git URL should be scrubbed
        expect(scrubbedMessage).to.include("[redacted:md5:");
        expect(scrubbedMessage).to.include(":url]");
        expect(scrubbedMessage).to.not.include("github.com/user/repo.git");

        // Non-.git URL should remain unchanged
        expect(scrubbedMessage).to.include("https://docs.gitpod.io/configure");
    }

    @test public testURL_HttpGitURLs() {
        // Test that http:// .git URLs are also scrubbed
        const httpMessage = "git clone http://internal-git.company.com/project.git";
        const scrubbedMessage = scrubber.scrubValue(httpMessage);

        expect(scrubbedMessage).to.include("[redacted:md5:");
        expect(scrubbedMessage).to.include(":url]");
        expect(scrubbedMessage).to.not.include("internal-git.company.com");
    }
}
module.exports = new ScrubbingTest();
