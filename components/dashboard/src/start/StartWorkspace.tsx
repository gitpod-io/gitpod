import React from "react";
import { GitpodService, DisposableCollection, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { StartPage, StartPhase } from "../components/StartPage";

export interface StartWorkspaceProps {
  workspaceId: string;
  gitpodService: GitpodService;
}

export interface StartWorkspaceState {
  phase: StartPhase;
  contextUrl?: string;
  startedInstanceId?: string;
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
    this.state = {
      phase: StartPhase.Building,
    };
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
      this.toDispose.push(this.props.gitpodService.registerClient(this));
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
      const result = await this.props.gitpodService.server.startWorkspace(workspaceId, { forceDefaultImage });
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
      this.props.gitpodService.server.getWorkspace(workspaceId).then(ws => {
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

    switch (workspaceInstance.status.phase) {
      // unknown indicates an issue within the system in that it cannot determine the actual phase of
      // a workspace. This phase is usually accompanied by an error.
      case "unknown":
        break;

      // Preparing means that we haven't actually started the workspace instance just yet, but rather
      // are still preparing for launch. This means we're building the Docker image for the workspace.
      case "preparing":
        this.props.gitpodService.server.watchWorkspaceImageBuildLogs(workspaceInstance.workspaceId);
        this.setState({ phase: StartPhase.Building });
        break;

      // Pending means the workspace does not yet consume resources in the cluster, but rather is looking for
      // some space within the cluster. If for example the cluster needs to scale up to accomodate the
      // workspace, the workspace will be in Pending state until that happened.
      case "pending":
        this.setState({ phase: StartPhase.Preparing });
        break;

      // Creating means the workspace is currently being created. That includes downloading the images required
      // to run the workspace over the network. The time spent in this phase varies widely and depends on the current
      // network speed, image size and cache states.
      case "creating":
        this.setState({ phase: StartPhase.Preparing });
        break;

      // Initializing is the phase in which the workspace is executing the appropriate workspace initializer (e.g. Git
      // clone or backup download). After this phase one can expect the workspace to either be Running or Failed.
      case "initializing":
        this.setState({ phase: StartPhase.Starting });
        break;

      // Running means the workspace is able to actively perform work, either by serving a user through Theia,
      // or as a headless workspace.
      case "running":
        this.setState({ phase: StartPhase.Running });
        break;

      // Interrupted is an exceptional state where the container should be running but is temporarily unavailable.
      // When in this state, we expect it to become running or stopping anytime soon.
      case "interrupted":
        this.setState({ phase: StartPhase.Running });
        break;

      // Stopping means that the workspace is currently shutting down. It could go to stopped every moment.
      case "stopping":
        break;

      // Stopped means the workspace ended regularly because it was shut down.
      case "stopped":
        break;
    }

  }

  async ensureWorkspaceAuth(instanceID: string) {
    if (!document.cookie.includes(`${instanceID}_owner_`)) {
      const authURL = new GitpodHostUrl(window.location.toString()).asWorkspaceAuth(instanceID);
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
    return <StartPage phase={this.state.phase}>
      <div className="text-sm text-gray-400">Workspace ID: {this.props.workspaceId}</div>
    </StartPage>;
  }
}
