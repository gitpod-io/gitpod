/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import moment from "moment";
import { PrebuildWithStatus, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { useContext, useEffect, useState } from "react";
import { useLocation, useRouteMatch } from "react-router";
import Header from "../components/Header";
import PrebuildLogs from "../components/PrebuildLogs";
import { getGitpodService } from "../service/service";
import { TeamsContext, getCurrentTeam } from "../teams/teams-context";
import { shortCommitMessage } from "./render-utils";
import { PrebuildInstanceStatus } from "./Prebuilds";

export default function () {
    const location = useLocation();

    const { teams } = useContext(TeamsContext);
    const team = getCurrentTeam(location, teams);

    const match = useRouteMatch<{ team: string, project: string, branchName: string }>("/(t/)?:team/:project/:branchName");
    const projectName = match?.params?.project;
    const branchName = match?.params?.branchName;

    const [ prebuilds, setPrebuilds ] = useState<PrebuildWithStatus[]>([]);
    const [ prebuildInstance, setPrebuildInstance ] = useState<WorkspaceInstance | undefined>();

    useEffect(() => {
        if (!teams || !projectName || !branchName) {
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
                branch: branchName
            });
            setPrebuilds(prebuilds);
        })();
    }, [ teams ]);

    const renderTitle = () => {
        return (<h1 className="tracking-tight">{branchName} </h1>);
    };

    const startedByAvatar = (prebuild: PrebuildWithStatus) => prebuild.info.startedByAvatar && <img className="rounded-full w-4 h-4 inline-block align-text-bottom mr-2" src={prebuild.info.startedByAvatar || ''} alt={prebuild.info.startedBy} />;

    const renderSubtitle = () => {
        if (prebuilds.length === 0) {
            return "";
        }
        const startedByAvatar = prebuilds[0].info.startedByAvatar && <img className="rounded-full w-4 h-4 inline-block align-text-bottom mr-2" src={prebuilds[0].info.startedByAvatar || ''} alt={prebuilds[0].info.startedBy} />;
        return (<div className="flex">
            <div className="my-auto">
                <p>{startedByAvatar}Triggered {moment(prebuilds[0].info.startedAt).fromNow()}</p>
            </div>
            <p className="mx-2 my-auto">·</p>
            <div className="my-auto">
                <p className="text-gray-500 dark:text-gray-50">{shortCommitMessage(prebuilds[0].info.changeTitle)}</p>
            </div>
        </div>)
    };

    const onInstanceUpdate = (instance: WorkspaceInstance) => {
        setPrebuildInstance(instance);
    }

    useEffect(() => { document.title = 'Prebuild — Gitpod' }, []);

    return <>
        <Header title={renderTitle()} subtitle={renderSubtitle()} />
        <div className="lg:px-28 px-10 mt-8">
            {
                prebuilds.map(prebuild =>
                    <div className="rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex flex-col">
                        <div className="h-96 flex">
                            <PrebuildLogs workspaceId={prebuild?.info?.buildWorkspaceId} onInstanceUpdate={onInstanceUpdate} />
                        </div>
                        <div className="h-20 px-6 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600 flex space-x-2">
                            {prebuildInstance && <PrebuildInstanceStatus prebuildInstance={prebuildInstance} />}
                            <div className="flex-grow" />
                            <div className="my-auto">
                                <p>{startedByAvatar(prebuild)}Triggered {moment(prebuild.info.startedAt).fromNow()}</p>
                            </div>
                            <p className="mx-2 my-auto">·</p>
                            <div className="my-auto">
                                <p className="text-gray-500 dark:text-gray-50">{shortCommitMessage(prebuild.info.changeTitle)}</p>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    </>;

}