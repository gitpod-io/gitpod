/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as d3 from "d3";
import { ProjectLanguages } from "@gitpod/gitpod-protocol";
import { useContext, useEffect, useRef, useState } from "react";
import { getGitpodService } from "../service/service";
import { ProjectContext } from "./project-context";
import PieChart from "../components/PieChart";

export default function ProjectInsights() {
    const { project } = useContext(ProjectContext);
    const [projectLanguages, setProjectLanguages] = useState<ProjectLanguages>({});
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        getGitpodService().server.getProjectLanguages(project?.cloneUrl || '').then(languages => {
            setProjectLanguages(languages)
            console.log('languages', languages);
        });
    }, [project]);

    useEffect(() => {
        const svg = d3.select(svgRef.current);
        const chart = PieChart(Object.entries(projectLanguages).map(([name, value]) => { return { name, value }; }), {
            name: (d: any) => d.name,
            value: (d: any) => d.value,
            svg,
        });
        console.log(chart, svg);
    }, [projectLanguages]);

    return <div className="mt-10 py-5 mx-auto" style={{ width: 700 }}>
        <svg className="container" ref={svgRef}></svg>
    </div>;
}
