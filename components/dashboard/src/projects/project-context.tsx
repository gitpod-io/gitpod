/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Project } from "@gitpod/gitpod-protocol";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useHistory, useLocation, useRouteMatch } from "react-router";
import { useCurrentOrg, useOrganizations } from "../data/organizations/orgs-query";
import { listAllProjects } from "../service/public-api";
import { useCurrentUser } from "../user-context";

export const ProjectContext = createContext<{
    project?: Project;
    setProject: React.Dispatch<Project | undefined>;
}>({
    setProject: () => null,
});

export const ProjectContextProvider: React.FC = ({ children }) => {
    const [project, setProject] = useState<Project>();

    const ctx = useMemo(() => ({ project, setProject }), [project]);

    return <ProjectContext.Provider value={ctx}>{children}</ProjectContext.Provider>;
};

interface ProjectInfo {
    id: string;
    name?: string;
}

export function useProjectInfo(): ProjectInfo | undefined {
    const projectsRouteMatch = useRouteMatch<{ projectSlug?: string }>("/projects/:projectSlug");

    return useMemo(() => {
        const projectSlug = projectsRouteMatch?.params.projectSlug;
        if (!projectSlug) {
            return undefined;
        }
        const result = parseProjectSlug(projectSlug);
        if (!result) {
            return undefined;
        }
        return result;
    }, [projectsRouteMatch?.params.projectSlug]);
}

const pattern: RegExp = /^((.+)-)?([a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})$/;
function parseProjectSlug(slug: string): ProjectInfo | undefined {
    const match = slug.match(pattern);

    if (match) {
        const name = match[2];
        const id = match[3];
        return {
            name,
            id,
        };
    } else {
        return undefined;
    }
}

export function useCurrentProject(): { project: Project | undefined; loading: boolean } {
    const { project, setProject } = useContext(ProjectContext);
    const [loading, setLoading] = useState(true);
    const user = useCurrentUser();
    const org = useCurrentOrg();
    const orgs = useOrganizations();
    const projectInfo = useProjectInfo();
    const location = useLocation();
    const history = useHistory();

    useEffect(() => {
        setLoading(true);
        if (!user) {
            setProject(undefined);
            // without a user we are still consider this loading
            return;
        }
        if (!projectInfo) {
            setProject(undefined);
            setLoading(false);
            return;
        }
        (async () => {
            if (!org.data) {
                return;
            }
            let projects = await listAllProjects({ orgId: org.data.id });

            // Find project matching with slug, otherwise with name
            const project = projects.find((p) => p.id === projectInfo.id);
            if (!project && orgs.data) {
                // check other orgs
                for (const t of orgs.data || []) {
                    if (t.id === org.data?.id) {
                        continue;
                    }
                    const projects = await listAllProjects({ orgId: t.id });
                    const project = projects.find((p) => p.id === projectInfo.id);
                    if (project) {
                        // redirect to the other org
                        history.push(location.pathname + "?org=" + t.id);
                    }
                }
            }
            setProject(project);
            setLoading(false);
        })();
    }, [setProject, org.data, user, orgs.data, location, history, projectInfo]);

    return { project, loading };
}
