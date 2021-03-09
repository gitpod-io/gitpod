import { CreateWorkspaceMode, GitpodService, WorkspaceCreationResult } from "@gitpod/gitpod-protocol";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { StartPage, StartPhase } from "../components/StartPage";
import StartWorkspace from "./StartWorkspace";
import React, { Suspense } from "react";

const WorkspaceLogs = React.lazy(() => import('./WorkspaceLogs'));

export interface CreateWorkspaceProps {
  contextUrl: string;
  gitpodService: GitpodService;
}

export interface CreateWorkspaceState {
  result?: WorkspaceCreationResult;
  error?: CreateWorkspaceError;
}

export interface CreateWorkspaceError {
  message?: string;
  code?: number;
  data?: any;
}

export class CreateWorkspace extends React.Component<CreateWorkspaceProps, CreateWorkspaceState> {

  constructor(props: CreateWorkspaceProps) {
    super(props);
    window.addEventListener("hashchange", () => { window.location.reload(true); }, false);
  }

  componentDidMount() {
    this.createWorkspace();
  }

  async createWorkspace() {
    try {
      const result = await this.props.gitpodService.server.createWorkspace({
        contextUrl: this.props.contextUrl,
        mode: CreateWorkspaceMode.SelectIfRunning
      });
      if (result.workspaceURL) {
        window.location.href = result.workspaceURL;
        return;
      }
      this.setState({ result });
    } catch (error) {
      this.setState({ error });
    }
  }

  render() {
    const { contextUrl } = this.props;
    let phase = StartPhase.Checking;
    let statusMessage = <p className="text-sm text-gray-400">Creating workspace …</p>;
    let logsView = undefined;

    const error = this.state?.error;
    if (error) {
      switch (error.code) {
        case ErrorCodes.CONTEXT_PARSE_ERROR:
          statusMessage = <div className="text-center">
            <p className="text-sm text-red">Unrecognized context: '{contextUrl}'</p>
            <p>Learn more about <a className="text-blue" href="https://www.gitpod.io/docs/context-urls/">supported context URLs</a></p>
          </div>;
          break;
        case ErrorCodes.NOT_FOUND:
          statusMessage = <div className="text-center">
            <p className="text-sm text-red">Not found: {contextUrl}</p>
          </div>;
          break;
        default:
          statusMessage = <p className="text-sm text-red">Unknown Error: {JSON.stringify(this.state?.error, null, 2)}</p>;
          break;
      }
    }

    const result = this.state?.result;
    if (result?.createdWorkspaceId) {
      return <StartWorkspace workspaceId={result.createdWorkspaceId} gitpodService={this.props.gitpodService} />;
    }

    else if (result?.existingWorkspaces) {
      // FIXME Force create
      statusMessage = <div className="text-sm text-gray-400">Existing workspaces:<ul>{result.existingWorkspaces.map(w => <li>→ <a className="text-blue" href={w.latestInstance?.ideUrl}>{w.workspace.id}</a></li>)}</ul></div>;
    }

    else if (result?.runningWorkspacePrebuild) {
      phase = StartPhase.Building;
      statusMessage = <p className="text-sm text-gray-400">⚡Prebuild in progress</p>;
      logsView = <Suspense fallback={<div className="m-6 p-4 h-60 w-11/12 lg:w-3/5 flex-shrink-0 rounded-lg" style={{ color: '#8E8787', background: '#ECE7E5' }}>Loading...</div>}>
        <WorkspaceLogs />
      </Suspense>;
    }

    return <StartPage phase={phase} error={!!error}>
      {statusMessage}
      {logsView}
    </StartPage>;
  }

}