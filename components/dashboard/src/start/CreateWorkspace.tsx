/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import EventEmitter from "events";
import React, { useEffect, Suspense, useContext, useState } from "react";
import { CreateWorkspaceMode, WorkspaceCreationResult, RunningWorkspacePrebuildStarting } from "@gitpod/gitpod-protocol";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import Modal from "../components/Modal";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { UserContext } from "../user-context";
import { StartPage, StartPhase, StartWorkspaceError } from "./StartPage";
import StartWorkspace from "./StartWorkspace";
import { openAuthorizeWindow } from "../provider-utils";
import { SelectAccountPayload } from "@gitpod/gitpod-protocol/lib/auth";
import { SelectAccountModal } from "../settings/SelectAccountModal";
import { watchHeadlessLogs } from "../components/PrebuildLogs";
import CodeText from "../components/CodeText";

const WorkspaceLogs = React.lazy(() => import('../components/WorkspaceLogs'));

export interface CreateWorkspaceProps {
  contextUrl: string;
}

export interface CreateWorkspaceState {
  result?: WorkspaceCreationResult;
  error?: StartWorkspaceError;
  selectAccountError?: SelectAccountPayload;
  stillParsing: boolean;
}

export default class CreateWorkspace extends React.Component<CreateWorkspaceProps, CreateWorkspaceState> {

  constructor(props: CreateWorkspaceProps) {
    super(props);
    this.state = { stillParsing: true };
  }

  componentDidMount() {
    this.createWorkspace();
  }

  async createWorkspace(mode = CreateWorkspaceMode.SelectIfRunning, forceDefaultConfig = false) {
    // Invalidate any previous result.
    this.setState({ result: undefined, stillParsing: true });

    // We assume anything longer than 3 seconds is no longer just parsing the context URL (i.e. it's now creating a workspace).
    let timeout = setTimeout(() => this.setState({ stillParsing: false }), 3000);

    try {
      const result = await getGitpodService().server.createWorkspace({
        contextUrl: this.props.contextUrl,
        mode,
        forceDefaultConfig
      });
      if (result.workspaceURL) {
        window.location.href = result.workspaceURL;
        return;
      }
      clearTimeout(timeout);
      this.setState({ result, stillParsing: false });
    } catch (error) {
      clearTimeout(timeout);
      console.error(error);
      this.setState({ error, stillParsing: false });
    }
  }

  async tryAuthorize(host: string, scopes?: string[]) {
    try {
      await openAuthorizeWindow({
        host,
        scopes,
        onSuccess: () => {
          window.location.reload();
        },
        onError: (error) => {
          if (typeof error === "string") {
            try {
              const payload = JSON.parse(error);
              if (SelectAccountPayload.is(payload)) {
                this.setState({ selectAccountError: payload });
              }
            } catch (error) {
              console.log(error);
            }
          }
        }
      });
    } catch (error) {
      console.log(error)
    }
  };

  render() {
    if (SelectAccountPayload.is(this.state.selectAccountError)) {
      return (<StartPage phase={StartPhase.Checking}>
        <div className="mt-2 flex flex-col space-y-8">
          <SelectAccountModal {...this.state.selectAccountError} close={() => {
            window.location.href = gitpodHostUrl.asAccessControl().toString();
          }} />
        </div>
      </StartPage>);
    }

    let phase = StartPhase.Checking;
    let statusMessage = <p className="text-base text-gray-400">{this.state.stillParsing ? 'Parsing context …' : 'Preparing workspace …'}</p>;

    let error = this.state?.error;
    if (error) {
      switch (error.code) {
        case ErrorCodes.CONTEXT_PARSE_ERROR:
          statusMessage = <div className="text-center">
            <p className="text-base mt-2">Are you trying to open a Git repository from a self-hosted instance? <a className="text-blue" href={gitpodHostUrl.asAccessControl().toString()}>Add integration</a></p>
          </div>;
          break;
        case ErrorCodes.INVALID_GITPOD_YML:
          statusMessage = <div className="mt-2 flex flex-col space-y-8">
            <button className="" onClick={() => { this.createWorkspace(CreateWorkspaceMode.Default, true) }}>Continue with default configuration</button>
          </div>;
          break;
        case ErrorCodes.NOT_AUTHENTICATED:
          statusMessage = <div className="mt-2 flex flex-col space-y-8">
            <button className="" onClick={() => {
              this.tryAuthorize(error?.data.host, error?.data.scopes)
            }}>Authorize with {error.data.host}</button>
          </div>;
          break;
        case ErrorCodes.USER_BLOCKED:
          window.location.href = '/blocked';
          return;
        case ErrorCodes.NOT_FOUND:
          return <RepositoryNotFoundView error={error} />;
        case ErrorCodes.TOO_MANY_RUNNING_WORKSPACES:
          // HACK: Hide the error (behind the modal)
          error = undefined;
          phase = StartPhase.Stopped;
          statusMessage = <LimitReachedParallelWorkspacesModal />;
          break;
        case ErrorCodes.NOT_ENOUGH_CREDIT:
          // HACK: Hide the error (behind the modal)
          error = undefined;
          phase = StartPhase.Stopped;
          statusMessage = <LimitReachedOutOfHours />;
          break;
        default:
          statusMessage = <p className="text-base text-gitpod-red w-96">Unknown Error: {JSON.stringify(this.state?.error, null, 2)}</p>;
          break;
      }
    }

    const result = this.state?.result;
    if (result?.createdWorkspaceId) {
      return <StartWorkspace workspaceId={result.createdWorkspaceId} />;
    }

    else if (result?.existingWorkspaces) {
      statusMessage = <Modal visible={true} closeable={false} onClose={() => { }}>
        <h3>Running Workspaces</h3>
        <div className="border-t border-b border-gray-200 dark:border-gray-800 mt-4 -mx-6 px-6 py-2">
          <p className="mt-1 mb-2 text-base">You already have running workspaces with the same context. You can open an existing one or open a new workspace.</p>
          <>
            {result?.existingWorkspaces?.map(w =>
              <a href={w.latestInstance?.ideUrl || gitpodHostUrl.with({ pathname: '/start/', hash: '#' + w.latestInstance?.workspaceId }).toString()} className="rounded-xl group hover:bg-gray-100 dark:hover:bg-gray-800 flex p-3 my-1">
                <div className="w-full">
                  <p className="text-base text-black dark:text-gray-100 font-bold">{w.workspace.id}</p>
                  <p className="truncate" title={w.workspace.contextURL}>{w.workspace.contextURL}</p>
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

    return <StartPage phase={phase} error={error}>
      {statusMessage}
      {error && <div>
        <a href={gitpodHostUrl.asDashboard().toString()}><button className="mt-8 secondary">Go to Dashboard</button></a>
        <p className="mt-14 text-base text-gray-400 flex space-x-2">
          <a className="hover:text-blue-600 dark:hover:text-blue-400" href="https://www.gitpod.io/docs/">Docs</a>
          <span>—</span>
          <a className="hover:text-blue-600 dark:hover:text-blue-400" href="https://status.gitpod.io/">Status</a>
          <span>—</span>
          <a className="hover:text-blue-600 dark:hover:text-blue-400" href="https://www.gitpod.io/blog/">Blog</a>
        </p>
      </div>}
    </StartPage>;
  }
}

function LimitReachedModal(p: { children: React.ReactNode }) {
  const { user } = useContext(UserContext);
  return <Modal visible={true} closeable={false} onClose={() => { }}>
    <h3 className="flex">
      <span className="flex-grow">Limit Reached</span>
      <img className="rounded-full w-8 h-8" src={user?.avatarUrl || ''} alt={user?.name || 'Anonymous'} />
    </h3>
    <div className="border-t border-b border-gray-200 dark:border-gray-800 mt-4 -mx-6 px-6 py-2">
      {p.children}
    </div>
    <div className="flex justify-end mt-6">
      <a href={gitpodHostUrl.asDashboard().toString()}><button className="secondary">Go to Dashboard</button></a>
      <a href={gitpodHostUrl.with({ pathname: 'plans' }).toString()} className="ml-2"><button>Upgrade</button></a>
    </div>
  </Modal>;
}

function LimitReachedParallelWorkspacesModal() {
  return <LimitReachedModal>
    <p className="mt-1 mb-2 text-base dark:text-gray-400">You have reached the limit of parallel running workspaces for your account. Please, upgrade or stop one of the running workspaces.</p>
  </LimitReachedModal>;
}

function LimitReachedOutOfHours() {
  return <LimitReachedModal>
    <p className="mt-1 mb-2 text-base dark:text-gray-400">You have reached the limit of monthly workspace hours for your account. Please upgrade to get more hours for your workspaces.</p>
  </LimitReachedModal>;
}

function RepositoryNotFoundView(p: { error: StartWorkspaceError }) {
  const [statusMessage, setStatusMessage] = useState<React.ReactNode>();
  const { host, owner, repoName, userIsOwner, userScopes, lastUpdate } = p.error.data;
  const repoFullName = (owner && repoName) ? `${owner}/${repoName}` : '';

  useEffect(() => {
    (async () => {
      console.log('host', host);
      console.log('owner', owner);
      console.log('repoName', repoName);
      console.log('userIsOwner', userIsOwner);
      console.log('userScopes', userScopes);
      console.log('lastUpdate', lastUpdate);

      const authProvider = (await getGitpodService().server.getAuthProviders()).find(p => p.host === host);
      if (!authProvider) {
        return;
      }

      // TODO: this should be aware of already granted permissions
      const missingScope = authProvider.host === 'github.com' ? 'repo' : 'read_repository';
      const authorizeURL = gitpodHostUrl.withApi({
        pathname: '/authorize',
        search: `returnTo=${encodeURIComponent(window.location.toString())}&host=${host}&scopes=${missingScope}`
      }).toString();

      if (!userScopes.includes(missingScope)) {
        setStatusMessage(<div className="mt-2 flex flex-col space-y-8">
          <p className="text-base text-gray-400 w-96">The repository may be private. Please authorize Gitpod to access to private repositories.</p>
          <a className="mx-auto" href={authorizeURL}><button className="secondary">Grant Access</button></a>
        </div>);
        return;
      }

      if (userIsOwner) {
        setStatusMessage(<div className="mt-2 flex flex-col space-y-8">
          <p className="text-base text-gray-400 w-96">The repository was not found in your account.</p>
        </div>);
        return;
      }

      let updatedRecently = false;
      if (lastUpdate && typeof lastUpdate === 'string') {
        try {
          const minutes = (Date.now() - Date.parse(lastUpdate)) / 1000 / 60;
          updatedRecently = minutes < 5;
        } catch {
          // ignore
        }
      }

      if (!updatedRecently) {
        setStatusMessage(<div className="mt-2 flex flex-col space-y-8">
          <p className="text-base text-gray-400 w-96">Permission to access private repositories has been granted. If you are a member of <CodeText>{owner}</CodeText>, please try to request access for Gitpod.</p>
          <a className="mx-auto" href={authorizeURL}><button className="secondary">Request Access for Gitpod</button></a>
        </div>);
        return;
      }

      setStatusMessage(<div className="mt-2 flex flex-col space-y-8">
        <p className="text-base text-gray-400 w-96">Your access token was updated recently. Please try again if the repository exists and Gitpod was approved for <CodeText>{owner}</CodeText>.</p>
        <a className="mx-auto" href={authorizeURL}><button className="secondary">Try Again</button></a>
      </div>);
    })();
  }, []);

  return (
    <StartPage phase={StartPhase.Checking} error={p.error}>
      <p className="text-base text-gray-400 mt-2">
        <CodeText>{repoFullName}</CodeText>
      </p>
      {statusMessage}
    </StartPage>
  );
}

interface RunningPrebuildViewProps {
  runningPrebuild: {
    prebuildID: string
    workspaceID: string
    instanceID: string
    starting: RunningWorkspacePrebuildStarting
    sameCluster: boolean
  };
  onIgnorePrebuild: () => void;
  onPrebuildSucceeded: () => void;
}

function RunningPrebuildView(props: RunningPrebuildViewProps) {
  const logsEmitter = new EventEmitter();
  let pollTimeout: NodeJS.Timeout | undefined;
  let prebuildDoneTriggered: boolean = false;

  useEffect(() => {
    const checkIsPrebuildDone = async (): Promise<boolean> => {
      if (prebuildDoneTriggered) {
        console.debug("prebuild done already triggered, doing nothing");
        return true;
      }

      const done = await getGitpodService().server.isPrebuildDone(props.runningPrebuild.prebuildID);
      if (done) {
        // note: this treats "done" as "available" which is not equivalent.
        // This works because the backend ignores prebuilds which are not "available", and happily starts a workspace as if there was no prebuild at all.
        prebuildDoneTriggered = true;
        props.onPrebuildSucceeded();
        return true;
      }
      return false;
    };
    const pollIsPrebuildDone = async () => {
      clearTimeout(pollTimeout!);
      await checkIsPrebuildDone();
      pollTimeout = setTimeout(pollIsPrebuildDone, 10000);
    };

    const disposables = watchHeadlessLogs(props.runningPrebuild.instanceID, (chunk) => logsEmitter.emit('logs', chunk), checkIsPrebuildDone);
    return function cleanup() {
      clearTimeout(pollTimeout!);
      disposables.dispose();
    };
  }, []);

  return <StartPage title="Prebuild in Progress">
    <Suspense fallback={<div />}>
      <WorkspaceLogs logsEmitter={logsEmitter} />
    </Suspense>
    <button className="mt-6 secondary" onClick={() => { clearTimeout(pollTimeout!); props.onIgnorePrebuild(); }}>Don't Wait for Prebuild</button>
  </StartPage>;
}