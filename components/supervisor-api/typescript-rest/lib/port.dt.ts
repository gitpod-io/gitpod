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
  export interface SupervisorAutoTunnelResponse {}
  export interface SupervisorCloseTunnelResponse {}
  export interface SupervisorEstablishTunnelResponse {
    data?: string; // byte
  }
  export interface SupervisorTunnelPortRequest {
    port?: number; // int64
    targetPort?: number; // int64
    visibility?: SupervisorTunnelVisiblity;
    clientId?: string;
  }
  export interface SupervisorTunnelPortResponse {}
  export type SupervisorTunnelVisiblity = 'none' | 'host' | 'network';
}
declare namespace Paths {
  namespace PortServiceAutoTunnel {
    namespace Responses {
      export type $200 = Definitions.SupervisorAutoTunnelResponse;
      export type Default = Definitions.RpcStatus;
    }
  }
  namespace PortServiceCloseTunnel {
    namespace Responses {
      export type $200 = Definitions.SupervisorCloseTunnelResponse;
      export type Default = Definitions.RpcStatus;
    }
  }
  namespace PortServiceTunnel {
    export interface BodyParameters {
      body: Parameters.Body;
    }
    namespace Parameters {
      export interface Body {
        targetPort?: number; // int64
        visibility?: Definitions.SupervisorTunnelVisiblity;
        clientId?: string;
      }
    }
    namespace Responses {
      export type $200 = Definitions.SupervisorTunnelPortResponse;
      export type Default = Definitions.RpcStatus;
    }
  }
}
