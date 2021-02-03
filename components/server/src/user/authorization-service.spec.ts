/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User } from '@gitpod/gitpod-protocol';
import * as chai from 'chai';
import { suite, test } from 'mocha-typescript';
import { Permission } from '@gitpod/gitpod-protocol/lib/permission';
import { AuthorizationServiceImpl, AuthorizationService } from './authorization-service';
const expect = chai.expect;

@suite
export class PermissionSpec {

    @test public hasPermission_viewer() {
        const userViewer: User = {
            rolesOrPermissions: ["viewer"]
        } as User;

        const cut: AuthorizationService = new AuthorizationServiceImpl();

        expect(cut.hasPermission(userViewer, Permission.MONITOR)).to.be.true;
        expect(cut.hasPermission(userViewer, Permission.REGISTRY_ACCESS)).to.be.true;
        expect(cut.hasPermission(userViewer, Permission.ENFORCEMENT)).to.be.false;
    }

    @test public hasPermission_dev() {
        const userDev: User = {
            rolesOrPermissions: ["devops"]
        } as User;

        const cut: AuthorizationService = new AuthorizationServiceImpl();

        expect(cut.hasPermission(userDev, Permission.MONITOR)).to.be.true;
        expect(cut.hasPermission(userDev, Permission.REGISTRY_ACCESS)).to.be.true;
        expect(cut.hasPermission(userDev, Permission.ENFORCEMENT)).to.be.true;
    }
}

module.exports = new PermissionSpec()
