/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ContextURL, DisposableCollection, GitpodServer, RateLimiterError, StartWorkspaceResult, WithPrebuild, Workspace, WorkspaceImageBuild, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { IDEOptions } from "@gitpod/gitpod-protocol/lib/ide-protocol";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import EventEmitter from "events";
import * as queryString from "query-string";
import React, { Suspense, useEffect } from "react";
import { v4 } from 'uuid';
import Arrow from "../components/Arrow";
import ContextMenu from "../components/ContextMenu";
import PendingChangesDropdown from "../components/PendingChangesDropdown";
import { watchHeadlessLogs } from "../components/PrebuildLogs";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { StartPage, StartPhase, StartWorkspaceError } from "./StartPage";
const sessionId = v4();

const WorkspaceLogs = React.lazy(() => import('../components/WorkspaceLogs'));

export interface StartWorkspaceProps {
  workspaceId: string,
  runsInIFrame: boolean,
  /**
   * This flag is used to break the autostart-cycle explained in https://github.com/gitpod-io/gitpod/issues/8043
   */
  dontAutostart: boolean,
}

export function parseProps(workspaceId: string, search?: string): StartWorkspaceProps {
  const params = parseParameters(search);
  const runsInIFrame = window.top !== window.self;
  return {
    workspaceId,
    runsInIFrame: window.top !== window.self,
    // Either:
    //  - not_found: we were sent back from a workspace cluster/IDE URL where we expected a workspace to be running but it wasn't because either:
    //    - this is a (very) old tab and the workspace already timed out
    //    - due to a start error our workspace terminated very quickly between:
    //      a) us being redirected to that IDEUrl (based on the first ws-manager update) and
    //      b) our requests being validated by ws-proxy
    //  - runsInIFrame (IDE case):
    //    - we assume the workspace has already been started for us
    //    - we don't know it's instanceId
    dontAutostart: params.notFound || runsInIFrame,
  }
}

function parseParameters(search?: string): { notFound?: boolean } {
  try {
    if (search === undefined) {
      return {};
    }
    const params = queryString.parse(search, {parseBooleans: true});
    const notFound = !!(params && params["not_found"]);
    return {
      notFound,
    };
  } catch (err) {
    console.error("/start: error parsing search params", err);
    return {};
  }
}

export interface StartWorkspaceState {
  /**
   * This is set to the istanceId we started (think we started on).
   * We only receive updates for this particular instance, or none if not set.
  */
  startedInstanceId?: string;
  workspaceInstance?: WorkspaceInstance;
  workspace?: Workspace;
  hasImageBuildLogs?: boolean;
  error?: StartWorkspaceError;
  desktopIde?: {
    link: string
    label: string
    clientID?: string
  };
  ideOptions?: IDEOptions;
}

export default class StartWorkspace extends React.Component<StartWorkspaceProps, StartWorkspaceState> {

  constructor(props: StartWorkspaceProps) {
    super(props);
    this.state = {};
  }

  private readonly toDispose = new DisposableCollection();
  componentWillMount() {
    if (this.props.runsInIFrame) {
      window.parent.postMessage({ type: '$setSessionId', sessionId }, '*');
      const setStateEventListener = (event: MessageEvent) => {
        if (event.data.type === 'setState' && 'state' in event.data && typeof event.data['state'] === 'object') {
          if (event.data.state.ideFrontendFailureCause) {
            const error = { message: event.data.state.ideFrontendFailureCause };
            this.setState({ error });
          }
          if (event.data.state.desktopIdeLink) {
            const label = event.data.state.desktopIdeLabel || "Open Desktop IDE";
            const clientID = event.data.state.desktopIdeClientID;
            this.setState({ desktopIde: { link: event.data.state.desktopIdeLink, label, clientID } });
          }
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

    if (this.props.dontAutostart) {
      // we saw errors previously, or run in-frame
      this.fetchWorkspaceInfo(undefined);
    } else {
      // dashboard case (w/o previous errors): start workspace as quickly as possible
      this.startWorkspace();
    }

    // query IDE options so we can show them if necessary once the workspace is running
    this.fetchIDEOptions();
  }

  componentWillUnmount() {
    this.toDispose.dispose();
  }

  componentDidUpdate(prevPros: StartWorkspaceProps, prevState: StartWorkspaceState) {
    const newPhase = this.state?.workspaceInstance?.status.phase;
    const oldPhase = prevState.workspaceInstance?.status.phase;
    if (newPhase !== oldPhase) {
      getGitpodService().server.trackEvent({
        event: "status_rendered",
        properties: {
          sessionId,
          instanceId: this.state.workspaceInstance?.id,
          workspaceId: this.props.workspaceId,
          type: this.state.workspace?.type,
          phase: newPhase
        },
      });
    }

    if (!!this.state.error && this.state.error !== prevState.error) {
      getGitpodService().server.trackEvent({
        event: "error_rendered",
        properties: {
          sessionId,
          instanceId: this.state.workspaceInstance?.id,
          workspaceId: this.state?.workspace?.id,
          type: this.state.workspace?.type,
          error: this.state.error
        },
      });
    }
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
      const result = await this.startWorkspaceRateLimited(workspaceId, { forceDefaultImage });
      if (!result) {
        throw new Error("No result!");
      }
      console.log("/start: started workspace instance: " + result.instanceID);
      // redirect to workspaceURL if we are not yet running in an iframe
      if (!this.props.runsInIFrame && result.workspaceURL) {
        this.redirectTo(result.workspaceURL);
        return;
      }
      // Start listening too instance updates - and explicitly query state once to guarantee we get at least one update
      // (needed for already started workspaces, and not hanging in 'Starting ...' for too long)
      this.fetchWorkspaceInfo(result.instanceID);
    } catch (error) {
      console.error(error);
      if (typeof error === 'string') {
        error = { message: error };
      }
      if (error?.code === ErrorCodes.USER_BLOCKED) {
        this.redirectTo(gitpodHostUrl.with({ pathname: '/blocked' }).toString());
        return;
      }
      this.setState({ error });
    }
  }

  /**
   * TODO(gpl) Ideally this can be pushed into the GitpodService implementation. But to get started we hand-roll it here.
   * @param workspaceId
   * @param options
   * @returns
   */
  protected async startWorkspaceRateLimited(workspaceId: string, options: GitpodServer.StartWorkspaceOptions): Promise<StartWorkspaceResult> {
    let retries = 0;
    while (true) {
      try {
        return await getGitpodService().server.startWorkspace(workspaceId, options);
      } catch (err) {
        if (err?.code !== ErrorCodes.TOO_MANY_REQUESTS) {
          throw err;
        }

        if (retries >= 10) {
          throw err;
        }
        retries++;

        const data = err?.data as RateLimiterError | undefined;
        const timeoutSeconds = data?.retryAfter || 5;
        console.log(`startWorkspace was rate-limited: waiting for ${timeoutSeconds}s before doing ${retries}nd retry...`)
        await new Promise(resolve => setTimeout(resolve, timeoutSeconds * 1000));
      }
    }
  }

  /**
   * Fetches initial WorkspaceInfo from the server. If there is a WorkspaceInstance for workspaceId, we feed it
   * into "onInstanceUpdate" and start accepting further updates.
   *
   * @param startedInstanceId The instanceId we want to listen on
   */
  async fetchWorkspaceInfo(startedInstanceId: string | undefined) {
    // this ensures we're receiving updates for this instance
    if (startedInstanceId) {
      this.setState({ startedInstanceId });
    }

    const { workspaceId } = this.props;
    try {
      const info = await getGitpodService().server.getWorkspace(workspaceId);
      if (info.latestInstance) {
        const instance = info.latestInstance;
        this.setState((s) => ({
          workspace: info.workspace,
          startedInstanceId: s.startedInstanceId || instance.id,  // note: here's a potential mismatch between startedInstanceId and instance.id. TODO(gpl) How to handle this?
        }));
        this.onInstanceUpdate(instance);
      }
    } catch (error) {
      console.error(error);
      this.setState({ error });
    }
  }

  /**
   * Fetches the current IDEOptions config for this user
   *
   * TODO(gpl) Ideally this would be part of the WorkspaceInstance shape, really. And we'd display options based on
   * what support it was started with.
   */
  protected async fetchIDEOptions() {
    const ideOptions = await getGitpodService().server.getIDEOptions();
    this.setState({ ideOptions });
  }

  notifyDidOpenConnection() {
    this.fetchWorkspaceInfo(undefined);
  }

  async onInstanceUpdate(workspaceInstance: WorkspaceInstance) {
    if (workspaceInstance.workspaceId !== this.props.workspaceId) {
      return;
    }

    // Here we filter out updates to instances we haven't started to avoid issues with updates coming in out-of-order
    // (e.g., multiple "stopped" events from the older instance, where we already started a fresh one after the first)
    // Only exception is when we do the switch from the "old" to the "new" one.
    const startedInstanceId = this.state?.startedInstanceId;
    if (startedInstanceId !== workspaceInstance.id) {
      // do we want to switch to "new" instance we just received an update for?
      const switchToNewInstance = this.state.workspaceInstance?.status.phase === "stopped" && workspaceInstance.status.phase !== "stopped";
      if (!switchToNewInstance) {
        return;
      }
      this.setState({
        startedInstanceId: workspaceInstance.id,
        workspaceInstance,
      });

      // now we're listening to a new instance, which might have been started with other IDEoptions
      this.fetchIDEOptions();
    }

    await this.ensureWorkspaceAuth(workspaceInstance.id);

    // Redirect to workspaceURL if we are not yet running in an iframe.
    // It happens this late if we were waiting for a docker build.
    if (!this.props.runsInIFrame && workspaceInstance.ideUrl && !this.props.dontAutostart) {
      this.redirectTo(workspaceInstance.ideUrl);
      return;
    }

    if (workspaceInstance.status.phase === 'preparing') {
      this.setState({ hasImageBuildLogs: true });
    }

    let error: StartWorkspaceError | undefined;
    if (workspaceInstance.status.conditions.failed) {
      error = { message: workspaceInstance.status.conditions.failed };
    }

    // Successfully stopped and headless: the prebuild is done, let's try to use it!
    if (!error && workspaceInstance.status.phase === 'stopped' && this.state.workspace?.type !== 'regular') {
      // here we want to point to the original context, w/o any modifiers "workspace" was started with (as this might have been a manually triggered prebuild!)
      const contextURL = ContextURL.getNormalizedURL(this.state.workspace);
      if (contextURL) {
        this.redirectTo(gitpodHostUrl.withContext(contextURL.toString()).toString());
      } else {
        console.error(`unable to parse contextURL: ${contextURL}`);
      }
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
    if (this.props.runsInIFrame) {
      window.parent.postMessage({ type: 'relocate', url }, '*');
    } else {
      window.location.href = url;
    }
  }

  render() {
    const { error } = this.state;
    const isHeadless = this.state.workspace?.type !== 'regular';
    const isPrebuilt = WithPrebuild.is(this.state.workspace?.context);
    let phase: StartPhase | undefined = StartPhase.Preparing;
    let title = undefined;
    let statusMessage = !!error ? undefined : <p className="text-base text-gray-400">Preparing workspace …</p>;
    const contextURL = ContextURL.getNormalizedURL(this.state.workspace)?.toString();

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
          return <HeadlessWorkspaceView instanceId={this.state.workspaceInstance.id} />;
        }
        if (!this.state.desktopIde) {
          phase = StartPhase.Running;

          if (this.props.dontAutostart) {
            // hide the progress bar, as we're already running
            phase = undefined;
            title = 'Running';

            // in case we dontAutostart the IDE we have to provide controls to do so
            statusMessage = <div>
                <div className="flex space-x-3 items-center text-left rounded-xl m-auto px-4 h-16 w-72 mt-4 mb-2 bg-gray-100 dark:bg-gray-800">
                  <div className="rounded-full w-3 h-3 text-sm bg-green-500">&nbsp;</div>
                  <div>
                    <p className="text-gray-700 dark:text-gray-200 font-semibold w-56 truncate">{this.state.workspaceInstance.workspaceId}</p>
                    <a target="_parent" href={contextURL}><p className="w-56 truncate hover:text-blue-600 dark:hover:text-blue-400" >{contextURL}</p></a>
                  </div>
                </div>
                <div className="mt-10 justify-center flex space-x-2">
                  <a target="_parent" href={gitpodHostUrl.asDashboard().toString()}><button className="secondary">Go to Dashboard</button></a>
                  <a target="_parent" href={gitpodHostUrl.asStart(this.props.workspaceId).toString() /** move over 'start' here to fetch fresh credentials in case this is an older tab */}><button>Open Workspace</button></a>
                </div>
            </div>;
          } else {
            statusMessage = <p className="text-base text-gray-400">Opening Workspace …</p>;
          }
        } else {
          phase = StartPhase.IdeReady;
          const openLink = this.state.desktopIde.link;
          const openLinkLabel = this.state.desktopIde.label;
          const clientID = this.state.desktopIde.clientID
          const client = clientID ? this.state.ideOptions?.clients?.[clientID] : undefined;
          const installationSteps = client?.installationSteps?.length && <div className="flex flex-col text-center m-auto text-sm w-72 text-gray-400">
            {client.installationSteps.map(step => <div dangerouslySetInnerHTML={{__html: step.replaceAll('${OPEN_LINK_LABEL}', openLinkLabel)}} />)}
          </div>
          statusMessage = <div>
            <p className="text-base text-gray-400">Opening Workspace …</p>
            <div className="flex space-x-3 items-center text-left rounded-xl m-auto px-4 h-16 w-72 mt-4 mb-2 bg-gray-100 dark:bg-gray-800">
              <div className="rounded-full w-3 h-3 text-sm bg-green-500">&nbsp;</div>
              <div>
                <p className="text-gray-700 dark:text-gray-200 font-semibold w-56 truncate">{this.state.workspaceInstance.workspaceId}</p>
                <a target="_parent" href={contextURL}><p className="w-56 truncate hover:text-blue-600 dark:hover:text-blue-400" >{contextURL}</p></a>
              </div>
            </div>
            {installationSteps}
            <div className="mt-10 justify-center flex space-x-2">
              <ContextMenu menuEntries={[
                {
                  title: 'Open in Browser',
                  onClick: () => window.parent.postMessage({ type: 'openBrowserIde' }, '*'),
                },
                {
                  title: 'Stop Workspace',
                  onClick: () => getGitpodService().server.stopWorkspace(this.props.workspaceId),
                },
                {
                  title: 'Go to Dashboard',
                  href: gitpodHostUrl.asDashboard().toString(),
                  target: "_parent",
                },
              ]} >
                <button className="secondary">More Actions...<Arrow up={false} /></button>
              </ContextMenu>
              <button onClick={() => {
                let redirect = false;
                try {
                  const desktopLink = new URL(openLink);
                  redirect = desktopLink.protocol != 'http:' && desktopLink.protocol != 'https:';
                } catch {}
                if (redirect) {
                  window.location.href = openLink;
                } else {
                  window.open(openLink, '_blank', 'noopener');
                }
              }}>{openLinkLabel}</button>
            </div>
            <div className="text-sm text-gray-400 dark:text-gray-500 mt-5">These IDE options are based on <a className="gp-link" href={gitpodHostUrl.asPreferences().toString()} target="_parent">your user preferences</a>.</div>
          </div>;
        }

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
          return <HeadlessWorkspaceView instanceId={this.state.workspaceInstance.id} />;
        }
        phase = StartPhase.Stopping;
        statusMessage = <div>
          <div className="flex space-x-3 items-center text-left rounded-xl m-auto px-4 h-16 w-72 mt-4 bg-gray-100 dark:bg-gray-800">
            <div className="rounded-full w-3 h-3 text-sm bg-gitpod-kumquat">&nbsp;</div>
            <div>
              <p className="text-gray-700 dark:text-gray-200 font-semibold w-56 truncate">{this.state.workspaceInstance.workspaceId}</p>
              <a target="_parent" href={contextURL}><p className="w-56 truncate hover:text-blue-600 dark:hover:text-blue-400" >{contextURL}</p></a>
            </div>
          </div>
          <div className="mt-10 flex justify-center">
            <a target="_parent" href={gitpodHostUrl.asDashboard().toString()}><button className="secondary">Go to Dashboard</button></a>
          </div>
        </div>;
        break;

      // Stopped means the workspace ended regularly because it was shut down.
      case "stopped":
        phase = StartPhase.Stopped;
        if (this.state.hasImageBuildLogs) {
          const restartWithDefaultImage = (event: React.MouseEvent) => {
            (event.target as HTMLButtonElement).disabled = true;
            this.startWorkspace(true, true);
          }
          return <ImageBuildView workspaceId={this.state.workspaceInstance.workspaceId} onStartWithDefaultImage={restartWithDefaultImage} phase={phase} error={error} />;
        }
        if (!isHeadless && this.state.workspaceInstance.status.conditions.timeout) {
          title = 'Timed Out';
        }
        statusMessage = <div>
          <div className="flex space-x-3 items-center text-left rounded-xl m-auto px-4 h-16 w-72 mt-4 mb-2 bg-gray-100 dark:bg-gray-800">
            <div className="rounded-full w-3 h-3 text-sm bg-gray-300">&nbsp;</div>
            <div>
              <p className="text-gray-700 dark:text-gray-200 font-semibold w-56 truncate">{this.state.workspaceInstance.workspaceId}</p>
              <a target="_parent" href={contextURL}><p className="w-56 truncate hover:text-blue-600 dark:hover:text-blue-400" >{contextURL}</p></a>
            </div>
          </div>
          <PendingChangesDropdown workspaceInstance={this.state.workspaceInstance} />
          <div className="mt-10 justify-center flex space-x-2">
            <a target="_parent" href={gitpodHostUrl.asDashboard().toString()}><button className="secondary">Go to Dashboard</button></a>
            <a target="_parent" href={gitpodHostUrl.asStart(this.state.workspaceInstance?.workspaceId).toString()}><button>Open Workspace</button></a>
          </div>
        </div>;
        break;
    }

    return <StartPage phase={phase} error={error} title={title}>
      {statusMessage}
    </StartPage>;
  }
}

interface ImageBuildViewProps {
  workspaceId: string;
  onStartWithDefaultImage?: (event: React.MouseEvent) => void;
  phase?: StartPhase;
  error?: StartWorkspaceError;
}

function ImageBuildView(props: ImageBuildViewProps) {
  const logsEmitter = new EventEmitter();

  useEffect(() => {
    let registered = false;
    const watchBuild = () => {
      if (registered) {
        return;
      }

      getGitpodService().server.watchWorkspaceImageBuildLogs(props.workspaceId)
        .then(() => registered = true)
        .catch(err => {

          if (err?.code === ErrorCodes.HEADLESS_LOG_NOT_YET_AVAILABLE) {
            // wait, and then retry
            setTimeout(watchBuild, 5000);
          }
        })
    }
    watchBuild();

    const toDispose = getGitpodService().registerClient({
      notifyDidOpenConnection: () => {
        registered = false; // new connection, we're not registered anymore
        watchBuild();
      },
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

  return <StartPage title="Building Image" phase={props.phase}>
    <Suspense fallback={<div />}>
      <WorkspaceLogs logsEmitter={logsEmitter} errorMessage={props.error?.message} />
    </Suspense>
    {!!props.onStartWithDefaultImage && <button className="mt-6 secondary" onClick={props.onStartWithDefaultImage}>Continue with Default Image</button>}
  </StartPage>;
}

function HeadlessWorkspaceView(props: { instanceId: string }) {
  const logsEmitter = new EventEmitter();

  useEffect(() => {
    const disposables = watchHeadlessLogs(props.instanceId, (chunk) => logsEmitter.emit('logs', chunk), async () => { return false; });
    return function cleanup() {
      disposables.dispose();
    };
  }, []);

  return <StartPage title="Prebuild in Progress">
    <Suspense fallback={<div />}>
      <WorkspaceLogs logsEmitter={logsEmitter} />
    </Suspense>
  </StartPage>;
}
