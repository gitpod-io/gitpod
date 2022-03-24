/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { Connection, ConnectionType, Project, Team } from "@gitpod/gitpod-protocol";
import { getCurrentTeam, TeamsContext } from "../teams/teams-context";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { ProjectContext } from "./project-context";
import { getGitpodService } from "../service/service";
import PillLabel from "../components/PillLabel";
import CheckBox from "../components/CheckBox";

export function getProjectConnectionsMenu(project?: Project, team?: Team) {
    const teamOrUserSlug = !!team ? "t/" + team.slug : "projects";
    return [
        {
            title: "General",
            link: [`/${teamOrUserSlug}/${project?.slug || project?.name}/settings`],
        },
        {
            title: "Connections",
            link: [`/${teamOrUserSlug}/${project?.slug || project?.name}/connections`],
        },
        {
            title: "Configuration",
            link: [`/${teamOrUserSlug}/${project?.slug || project?.name}/configure`],
        },
        {
            title: "Variables",
            link: [`/${teamOrUserSlug}/${project?.slug || project?.name}/variables`],
        },
    ];
}

export function ProjectConnectionsPage(props: { project?: Project; children?: React.ReactNode }) {
    const location = useLocation();
    const { teams } = useContext(TeamsContext);
    const team = getCurrentTeam(location, teams);

    return (
        <PageWithSubMenu
            subMenu={getProjectConnectionsMenu(props.project, team)}
            title="Connections"
            subtitle="Manage project connections"
        >
            {props.children}
        </PageWithSubMenu>
    );
}

export default function () {
    const { project } = useContext(ProjectContext);

    const [connectionTypes, setConnectionTypes] = useState<{ [key: string]: ConnectionType }>({});
    const [connections, setConnections] = useState<Connection[]>([]);
    const [searchFilter, setSearchFilter] = useState<string | undefined>();

    useEffect(() => {
        updateConnectionTypes();
    }, []);

    useEffect(() => {
        if (!project) {
            return;
        }
        updateConnections();
    }, [project]);

    const updateConnectionTypes = async () => {
        const connectionTypes = await getGitpodService().server.getConnectionTypes();
        setConnectionTypes(connectionTypes);
    };

    const updateConnections = async () => {
        if (!project) {
            return;
        }
        const connections = await getGitpodService().server.getProjectConnections(project.id);
        setConnections(connections);
    };

    const getConnection = (id: string) => {
        return connections.find((c) => c.id === id);
    };

    const updateConnection = async (connectionId: string, attribute: string, newValue: string) => {
        if (!project) {
            return;
        }
        const updated = [...connections];
        const connection = updated.find((c) => c.id === connectionId);
        (connection as any)[attribute] = newValue;
        setConnections(updated);
        await getGitpodService().server.setProjectConnections(project.id, updated);
    };

    const toggleConnectionEnabled = async (id: string, newState: boolean) => {
        if (!project) {
            return;
        }
        let updated = [...connections];
        if (newState) {
            updated.push({ id });
        } else {
            updated = updated.filter((c) => c.id !== id);
        }
        await getGitpodService().server.setProjectConnections(project.id, updated);
        updateConnections();
    };

    return (
        <ProjectConnectionsPage project={project}>
            <h3>Projects Connections</h3>
            <div className={"flex mt-8"}>
                <div className="flex">
                    <div className="py-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="16" height="16">
                            <path
                                fill="#A8A29E"
                                d="M6 2a4 4 0 100 8 4 4 0 000-8zM0 6a6 6 0 1110.89 3.477l4.817 4.816a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 010 6z"
                            />
                        </svg>
                    </div>
                    <input
                        type="search"
                        placeholder="Search Connections"
                        onChange={(e) => setSearchFilter(e.target.value)}
                    />
                </div>
            </div>
            {Object.keys(connectionTypes).map((connectionTypeId, i) => {
                const connectionType = connectionTypes[connectionTypeId];
                const connection = getConnection(connectionTypeId);

                if (
                    !connection ||
                    (searchFilter && connectionType.name.toLowerCase().includes(searchFilter.toLowerCase()))
                ) {
                    return undefined;
                }

                const attributes = connectionType.attributes;
                return (
                    <>
                        <CheckBox
                            key={`type-${connectionType}-${i}`}
                            title={
                                <span>
                                    Enable {connectionTypeId}{" "}
                                    <PillLabel type="warn" className="font-semibold mt-2 py-0.5 px-2 self-center">
                                        🚀
                                    </PillLabel>
                                </span>
                            }
                            desc={
                                <span>
                                    {!!connection &&
                                        attributes.map((attribute, i) => (
                                            <div className="mt-4" key={`attribute-${attribute}-${i}`}>
                                                <h4>{attribute}</h4>
                                                <input
                                                    className="w-full"
                                                    type="text"
                                                    name="value"
                                                    value={(connection as any)[attribute]}
                                                    onChange={(e) =>
                                                        updateConnection(connection.id, attribute, e.target.value)
                                                    }
                                                />
                                            </div>
                                        ))}
                                </span>
                            }
                            checked={!!connection}
                            onChange={() => toggleConnectionEnabled(connectionTypeId, !connection)}
                        />
                    </>
                );
            })}
        </ProjectConnectionsPage>
    );
}
