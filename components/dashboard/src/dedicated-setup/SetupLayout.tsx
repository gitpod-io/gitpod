/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useEffect } from "react";
import gitpodIcon from "../icons/gitpod.svg";
import { OrgIcon } from "../components/org-icon/OrgIcon";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import "./styles.css";

type Props = {
    showOrg?: boolean;
};
export const SetupLayout: FC<Props> = ({ showOrg = false, children }) => {
    const currentOrg = useCurrentOrg();

    useEffect(() => {
        document.body.classList.add("honeycomb-bg");

        return () => {
            document.body.classList.remove("honeycomb-bg");
        };
    }, []);

    return (
        <div className="container">
            <div className="app-container">
                <div className="flex items-center justify-start items-center py-3 space-x-1">
                    <img src={gitpodIcon} className="w-6 h-6" alt="Gitpod's logo" />
                    {showOrg ? (
                        <div className="pr-1 flex font-semibold whitespace-nowrap max-w-xs overflow-hidden">
                            <OrgIcon
                                id={currentOrg?.data?.id || "empty"}
                                name={currentOrg.data?.name || ""}
                                size="small"
                                className="mr-2"
                            />
                            {currentOrg.data?.name}
                        </div>
                    ) : (
                        <span className="text-lg">Gitpod</span>
                    )}
                </div>
                <div className="mt-24 max-w-md">{children}</div>
            </div>
        </div>
    );
};
