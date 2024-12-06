/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import type { OrganizationMember } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { LoadingState } from "@podkit/loading/LoadingState";
import { Heading2, Subheading } from "@podkit/typography/Headings";
import classNames from "classnames";
import { useMemo } from "react";
import { Accordion } from "./components/accordion/Accordion";
import Alert from "./components/Alert";
import Header from "./components/Header";
import { Item, ItemField, ItemsList } from "./components/ItemsList";
import { useWorkspaceSessions } from "./data/insights/list-workspace-sessions-query";
import { useListOrganizationMembers } from "./data/organizations/members-query";
import { WorkspaceSessionGroup } from "./insights/WorkspaceSessionGroup";
import { gitpodHostUrl } from "./service/service";

export const Insights = () => {
    const { data, error: errorMessage, isLoading } = useWorkspaceSessions();
    const membersQuery = useListOrganizationMembers();
    const members: OrganizationMember[] = useMemo(() => membersQuery.data || [], [membersQuery.data]);

    const sessions = data ?? [];
    const grouped = Object.groupBy(sessions, (ws) => ws.workspace?.id ?? "unknown");

    return (
        <>
            <Header title="Insights" subtitle="Insights into workspace sessions in your organization" />
            <div className="app-container pt-5">
                <div
                    className={classNames(
                        "flex flex-col items-start space-y-3 justify-between px-3",
                        "md:flex-row md:items-center md:space-x-4 md:space-y-0",
                    )}
                ></div>

                {errorMessage && (
                    <Alert type="error" className="mt-4">
                        {errorMessage}
                    </Alert>
                )}

                <div className="flex flex-col w-full mb-8">
                    <ItemsList className="mt-2 text-gray-400 dark:text-gray-500">
                        <Item header={false} className="grid grid-cols-12 gap-x-3 bg-gray-100 dark:bg-gray-800">
                            <ItemField className="col-span-2 my-auto">
                                <span>Type</span>
                            </ItemField>
                            <ItemField className="col-span-5 my-auto">
                                <span>ID</span>
                            </ItemField>
                            <ItemField className="col-span-3 my-auto">
                                <span>User</span>
                            </ItemField>
                            <ItemField className="col-span-2 my-auto">
                                <span>Sessions</span>
                            </ItemField>
                        </Item>

                        {isLoading && (
                            <div className="flex items-center justify-center w-full space-x-2 text-gray-400 text-sm pt-16 pb-40">
                                <LoadingState />
                                <span>Loading usage...</span>
                            </div>
                        )}

                        {!isLoading && (
                            <Accordion type="multiple" className="w-full">
                                {Object.entries(grouped).map(([id, sessions]) => {
                                    if (!sessions?.length) {
                                        return null;
                                    }
                                    const member = members.find(
                                        (m) => m.userId === sessions[0]?.workspace?.metadata?.ownerId,
                                    );

                                    return (
                                        <WorkspaceSessionGroup key={id} id={id} sessions={sessions} member={member} />
                                    );
                                })}
                            </Accordion>
                        )}

                        {/* No results */}
                        {!isLoading && sessions.length === 0 && !errorMessage && (
                            <div className="flex flex-col w-full mb-8">
                                <Heading2 className="text-center mt-8">No sessions found.</Heading2>
                                <Subheading className="text-center mt-1">
                                    Have you started any
                                    <a className="gp-link" href={gitpodHostUrl.asWorkspacePage().toString()}>
                                        {" "}
                                        workspaces
                                    </a>{" "}
                                    in the last 30 days or checked your other organizations?
                                </Subheading>
                            </div>
                        )}
                    </ItemsList>
                </div>
            </div>
        </>
    );
};

export default Insights;
