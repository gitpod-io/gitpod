/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { useEffect } from "react";
import { useHistory } from "react-router-dom";
import { useUserLoader } from "../hooks/use-user-loader";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { useIsOwner } from "../data/organizations/members-query";
import Header from "../components/Header";
import { SpinnerLoader } from "../components/Loader";
import { RunningWorkspacesCard } from "./RunningWorkspacesCard";
import { MaintenanceModeCard } from "./MaintenanceModeCard";
import { MaintenanceNotificationCard } from "./MaintenanceNotificationCard";
import { Heading2 } from "@podkit/typography/Headings";

const AdminPage: React.FC = () => {
    const history = useHistory();
    const { loading: userLoading } = useUserLoader();
    const { data: currentOrg, isLoading: orgLoading } = useCurrentOrg();
    const isOwner = useIsOwner();

    useEffect(() => {
        if (userLoading || orgLoading) {
            return;
        }
        if (!isOwner) {
            history.replace("/workspaces");
        }
    }, [isOwner, userLoading, orgLoading, history, currentOrg?.id]);

    return (
        <div className="flex flex-col w-full">
            <Header title="Organization Administration" subtitle="Manage Infrastructure Rollouts" />
            <div className="app-container py-6 flex flex-col gap-4">
                <Heading2>Infrastructure Rollout</Heading2>

                {userLoading ||
                    orgLoading ||
                    (!isOwner && (
                        <div className="flex items-center justify-center w-full p-8">
                            <SpinnerLoader />
                        </div>
                    ))}

                {!orgLoading && !currentOrg && (
                    <div className="text-red-500 p-4 bg-red-100 dark:bg-red-900 border border-red-500 rounded-md">
                        Could not load organization details. Please ensure you are part of an organization.
                    </div>
                )}

                {currentOrg && (
                    <>
                        <MaintenanceNotificationCard />
                        <MaintenanceModeCard />
                        <RunningWorkspacesCard />
                    </>
                )}
            </div>
        </div>
    );
};

export default AdminPage;
