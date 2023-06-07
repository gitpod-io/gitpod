/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { suite, test } from "mocha-typescript";
import { scrubKeyValue, scrubReplacer, scrubValue } from "./scrubbing";
const expect = chai.expect;

@suite
export class ScrubbingTest {
    @test public testValue_EmptyString() {
        expect(scrubValue("")).to.equal("");
    }
    @test public testValue_Email() {
        expect(scrubValue("foo@bar.com")).to.equal("[redacted:md5:f3ada405ce890b6f8204094deb12d8a8:email]");
    }
    @test public testValue_EmailInText() {
        expect(scrubValue("The email is foo@bar.com or bar@foo.com")).to.equal(
            "The email is [redacted:md5:f3ada405ce890b6f8204094deb12d8a8:email] or [redacted:md5:dc8a42aba3651b0b1f088ef928ff3b1d:email]",
        );
    }

    @test public testKeyValue_Email() {
        expect(scrubKeyValue("email", "testvalue")).to.equal("[redacted:md5:e9de89b0a5e9ad6efd5e5ab543ec617c]");
    }
    @test public testKeyValue_AuthorEmail() {
        expect(scrubKeyValue("author_email", "testvalue")).to.equal("[redacted:md5:e9de89b0a5e9ad6efd5e5ab543ec617c]");
    }
    @test public testKeyValue_Token() {
        expect(scrubKeyValue("token", "testvalue")).to.equal("[redacted]");
    }
    @test public testKeyValue_OwnerToken() {
        expect(scrubKeyValue("owner_token", "testvalue")).to.equal("[redacted]");
    }

    @test public testJSON_BasicHappyPath() {
        const createObject = () => {
            return {
                ok: true,
                email: "foo@bar.com",
                workspaceID: "gitpodio-gitpod-uesaddev73c",
            };
        };
        const obj = createObject();
        expect(JSON.stringify(obj, scrubReplacer)).to.equal(
            `{"ok":true,"email":"[redacted:md5:f3ada405ce890b6f8204094deb12d8a8]","workspaceID":"[redacted:md5:a35538939333def8477b5c19ac694b35]"}`,
            "scrubbing should work recursively",
        );
        expect(obj).to.deep.equal(createObject(), "scrubbing should not modify the original object");
    }
    @test public testJSON_ComplexObject() {
        const createObject = () => {
            return {
                auth: { owner_token: "abcsecrettokendef", total: {} },
                env: [
                    { name: "SECRET_PASSWORD", value: "i-am-leaked-in-the-logs-yikes" },
                    { name: "GITHUB_TOKEN", value: "thisismyGitHubTokenDontStealIt" },
                    { name: "SUPER_SEKRET", value: "you.cant.see.me.or.can.you" },
                    { name: "GITHUB_SSH_PRIVATE_KEY", value: "super-secret-private-ssh-key-from-github" },
                    { name: "SHELL", value: "zsh" },
                    { name: "GITLAB_TOKEN", value: "abcsecrettokendef" },
                ],
                source: {
                    file: {
                        contextPath: ".",
                        dockerfilePath: ".gitpod.dockerfile",
                        dockerfileVersion: "82561e7f6455e3c0e6ee98be03c4d9aab4d459f8",
                        source: {
                            git: {
                                checkoutLocation: "test.repo",
                                cloneTaget: "good-workspace-image",
                                config: {
                                    authPassword: "super-secret-password",
                                    authUser: "oauth2",
                                    authentication: "BASIC_AUTH",
                                },
                                remoteUri: "https://github.com/AlexTugarev/test.repo.git",
                                targetMode: "REMOTE_BRANCH",
                            },
                        },
                    },
                },
            };
        };
        const obj = createObject();
        expect(JSON.stringify(obj, scrubReplacer)).to.equal(
            `{"auth":{"owner_token":"[redacted]","total":{}},"env":[{"name":"SECRET_PASSWORD","value":"[redacted]"},{"name":"GITHUB_TOKEN","value":"[redacted]"},{"name":"SUPER_SEKRET","value":"you.cant.see.me.or.can.you"},{"name":"GITHUB_SSH_PRIVATE_KEY","value":"[redacted]"},{"name":"SHELL","value":"zsh"},{"name":"GITLAB_TOKEN","value":"[redacted]"}],"source":{"file":{"contextPath":".","dockerfilePath":".gitpod.dockerfile","dockerfileVersion":"82561e7f6455e3c0e6ee98be03c4d9aab4d459f8","source":{"git":{"checkoutLocation":"test.repo","cloneTaget":"good-workspace-image","config":{"authPassword":"[redacted]","authUser":"oauth2","authentication":"BASIC_AUTH"},"remoteUri":"https://github.com/AlexTugarev/test.repo.git","targetMode":"REMOTE_BRANCH"}}}}}`,
            "scrubbing should work recursively",
        );
        expect(obj).to.deep.equal(createObject(), "scrubbing should not modify the original object");
    }
    @test public testJSON_String() {
        const val = "foo@bar.com";
        expect(JSON.stringify(val, scrubReplacer)).to.equal(`"[redacted:md5:f3ada405ce890b6f8204094deb12d8a8:email]"`);
        expect(val).to.equal("foo@bar.com", "scrubbing should not modify the original object");
    }
    @test public testJSON_Array() {
        const val = ["foo@bar.com"];
        expect(JSON.stringify(val, scrubReplacer)).to.equal(
            `["[redacted:md5:f3ada405ce890b6f8204094deb12d8a8:email]"]`,
        );
        expect(val).to.deep.equal(["foo@bar.com"], "scrubbing should not modify the original object");
    }
}
module.exports = new ScrubbingTest();
