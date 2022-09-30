import {
    createConnectTransport,
    createPromiseClient,
} from "@bufbuild/connect-web";
import {WorkspacesService} from "./gitpod/v1/workspaces_connectweb";
import { GetWorkspaceRequest } from "./gitpod/v1/workspaces_pb";


const transport = createConnectTransport({
    baseUrl: "https://9002-gitpodio-gitpod-rxp4lp9t33p.ws-eu67.gitpod.io",
    useBinaryFormat: true,
    // credentials: "include",
});

// Here we make the client itself, combining the service
// definition with the transport.
const client = createPromiseClient(WorkspacesService, transport);

async function getWS() {
    const resp = await client.getWorkspace(new GetWorkspaceRequest({
        workspaceId: "123"
    }), {
        timeoutMs: 1000
    })
    console.log(resp);
}

async function getWSJSON() {
    const res = await fetch("https://9002-gitpodio-gitpod-rxp4lp9t33p.ws-eu67.gitpod.io/gitpod.v1.WorkspacesService/GetWorkspace", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: `{"workspaceId": "foo-bar"}`,
        mode: "cors",
    });
    const answer = await res.text();
    console.log(answer);
}

getWS()

getWSJSON()
