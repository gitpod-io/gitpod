// package: supervisor
// file: token.proto

/* tslint:disable */

import * as grpc from "grpc";
import * as token_pb from "./token_pb";
import * as google_protobuf_timestamp_pb from "google-protobuf/google/protobuf/timestamp_pb";

interface ITokenServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    getToken: ITokenServiceService_IGetToken;
    setToken: ITokenServiceService_ISetToken;
    clearToken: ITokenServiceService_IClearToken;
    provideToken: ITokenServiceService_IProvideToken;
}

interface ITokenServiceService_IGetToken extends grpc.MethodDefinition<token_pb.GetTokenRequest, token_pb.GetTokenResponse> {
    path: string; // "/supervisor.TokenService/GetToken"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<token_pb.GetTokenRequest>;
    requestDeserialize: grpc.deserialize<token_pb.GetTokenRequest>;
    responseSerialize: grpc.serialize<token_pb.GetTokenResponse>;
    responseDeserialize: grpc.deserialize<token_pb.GetTokenResponse>;
}
interface ITokenServiceService_ISetToken extends grpc.MethodDefinition<token_pb.SetTokenRequest, token_pb.SetTokenResponse> {
    path: string; // "/supervisor.TokenService/SetToken"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<token_pb.SetTokenRequest>;
    requestDeserialize: grpc.deserialize<token_pb.SetTokenRequest>;
    responseSerialize: grpc.serialize<token_pb.SetTokenResponse>;
    responseDeserialize: grpc.deserialize<token_pb.SetTokenResponse>;
}
interface ITokenServiceService_IClearToken extends grpc.MethodDefinition<token_pb.ClearTokenRequest, token_pb.ClearTokenResponse> {
    path: string; // "/supervisor.TokenService/ClearToken"
    requestStream: boolean; // false
    responseStream: boolean; // false
    requestSerialize: grpc.serialize<token_pb.ClearTokenRequest>;
    requestDeserialize: grpc.deserialize<token_pb.ClearTokenRequest>;
    responseSerialize: grpc.serialize<token_pb.ClearTokenResponse>;
    responseDeserialize: grpc.deserialize<token_pb.ClearTokenResponse>;
}
interface ITokenServiceService_IProvideToken extends grpc.MethodDefinition<token_pb.ProvideTokenRequest, token_pb.ProvideTokenResponse> {
    path: string; // "/supervisor.TokenService/ProvideToken"
    requestStream: boolean; // true
    responseStream: boolean; // true
    requestSerialize: grpc.serialize<token_pb.ProvideTokenRequest>;
    requestDeserialize: grpc.deserialize<token_pb.ProvideTokenRequest>;
    responseSerialize: grpc.serialize<token_pb.ProvideTokenResponse>;
    responseDeserialize: grpc.deserialize<token_pb.ProvideTokenResponse>;
}

export const TokenServiceService: ITokenServiceService;

export interface ITokenServiceServer {
    getToken: grpc.handleUnaryCall<token_pb.GetTokenRequest, token_pb.GetTokenResponse>;
    setToken: grpc.handleUnaryCall<token_pb.SetTokenRequest, token_pb.SetTokenResponse>;
    clearToken: grpc.handleUnaryCall<token_pb.ClearTokenRequest, token_pb.ClearTokenResponse>;
    provideToken: grpc.handleBidiStreamingCall<token_pb.ProvideTokenRequest, token_pb.ProvideTokenResponse>;
}

export interface ITokenServiceClient {
    getToken(request: token_pb.GetTokenRequest, callback: (error: grpc.ServiceError | null, response: token_pb.GetTokenResponse) => void): grpc.ClientUnaryCall;
    getToken(request: token_pb.GetTokenRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: token_pb.GetTokenResponse) => void): grpc.ClientUnaryCall;
    getToken(request: token_pb.GetTokenRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: token_pb.GetTokenResponse) => void): grpc.ClientUnaryCall;
    setToken(request: token_pb.SetTokenRequest, callback: (error: grpc.ServiceError | null, response: token_pb.SetTokenResponse) => void): grpc.ClientUnaryCall;
    setToken(request: token_pb.SetTokenRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: token_pb.SetTokenResponse) => void): grpc.ClientUnaryCall;
    setToken(request: token_pb.SetTokenRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: token_pb.SetTokenResponse) => void): grpc.ClientUnaryCall;
    clearToken(request: token_pb.ClearTokenRequest, callback: (error: grpc.ServiceError | null, response: token_pb.ClearTokenResponse) => void): grpc.ClientUnaryCall;
    clearToken(request: token_pb.ClearTokenRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: token_pb.ClearTokenResponse) => void): grpc.ClientUnaryCall;
    clearToken(request: token_pb.ClearTokenRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: token_pb.ClearTokenResponse) => void): grpc.ClientUnaryCall;
    provideToken(): grpc.ClientDuplexStream<token_pb.ProvideTokenRequest, token_pb.ProvideTokenResponse>;
    provideToken(options: Partial<grpc.CallOptions>): grpc.ClientDuplexStream<token_pb.ProvideTokenRequest, token_pb.ProvideTokenResponse>;
    provideToken(metadata: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientDuplexStream<token_pb.ProvideTokenRequest, token_pb.ProvideTokenResponse>;
}

export class TokenServiceClient extends grpc.Client implements ITokenServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: object);
    public getToken(request: token_pb.GetTokenRequest, callback: (error: grpc.ServiceError | null, response: token_pb.GetTokenResponse) => void): grpc.ClientUnaryCall;
    public getToken(request: token_pb.GetTokenRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: token_pb.GetTokenResponse) => void): grpc.ClientUnaryCall;
    public getToken(request: token_pb.GetTokenRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: token_pb.GetTokenResponse) => void): grpc.ClientUnaryCall;
    public setToken(request: token_pb.SetTokenRequest, callback: (error: grpc.ServiceError | null, response: token_pb.SetTokenResponse) => void): grpc.ClientUnaryCall;
    public setToken(request: token_pb.SetTokenRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: token_pb.SetTokenResponse) => void): grpc.ClientUnaryCall;
    public setToken(request: token_pb.SetTokenRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: token_pb.SetTokenResponse) => void): grpc.ClientUnaryCall;
    public clearToken(request: token_pb.ClearTokenRequest, callback: (error: grpc.ServiceError | null, response: token_pb.ClearTokenResponse) => void): grpc.ClientUnaryCall;
    public clearToken(request: token_pb.ClearTokenRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: token_pb.ClearTokenResponse) => void): grpc.ClientUnaryCall;
    public clearToken(request: token_pb.ClearTokenRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: token_pb.ClearTokenResponse) => void): grpc.ClientUnaryCall;
    public provideToken(options?: Partial<grpc.CallOptions>): grpc.ClientDuplexStream<token_pb.ProvideTokenRequest, token_pb.ProvideTokenResponse>;
    public provideToken(metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientDuplexStream<token_pb.ProvideTokenRequest, token_pb.ProvideTokenResponse>;
}
