declare namespace Definitions {
  export type NotifyRequestLevel = 'ERROR' | 'WARNING' | 'INFO';
  export interface ProtobufAny {
    typeUrl?: string;
    value?: string; // byte
  }
  export interface RpcStatus {
    code?: number; // int32
    message?: string;
    details?: ProtobufAny[];
  }
  export interface SupervisorNotifyRequest {
    level?: NotifyRequestLevel;
    message?: string;
    /**
     * if actions are empty, Notify will return immediately
     */
    actions?: string[];
  }
  export interface SupervisorNotifyResponse {
    /**
     * action chosen by the user or empty string if cancelled
     */
    action?: string;
  }
  export interface SupervisorRespondResponse {}
  export interface SupervisorSubscribeResponse {
    requestId?: string; // uint64
    request?: SupervisorNotifyRequest;
  }
}
declare namespace Paths {
  namespace NotificationServiceNotify {
    namespace Responses {
      export type $200 = Definitions.SupervisorNotifyResponse;
      export type Default = Definitions.RpcStatus;
    }
  }
  namespace NotificationServiceRespond {
    namespace Responses {
      export type $200 = Definitions.SupervisorRespondResponse;
      export type Default = Definitions.RpcStatus;
    }
  }
  namespace NotificationServiceSubscribe {
    namespace Responses {
      /**
       * Stream result of supervisorSubscribeResponse
       */
      export interface $200 {
        result?: Definitions.SupervisorSubscribeResponse;
        error?: Definitions.RpcStatus;
      }
      export type Default = Definitions.RpcStatus;
    }
  }
}
