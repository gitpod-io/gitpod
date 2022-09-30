import {
    createConnectTransport,
    createPromiseClient,
} from "@bufbuild/connect-web";
import {WorkspacesService} from "./gitpod/v1/workspaces_connectweb";


const transport = createConnectTransport({
    baseUrl: "http://localhost:9002/",
    // credentials: "include",
});

// Here we make the client itself, combining the service
// definition with the transport.
const client = createPromiseClient(WorkspacesService, transport);

async function getWS() {
    const resp = await client.getWorkspace({})
    console.log(resp);
}

async function getWSJSON() {
    const res = await fetch("http://localhost:9002/gitpod.v1.WorkspacesService/GetWorkspace", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: `{"workspaceId": "foo-bar"}`,
        mode: "cors",
    });
    const answer = await res.text();
    console.log(answer);
}

getWS()

// getWSJSON()
