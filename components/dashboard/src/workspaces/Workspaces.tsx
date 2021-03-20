import React from "react";
import { WhitelistedRepository, WorkspaceInfo } from "@gitpod/gitpod-protocol";
import Header from "../components/Header";
import DropDown from "../components/DropDown"
import { WorkspaceModel } from "./workspace-model";
import { WorkspaceEntry } from "./WorkspaceEntry";
import Modal from "../components/Modal";
import { getGitpodService, gitpodHostUrl } from "../service/service";

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

    render() {
        const wsModel = this.workspaceModel;
        const toggleTemplateModal = () => this.setState({
            isTemplateModelOpen: !this.state?.isTemplateModelOpen
        });
        const onActive = () => wsModel!.active = true;
        const onAll = () => wsModel!.active = false;
        return <>
            <Header title="Workspaces" subtitle="Manage recent and stopped workspaces." />

            <div className="lg:px-28 px-10 pt-8 flex">
                <div className="flex">
                    <div className="py-4">
                        <svg width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M6 2a4 4 0 100 8 4 4 0 000-8zM0 6a6 6 0 1110.89 3.477l4.817 4.816a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 010 6z" fill="#A8A29E"/>
                        </svg>
                    </div>
                    <input className="border-0" type="text" placeholder="Search Workspaces" onChange={(v) => { if (wsModel) wsModel.setSearch(v.target.value) }} />
                </div>
                <div className="flex-1" />
                <div className="py-3">
                    <DropDown prefix="Filter: " contextMenuWidth="w-32" entries={[{
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
                        <div className="px-6 py-3 flex justify-between space-x-2 text-sm text-gray-400 border-t border-gray-200 h-96">
                            <div className="flex flex-col items-center w-96 m-auto">
                                <h3 className="text-center pb-3">No Active Workspaces</h3>
                                <div className="text-center pb-6 text-gray-500">Prefix a git repository URL with gitpod.io/# or open a workspace template. <a className="text-gray-400 underline underline-thickness-thin underline-offset-small hover:text-gray-600" href="https://www.gitpod.io/docs/getting-started/">Learn how to get started</a></div>
                                <button onClick={toggleTemplateModal} className="font-medium">Select Template</button>
                            </div>
                        </div>
                    </div>
            )}
            <Modal onClose={toggleTemplateModal} visible={!!this.state?.isTemplateModelOpen}>
                <h3>Select Template</h3>
                {/* separator */}
                <div className="border-t mt-2 -mx-6 px-6 py-2">
                    <p className="mt-1 mb-2 text-base">Select a template to open a workspace.</p>
                    <div className="space-y-2 pt-4 overflow-y-scroll h-80">
                        {this.state?.repos && this.state.repos.map(r => {
                            const url = gitpodHostUrl.withContext(r.url).toString();
                            return <a key={r.name} href={url} className="rounded-xl group hover:bg-gray-100 flex p-4 my-1">
                                <div className="w-full">
                                    <p className="text-base text-gray-800 font-semibold">{r.name}</p>
                                    <p>{r.url}</p>
                                </div>
                            </a>;
                        })}
                    </div>
                </div>
            </Modal>
        </>;
    }
}