/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import EventEmitter from "events";
import React, { useEffect, Suspense } from "react";
import { DisposableCollection, WorkspaceInstance, WorkspaceImageBuild, Workspace, WithPrebuild } from "@gitpod/gitpod-protocol";
import { HeadlessLogEvent } from "@gitpod/gitpod-protocol/lib/headless-workspace-log";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { StartPage, StartPhase } from "./StartPage";

const WorkspaceLogs = React.lazy(() => import('./WorkspaceLogs'));

export interface StartWorkspaceProps {
  workspaceId: string;
}

export interface StartWorkspaceState {
  startedInstanceId?: string;
  workspaceInstance?: WorkspaceInstance;
  workspace?: Workspace;
  error?: StartWorkspaceError;
  ideFrontendFailureCause?: string;
}

export interface StartWorkspaceError {
  message?: string;
  code?: number;
  data?: any;
}

export default class StartWorkspace extends React.Component<StartWorkspaceProps, StartWorkspaceState> {

  constructor(props: StartWorkspaceProps) {
    super(props);
    this.state = {};
  }

  private readonly toDispose = new DisposableCollection();
  componentWillMount() {
    if (this.runsInIFrame()) {
      const setStateEventListener = (event: MessageEvent) => {
        if (event.data.type === 'setState' && 'state' in event.data && typeof event.data['state'] === 'object') {
          // This seems to only set ideFrontendFailureCause
          this.setState(event.data.state);
        }
      }
      window.addEventListener('message', setStateEventListener, false);
      this.toDispose.push({
        dispose: () => window.removeEventListener('message', setStateEventListener)
      });
    }

    try {
      this.toDispose.push(getGitpodService().registerClient(this));
    } catch (error) {
      console.error(error);
      this.setState({ error });
    }

    this.startWorkspace();
  }

  componentWillUnmount() {
    this.toDispose.dispose();
  }

  async startWorkspace(restart = false, forceDefaultImage = false) {
    const state = this.state;
    if (state) {
      if (!restart && (state.startedInstanceId /* || state.errorMessage */)) {
        // We stick with a started instance until we're explicitly told not to
        return;
      }
    }

    const { workspaceId } = this.props;
    try {
      const result = await getGitpodService().server.startWorkspace(workspaceId, { forceDefaultImage });
      if (!result) {
        throw new Error("No result!");
      }
      console.log("/start: started workspace instance: " + result.instanceID);
      // redirect to workspaceURL if we are not yet running in an iframe
      if (!this.runsInIFrame() && result.workspaceURL) {
        this.redirectTo(result.workspaceURL);
        return;
      }
      this.setState({ startedInstanceId: result.instanceID });
      // Explicitly query state to guarantee we get at least one update
      // (needed for already started workspaces, and not hanging in 'Starting ...' for too long)
      getGitpodService().server.getWorkspace(workspaceId).then(ws => {
        if (ws.latestInstance) {
          this.setState({
            workspace: ws.workspace
          });
          this.onInstanceUpdate(ws.latestInstance);
        }
      });
    } catch (error) {
      console.error(error);
      if (typeof error === 'string') {
        error = { message: error };
      }
      this.setState({ error });
    }
  }

  async onInstanceUpdate(workspaceInstance: WorkspaceInstance) {
    const startedInstanceId = this.state?.startedInstanceId;
    if (workspaceInstance.workspaceId !== this.props.workspaceId || startedInstanceId !== workspaceInstance.id) {
      return;
    }

    await this.ensureWorkspaceAuth(workspaceInstance.id);

    // Redirect to workspaceURL if we are not yet running in an iframe.
    // It happens this late if we were waiting for a docker build.
    if (!this.runsInIFrame() && workspaceInstance.ideUrl) {
      this.redirectTo(workspaceInstance.ideUrl);
      return;
    }

    // Stopped and headless: the prebuild is done, let's try to use it!
    if (workspaceInstance.status.phase === 'stopped' && this.state.workspace?.type !== 'regular') {
      const contextUrl = this.state.workspace?.contextURL.replace('prebuild/', '')!;
      this.redirectTo(gitpodHostUrl.withContext(contextUrl).toString());
    }

    let error;
    if (workspaceInstance.status.conditions.failed) {
      error = { message: workspaceInstance.status.conditions.failed };
    }

    this.setState({ workspaceInstance, error });
  }

  async ensureWorkspaceAuth(instanceID: string) {
    if (!document.cookie.includes(`${instanceID}_owner_`)) {
      const authURL = gitpodHostUrl.asWorkspaceAuth(instanceID);
      const response = await fetch(authURL.toString());
      if (response.redirected) {
        this.redirectTo(response.url);
        return;
      }
      if (!response.ok) {
        // getting workspace auth didn't work as planned - redirect
        this.redirectTo(authURL.asWorkspaceAuth(instanceID, true).toString());
        return;
      }
    }
  }

  redirectTo(url: string) {
    if (this.runsInIFrame()) {
        window.parent.postMessage({ type: 'relocate', url }, '*');
    } else {
        window.location.href = url;
    }
  }

  runsInIFrame() {
    return window.top !== window.self;
  }

  render() {
    const { error } = this.state;
    const isHeadless = this.state.workspace?.type !== 'regular';
    const isPrebuilt = WithPrebuild.is(this.state.workspace?.context);
    let phase = StartPhase.Preparing;
    let title = !error ? undefined : 'Oh, no! Something went wrong!1';
    let statusMessage = !error
      ? <p className="text-base text-gray-400">Preparing workspace …</p>
      : <p className="text-base text-red-500 w-96">{error.message}</p>;

    switch (this.state?.workspaceInstance?.status.phase) {
      // unknown indicates an issue within the system in that it cannot determine the actual phase of
      // a workspace. This phase is usually accompanied by an error.
      case "unknown":
        break;

      // Preparing means that we haven't actually started the workspace instance just yet, but rather
      // are still preparing for launch. This means we're building the Docker image for the workspace.
      case "preparing":
        return <ImageBuildView workspaceId={this.state.workspaceInstance.workspaceId} />;

      // Pending means the workspace does not yet consume resources in the cluster, but rather is looking for
      // some space within the cluster. If for example the cluster needs to scale up to accomodate the
      // workspace, the workspace will be in Pending state until that happened.
      case "pending":
        phase = StartPhase.Preparing;
        statusMessage = <p className="text-base text-gray-400">Allocating resources …</p>;
        break;

      // Creating means the workspace is currently being created. That includes downloading the images required
      // to run the workspace over the network. The time spent in this phase varies widely and depends on the current
      // network speed, image size and cache states.
      case "creating":
        phase = StartPhase.Creating;
        statusMessage = <p className="text-base text-gray-400">Pulling container image …</p>;
        break;

      // Initializing is the phase in which the workspace is executing the appropriate workspace initializer (e.g. Git
      // clone or backup download). After this phase one can expect the workspace to either be Running or Failed.
      case "initializing":
        phase = StartPhase.Starting;
        statusMessage = <p className="text-base text-gray-400">{isPrebuilt ? 'Loading prebuild …' : 'Initializing content …'}</p>;
        break;

      // Running means the workspace is able to actively perform work, either by serving a user through Theia,
      // or as a headless workspace.
      case "running":
        if (isHeadless) {
          return <HeadlessWorkspaceView workspaceId={this.state.workspaceInstance.workspaceId} />;
        }
        phase = StartPhase.Running;
        statusMessage = <p className="text-base text-gray-400">Opening IDE …</p>;
        break;

      // Interrupted is an exceptional state where the container should be running but is temporarily unavailable.
      // When in this state, we expect it to become running or stopping anytime soon.
      case "interrupted":
        phase = StartPhase.Running;
        statusMessage = <p className="text-base text-gray-400">Checking workspace …</p>;
        break;

      // Stopping means that the workspace is currently shutting down. It could go to stopped every moment.
      case "stopping":
        if (isHeadless) {
          return <HeadlessWorkspaceView workspaceId={this.state.workspaceInstance.workspaceId} />;
        }
        phase = StartPhase.Stopping;
        statusMessage = <div>
          <div className="flex space-x-3 items-center rounded-xl m-auto px-4 h-16 w-72 mt-4 bg-gray-100">
            <div className="rounded-full w-3 h-3 text-sm bg-gitpod-kumquat">&nbsp;</div>
            <div>
              <p className="text-gray-700 font-semibold">{this.state.workspaceInstance.workspaceId}</p>
              <a href={this.state.workspace?.contextURL}><p className="w-56 truncate hover:underline" >{this.state.workspace?.contextURL}</p></a>
            </div>
          </div>
          <div className="mt-10 flex">
            <button className="secondary mx-auto" onClick={() => this.redirectTo(gitpodHostUrl.asDashboard().toString())}>Go to Dashboard</button>
          </div>
        </div>;
        break;

      // Stopped means the workspace ended regularly because it was shut down.
      case "stopped":
        phase = StartPhase.Stopped;
        if (!isHeadless && this.state.workspaceInstance.status.conditions.timeout) {
          title = 'Timed Out';
        }
        const pendingChanges = getPendingChanges(this.state.workspaceInstance);
        statusMessage = <div>
          <div className="flex space-x-3 items-center rounded-xl m-auto px-4 h-16 w-72 mt-4 bg-gray-100">
            <div className="rounded-full w-3 h-3 text-sm bg-gray-300">&nbsp;</div>
            <div>
              <p className="text-gray-700 font-semibold">{this.state.workspaceInstance.workspaceId}</p>
              {pendingChanges.length > 0 &&
                <p className="text-red-500">{pendingChanges.length} Change{pendingChanges.length === 1 ? '' : 's'}</p>
              }
              <a href={this.state.workspace?.contextURL}><p className="w-56 truncate hover:underline" >{this.state.workspace?.contextURL}</p></a>
            </div>
          </div>
          <div className="mt-10 flex space-x-2">
            <button className="secondary" onClick={() => this.redirectTo(gitpodHostUrl.asDashboard().toString())}>Go to Dashboard</button>
            <button onClick={() => this.redirectTo(gitpodHostUrl.asStart(this.state.workspaceInstance?.workspaceId).toString())}>Open Workspace</button>
          </div>
        </div>;
        break;
    }

    return <StartPage phase={phase} error={!!error} title={title}>
      {statusMessage}
      {error && <div>
        <button className="mt-8 secondary" onClick={() => this.redirectTo(gitpodHostUrl.asDashboard().toString())}>Go back to dashboard</button>
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

function getPendingChanges(workspaceInstance?: WorkspaceInstance) {
  const pendingChanges: { message: string, items: string[] }[] = [];
  const repo = workspaceInstance && workspaceInstance.status && workspaceInstance.status.repo;
  if (repo) {
    if (repo.totalUncommitedFiles || 0 > 0) {
      pendingChanges.push({
        message: repo.totalUncommitedFiles === 1 ? 'an uncommited file' : `${repo.totalUncommitedFiles} uncommited files`,
        items: repo.uncommitedFiles || []
      });
    }
    if (repo.totalUntrackedFiles || 0 > 0) {
      pendingChanges.push({
        message: repo.totalUntrackedFiles === 1 ? 'an untracked file' : `${repo.totalUntrackedFiles} untracked files`,
        items: repo.untrackedFiles || []
      });
    }
    if (repo.totalUnpushedCommits || 0 > 0) {
      pendingChanges.push({
        message: repo.totalUnpushedCommits === 1 ? 'an unpushed commit' : `${repo.totalUnpushedCommits} unpushed commits`,
        items: repo.unpushedCommits || []
      });
    }
  }
  return pendingChanges;
}

function ImageBuildView(props: { workspaceId: string }) {
  const logsEmitter = new EventEmitter();

  useEffect(() => {
    const service = getGitpodService();
    const watchBuild = () => service.server.watchWorkspaceImageBuildLogs(props.workspaceId);
    watchBuild();

    const toDispose = service.registerClient({
      notifyDidOpenConnection: () => watchBuild(),
      onWorkspaceImageBuildLogs: (info: WorkspaceImageBuild.StateInfo, content?: WorkspaceImageBuild.LogContent) => {
        if (!content) {
          return;
        }
        logsEmitter.emit('logs', content.text);
      },
    });

    return function cleanup() {
      toDispose.dispose();
    };
  }, []);

  return <StartPage title="Building Image">
    <Suspense fallback={<div />}>
      <WorkspaceLogs logsEmitter={logsEmitter}/>
    </Suspense>
  </StartPage>;
}

function HeadlessWorkspaceView(props: { workspaceId: string }) {
  const logsEmitter = new EventEmitter();

  useEffect(() => {
    const service = getGitpodService();
    const watchHeadlessWorkspace = () => service.server.watchHeadlessWorkspaceLogs(props.workspaceId);;
    watchHeadlessWorkspace();

    const toDispose = service.registerClient({
      notifyDidOpenConnection: () => watchHeadlessWorkspace(),
      onHeadlessWorkspaceLogs(event: HeadlessLogEvent): void {
        logsEmitter.emit('logs', event.text);
      },
    });

    return function cleanup() {
      toDispose.dispose();
    };
  }, []);

  return <StartPage title="Prebuild in Progress">
    <Suspense fallback={<div />}>
      <WorkspaceLogs logsEmitter={logsEmitter}/>
    </Suspense>
  </StartPage>;
}