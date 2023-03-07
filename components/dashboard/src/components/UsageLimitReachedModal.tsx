/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { useEffect, useState } from "react";
import { OrganizationInfo, useOrganizations } from "../data/organizations/orgs-query";
import { settingsPathBilling } from "../user-settings/settings.routes";
import Alert from "./Alert";
import Modal from "./Modal";
import { Heading2 } from "./typography/headings";

export function UsageLimitReachedModal(p: { hints: any }) {
    const orgs = useOrganizations();
    const [attributedTeam, setAttributedTeam] = useState<OrganizationInfo | undefined>();

    useEffect(() => {
        const attributionId: AttributionId | undefined = p.hints && p.hints.attributionId;
        if (attributionId) {
            // setAttributionId(attributionId);
            if (attributionId.kind === "team") {
                const team = orgs?.data?.find((t) => t.id === attributionId.teamId);
                setAttributedTeam(team);
            }
        }
    }, [orgs?.data, p.hints]);

    const attributedTeamName = attributedTeam?.name;
    const billingLink = attributedTeam ? "/billing" : settingsPathBilling;
    return (
        <Modal visible={true} closeable={false} onClose={() => {}}>
            <Heading2 className="flex">
                <span className="flex-grow">Usage Limit Reached</span>
            </Heading2>
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
