declare namespace Definitions {
  export interface ProtobufAny {
    typeUrl?: string;
    value?: string; // byte
  }
  export interface ProvideTokenRequestRegisterProvider {
    kind?: string;
  }
  export interface RpcStatus {
    code?: number; // int32
    message?: string;
    details?: ProtobufAny[];
  }
  export interface SupervisorClearTokenResponse {}
  export interface SupervisorGetTokenRequest {
    host?: string;
    scope?: string[];
    description?: string;
    kind?: string;
  }
  export interface SupervisorGetTokenResponse {
    token?: string;
    /**
     * * The username of the account associated with the token.
     */
    user?: string;
    scope?: string[];
  }
  export interface SupervisorProvideTokenResponse {
    request?: SupervisorGetTokenRequest;
  }
  export interface SupervisorSetTokenRequest {
    host?: string;
    scope?: string[];
    token?: string;
    expiryDate?: string; // date-time
    reuse?: /**
     *  - REUSE_NEVER: REUSE_NEVER means the token can never be re-used.
     * This mode only makes sense when providing a token in response to a request.
     *  - REUSE_EXACTLY: REUSE_EXACTLY means the token can only be reused when the requested scopes
     * exactly match those of the token.
     *  - REUSE_WHEN_POSSIBLE: REUSE_WHEN_POSSIBLE means the token can be reused when the requested scopes
     * are a subset of the token's scopes.
     */
    SupervisorTokenReuse;
    kind?: string;
  }
  export interface SupervisorSetTokenResponse {}
  /**
   *  - REUSE_NEVER: REUSE_NEVER means the token can never be re-used.
   * This mode only makes sense when providing a token in response to a request.
   *  - REUSE_EXACTLY: REUSE_EXACTLY means the token can only be reused when the requested scopes
   * exactly match those of the token.
   *  - REUSE_WHEN_POSSIBLE: REUSE_WHEN_POSSIBLE means the token can be reused when the requested scopes
   * are a subset of the token's scopes.
   */
  export type SupervisorTokenReuse = 'REUSE_NEVER' | 'REUSE_EXACTLY' | 'REUSE_WHEN_POSSIBLE';
}
declare namespace Paths {
  namespace TokenServiceClearToken {
    namespace Responses {
      export type $200 = Definitions.SupervisorClearTokenResponse;
      export type Default = Definitions.RpcStatus;
    }
  }
  namespace TokenServiceClearToken2 {
    namespace Responses {
      export type $200 = Definitions.SupervisorClearTokenResponse;
      export type Default = Definitions.RpcStatus;
    }
  }
  namespace TokenServiceGetToken {
    namespace Responses {
      export type $200 = Definitions.SupervisorGetTokenResponse;
      export type Default = Definitions.RpcStatus;
    }
  }
  namespace TokenServiceSetToken {
    export interface BodyParameters {
      body: Parameters.Body;
    }
    namespace Parameters {
      export interface Body {
        scope?: string[];
        token?: string;
        expiryDate?: string; // date-time
        reuse?: /**
         *  - REUSE_NEVER: REUSE_NEVER means the token can never be re-used.
         * This mode only makes sense when providing a token in response to a request.
         *  - REUSE_EXACTLY: REUSE_EXACTLY means the token can only be reused when the requested scopes
         * exactly match those of the token.
         *  - REUSE_WHEN_POSSIBLE: REUSE_WHEN_POSSIBLE means the token can be reused when the requested scopes
         * are a subset of the token's scopes.
         */
        Definitions.SupervisorTokenReuse;
      }
    }
    namespace Responses {
      export type $200 = Definitions.SupervisorSetTokenResponse;
      export type Default = Definitions.RpcStatus;
    }
  }
}
