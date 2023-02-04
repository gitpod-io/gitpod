/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Team } from "@gitpod/gitpod-protocol";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { useEffect, useState } from "react";
import { settingsPathBilling } from "../user-settings/settings.routes";
import { useTeams } from "../teams/teams-context";
import Alert from "./Alert";
import Modal from "./Modal";

export function UsageLimitReachedModal(p: { hints: any }) {
    const teams = useTeams();
    // const [attributionId, setAttributionId] = useState<AttributionId | undefined>();
    const [attributedTeam, setAttributedTeam] = useState<Team | undefined>();

    useEffect(() => {
        const attributionId: AttributionId | undefined = p.hints && p.hints.attributionId;
        if (attributionId) {
            // setAttributionId(attributionId);
            if (attributionId.kind === "team") {
                const team = teams?.find((t) => t.id === attributionId.teamId);
                setAttributedTeam(team);
            }
        }
    }, []);

    const attributedTeamName = attributedTeam?.name;
    const billingLink = attributedTeam ? "/billing" : settingsPathBilling;
    return (
        <Modal visible={true} closeable={false} onClose={() => {}}>
            <h3 className="flex">
                <span className="flex-grow">Usage Limit Reached</span>
            </h3>
            <div className="border-t border-b border-gray-200 dark:border-gray-800 mt-4 -mx-6 px-6 py-6">
                <Alert type="error" className="app-container rounded-md">
                    You have reached the <strong>usage limit</strong> of your billing account.
                </Alert>
                <p className="mt-3 text-base text-gray-600 dark:text-gray-300">
                    {"Contact an organization owner "}
                    {attributedTeamName && (
                        <>
                            of <strong>{attributedTeamName} </strong>
                        </>
                    )}
                    to increase the usage limit, or change your <a href={billingLink}>billing settings</a>.
                </p>
            </div>
            <div className="flex justify-end mt-6 space-x-2">
                <a href={billingLink}>
                    <button className="secondary">Go to Billing</button>
                </a>
            </div>
        </Modal>
    );
}
