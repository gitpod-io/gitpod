/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import moment from "moment";
import { PrebuildWithStatus, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { useContext, useEffect, useState } from "react";
import { useHistory, useLocation, useRouteMatch } from "react-router";
import Header from "../components/Header";
import PrebuildLogs from "../components/PrebuildLogs";
import Spinner from "../icons/Spinner.svg";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { TeamsContext, getCurrentTeam } from "../teams/teams-context";
import { PrebuildInstanceStatus } from "./Prebuilds";
import { shortCommitMessage } from "./render-utils";

export default function () {
    const history = useHistory();
    const location = useLocation();

    const { teams } = useContext(TeamsContext);
    const team = getCurrentTeam(location, teams);

    const match = useRouteMatch<{ team: string, project: string, prebuildId: string }>("/(t/)?:team/:project/:prebuildId");
    const projectName = match?.params?.project;
    const prebuildId = match?.params?.prebuildId;

    const [ prebuild, setPrebuild ] = useState<PrebuildWithStatus | undefined>();
    const [ prebuildInstance, setPrebuildInstance ] = useState<WorkspaceInstance | undefined>();
    const [ isRerunningPrebuild, setIsRerunningPrebuild ] = useState<boolean>(false);
    const [ isCancellingPrebuild, setIsCancellingPrebuild ] = useState<boolean>(false);

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
        return (<h1 className="tracking-tight">{prebuild.info.branch} </h1>);
    };

    const renderSubtitle = () => {
        if (!prebuild) {
            return "";
        }
        const startedByAvatar = prebuild.info.startedByAvatar && <img className="rounded-full w-4 h-4 inline-block align-text-bottom mr-2" src={prebuild.info.startedByAvatar || ''} alt={prebuild.info.startedBy} />;
        return (<div className="flex">
            <div className="my-auto">
                <p>{startedByAvatar}Triggered {moment(prebuild.info.startedAt).fromNow()}</p>
            </div>
            <p className="mx-2 my-auto">·</p>
            <div className="my-auto">
                <p className="text-gray-500 dark:text-gray-50">{shortCommitMessage(prebuild.info.changeTitle)}</p>
            </div>
        </div>)
    };

    const onInstanceUpdate = (instance: WorkspaceInstance) => {
        setPrebuildInstance(instance);
    }

    const rerunPrebuild = async () => {
        if (!prebuild) {
            return;
        }
        try {
            setIsRerunningPrebuild(true);
            await getGitpodService().server.triggerPrebuild(prebuild.info.projectId, prebuild.info.branch);
            // TODO: Open a Prebuilds page that's specific to `prebuild.info.branch`?
            history.push(`/${!!team ? 't/'+team.slug : 'projects'}/${projectName}/prebuilds`);
        } catch (error) {
            console.error('Could not rerun prebuild', error);
        } finally {
            setIsRerunningPrebuild(false);
        }
    }

    const cancelPrebuild = async () => {
        if (!prebuild) {
            return;
        }
        try {
            setIsCancellingPrebuild(true);
            await getGitpodService().server.cancelPrebuild(prebuild.info.projectId, prebuild.info.id);
        } catch (error) {
            console.error('Could not cancel prebuild', error);
        } finally {
            setIsCancellingPrebuild(false);
        }
    }

    useEffect(() => { document.title = 'Prebuild — Gitpod' }, []);

    return <>
        <Header title={renderTitle()} subtitle={renderSubtitle()} />
        <div className="lg:px-28 px-10 mt-8">
            <div className="rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex flex-col">
                <div className="h-96 flex">
                    <PrebuildLogs workspaceId={prebuild?.info?.buildWorkspaceId} onInstanceUpdate={onInstanceUpdate} />
                </div>
                <div className="h-20 px-6 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600 flex space-x-2">
                    {prebuildInstance && <PrebuildInstanceStatus prebuildInstance={prebuildInstance} />}
                    <div className="flex-grow" />
                    {(prebuild?.status === 'aborted' || prebuild?.status === 'timeout' || !!prebuild?.error)
                        ? <button className="flex items-center space-x-2" disabled={isRerunningPrebuild} onClick={rerunPrebuild}>
                            {isRerunningPrebuild && <img className="h-4 w-4 animate-spin filter brightness-150" src={Spinner} />}
                            <span>Rerun Prebuild ({prebuild.info.branch})</span>
                        </button>
                        : (prebuild?.status === 'building'
                            ? <button className="danger flex items-center space-x-2" disabled={isCancellingPrebuild} onClick={cancelPrebuild}>
                                {isCancellingPrebuild && <img className="h-4 w-4 animate-spin filter brightness-150" src={Spinner} />}
                                <span>Cancel Prebuild</span>
                            </button>
                            : (prebuild?.status === 'available'
                                ? <a className="my-auto" href={gitpodHostUrl.withContext(`${prebuild?.info.changeUrl}`).toString()}><button>New Workspace ({prebuild?.info.branch})</button></a>
                                : <button disabled={true}>New Workspace ({prebuild?.info.branch})</button>))}
                </div>
            </div>
        </div>
    </>;

}