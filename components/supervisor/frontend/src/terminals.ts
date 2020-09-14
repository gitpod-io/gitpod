/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

require("../public/index.css");

import "reflect-metadata";
import { createGitpodService } from "@gitpod/gitpod-protocol";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";

import * as grpc from "@grpc/grpc-js";

import {
  ListTerminalsRequest,
  ListTerminalsResponse
} from "@gitpod/supervisor/lib/terminal_pb";
import { TerminalServiceClient } from "@gitpod/supervisor/lib/terminal_grpc_pb";

const workspaceUrl = new GitpodHostUrl(window.location.href);
const { workspaceId } = workspaceUrl;
if (workspaceId) {
  const gitpodService = createGitpodService(
    workspaceUrl.withoutWorkspacePrefix().toString()
  );
  gitpodService.server.getWorkspace(workspaceId).then(info => {
    document.title = info.workspace.description;
  });
} else {
  document.title += ": Unknown workspace";
}

const checkReady: (kind: "content" | "ide") => Promise<void> = kind =>
  fetch(
    window.location.protocol +
      "//" +
      window.location.host +
      "/_supervisor/v1/status/" +
      kind +
      "/wait/true"
  ).then(
    response => {
      if (response.ok) {
        return;
      }
      console.debug(
        `failed to check whether ${kind} is ready, trying again...`,
        response.status,
        response.statusText
      );
      return checkReady(kind);
    },
    e => {
      console.debug(
        `failed to check whether ${kind} is ready, trying again...`,
        e
      );
      return checkReady(kind);
    }
  );

let terminalClient = new TerminalServiceClient(
  process.env.SUPERVISOR_ADDR || "localhost:22999",
  grpc.credentials.createInsecure()
);
let req = new ListTerminalsRequest();
let body = document.createElement("p");

terminalClient.list(req, (err: grpc.ServiceError | null, response: ListTerminalsResponse) => {
  body.innerHTML = JSON.stringify(response.getTerminalsList());
});

const onDOMContentLoaded = new Promise(resolve =>
  window.addEventListener("DOMContentLoaded", resolve)
);

Promise.all([
  onDOMContentLoaded,
  checkReady("ide"),
  checkReady("content")
]).then(() => {
  document.body.append(body);
});
