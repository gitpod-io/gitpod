/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ProjectLanguages } from "@gitpod/gitpod-protocol";
import { useContext, useEffect, useState } from "react";
import { getGitpodService } from "../service/service";
import { ProjectContext } from "./project-context";


export default function ProjectInsights() {
    const { project } = useContext(ProjectContext);
    const [projectLanguages, setProjectLanguages] = useState<ProjectLanguages>({});

    useEffect(() => {
        getGitpodService().server.getProjectLanguages(project?.cloneUrl || '').then(languages => {
            setProjectLanguages(languages)
            console.log('languages', languages);
        });
    }, [project]);

    return <pre>{JSON.stringify(projectLanguages, null, 4)}</pre>;
}