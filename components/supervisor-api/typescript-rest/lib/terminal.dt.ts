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
    export interface SupervisorListTerminalsResponse {
        terminals?: SupervisorTerminal[];
    }
    export interface SupervisorListenTerminalResponse {
        data?: string; // byte
        exitCode?: number; // int32
        title?: string;
    }
    export interface SupervisorOpenTerminalResponse {
        terminal?: SupervisorTerminal;
        /**
         * starter_token can be used to change the terminal size if there are
         * multiple listerns, without having to force your way in.
         */
        starterToken?: string;
    }
    export interface SupervisorSetTerminalSizeResponse {}
    export interface SupervisorShutdownTerminalResponse {}
    export interface SupervisorTerminal {
        alias?: string;
        command?: string[];
        title?: string;
        pid?: string; // int64
        initialWorkdir?: string;
        currentWorkdir?: string;
        annotations?: {
            [name: string]: string;
        };
    }
    export interface SupervisorTerminalSize {
        rows?: number; // int64
        cols?: number; // int64
        widthPx?: number; // int64
        heightPx?: number; // int64
    }
    export interface SupervisorWriteTerminalResponse {
        bytesWritten?: number; // int64
    }
}
declare namespace Paths {
    namespace TerminalServiceGet {
        namespace Responses {
            export type $200 = Definitions.SupervisorTerminal;
            export type Default = Definitions.RpcStatus;
        }
    }
    namespace TerminalServiceList {
        namespace Responses {
            export type $200 = Definitions.SupervisorListTerminalsResponse;
            export type Default = Definitions.RpcStatus;
        }
    }
    namespace TerminalServiceListen {
        namespace Responses {
            /**
             * Stream result of supervisorListenTerminalResponse
             */
            export interface $200 {
                result?: Definitions.SupervisorListenTerminalResponse;
                error?: Definitions.RpcStatus;
            }
            export type Default = Definitions.RpcStatus;
        }
    }
    namespace TerminalServiceShutdown {
        namespace Responses {
            export type $200 = Definitions.SupervisorShutdownTerminalResponse;
            export type Default = Definitions.RpcStatus;
        }
    }
    namespace TerminalServiceWrite {
        namespace Responses {
            export type $200 = Definitions.SupervisorWriteTerminalResponse;
            export type Default = Definitions.RpcStatus;
        }
    }
}
