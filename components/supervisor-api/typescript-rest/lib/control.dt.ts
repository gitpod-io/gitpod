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
  export interface SupervisorExposePortResponse {}
}
