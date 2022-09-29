import {createChannel, createClient} from 'nice-grpc-web';
import {
    GetWorkspaceRequest,
    WorkspacesServiceClient,
    WorkspacesServiceDefinition
} from './gitpod/v1/workspaces.pb';

const channel = createChannel('http://localhost:9002');

const client: WorkspacesServiceClient = createClient(
    WorkspacesServiceDefinition,
    channel,
);

const req: GetWorkspaceRequest = {
    workspaceId: "123"
}

async function yay() {
    const resp = await client.getWorkspace(req)
    console.log(resp)
}

yay()
