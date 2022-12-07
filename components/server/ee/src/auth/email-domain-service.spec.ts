/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { suite, test, timeout } from "mocha-typescript";
import { testContainer as dbTestContainer } from "@gitpod/gitpod-db/lib/test-container";
import { ContainerModule } from "inversify";
import { EMailDomainService, EMailDomainServiceImpl } from "../auth/email-domain-service";
const expect = chai.expect;

const testContainerModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    bind(EMailDomainService).to(EMailDomainServiceImpl).inSingletonScope();
});
const testContainer = dbTestContainer.createChild();
testContainer.load(testContainerModule);

@suite
export class EMailDomainServiceSpec {
    @test @timeout(30000) public async internal_check() {
        const svc = testContainer.get<EMailDomainService>(EMailDomainService);
        const test = (emailOrDomain: string) => (svc as any).checkSwotJsForEducationalInstitutionSuffix(emailOrDomain);

        expect(await test("")).to.be.false;
        expect(await test("hdm-stuttgart.de")).to.be.true;
        expect(await test("purdue.edu")).to.be.true;
        expect(await test("@miau.miau")).to.be.false;

        expect(await test("asd@miau.miau")).to.be.false;
        expect(await test("asd@hdm-stuttgart.de")).to.be.true;
        expect(await test("as@purdue.edu")).to.be.true;
    }
}

module.exports = new EMailDomainServiceSpec();
