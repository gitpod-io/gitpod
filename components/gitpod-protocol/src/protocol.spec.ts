/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test } from "@testdeck/mocha";
import * as chai from "chai";
import { SSHPublicKeyValue, EnvVar, EnvVarWithValue } from ".";

const expect = chai.expect;

@suite
class TestSSHPublicKeyValue {
    private key =
        "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDCnrN9UdK1bNGPmZfenTWXLuYYDjlYvZE8S+WOfP08WpR1GETzX5ZvgYOEZGwEE8KUPHC9cge4Hvo/ydIS9aqbZ5MiVGJ8cAIq1Ic89SjlDWU6fl8TwIqOPCi2imAASlEDP4q8vMLK1N6UOW1EVbxyL3uybGd10ysC1t1FxFPveIGNsYE/MOQeuEWS16AplpXYXIfVRSlgAskeBft2w8Ud3B4gNe8ECLA/FXu96UpvZkdtOarA3JZ9Z27GveNJg9Mtmmw0+US0KXiO9x9NyH7G8+mqVDwDY+nNvaFA5gtQxkkl/uY2oz9k/B4Rjlj3jOiUXe5uQs3XUm5m8g9a9fh62DabLpA2fEvtfg+a/VqNe52dNa5YjupwvBd6Inb5uMW/TYjNl6bNHPlXFKw/nwLOVzukpkjxMZUKS6+4BGkpoasj6y2rTU/wkpbdD8J7yjI1p6J9aKkC6KksIWgN7xGmHkv2PCGDqMHTNbnQyowtNKMgA/667vAYJ0qW7HAHBFXJRs6uRi/DI3+c1QV2s4wPCpEHDIYApovQ0fbON4WDPoGMyHd7kPh9xB/bX7Dj0uMXImu1pdTd62fQ/1XXX64+vjAAXS/P9RSCD0RCRt/K3LPKl2m7GPI3y1niaE52XhxZw+ms9ays6NasNVMw/ZC+f02Ti+L5FBEVf8230RVVRQ== notfound@gitpod.io";

    @test public testValidate() {
        const key = this.key;
        const [t, k, e] = key.split(" ");
        expect(
            SSHPublicKeyValue.getData({
                key,
                name: "NiceName",
            }),
        ).to.deep.equal({ type: t, key: k, email: e });
    }

    @test public testValidateWithDiffType() {
        const key = this.key;
        const [_, k, e] = key.split(" ");
        expect(
            SSHPublicKeyValue.getData({
                key: key.replace("ssh-rsa", "sk-ecdsa-sha2-nistp256@openssh.com"),
                name: "NiceName",
            }),
        ).to.deep.equal({ type: "sk-ecdsa-sha2-nistp256@openssh.com", key: k, email: e });
    }

    @test public testValidateWithoutEmail() {
        const key = this.key;
        const [t, k, _] = key.split(" ");
        expect(
            SSHPublicKeyValue.getData({
                key: key.replace(" notfound@gitpod.io", ""),
                name: "NiceName",
            }),
        ).to.deep.equal({ type: t, key: k, email: undefined });
    }

    @test public testValidateWithoutEmailButEndsWithSpaces() {
        const key = this.key;
        const [t, k, _] = key.split(" ");
        expect(
            SSHPublicKeyValue.getData({
                key: key.replace("notfound@gitpod.io", "  "),
                name: "NiceName",
            }),
        ).to.deep.equal({ type: t, key: k, email: undefined });
    }

    @test public testValidateWithError() {
        expect(() =>
            SSHPublicKeyValue.getData({
                key: "Hello World",
                name: "NiceName",
            }),
        ).throw("Key is invalid");

        expect(() =>
            SSHPublicKeyValue.getData({
                key: "",
                name: "NiceName",
            }),
        ).throw("Key is invalid");
    }

    @test public testGetFingerprint() {
        const key = this.key;
        expect(
            SSHPublicKeyValue.getFingerprint({
                key,
                name: "NiceName",
            }),
        ).to.equal("ykjP/b5aqoa3envmXzWpPMCGgEFMu3QvubfSTNrJCMA=");
    }

    @test public testGetFingerprintWithIncorrectPublicKey() {
        expect(() =>
            SSHPublicKeyValue.getFingerprint({
                key: "Hello World",
                name: "NiceName",
            }),
        ).to.throw("Key is invalid");
    }
}

@suite
class TestEnvVar {
    @test
    public testGetGitpodImageAuth_empty() {
        const result = EnvVar.getGitpodImageAuth([]);
        expect(result.size).to.equal(0);
    }

    @test
    public testGetGitpodImageAuth_noRelevantVar() {
        const envVars: EnvVarWithValue[] = [{ name: "OTHER_VAR", value: "some_value" }];
        const result = EnvVar.getGitpodImageAuth(envVars);
        expect(result.size).to.equal(0);
    }

    @test
    public testGetGitpodImageAuth_singleEntryNoPort() {
        const envVars: EnvVarWithValue[] = [
            {
                name: EnvVar.GITPOD_IMAGE_AUTH_ENV_VAR_NAME,
                value: "my-registry.foo.net:Zm9vOmJhcg==",
            },
        ];
        const result = EnvVar.getGitpodImageAuth(envVars);
        expect(result.size).to.equal(1);
        expect(result.get("my-registry.foo.net")).to.equal("Zm9vOmJhcg==");
    }

    @test
    public testGetGitpodImageAuth_singleEntryWithPort() {
        const envVars: EnvVarWithValue[] = [
            {
                name: EnvVar.GITPOD_IMAGE_AUTH_ENV_VAR_NAME,
                value: "my-registry.foo.net:5000:Zm9vOmJhcg==",
            },
        ];
        const result = EnvVar.getGitpodImageAuth(envVars);
        expect(result.size).to.equal(1);
        expect(result.get("my-registry.foo.net:5000")).to.equal("Zm9vOmJhcg==");
    }

    @test
    public testGetGitpodImageAuth_multipleEntries() {
        const envVars: EnvVarWithValue[] = [
            {
                name: EnvVar.GITPOD_IMAGE_AUTH_ENV_VAR_NAME,
                value: "my-registry.foo.net:Zm9vOmJhcg==,my-registry2.bar.com:YWJjOmRlZg==",
            },
        ];
        const result = EnvVar.getGitpodImageAuth(envVars);
        expect(result.size).to.equal(2);
        expect(result.get("my-registry.foo.net")).to.equal("Zm9vOmJhcg==");
        expect(result.get("my-registry2.bar.com")).to.equal("YWJjOmRlZg==");
    }

    @test
    public testGetGitpodImageAuth_multipleEntriesWithPortAndMalformed() {
        const envVars: EnvVarWithValue[] = [
            {
                name: EnvVar.GITPOD_IMAGE_AUTH_ENV_VAR_NAME,
                value: "my-registry.foo.net:5000:Zm9vOmJhcg==,my-registry2.bar.com:YWJjOmRlZg==,invalidEntry,another.host:anothercred",
            },
        ];
        const result = EnvVar.getGitpodImageAuth(envVars);
        expect(result.size).to.equal(3);
        expect(result.get("my-registry2.bar.com")).to.equal("YWJjOmRlZg==");
        expect(result.get("another.host")).to.equal("anothercred");
        expect(result.get("my-registry.foo.net:5000")).to.equal("Zm9vOmJhcg==");
    }

    @test
    public testGetGitpodImageAuth_emptyValue() {
        const envVars: EnvVarWithValue[] = [
            {
                name: EnvVar.GITPOD_IMAGE_AUTH_ENV_VAR_NAME,
                value: "",
            },
        ];
        const result = EnvVar.getGitpodImageAuth(envVars);
        expect(result.size).to.equal(0);
    }

    @test
    public testGetGitpodImageAuth_malformedEntries() {
        const envVars: EnvVarWithValue[] = [
            {
                name: EnvVar.GITPOD_IMAGE_AUTH_ENV_VAR_NAME,
                value: "justhost,hostonly:,:credonly,:::,:,",
            },
        ];
        const result = EnvVar.getGitpodImageAuth(envVars);
        expect(result.size).to.equal(0);
    }

    @test
    public testGetGitpodImageAuth_entriesWithSpaces() {
        const envVars: EnvVarWithValue[] = [
            {
                name: EnvVar.GITPOD_IMAGE_AUTH_ENV_VAR_NAME,
                value: " my-registry.foo.net : Zm9vOmJhcg== ,  my-registry2.bar.com:YWJjOmRlZg==  ",
            },
        ];
        const result = EnvVar.getGitpodImageAuth(envVars);
        expect(result.size).to.equal(2);
        expect(result.get("my-registry.foo.net")).to.equal("Zm9vOmJhcg==");
        expect(result.get("my-registry2.bar.com")).to.equal("YWJjOmRlZg==");
    }
}

// Exporting both test suites
const testSSHPublicKeyValue = new TestSSHPublicKeyValue();
const testEnvVar = new TestEnvVar();
module.exports = {
    testSSHPublicKeyValue,
    testEnvVar,
};
