/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "./protocol";
import { Team } from "./teams-projects-protocol";

export type AttributionId = UserAttributionId | TeamAttributionId;
export type AttributionTarget = "user" | "team";

export interface UserAttributionId {
    kind: "user";
    userId: string;
}
export interface TeamAttributionId {
    kind: "team";
    teamId: string;
}

export namespace AttributionId {
    const SEPARATOR = ":";

    export function createFromOrganizationId(organizationId?: string): AttributionId | undefined {
        return organizationId ? { kind: "team", teamId: organizationId } : undefined;
    }

    export function create(userOrTeam: User | Team): AttributionId {
        if (User.is(userOrTeam)) {
            return { kind: "user", userId: userOrTeam.id };
        } else {
            return { kind: "team", teamId: userOrTeam.id };
        }
    }

    export function parse(s: string): UserAttributionId | TeamAttributionId | undefined {
        if (!s) {
            return undefined;
        }
        const parts = s.split(":");
        if (parts.length !== 2) {
            return undefined;
        }
        switch (parts[0]) {
            case "user":
                return { kind: "user", userId: parts[1] };
            case "team":
                return { kind: "team", teamId: parts[1] };
            default:
                return undefined;
        }
    }

    export function render(id: AttributionId): string {
        switch (id.kind) {
            case "user":
                return `user${SEPARATOR}${id.userId}`;
            case "team":
                return `team${SEPARATOR}${id.teamId}`;
        }
    }

    export function equals(a: AttributionId, b: AttributionId): boolean {
        return render(a) === render(b);
    }
}
