/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { Subheading } from "../components/typography/headings";
import { Link } from "react-router-dom";
import { useOrgBillingMode } from "../data/billing-mode/org-billing-mode-query";
import { useOrgMembersInfoQuery } from "../data/organizations/org-members-info-query";

type Props = {
    creditsUsed?: number;
};
export const UsageSummaryData: FC<Props> = ({ creditsUsed }) => {
    const orgMembersInfo = useOrgMembersInfoQuery().data;
    const { data: billingMode } = useOrgBillingMode();

    return (
        <div className="flex flex-row">
            <div className="mt-8 p-3 flex flex-col">
                <Subheading>Credits Consumed</Subheading>
                <div className="flex text-lg text-gray-600 font-semibold">
                    <span className="dark:text-gray-400">
                        {creditsUsed !== undefined ? creditsUsed.toLocaleString() : "-"}
                    </span>
                </div>
                {orgMembersInfo && orgMembersInfo.isOwner && billingMode?.mode === "usage-based" && (
                    <div className="flex text-xs text-gray-600">
                        <span className="dark:text-gray-500 text-gray-400">
                            <Link to="/billing" className="gp-link">
                                View Billing →
                            </Link>
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};
