import React from "react";
import { DisposableCollection, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { StartPage, StartPhase } from "./StartPage";

export interface StartWorkspaceProps {
  workspaceId: string;
}

export interface StartWorkspaceState {
  contextUrl?: string;
  startedInstanceId?: string;
  workspaceInstance?: WorkspaceInstance;
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
            contextUrl: ws.workspace.contextURL
          });
          this.onInstanceUpdate(ws.latestInstance);
        }
      });
    } catch (error) {
      this.setState({ error });
    }
  }

  async onInstanceUpdate(workspaceInstance: WorkspaceInstance) {
    const startedInstanceId = this.state?.startedInstanceId;
    if (workspaceInstance.workspaceId !== this.props.workspaceId || startedInstanceId !== workspaceInstance.id) {
      return;
    }

    await this.ensureWorkspaceAuth(workspaceInstance.id);

    // redirect to workspaceURL if we are not yet running in an iframe
    // it happens this late if we were waiting for a docker build.
    if (!this.runsInIFrame() && workspaceInstance.ideUrl) {
      this.redirectTo(workspaceInstance.ideUrl);
      return;
    }

    if (workspaceInstance.status.phase === 'preparing') {
      getGitpodService().server.watchWorkspaceImageBuildLogs(workspaceInstance.workspaceId);
    }

    this.setState({ workspaceInstance });
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
    let phase = StartPhase.Preparing;
    let statusMessage = <p className="text-base text-gray-400">Preparing workspace …</p>;

    switch (this.state?.workspaceInstance?.status.phase) {
      // unknown indicates an issue within the system in that it cannot determine the actual phase of
      // a workspace. This phase is usually accompanied by an error.
      case "unknown":
        break;

      // Preparing means that we haven't actually started the workspace instance just yet, but rather
      // are still preparing for launch. This means we're building the Docker image for the workspace.
      case "preparing":
        phase = StartPhase.Preparing;
        statusMessage = <p className="text-base text-gray-400">Building image …</p>;
        break;

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
        statusMessage = <p className="text-base text-gray-400">Cloning repository …</p>; // TODO Loading prebuild ...
        break;

      // Running means the workspace is able to actively perform work, either by serving a user through Theia,
      // or as a headless workspace.
      case "running":
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
        phase = StartPhase.Stopping;
        statusMessage = <div>
          <div className="flex space-x-3 items-center rounded-xl m-auto px-4 h-16 w-72 mt-4 bg-gray-100">
            <div className="rounded-full w-3 h-3 text-sm bg-gitpod-kumquat">&nbsp;</div>
            <div>
              <p className="text-gray-700 font-semibold">{this.state.workspaceInstance.workspaceId}</p>
              <p className="w-56 truncate">{this.state.contextUrl}</p>
            </div>
          </div>
        </div>;
        break;

      // Stopped means the workspace ended regularly because it was shut down.
      case "stopped":
        phase = StartPhase.Stopped;
        statusMessage = <div>
            <div className="flex space-x-3 items-center rounded-xl m-auto px-4 h-16 w-72 mt-4 bg-gray-100">
            <div className="rounded-full w-3 h-3 text-sm bg-gray-300">&nbsp;</div>
            <div>
              <p className="text-gray-700 font-semibold">{this.state.workspaceInstance.workspaceId}</p>
              <p className="w-56 truncate">{this.state.contextUrl}</p>
            </div>
          </div>
          <div className="mt-10 flex space-x-2">
            <button className="px-4 py-2 text-gray-500 bg-white font-semibold border-gray-500 hover:text-gray-700 hover:border-gray-700 hover:bg-gray-100" onClick={() => this.redirectTo(gitpodHostUrl.asDashboard().toString())}>Go to Dashboard</button>
            <button className="px-4 py-2 text-gray-50 bg-green-600 font-semibold border-green-800 hover:bg-green-700" onClick={() => this.redirectTo(gitpodHostUrl.asStart(this.state.workspaceInstance?.workspaceId).toString())}>Open Workspace</button>
          </div>
        </div>;
        break;
    }

    return <StartPage phase={phase}>
      {statusMessage}
    </StartPage>;
  }
}
