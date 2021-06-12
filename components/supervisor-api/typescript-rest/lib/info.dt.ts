declare namespace Definitions {
    export interface ProtobufAny {
        typeUrl?: string;
        value?: string; // byte
    }
    export interface RpcStatus {
        code?: number; // int32
        message?: string;
        details?: ProtobufAny[];
    }
    export interface SupervisorWorkspaceInfoResponse {
        /**
         * workspace_id is the workspace ID of this workspace.
         */
        workspaceId?: string;
        /**
         * instance_id is the instance ID of this workspace.
         */
        instanceId?: string;
        /**
         * checkout_location is the path where we initialized the workspace content
         */
        checkoutLocation?: string;
        /**
         * file means the workspace root is a file describing the workspace layout.
         */
        workspaceLocationFile?: string;
        /**
         * folder means the workspace root is a simple folder.
         */
        workspaceLocationFolder?: string;
        /**
         * user_home is the path to the user's home.
         */
        userHome?: string;
        /**
         * GitpodAPI provides information to reach the Gitpod server API.
         */
        gitpodApi?: WorkspaceInfoResponseGitpodAPI;
        /**
         * gitpod_host provides Gitpod host URL.
         */
        gitpodHost?: string;
        /**
         * workspace_context_url is an URL for which the workspace was created.
         */
        workspaceContextUrl?: string;
        /**
         * repository is a repository from which this workspace was created
         */
        repository?: WorkspaceInfoResponseRepository;
    }
    export interface WorkspaceInfoResponseGitpodAPI {
        /**
         * endpoint is the websocket URL on which the token-accessible Gitpod API is served on
         */
        endpoint?: string;
        /**
         * host is the host of the endpoint. Use this host to ask supervisor a token.
         */
        host?: string;
    }
    export interface WorkspaceInfoResponseRepository {
        /**
         * owner is the repository owner
         */
        owner?: string;
        /**
         * name is the repository name
         */
        name?: string;
    }
}
declare namespace Paths {
    namespace InfoServiceWorkspaceInfo {
        namespace Responses {
            export type $200 = Definitions.SupervisorWorkspaceInfoResponse;
            export type Default = Definitions.RpcStatus;
        }
    }
}
