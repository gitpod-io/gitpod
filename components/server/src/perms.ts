/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { OpenFgaApi, TupleKey } from "@openfga/sdk";
import { ResponseError } from "vscode-jsonrpc";

export const OpenFGA = new OpenFgaApi({
    apiScheme: "http", // Optional. Can be "http" or "https". Defaults to "https"
    apiHost: "openfga:8080", // required, define without the scheme (e.g. api.openfga.example instead of https://api.openfga.example)
    storeId: "01GP4CRKXESH1JE5E0SNHMZYG1",
});

function tup(user: string, relation: string, object: string): TupleKey {
    return { user, relation, object };
}

function user(id: string): string {
    return `user:${id}`;
}

function team(id: string): string {
    return `team:${id}`;
}

function proj(id: string): string {
    return `project:${id}`;
}

export async function isTeamOwner(userID: string, teamID: string): Promise<boolean> {
    return (
        (
            await OpenFGA.check({
                tuple_key: tup(user(userID), "owner", team(teamID)),
            })
        ).allowed || false
    );
}

export async function isTeamMember(userID: string, teamID: string): Promise<boolean> {
    return (
        (
            await OpenFGA.check({
                tuple_key: tup(user(userID), "member", team(teamID)),
            })
        ).allowed || false
    );
}

export async function grantTeamOwner(userID: string, teamID: string) {
    const deletes: TupleKey[] = [];

    const isMember = await isTeamMember(userID, teamID);
    if (isMember) {
        deletes.push(tup(user(userID), "member", team(teamID)));
    }

    return await OpenFGA.write({
        writes: {
            tuple_keys: [tup(user(userID), "owner", team(teamID))],
        },
        deletes: {
            tuple_keys: deletes,
        },
    });
}

export async function grantTeamMember(userID: string, teamID: string) {
    const deletes: TupleKey[] = [];

    const isMember = await isTeamOwner(userID, teamID);
    if (isMember) {
        deletes.push(tup(user(userID), "owner", team(teamID)));
    }
    await OpenFGA.write({
        writes: {
            tuple_keys: [tup(user(userID), "member", team(teamID))],
        },
        deletes: {
            tuple_keys: deletes,
        },
    });
}

export async function removeUserFromTeam(userID: string, teamID: string) {
    return OpenFGA.write({
        deletes: {
            tuple_keys: [tup(user(userID), "owner", team(teamID)), tup(user(userID), "member", team(teamID))],
        },
    });
}

export async function canCreateProject(userID: string, teamID: string) {
    const response = await OpenFGA.check({
        tuple_key: tup(user(userID), "member", team(teamID)),
    });

    if (!response.allowed) {
        throw newPermissionDenied(`user ${userID} is not allowed to create projects for team ${teamID}`);
    }
    return response.allowed || false;
}

export async function canDeleteProject(userID: string, projectID: string) {
    const response = await OpenFGA.check({
        tuple_key: tup(user(userID), "maintainer", proj(projectID)),
    });

    if (!response.allowed) {
        throw newPermissionDenied(`user ${userID} is not allowed to delete project ${projectID}`);
    }
    return response.allowed || false;
}

export async function canAccessProject(userID: string, projectID: string): Promise<boolean> {
    const response = await OpenFGA.check({
        tuple_key: tup(user(userID), "maintainer", proj(projectID)),
    });

    return response.allowed || false;
}

export async function grantTeamProjectMaintainer(teamID: string, projectID: string) {
    return OpenFGA.write({
        writes: {
            tuple_keys: [
                {
                    user: `team:${teamID}#member`,
                    relation: "maintainer",
                    object: proj(projectID),
                },
            ],
        },
    });
}

function newPermissionDenied(msg: string): ResponseError<string> {
    return new ResponseError(ErrorCodes.PERMISSION_DENIED, msg);
}
