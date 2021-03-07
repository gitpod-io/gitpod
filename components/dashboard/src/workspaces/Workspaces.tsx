import React from "react";
import { GitpodService, WorkspaceInfo } from "@gitpod/gitpod-protocol";
import Header from "../components/Header";
import Toggle from "../components/Toggle"
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
        this.workspaceModel = new  WorkspaceModel(props.gitpodService, this.setWorkspaces);
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
        <Header title="Workspaces" subtitle="Open and Share Workspaces"/>
        
        <div className="lg:px-28 px-10 pt-4 flex">
            <input type="text" placeholder="Search Workspace"  onChange={(v) => {console.log(v)}} />

            <Toggle entries={[{
                title: 'Active',
                onActivate: onActive
            }, {
                title: 'Recent',
                onActivate: onRecent
            }]} />
        </div>
        <div className="lg:px-28 px-10 pt-4 flex flex-col">
            {
                this.state?.workspaces.map(e => {
                    return <WorkspaceEntry key={e.workspace.id} {...e} />
                })
            }
        </div></>;
    }
}