/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useEffect, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { useOrganizationsInvalidator } from "../data/organizations/orgs-query";
import { useDocumentTitle } from "../hooks/use-document-title";
import { publicApiTeamToProtocol, teamsService } from "../service/public-api";

export default function JoinTeamPage() {
    const orgInvalidator = useOrganizationsInvalidator();
    const history = useHistory();
    const location = useLocation();

    const [joinError, setJoinError] = useState<Error>();
    const inviteId = useMemo(() => new URLSearchParams(location.search).get("inviteId"), [location]);

    useEffect(() => {
        (async () => {
            try {
                if (!inviteId) {
                    throw new Error("This invite URL is incorrect.");
                }
                const team = publicApiTeamToProtocol((await teamsService.joinTeam({ invitationId: inviteId })).team!);
                orgInvalidator();

                history.push(`/members?org=${team.id}`);
            } catch (error) {
                console.error(error);
                setJoinError(error);
            }
        })();
    }, [history, inviteId, orgInvalidator]);

    useDocumentTitle("Joining Organization");

    return joinError ? <div className="mt-16 text-center text-gitpod-red">{String(joinError)}</div> : <></>;
}
