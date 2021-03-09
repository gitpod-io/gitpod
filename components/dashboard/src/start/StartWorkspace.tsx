import { StartPage, StartPhase } from "../components/StartPage";
import { GitpodService } from "@gitpod/gitpod-protocol";
import React from "react";

export interface StartWorkspaceProps {
  workspaceId?: string;
  gitpodService: GitpodService;
}

export interface StartWorkspaceState {
  phase: StartPhase;
}

export interface StartWorkspaceError {
  message?: string;
  code?: number;
  data?: any;
}

export default class StartWorkspace extends React.Component<StartWorkspaceProps, StartWorkspaceState> {

  constructor(props: StartWorkspaceProps) {
    super(props);
    this.state = {
      phase: StartPhase.Building,
    };
  }

  render() {
    return <StartPage phase={this.state.phase}>
      <div className="text-sm text-gray-400">Workspace ID: {this.props.workspaceId}</div>
    </StartPage>;
  }
}
