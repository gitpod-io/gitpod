/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Project } from "@gitpod/gitpod-protocol";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useHistory, useLocation, useRouteMatch } from "react-router";
import { validate as uuidValidate } from "uuid";
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
    const org = useCurrentOrg();
    const orgs = useOrganizations();
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
            if (!org.data) {
                return;
            }
            let projects = await listAllProjects({ orgId: org.data.id });

            // Find project matching with slug, otherwise with name
            const project = projects.find((p) => Project.slug(p) === slugs.projectSlug);
            if (!project && orgs.data) {
                // check other orgs
                for (const t of orgs.data || []) {
                    if (t.id === org.data?.id) {
                        continue;
                    }
                    const projects = await listAllProjects({ orgId: t.id });
                    const project = projects.find((p) => Project.slug(p) === slugs.projectSlug);
                    if (project) {
                        // redirect to the other org
                        history.push(location.pathname + "?org=" + t.id);
                    }
                }
            }
            setProject(project);
            setLoading(false);
        })();
    }, [slugs.projectSlug, setProject, org.data, user, orgs.data, location, history]);

    return { project, loading };
}
