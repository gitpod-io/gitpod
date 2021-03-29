/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import React from "react";
import { WhitelistedRepository, Workspace, WorkspaceInfo } from "@gitpod/gitpod-protocol";
import Header from "../components/Header";
import DropDown from "../components/DropDown"
import { WorkspaceModel } from "./workspace-model";
import { WorkspaceEntry } from "./WorkspaceEntry";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import {StartWorkspaceModal, WsStartEntry} from "./StartWorkspaceModal";

export interface WorkspacesProps {
}

export interface WorkspacesState {
    workspaces: WorkspaceInfo[];
    isTemplateModelOpen: boolean;
    repos: WhitelistedRepository[];
}

export class Workspaces extends React.Component<WorkspacesProps, WorkspacesState> {

    protected workspaceModel: WorkspaceModel | undefined;

    constructor(props: WorkspacesProps) {
        super(props);
        this.state = {
            workspaces: [],
            isTemplateModelOpen: false,
            repos: [],
        };
    }

    async componentDidMount() {
        this.workspaceModel = new WorkspaceModel(this.setWorkspaces);
        const repos = await getGitpodService().server.getFeaturedRepositories();
        this.setState({
            repos
        })
    }

    protected setWorkspaces = (workspaces: WorkspaceInfo[]) => {
        this.setState({
            workspaces
        });
    }

    protected showStartWSModal = () => this.setState({
        isTemplateModelOpen: true
    });

    protected hideStartWSModal = () => this.setState({
        isTemplateModelOpen: false
    });

    render() {
        const wsModel = this.workspaceModel;
        const onActive = () => wsModel!.active = true;
        const onAll = () => wsModel!.active = false;
        return <>
            <Header title="Workspaces" subtitle="Manage recent and stopped workspaces." />

            <div className="lg:px-28 px-10 pt-8 flex">
                <div className="flex">
                    <div className="py-4">
                        <svg width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" clipRule="evenodd" d="M6 2a4 4 0 100 8 4 4 0 000-8zM0 6a6 6 0 1110.89 3.477l4.817 4.816a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 010 6z" fill="#A8A29E"/>
                        </svg>
                    </div>
                    <input className="border-0" type="text" placeholder="Search Workspaces" onChange={(v) => { if (wsModel) wsModel.setSearch(v.target.value) }} />
                </div>
                <div className="flex-1" />
                <div className="py-3">
                    <DropDown prefix="Filter: " contextMenuWidth="w-32" activeEntry={wsModel?.active ? 'Active' : 'All'} entries={[{
                        title: 'Active',
                        onClick: onActive
                    }, {
                        title: 'All',
                        onClick: onAll
                    }]} />
                </div>
                <div className="py-3 pl-3">
                    <DropDown prefix="Limit: " contextMenuWidth="w-32" entries={[{
                        title: '50',
                        onClick: () => { if (wsModel) wsModel.limit = 50; }
                    }, {
                        title: '100',
                        onClick: () => { if (wsModel) wsModel.limit = 100; }
                    }, {
                        title: '200',
                        onClick: () => { if (wsModel) wsModel.limit = 200; }
                    }]} />
                </div>
                {wsModel && this.state?.workspaces.length > 0 ? 
                 <button onClick={this.showStartWSModal} className="ml-2">New Workspace</button>
                 : null
                }
            </div>
            {wsModel && (
                this.state?.workspaces.length > 0 || wsModel.searchTerm ?
                    <div className="lg:px-28 px-10 flex flex-col space-y-2">
                        <div className="px-6 py-3 flex justify-between space-x-2 text-sm text-gray-400 border-t border-b border-gray-200">
                            <div className="w-6"></div>
                            <div className="w-3/12">Name</div>
                            <div className="w-4/12">Context</div>
                            <div className="w-2/12">Pending Changes</div>
                            <div className="w-2/12">Last Start</div>
                            <div className="w-8"></div>
                        </div>
                        {
                            wsModel.active || wsModel.searchTerm ? null :
                                <div className="whitespace-nowrap flex space-x-2 py-6 px-6 w-full justify-between bg-gitpod-kumquat-light rounded-xl">
                                    <div className="pr-3 self-center w-6">
                                        <div className="relative rounded-full w-3 h-3 bg-red">
                                            <div className="absolute text-xs text-gray-100"
                                                style={{
                                                    left: "5px",
                                                    top: "-2px"
                                                }}
                                                ref={(node) => {
                                                    if (node) {
                                                        node.style.setProperty("font-size", "10px", "important");
                                                    }
                                                }}>!</div>
                                        </div>
                                    </div>
                                    <div className="flex-1 flex flex-col overflow-x-auto">
                                        <div className="text-red font-semibold">Garbage Collection</div>
                                        <p className="text-gray-500">Unpinned workspaces that have been stopped for more than 14 days will be automatically deleted. <a className="text-blue-600 underline underline-thickness-thin underline-offset-small hover:text-gray-800" href="https://www.gitpod.io/docs/life-of-workspace/#garbage-collection">Learn more</a></p>
                                    </div>
                                </div>
                        }
                        {
                            this.state?.workspaces.map(e => {
                                return <WorkspaceEntry key={e.workspace.id} desc={e} model={wsModel} />
                            })
                        }
                    </div>
                    :
                    <div className="lg:px-28 px-10 flex flex-col space-y-2">
                        <div className="px-6 py-3 flex justify-between space-x-2 text-gray-400 border-t border-gray-200 h-96">
                            <div className="flex flex-col items-center w-96 m-auto">
                                <h3 className="text-center pb-3 text-gray-500">No Active Workspaces</h3>
                                <div className="text-center pb-6 text-gray-500">Prefix any git repository URL with gitpod.io/# or create a new workspace for a recently used project. <a className="text-gray-400 underline underline-thickness-thin underline-offset-small hover:text-gray-600" href="https://www.gitpod.io/docs/getting-started/">Learn more</a></div>
                                <span>
                                    <button onClick={this.showStartWSModal}>New Workspace</button>
                                    {wsModel.getAllFetchedWorkspaces().size > 0 ? <button className="secondary ml-2" onClick={onAll}>View All Workspaces</button>:null}
                                </span>
                            </div>
                        </div>
                    </div>
            )}
            <StartWorkspaceModal
                onClose={this.hideStartWSModal}
                visible={!!this.state?.isTemplateModelOpen}
                examples={this.state?.repos && this.state.repos.map(r => ({
                    title: r.name,
                    description: r.description || r.url,
                    startUrl:  gitpodHostUrl.withContext(r.url).toString()
                }))}
                recent={wsModel && this.state?.workspaces ? 
                    this.getRecentSuggestions()
                : []} />
        </>;
    }

    protected getRecentSuggestions(): WsStartEntry[] {
        if (this.workspaceModel) {
            const all = this.workspaceModel.getAllFetchedWorkspaces();
            if (all && all.size > 0) {
                const index = new Map<string, WsStartEntry & {lastUse: string}>();
                for (const ws of Array.from(all.values())) {
                    const repoUrl = Workspace.getFullRepositoryUrl(ws.workspace);
                    if (repoUrl) {
                        const lastUse = WorkspaceInfo.lastActiveISODate(ws);
                        let entry = index.get(repoUrl);
                        if (!entry) {
                            entry = {
                                title: Workspace.getFullRepositoryName(ws.workspace) || repoUrl,
                                description: repoUrl,
                                startUrl: gitpodHostUrl.withContext(repoUrl).toString(),
                                lastUse,
                            };
                            index.set(repoUrl, entry);
                        } else {
                            if (entry.lastUse.localeCompare(lastUse) < 0) {
                                entry.lastUse = lastUse;
                            }
                        }
                    }
                }
                const list = Array.from(index.values());
                list.sort((a,b) => b.lastUse.localeCompare(a.lastUse));
                return list;
            }
        }
        return [];
    }
}