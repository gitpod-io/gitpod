/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import EventEmitter from "events";
import React, { useEffect, Suspense } from "react";
import { CreateWorkspaceMode, WorkspaceCreationResult, RunningWorkspacePrebuildStarting } from "@gitpod/gitpod-protocol";
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
      console.error(error);
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

    const error = this.state?.error;
    if (error) {
      switch (error.code) {
        case ErrorCodes.CONTEXT_PARSE_ERROR:
          statusMessage = <div className="text-center">
            <p className="text-base text-red-500">Unrecognized context: '{contextUrl}'</p>
            <p className="text-base mt-2">Learn more about <a className="text-blue" href="https://www.gitpod.io/docs/context-urls/">supported context URLs</a></p>
          </div>;
          break;
        case ErrorCodes.NOT_FOUND:
          statusMessage = <div className="text-center">
            <p className="text-base text-red-500">Not found: {contextUrl}</p>
          </div>;
          break;
        default:
          statusMessage = <p className="text-base text-red-500 w-96">Unknown Error: {JSON.stringify(this.state?.error, null, 2)}</p>;
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
      return <RunningPrebuildView
        runningPrebuild={result.runningWorkspacePrebuild}
        onIgnorePrebuild={() => this.createWorkspace(CreateWorkspaceMode.ForceNew)}
        onPrebuildSucceeded={() => this.createWorkspace(CreateWorkspaceMode.UsePrebuild)}
      />;
    }

    return <StartPage phase={phase} error={!!error}>
      {statusMessage}
      {error && <div>
        <a href={gitpodHostUrl.asDashboard().toString()}><button className="mt-8 px-4 py-2 text-gray-500 bg-white font-semibold border-gray-500 hover:text-gray-700 hover:bg-gray-100 hover:border-gray-700">Go back to dashboard</button></a>
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

interface RunningPrebuildViewProps {
  runningPrebuild: {
    prebuildID: string
    workspaceID: string
    starting: RunningWorkspacePrebuildStarting
    sameCluster: boolean
  };
  onIgnorePrebuild: () => void;
  onPrebuildSucceeded: () => void;
}

function RunningPrebuildView(props: RunningPrebuildViewProps) {
  const logsEmitter = new EventEmitter();
  const service = getGitpodService();
  let pollTimeout: NodeJS.Timeout | undefined;

  useEffect(() => {
    const pollIsPrebuildDone = async () => {
      clearTimeout(pollTimeout!);
      const available = await service.server.isPrebuildDone(props.runningPrebuild.prebuildID);
      if (available) {
        props.onPrebuildSucceeded();
        return;
      }
      pollTimeout = setTimeout(pollIsPrebuildDone, 10000);
    };
    const watchPrebuild = () => {
      service.server.watchHeadlessWorkspaceLogs(props.runningPrebuild.workspaceID);
      pollIsPrebuildDone();
    };
    watchPrebuild();

    const toDispose = service.registerClient({
      notifyDidOpenConnection: () => watchPrebuild(),
      onHeadlessWorkspaceLogs: event => {
        if (event.workspaceID !== props.runningPrebuild.workspaceID) {
          return;
        }
        logsEmitter.emit('logs', event.text);
      },
    });

    return function cleanup() {
      clearTimeout(pollTimeout!);
      toDispose.dispose();
    };
  }, []);

  return <StartPage title="Prebuild in Progress">
    <Suspense fallback={<div />}>
      <WorkspaceLogs logsEmitter={logsEmitter} />
    </Suspense>
    <button className="mt-6 text-gray-500 border-gray-500 bg-white hover:text-gray-700 hover:bg-gray-100 hover:border-gray-700" onClick={() => { clearTimeout(pollTimeout!); props.onIgnorePrebuild(); }}>Don't Wait for Prebuild</button>
  </StartPage>;
}