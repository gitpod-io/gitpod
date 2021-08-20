/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import moment from "moment";
import { PrebuildInfo } from "@gitpod/gitpod-protocol";
import { useContext, useEffect, useState } from "react";
import { useLocation, useRouteMatch } from "react-router";
import Header from "../components/Header";
import { getGitpodService } from "../service/service";
import { TeamsContext, getCurrentTeam } from "../teams/teams-context";
import { prebuildStatusIcon, prebuildStatusLabel } from "./Prebuilds";
import PrebuildLogs from "../components/PrebuildLogs";
import { shortCommitMessage } from "./render-utils";

export default function () {
    const location = useLocation();

    const { teams } = useContext(TeamsContext);
    const team = getCurrentTeam(location, teams);

    const match = useRouteMatch<{ team: string, project: string, prebuildId: string }>("/:team/:project/:prebuildId");
    const projectName = match?.params?.project;
    const prebuildId = match?.params?.prebuildId;

    const [ prebuild, setPrebuild ] = useState<PrebuildInfo | undefined>();

    useEffect(() => {
        if (!teams || !projectName || !prebuildId) {
            return;
        }
        (async () => {
            const projects = (!!team
                ? await getGitpodService().server.getTeamProjects(team.id)
                : await getGitpodService().server.getUserProjects());
            const project = projects.find(p => p.name === projectName);
            if (!project) {
                console.error(new Error(`Project not found! (teamId: ${team?.id}, projectName: ${projectName})`));
                return;
            }
            const prebuilds = await getGitpodService().server.findPrebuilds({
                projectId: project.id,
                prebuildId
            });
            setPrebuild(prebuilds[0]);
        })();
    }, [ teams ]);

    const renderTitle = () => {
        if (!prebuild) {
            return "unknown prebuild";
        }
        return (<h1 className="tracking-tight">{prebuild.branch} <span className="text-gray-200">#{prebuild.branchPrebuildNumber}</span></h1>);
    };

    const renderSubtitle = () => {
        if (!prebuild) {
            return "";
        }
        const statusIcon = prebuildStatusIcon(prebuild.status);
        const status = prebuildStatusLabel(prebuild.status);
        const startedByAvatar = prebuild.startedByAvatar && <img className="rounded-full w-4 h-4 inline-block align-text-bottom mr-2" src={prebuild.startedByAvatar || ''} alt={prebuild.startedBy} />;
        return (<div className="flex">
            <div className="text-base text-gray-900 dark:text-gray-50 font-medium uppercase">
                <div className="inline-block align-text-bottom mr-2 w-4 h-4">{statusIcon}</div>
                {status}
            </div>
            <p className="mx-2 my-auto">·</p>
            <div className="my-auto">
                <p>{startedByAvatar}Triggered {moment(prebuild.startedAt).fromNow()}</p>
            </div>
            <p className="mx-2 my-auto">·</p>
            <div className="my-auto">
                <p className="text-gray-500 dark:text-gray-50">{shortCommitMessage(prebuild.changeTitle)}</p>
            </div>
        </div>)
    };

    useEffect(() => { document.title = 'Prebuild — Gitpod' }, []);

    return <>
        <Header title={renderTitle()} subtitle={renderSubtitle()} />
        <div className="w-full"><PrebuildLogs workspaceId={prebuild?.buildWorkspaceId}/></div>
    </>

}