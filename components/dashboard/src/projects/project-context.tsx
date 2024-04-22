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
import { useListAllProjectsQuery } from "../data/projects/list-all-projects-query";

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

export function useCurrentProject(): { project: Project | undefined; loading: boolean } {
    const { project, setProject } = useContext(ProjectContext);
    const [loading, setLoading] = useState(true);
    const user = useCurrentUser();
    const org = useCurrentOrg();
    const orgs = useOrganizations();
    const projectIdFromRoute = useRouteMatch<{ projectId?: string }>("/projects/:projectId")?.params?.projectId;
    const location = useLocation();
    const history = useHistory();
    const listProjects = useListAllProjectsQuery();

    useEffect(() => {
        setLoading(true);
        if (!user) {
            setProject(undefined);
            // without a user we are still consider this loading
            return;
        }
        if (!projectIdFromRoute) {
            setProject(undefined);
            setLoading(false);
            return;
        }
        (async () => {
            if (!org.data) {
                return;
            }
            if (!listProjects.data) {
                return;
            }
            const projects = listProjects.data?.projects || [];

            // Find project matching with slug, otherwise with name
            const project = projects.find((p) => p.id === projectIdFromRoute);
            if (!project && orgs.data) {
                // check other orgs
                for (const t of orgs.data || []) {
                    if (t.id === org.data?.id) {
                        continue;
                    }
                    const projects = await listAllProjects({ orgId: t.id });
                    const project = projects.find((p) => p.id === projectIdFromRoute);
                    if (project) {
                        // redirect to the other org
                        history.push(location.pathname + "?org=" + t.id);
                    }
                }
            }
            setProject(project);
            setLoading(false);
        })();
    }, [setProject, org.data, user, orgs.data, location, history, listProjects.data, projectIdFromRoute]);

    return { project, loading };
}
