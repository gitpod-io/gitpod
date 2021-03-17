import React from "react";
import { GitpodService, WorkspaceInfo } from "@gitpod/gitpod-protocol";
import Header from "../components/Header";
import DropDown from "../components/DropDown"
import { WorkspaceModel } from "./workspace-model";
import { WorkspaceEntry } from "./WorkspaceEntry";

export interface WorkspacesProps {
    gitpodService: GitpodService;
}

export interface WorkspacesState {
    workspaces: WorkspaceInfo[];
}

export class Workspaces extends React.Component<WorkspacesProps, WorkspacesState> {

    protected workspaceModel: WorkspaceModel;

    constructor(props: WorkspacesProps) {
        super(props);
        this.workspaceModel = new WorkspaceModel(props.gitpodService, this.setWorkspaces);
    }

    protected setWorkspaces = (workspaces: WorkspaceInfo[]) => {
        this.setState({
            workspaces
        });
    }

    render() {
        const onActive = () => this.workspaceModel.active = true;
        const onRecent = () => this.workspaceModel.active = false;
        return <>
            <Header title="Workspaces" subtitle="Manage past workspaces" />

            <div className="lg:px-28 px-10 pt-8 flex">
                <div className="flex">
                    <div className="py-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 490 490">
                            <path fill="none" stroke="#777" stroke-width="36" stroke-linecap="round"
                                d="m280,278a153,153 0 1,0-2,2l170,170m-91-117 110,110-26,26-110-110" />
                        </svg>
                    </div>
                    <input className="border-0" type="text" placeholder="Search Workspace" onChange={(v) => { console.log(v) }} />
                </div>
                <div className="flex-1" />
                <div className="py-3">
                    <DropDown entries={[{
                        title: 'Active',
                        onClick: onActive
                    }, {
                        title: 'Past',
                        onClick: onRecent
                    }]} />
                </div>
            </div>
            <div className="lg:px-28 px-10 flex flex-col space-y-2">
                <div className="py-3 flex justify-between space-x-2 text-sm text-gray-400 border-t border-b border-gray-200">
                    <div className="w-10"></div>
                    <div className="w-3/12">Name</div>
                    <div className="w-4/12">Context</div>
                    <div className="w-2/12">Pending Changes</div>
                    <div className="w-2/12">Last Active</div>
                    <div className="w-8"></div>
                </div>
                {
                    this.state?.workspaces.map(e => {
                        return <WorkspaceEntry key={e.workspace.id} {...e} />
                    })
                }
            </div></>;
    }
}