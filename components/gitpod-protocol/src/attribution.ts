/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Organization } from "./teams-projects-protocol";

export type AttributionId = TeamAttributionId;
export type AttributionTarget = "user" | "team";

export interface TeamAttributionId {
    kind: "team";
    teamId: string;
}

export namespace AttributionId {
    const SEPARATOR = ":";

    export function createFromOrganizationId(organizationId: string): AttributionId {
        return { kind: "team", teamId: organizationId };
    }

    export function create(organization: Pick<Organization, "id">): AttributionId {
        return createFromOrganizationId(organization.id);
    }

    export function parse(s: string): AttributionId | undefined {
        if (!s) {
            return undefined;
        }
        const parts = s.split(":");
        if (parts.length !== 2) {
            return undefined;
        }
        switch (parts[0]) {
            case "team":
                return { kind: "team", teamId: parts[1] };
        }
        return undefined;
    }

    export function render(id: AttributionId): string {
        switch (id.kind) {
            case "team":
                return `team${SEPARATOR}${id.teamId}`;
        }
        // allthough grayed as unreachable it is reachable at runtime
        throw new Error("invalid attributionId kind : " + id.kind);
    }

    export function equals(a: AttributionId, b: AttributionId): boolean {
        return render(a) === render(b);
    }
}
