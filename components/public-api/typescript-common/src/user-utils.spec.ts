/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Timestamp } from "@bufbuild/protobuf";
import { Identity, User, User_ProfileDetails } from "@gitpod/public-api/lib/gitpod/v1/user_pb";
import * as chai from "chai";
import { getPrimaryEmail } from "./user-utils";

const expect = chai.expect;

describe("getPrimaryEmail", function () {
    const user = new User({
        organizationId: undefined,
        profile: new User_ProfileDetails({
            emailAddress: "personal@email.com",
        }),
        identities: [
            new Identity({
                primaryEmail: "git-email@provider.com",
            }),
        ],
    });
    it(`should return email from profile exists`, () => {
        const email = getPrimaryEmail(user);
        expect(email).to.equal(user.profile!.emailAddress);
    });
    it(`should return email from SSO provider for org-owned accounts`, () => {
        const ssoEmail = "sso-email@provider.com";
        user.identities.unshift(
            new Identity({
                primaryEmail: ssoEmail,
                // SSO identities have `lastSigninTime` set
                lastSigninTime: Timestamp.fromDate(new Date()),
            }),
        );
        user.organizationId = "any";
        const email = getPrimaryEmail(user);
        expect(email).to.equal(ssoEmail);
    });
});
