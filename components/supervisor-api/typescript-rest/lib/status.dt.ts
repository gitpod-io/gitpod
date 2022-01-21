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
  export interface SupervisorBackupStatusResponse {
    canaryAvailable?: boolean;
  }
  export type SupervisorContentSource = 'from_other' | 'from_backup' | 'from_prebuild';
  export interface SupervisorContentStatusResponse {
    /**
     * true if the workspace content is available
     */
    available?: boolean;
    /**
     * source indicates where the workspace content came from
     */
    source?: SupervisorContentSource;
  }
  export interface SupervisorExposedPortInfo {
    /**
     * public determines if the port is available without authentication or not
     */
    visibility?: SupervisorPortVisibility;
    /**
     * url is the URL at which the port is available
     */
    url?: string;
    /**
     * action hint on expose
     */
    onExposed?: SupervisorOnPortExposedAction;
  }
  export interface SupervisorIDEStatusResponse {
    ok?: boolean;
  }
  export type SupervisorOnPortExposedAction = 'ignore' | 'open_browser' | 'open_preview' | 'notify' | 'notify_private';
  export type SupervisorPortVisibility = 'private' | 'public';
  export interface SupervisorPortsStatus {
    /**
     * local_port is the port a service actually bound to. Some services bind
     * to localhost:<port>, in which case they cannot be made accessible from
     * outside the container. To help with this, supervisor then starts a proxy
     * that forwards traffic to this local port. In those cases, global_port
     * contains the port where the proxy is listening on.
     */
    localPort?: number; // int64
    globalPort?: number; // int64
    /**
     * served is true if there is a process in the workspace that serves this port.
     */
    served?: boolean;
    /**
     * Exposed provides information when a port is exposed. If this field isn't set,
     * the port is not available from outside the workspace (i.e. the internet).
     */
    exposed?: SupervisorExposedPortInfo;
    /**
     * Tunneled provides information when a port is tunneled. If not present then
     * the port is not tunneled.
     */
    tunneled?: SupervisorTunneledPortInfo;
  }
  export interface SupervisorPortsStatusResponse {
    ports?: SupervisorPortsStatus[];
  }
  export interface SupervisorSupervisorStatusResponse {
    ok?: boolean;
  }
  export interface SupervisorTaskPresentation {
    name?: string;
    openIn?: string;
    openMode?: string;
  }
  export type SupervisorTaskState = 'opening' | 'running' | 'closed';
  export interface SupervisorTaskStatus {
    id?: string;
    state?: SupervisorTaskState;
    terminal?: string;
    presentation?: SupervisorTaskPresentation;
  }
  export interface SupervisorTasksStatusResponse {
    tasks?: SupervisorTaskStatus[];
  }
  export type SupervisorTunnelVisiblity = 'none' | 'host' | 'network';
  export interface SupervisorTunneledPortInfo {
    /**
     * target port is the desired port on the remote machine
     */
    targetPort?: number; // int64
    /**
     * visibility determines if the listener on remote machine should accept connections from localhost or network
     * visibility none means that the port should not be tunneled
     */
    visibility?: SupervisorTunnelVisiblity;
    /**
     * map of remote clients indicates on which remote port each client is listening to
     */
    clients?: {
      [name: string]: number; // int64
    };
  }
}
declare namespace Paths {
  namespace StatusServiceBackupStatus {
    namespace Responses {
      export type $200 = Definitions.SupervisorBackupStatusResponse;
      export type Default = Definitions.RpcStatus;
    }
  }
  namespace StatusServiceContentStatus {
    namespace Responses {
      export type $200 = Definitions.SupervisorContentStatusResponse;
      export type Default = Definitions.RpcStatus;
    }
  }
  namespace StatusServiceContentStatus2 {
    namespace Responses {
      export type $200 = Definitions.SupervisorContentStatusResponse;
      export type Default = Definitions.RpcStatus;
    }
  }
  namespace StatusServiceIDEStatus {
    namespace Responses {
      export type $200 = Definitions.SupervisorIDEStatusResponse;
      export type Default = Definitions.RpcStatus;
    }
  }
  namespace StatusServiceIDEStatus2 {
    namespace Responses {
      export type $200 = Definitions.SupervisorIDEStatusResponse;
      export type Default = Definitions.RpcStatus;
    }
  }
  namespace StatusServicePortsStatus {
    namespace Responses {
      /**
       * Stream result of supervisorPortsStatusResponse
       */
      export interface $200 {
        result?: Definitions.SupervisorPortsStatusResponse;
        error?: Definitions.RpcStatus;
      }
      export type Default = Definitions.RpcStatus;
    }
  }
  namespace StatusServicePortsStatus2 {
    namespace Responses {
      /**
       * Stream result of supervisorPortsStatusResponse
       */
      export interface $200 {
        result?: Definitions.SupervisorPortsStatusResponse;
        error?: Definitions.RpcStatus;
      }
      export type Default = Definitions.RpcStatus;
    }
  }
  namespace StatusServiceSupervisorStatus {
    namespace Responses {
      export type $200 = Definitions.SupervisorSupervisorStatusResponse;
      export type Default = Definitions.RpcStatus;
    }
  }
  namespace StatusServiceTasksStatus {
    namespace Responses {
      /**
       * Stream result of supervisorTasksStatusResponse
       */
      export interface $200 {
        result?: Definitions.SupervisorTasksStatusResponse;
        error?: Definitions.RpcStatus;
      }
      export type Default = Definitions.RpcStatus;
    }
  }
  namespace StatusServiceTasksStatus2 {
    namespace Responses {
      /**
       * Stream result of supervisorTasksStatusResponse
       */
      export interface $200 {
        result?: Definitions.SupervisorTasksStatusResponse;
        error?: Definitions.RpcStatus;
      }
      export type Default = Definitions.RpcStatus;
    }
  }
}
