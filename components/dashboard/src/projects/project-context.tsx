/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Project } from "@gitpod/gitpod-protocol";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useHistory, useLocation, useRouteMatch } from "react-router";
import { validate as uuidValidate } from "uuid";
import { listAllProjects } from "../service/public-api";
import { useCurrentTeam, useTeams } from "../teams/teams-context";
import { useCurrentUser } from "../user-context";

export const ProjectContext = createContext<{
    project?: Project;
    setProject: React.Dispatch<Project | undefined>;
}>({
    setProject: () => null,
});

export const ProjectContextProvider: React.FC = ({ children }) => {
    const [project, setProject] = useState<Project>();
    return <ProjectContext.Provider value={{ project, setProject }}>{children}</ProjectContext.Provider>;
};

export function useProjectSlugs(): { projectSlug?: string; prebuildId?: string } {
    const projectsRouteMatch = useRouteMatch<{ projectSlug?: string; prebuildId?: string }>(
        "/projects/:projectSlug?/:prebuildId?",
    );

    return useMemo(() => {
        const projectSlug = projectsRouteMatch?.params.projectSlug;
        const result: { projectSlug?: string; prebuildId?: string } = {};
        const reservedProjectSlugs = ["new"];
        if (!projectSlug || reservedProjectSlugs.includes(projectSlug)) {
            return result;
        }
        result.projectSlug = projectSlug;
        const prebuildId = projectsRouteMatch?.params.prebuildId;
        if (prebuildId && uuidValidate(prebuildId)) {
            result.prebuildId = projectsRouteMatch?.params.prebuildId;
        }
        return result;
    }, [projectsRouteMatch?.params.projectSlug, projectsRouteMatch?.params.prebuildId]);
}

export function useCurrentProject(): { project: Project | undefined; loading: boolean } {
    const { project, setProject } = useContext(ProjectContext);
    const [loading, setLoading] = useState(true);
    const user = useCurrentUser();
    const team = useCurrentTeam();
    const teams = useTeams();
    const slugs = useProjectSlugs();
    const location = useLocation();
    const history = useHistory();

    useEffect(() => {
        setLoading(true);
        if (!user) {
            setProject(undefined);
            // without a user we are still consider this loading
            return;
        }
        if (!slugs.projectSlug) {
            setProject(undefined);
            setLoading(false);
            return;
        }
        (async () => {
            let projects: Project[];
            if (!!team) {
                projects = await listAllProjects({ teamId: team.id });
            } else {
                projects = await listAllProjects({ userId: user?.id });
            }

            // Find project matching with slug, otherwise with name
            const project = projects.find((p) => Project.slug(p) === slugs.projectSlug);
            if (!project && teams) {
                // check other orgs
                for (const t of teams) {
                    if (t.id === team?.id) {
                        continue;
                    }
                    const projects = await listAllProjects({ teamId: t.id });
                    const project = projects.find((p) => Project.slug(p) === slugs.projectSlug);
                    if (project) {
                        // redirect to the other org
                        history.push(location.pathname + "?org=" + t.id);
                    }
                }

                // check personal projects
                const projects = await listAllProjects({ userId: user.id });
                const project = projects.find((p) => Project.slug(p) === slugs.projectSlug);
                if (project) {
                    // redirect to the other org
                    history.push(location.pathname + "?org=0");
                }
            }
            setProject(project);
            setLoading(false);
        })();
    }, [slugs.projectSlug, setProject, team, user, teams, location, history]);

    return { project, loading };
}
