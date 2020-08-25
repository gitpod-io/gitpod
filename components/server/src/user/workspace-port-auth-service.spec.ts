/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as chai from 'chai';
import { suite, test } from 'mocha-typescript';
import { WorkspacePortAuthorizationService } from './workspace-port-auth-service';
const expect = chai.expect;

@suite
export class WorkspacePortAuthorizationServiceSpec {

    decide(input: { portAccessForUsersOnly: boolean, hasValidCookieForWorkspace: boolean, userAuthenticated?: boolean, isPortPublic: boolean, isWsShared: boolean, isUserWsOwner?: boolean }): boolean {
        const cut = new WorkspacePortAuthorizationService();
        const actual = (cut as any).decide(input.portAccessForUsersOnly, input.hasValidCookieForWorkspace, !!input.userAuthenticated, {
            isPortPublic: input.isPortPublic,
            isWsShared: input.isWsShared,
            isUserWsOwner: input.isUserWsOwner
        });
        return actual;
    }

    @test public decide_all_notOwner_unshared_private() {
        expect(this.decide({
            portAccessForUsersOnly: false,
            hasValidCookieForWorkspace: false,
            isPortPublic: false,
            isWsShared: false
        })).to.equal(false);
    }

    @test public decide_all_owner_unshared_private() {
        expect(this.decide({
            portAccessForUsersOnly: false,
            hasValidCookieForWorkspace: true,
            isUserWsOwner: true,
            isPortPublic: false,
            isWsShared: false
        })).to.equal(true);
    }

    @test public decide_all_notOwner_shared_private() {
        expect(this.decide({
            portAccessForUsersOnly: false,
            hasValidCookieForWorkspace: false,
            isUserWsOwner: true,
            isPortPublic: false,
            isWsShared: true
        })).to.equal(true);
    }

    @test public decide_all_notOwner_unshared_public() {
        expect(this.decide({
            portAccessForUsersOnly: false,
            hasValidCookieForWorkspace: false,
            isPortPublic: true,
            isWsShared: false
        })).to.equal(true);
    }

    @test public decide_usersOnly_owner_unshared_private() {
        expect(this.decide({
            portAccessForUsersOnly: true,
            hasValidCookieForWorkspace: true,
            isUserWsOwner: true,
            isPortPublic: false,
            isWsShared: false
        })).to.equal(true);
    }

    @test public decide_usersOnly_notOwner_unshared_private() {
        expect(this.decide({
            portAccessForUsersOnly: true,
            hasValidCookieForWorkspace: false,
            userAuthenticated: false,
            isPortPublic: false,
            isWsShared: false
        })).to.equal(false);
    }

    @test public decide_usersOnly_notOwner_shared_private() {
        expect(this.decide({
            portAccessForUsersOnly: true,
            hasValidCookieForWorkspace: false,
            userAuthenticated: false,
            isPortPublic: false,
            isWsShared: true
        })).to.equal(false);
    }

    @test public decide_usersOnly_notOwner_unshared_public() {
        expect(this.decide({
            portAccessForUsersOnly: true,
            hasValidCookieForWorkspace: false,
            userAuthenticated: false,
            isPortPublic: true,
            isWsShared: false
        })).to.equal(false);
    }

    @test public decide_usersOnly_notOwner_shared_public() {
        expect(this.decide({
            portAccessForUsersOnly: true,
            hasValidCookieForWorkspace: false,
            userAuthenticated: false,
            isPortPublic: true,
            isWsShared: true
        })).to.equal(false);
    }

    @test public decide_usersOnly_notOwner_unshared_private_authdUser() {
        expect(this.decide({
            portAccessForUsersOnly: true,
            hasValidCookieForWorkspace: false,
            userAuthenticated: true,
            isPortPublic: false,
            isWsShared: false
        })).to.equal(false);
    }

    @test public decide_usersOnly_notOwner_shared_private_authdUser() {
        expect(this.decide({
            portAccessForUsersOnly: true,
            hasValidCookieForWorkspace: false,
            userAuthenticated: true,
            isPortPublic: false,
            isWsShared: true
        })).to.equal(true);
    }

    @test public decide_usersOnly_notOwner_unshared_public_authdUser() {
        expect(this.decide({
            portAccessForUsersOnly: true,
            hasValidCookieForWorkspace: false,
            userAuthenticated: true,
            isPortPublic: true,
            isWsShared: false
        })).to.equal(true);
    }

    @test public decide_usersOnly_notOwner_shared_public_authdUser() {
        expect(this.decide({
            portAccessForUsersOnly: true,
            hasValidCookieForWorkspace: false,
            userAuthenticated: true,
            isPortPublic: true,
            isWsShared: true
        })).to.equal(true);
    }

    @test public decide_usersOnly_owner_shared_private_authdUser() {
        expect(this.decide({
            portAccessForUsersOnly: true,
            hasValidCookieForWorkspace: true,
            userAuthenticated: true,
            isUserWsOwner: true,
            isPortPublic: false,
            isWsShared: true
        })).to.equal(true);
    }

    @test public decide_usersOnly_notOwner_exshared_private_authdUser() {
        expect(this.decide({
            portAccessForUsersOnly: true,
            hasValidCookieForWorkspace: true,
            userAuthenticated: true,
            isUserWsOwner: false,
            isPortPublic: false,
            isWsShared: false
        })).to.equal(false);
    }
}

module.exports = new WorkspacePortAuthorizationServiceSpec()
