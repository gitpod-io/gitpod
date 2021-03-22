import React, { Suspense } from "react";
import { CreateWorkspaceMode, WorkspaceCreationResult } from "@gitpod/gitpod-protocol";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import Modal from "../components/Modal";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { StartPage, StartPhase } from "./StartPage";
import StartWorkspace from "./StartWorkspace";

const WorkspaceLogs = React.lazy(() => import('./WorkspaceLogs'));

export interface CreateWorkspaceProps {
  contextUrl: string;
}

export interface CreateWorkspaceState {
  result?: WorkspaceCreationResult;
  error?: CreateWorkspaceError;
  stillParsing: boolean;
}

export interface CreateWorkspaceError {
  message?: string;
  code?: number;
  data?: any;
}

export class CreateWorkspace extends React.Component<CreateWorkspaceProps, CreateWorkspaceState> {

  constructor(props: CreateWorkspaceProps) {
    super(props);
    this.state = { stillParsing: true };
  }

  componentDidMount() {
    this.createWorkspace();
  }

  async createWorkspace(mode = CreateWorkspaceMode.SelectIfRunning) {
    // Invalidate any previous result.
    this.setState({
      result: undefined,
      stillParsing: true,
    });

    // We assume anything longer than 3 seconds is no longer just parsing the context URL (i.e. it's now creating a workspace).
    let timeout = setTimeout(() => this.setState({ stillParsing: false }), 3000);

    try {
      const result = await getGitpodService().server.createWorkspace({
        contextUrl: this.props.contextUrl,
        mode
      });
      if (result.workspaceURL) {
        window.location.href = result.workspaceURL;
        return;
      }
      clearTimeout(timeout);
      this.setState({
        result,
        stillParsing: false,
      });
    } catch (error) {
      clearTimeout(timeout);
      this.setState({
        error,
        stillParsing: false,
      });
    }
  }

  render() {
    const { contextUrl } = this.props;
    let phase = StartPhase.Checking;
    let statusMessage = <p className="text-base text-gray-400">{this.state.stillParsing ? 'Parsing context …' : 'Preparing workspace …'}</p>;
    let logsView = undefined;

    const error = this.state?.error;
    if (error) {
      switch (error.code) {
        case ErrorCodes.CONTEXT_PARSE_ERROR:
          statusMessage = <div className="text-center">
            <p className="text-base text-red">Unrecognized context: '{contextUrl}'</p>
            <p className="text-base mt-2">Learn more about <a className="text-blue" href="https://www.gitpod.io/docs/context-urls/">supported context URLs</a></p>
          </div>;
          break;
        case ErrorCodes.NOT_FOUND:
          statusMessage = <div className="text-center">
            <p className="text-base text-red">Not found: {contextUrl}</p>
          </div>;
          break;
        default:
          statusMessage = <p className="text-base text-red">Unknown Error: {JSON.stringify(this.state?.error, null, 2)}</p>;
          break;
      }
    }

    const result = this.state?.result;
    if (result?.createdWorkspaceId) {
      return <StartWorkspace workspaceId={result.createdWorkspaceId} />;
    }

    else if (result?.existingWorkspaces) {
      statusMessage = <Modal visible={true} closeable={false} onClose={()=>{}}>
        <h3>Running Workspaces</h3>
        <div className="border-t border-b border-gray-200 mt-2 -mx-6 px-6 py-2">
          <p className="mt-1 mb-2 text-base">You already have running workspaces with the same context. You can open an existing one or open a new workspace.</p>
          <>
            {result?.existingWorkspaces?.map(w =>
              <a href={w.latestInstance?.ideUrl} className="rounded-xl group hover:bg-gray-100 flex p-3 my-1">
                <div className="w-full">
                  <p className="text-base text-black font-bold">{w.workspace.id}</p>
                  <p>{w.workspace.contextURL}</p>
                </div>
              </a>
            )}
          </>
        </div>
        <div className="flex justify-end mt-6">
          <button onClick={() => this.createWorkspace(CreateWorkspaceMode.Default)}>New Workspace</button>
        </div>
      </Modal>;
    }

    else if (result?.runningWorkspacePrebuild) {
      statusMessage = <p className="text-base text-gray-400">⚡Prebuild in progress</p>;
      logsView = <Suspense fallback={<div className="m-6 p-4 h-60 w-11/12 lg:w-3/5 flex-shrink-0 rounded-lg" style={{ color: '#8E8787', background: '#ECE7E5' }}>Loading...</div>}>
        <WorkspaceLogs />
      </Suspense>;
    }

    return <StartPage phase={phase} error={!!error}>
      {statusMessage}
      {logsView}
      {error && <div>
        <a href={gitpodHostUrl.asDashboard().toString()}><button className="mt-8 px-4 py-2 text-gray-500 bg-white font-semibold border-gray-500">Go back to dashboard</button></a>
        <p className="mt-14 text-base text-gray-400 flex space-x-2">
          <a href="https://www.gitpod.io/docs/">Docs</a>
          <span>—</span>
          <a href="https://status.gitpod.io/">Status</a>
          <span>—</span>
          <a href="https://www.gitpod.io/blog/">Blog</a>
        </p>
      </div>}
    </StartPage>;
  }

}