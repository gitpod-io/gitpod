/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import EventEmitter from "events";
import React, { Suspense, useEffect, useState } from "react";
import { Workspace, WorkspaceInstance, DisposableCollection, WorkspaceImageBuild, HEADLESS_LOG_STREAM_STATUS_CODE_REGEX } from "@gitpod/gitpod-protocol";
import { getGitpodService } from "../service/service";

const WorkspaceLogs = React.lazy(() => import('./WorkspaceLogs'));

export interface PrebuildLogsProps {
  workspaceId?: string;
  onInstanceUpdate?: (instance: WorkspaceInstance) => void;
}

export default function PrebuildLogs(props: PrebuildLogsProps) {
  const [ workspace, setWorkspace ] = useState<Workspace | undefined>();
  const [ workspaceInstance, setWorkspaceInstance ] = useState<WorkspaceInstance | undefined>();
  const [ error, setError ] = useState<Error | undefined>();
  const [ logsEmitter ] = useState(new EventEmitter());

  useEffect(() => {
    const disposables = new DisposableCollection();
    (async () => {
      if (!props.workspaceId) {
        return;
      }
      try {
        const info = await getGitpodService().server.getWorkspace(props.workspaceId);
        if (info.latestInstance) {
          setWorkspace(info.workspace);
          setWorkspaceInstance(info.latestInstance);
        }
        disposables.push(getGitpodService().registerClient({
          onInstanceUpdate: setWorkspaceInstance,
          onWorkspaceImageBuildLogs: (info: WorkspaceImageBuild.StateInfo, content?: WorkspaceImageBuild.LogContent) => {
            if (!content) {
              return;
            }
            logsEmitter.emit('logs', content.text);
          },
        }));
        if (info.latestInstance) {
          disposables.push(watchHeadlessLogs(info.latestInstance.id, chunk => {
            logsEmitter.emit('logs', chunk);
          }, async () => workspaceInstance?.status.phase === 'stopped'));
        }
      } catch (err) {
        console.error(err);
        setError(err);
      }
    })();
    return function cleanUp() {
      disposables.dispose();
    }
  }, [ props.workspaceId ]);

  useEffect(() => {
    if (props.onInstanceUpdate && workspaceInstance) {
      props.onInstanceUpdate(workspaceInstance);
    }
    switch (workspaceInstance?.status.phase) {
      // unknown indicates an issue within the system in that it cannot determine the actual phase of
      // a workspace. This phase is usually accompanied by an error.
      case "unknown":
        break;

      // Preparing means that we haven't actually started the workspace instance just yet, but rather
      // are still preparing for launch. This means we're building the Docker image for the workspace.
      case "preparing":
        getGitpodService().server.watchWorkspaceImageBuildLogs(workspace!.id);
        break;

      // Pending means the workspace does not yet consume resources in the cluster, but rather is looking for
      // some space within the cluster. If for example the cluster needs to scale up to accomodate the
      // workspace, the workspace will be in Pending state until that happened.
      case "pending":
        break;

      // Creating means the workspace is currently being created. That includes downloading the images required
      // to run the workspace over the network. The time spent in this phase varies widely and depends on the current
      // network speed, image size and cache states.
      case "creating":
        break;

      // Initializing is the phase in which the workspace is executing the appropriate workspace initializer (e.g. Git
      // clone or backup download). After this phase one can expect the workspace to either be Running or Failed.
      case "initializing":
        break;

      // Running means the workspace is able to actively perform work, either by serving a user through Theia,
      // or as a headless workspace.
      case "running":
        break;

      // Interrupted is an exceptional state where the container should be running but is temporarily unavailable.
      // When in this state, we expect it to become running or stopping anytime soon.
      case "interrupted":
        break;

      // Stopping means that the workspace is currently shutting down. It could go to stopped every moment.
      case "stopping":
        break;

      // Stopped means the workspace ended regularly because it was shut down.
      case "stopped":
        getGitpodService().server.watchWorkspaceImageBuildLogs(workspace!.id);
        break;
    }
    if (workspaceInstance?.status.conditions.failed) {
      setError(new Error(workspaceInstance.status.conditions.failed));
    }
  }, [ workspaceInstance?.status.phase ]);

  return <Suspense fallback={<div />}>
    <WorkspaceLogs classes="h-full w-full" logsEmitter={logsEmitter} errorMessage={error?.message} />
  </Suspense>;
}

export function watchHeadlessLogs(instanceId: string, onLog: (chunk: string) => void, checkIsDone: () => Promise<boolean>): DisposableCollection {
  const disposables = new DisposableCollection();

  const startWatchingLogs = async () => {
    if (await checkIsDone()) {
      return;
    }

    const retry = async (reason: string, err?: Error) => {
      console.debug("re-trying headless-logs because: " + reason, err);
      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });
      startWatchingLogs().catch(console.error);
    };

    let response: Response | undefined = undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined = undefined;
    try {
      const logSources = await getGitpodService().server.getHeadlessLog(instanceId);
      // TODO(gpl) Only listening on first stream for now
      const streamIds = Object.keys(logSources.streams);
      if (streamIds.length < 1) {
        await retry("no streams");
        return;
      }

      const streamUrl = logSources.streams[streamIds[0]];
      console.log("fetching from streamUrl: " + streamUrl);
      response = await fetch(streamUrl, {
        method: 'GET',
        cache: 'no-cache',
        credentials: 'include',
        keepalive: true,
        headers: {
          'TE': 'trailers', // necessary to receive stream status code
        },
      });
      reader = response.body?.getReader();
      if (!reader) {
        await retry("no reader");
        return;
      }
      disposables.push({ dispose: () => reader?.cancel() });

      const decoder = new TextDecoder('utf-8');
      let chunk = await reader.read();
      while (!chunk.done) {
        const msg = decoder.decode(chunk.value, { stream: true });

        // In an ideal world, we'd use res.addTrailers()/response.trailer here. But despite being introduced with HTTP/1.1 in 1999, trailers are not supported by popular proxies (nginx, for example).
        // So we resort to this hand-written solution:
        const matches = msg.match(HEADLESS_LOG_STREAM_STATUS_CODE_REGEX);
        if (matches) {
          if (matches.length < 2) {
            console.debug("error parsing log stream status code. msg: " + msg);
          } else {
            const streamStatusCode = matches[1];
            if (streamStatusCode !== "200") {
              throw new Error("received status code: " + streamStatusCode);
            }
          }
        } else {
          onLog(msg);
        }

        chunk = await reader.read();
      }
      reader.cancel()

      if (await checkIsDone()) {
        return;
      }
    } catch(err) {
      reader?.cancel().catch(console.debug);
      await retry("error while listening to stream", err);
    }
  };
  startWatchingLogs().catch(console.error);

  return disposables;
}