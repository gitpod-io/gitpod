// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.supervisor.api;

import static io.grpc.MethodDescriptor.generateFullMethodName;

/**
 */
@javax.annotation.Generated(
    value = "by gRPC proto compiler (version 1.40.1)",
    comments = "Source: token.proto")
@io.grpc.stub.annotations.GrpcGenerated
public final class TokenServiceGrpc {

  private TokenServiceGrpc() {}

  public static final String SERVICE_NAME = "supervisor.TokenService";

  // Static method descriptors that strictly reflect the proto.
  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Token.GetTokenRequest,
      io.gitpod.supervisor.api.Token.GetTokenResponse> getGetTokenMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "GetToken",
      requestType = io.gitpod.supervisor.api.Token.GetTokenRequest.class,
      responseType = io.gitpod.supervisor.api.Token.GetTokenResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Token.GetTokenRequest,
      io.gitpod.supervisor.api.Token.GetTokenResponse> getGetTokenMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Token.GetTokenRequest, io.gitpod.supervisor.api.Token.GetTokenResponse> getGetTokenMethod;
    if ((getGetTokenMethod = TokenServiceGrpc.getGetTokenMethod) == null) {
      synchronized (TokenServiceGrpc.class) {
        if ((getGetTokenMethod = TokenServiceGrpc.getGetTokenMethod) == null) {
          TokenServiceGrpc.getGetTokenMethod = getGetTokenMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Token.GetTokenRequest, io.gitpod.supervisor.api.Token.GetTokenResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "GetToken"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Token.GetTokenRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Token.GetTokenResponse.getDefaultInstance()))
              .setSchemaDescriptor(new TokenServiceMethodDescriptorSupplier("GetToken"))
              .build();
        }
      }
    }
    return getGetTokenMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Token.SetTokenRequest,
      io.gitpod.supervisor.api.Token.SetTokenResponse> getSetTokenMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "SetToken",
      requestType = io.gitpod.supervisor.api.Token.SetTokenRequest.class,
      responseType = io.gitpod.supervisor.api.Token.SetTokenResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Token.SetTokenRequest,
      io.gitpod.supervisor.api.Token.SetTokenResponse> getSetTokenMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Token.SetTokenRequest, io.gitpod.supervisor.api.Token.SetTokenResponse> getSetTokenMethod;
    if ((getSetTokenMethod = TokenServiceGrpc.getSetTokenMethod) == null) {
      synchronized (TokenServiceGrpc.class) {
        if ((getSetTokenMethod = TokenServiceGrpc.getSetTokenMethod) == null) {
          TokenServiceGrpc.getSetTokenMethod = getSetTokenMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Token.SetTokenRequest, io.gitpod.supervisor.api.Token.SetTokenResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "SetToken"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Token.SetTokenRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Token.SetTokenResponse.getDefaultInstance()))
              .setSchemaDescriptor(new TokenServiceMethodDescriptorSupplier("SetToken"))
              .build();
        }
      }
    }
    return getSetTokenMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Token.ClearTokenRequest,
      io.gitpod.supervisor.api.Token.ClearTokenResponse> getClearTokenMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "ClearToken",
      requestType = io.gitpod.supervisor.api.Token.ClearTokenRequest.class,
      responseType = io.gitpod.supervisor.api.Token.ClearTokenResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Token.ClearTokenRequest,
      io.gitpod.supervisor.api.Token.ClearTokenResponse> getClearTokenMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Token.ClearTokenRequest, io.gitpod.supervisor.api.Token.ClearTokenResponse> getClearTokenMethod;
    if ((getClearTokenMethod = TokenServiceGrpc.getClearTokenMethod) == null) {
      synchronized (TokenServiceGrpc.class) {
        if ((getClearTokenMethod = TokenServiceGrpc.getClearTokenMethod) == null) {
          TokenServiceGrpc.getClearTokenMethod = getClearTokenMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Token.ClearTokenRequest, io.gitpod.supervisor.api.Token.ClearTokenResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "ClearToken"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Token.ClearTokenRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Token.ClearTokenResponse.getDefaultInstance()))
              .setSchemaDescriptor(new TokenServiceMethodDescriptorSupplier("ClearToken"))
              .build();
        }
      }
    }
    return getClearTokenMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Token.ProvideTokenRequest,
      io.gitpod.supervisor.api.Token.ProvideTokenResponse> getProvideTokenMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "ProvideToken",
      requestType = io.gitpod.supervisor.api.Token.ProvideTokenRequest.class,
      responseType = io.gitpod.supervisor.api.Token.ProvideTokenResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.BIDI_STREAMING)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Token.ProvideTokenRequest,
      io.gitpod.supervisor.api.Token.ProvideTokenResponse> getProvideTokenMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Token.ProvideTokenRequest, io.gitpod.supervisor.api.Token.ProvideTokenResponse> getProvideTokenMethod;
    if ((getProvideTokenMethod = TokenServiceGrpc.getProvideTokenMethod) == null) {
      synchronized (TokenServiceGrpc.class) {
        if ((getProvideTokenMethod = TokenServiceGrpc.getProvideTokenMethod) == null) {
          TokenServiceGrpc.getProvideTokenMethod = getProvideTokenMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Token.ProvideTokenRequest, io.gitpod.supervisor.api.Token.ProvideTokenResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.BIDI_STREAMING)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "ProvideToken"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Token.ProvideTokenRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Token.ProvideTokenResponse.getDefaultInstance()))
              .setSchemaDescriptor(new TokenServiceMethodDescriptorSupplier("ProvideToken"))
              .build();
        }
      }
    }
    return getProvideTokenMethod;
  }

  /**
   * Creates a new async stub that supports all call types for the service
   */
  public static TokenServiceStub newStub(io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<TokenServiceStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<TokenServiceStub>() {
        @java.lang.Override
        public TokenServiceStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new TokenServiceStub(channel, callOptions);
        }
      };
    return TokenServiceStub.newStub(factory, channel);
  }

  /**
   * Creates a new blocking-style stub that supports unary and streaming output calls on the service
   */
  public static TokenServiceBlockingStub newBlockingStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<TokenServiceBlockingStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<TokenServiceBlockingStub>() {
        @java.lang.Override
        public TokenServiceBlockingStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new TokenServiceBlockingStub(channel, callOptions);
        }
      };
    return TokenServiceBlockingStub.newStub(factory, channel);
  }

  /**
   * Creates a new ListenableFuture-style stub that supports unary calls on the service
   */
  public static TokenServiceFutureStub newFutureStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<TokenServiceFutureStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<TokenServiceFutureStub>() {
        @java.lang.Override
        public TokenServiceFutureStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new TokenServiceFutureStub(channel, callOptions);
        }
      };
    return TokenServiceFutureStub.newStub(factory, channel);
  }

  /**
   */
  public static abstract class TokenServiceImplBase implements io.grpc.BindableService {

    /**
     */
    public void getToken(io.gitpod.supervisor.api.Token.GetTokenRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Token.GetTokenResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getGetTokenMethod(), responseObserver);
    }

    /**
     */
    public void setToken(io.gitpod.supervisor.api.Token.SetTokenRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Token.SetTokenResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getSetTokenMethod(), responseObserver);
    }

    /**
     */
    public void clearToken(io.gitpod.supervisor.api.Token.ClearTokenRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Token.ClearTokenResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getClearTokenMethod(), responseObserver);
    }

    /**
     */
    public io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Token.ProvideTokenRequest> provideToken(
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Token.ProvideTokenResponse> responseObserver) {
      return io.grpc.stub.ServerCalls.asyncUnimplementedStreamingCall(getProvideTokenMethod(), responseObserver);
    }

    @java.lang.Override public final io.grpc.ServerServiceDefinition bindService() {
      return io.grpc.ServerServiceDefinition.builder(getServiceDescriptor())
          .addMethod(
            getGetTokenMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Token.GetTokenRequest,
                io.gitpod.supervisor.api.Token.GetTokenResponse>(
                  this, METHODID_GET_TOKEN)))
          .addMethod(
            getSetTokenMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Token.SetTokenRequest,
                io.gitpod.supervisor.api.Token.SetTokenResponse>(
                  this, METHODID_SET_TOKEN)))
          .addMethod(
            getClearTokenMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Token.ClearTokenRequest,
                io.gitpod.supervisor.api.Token.ClearTokenResponse>(
                  this, METHODID_CLEAR_TOKEN)))
          .addMethod(
            getProvideTokenMethod(),
            io.grpc.stub.ServerCalls.asyncBidiStreamingCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Token.ProvideTokenRequest,
                io.gitpod.supervisor.api.Token.ProvideTokenResponse>(
                  this, METHODID_PROVIDE_TOKEN)))
          .build();
    }
  }

  /**
   */
  public static final class TokenServiceStub extends io.grpc.stub.AbstractAsyncStub<TokenServiceStub> {
    private TokenServiceStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected TokenServiceStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new TokenServiceStub(channel, callOptions);
    }

    /**
     */
    public void getToken(io.gitpod.supervisor.api.Token.GetTokenRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Token.GetTokenResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getGetTokenMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     */
    public void setToken(io.gitpod.supervisor.api.Token.SetTokenRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Token.SetTokenResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getSetTokenMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     */
    public void clearToken(io.gitpod.supervisor.api.Token.ClearTokenRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Token.ClearTokenResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getClearTokenMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     */
    public io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Token.ProvideTokenRequest> provideToken(
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Token.ProvideTokenResponse> responseObserver) {
      return io.grpc.stub.ClientCalls.asyncBidiStreamingCall(
          getChannel().newCall(getProvideTokenMethod(), getCallOptions()), responseObserver);
    }
  }

  /**
   */
  public static final class TokenServiceBlockingStub extends io.grpc.stub.AbstractBlockingStub<TokenServiceBlockingStub> {
    private TokenServiceBlockingStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected TokenServiceBlockingStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new TokenServiceBlockingStub(channel, callOptions);
    }

    /**
     */
    public io.gitpod.supervisor.api.Token.GetTokenResponse getToken(io.gitpod.supervisor.api.Token.GetTokenRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getGetTokenMethod(), getCallOptions(), request);
    }

    /**
     */
    public io.gitpod.supervisor.api.Token.SetTokenResponse setToken(io.gitpod.supervisor.api.Token.SetTokenRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getSetTokenMethod(), getCallOptions(), request);
    }

    /**
     */
    public io.gitpod.supervisor.api.Token.ClearTokenResponse clearToken(io.gitpod.supervisor.api.Token.ClearTokenRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getClearTokenMethod(), getCallOptions(), request);
    }
  }

  /**
   */
  public static final class TokenServiceFutureStub extends io.grpc.stub.AbstractFutureStub<TokenServiceFutureStub> {
    private TokenServiceFutureStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected TokenServiceFutureStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new TokenServiceFutureStub(channel, callOptions);
    }

    /**
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.Token.GetTokenResponse> getToken(
        io.gitpod.supervisor.api.Token.GetTokenRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getGetTokenMethod(), getCallOptions()), request);
    }

    /**
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.Token.SetTokenResponse> setToken(
        io.gitpod.supervisor.api.Token.SetTokenRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getSetTokenMethod(), getCallOptions()), request);
    }

    /**
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.Token.ClearTokenResponse> clearToken(
        io.gitpod.supervisor.api.Token.ClearTokenRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getClearTokenMethod(), getCallOptions()), request);
    }
  }

  private static final int METHODID_GET_TOKEN = 0;
  private static final int METHODID_SET_TOKEN = 1;
  private static final int METHODID_CLEAR_TOKEN = 2;
  private static final int METHODID_PROVIDE_TOKEN = 3;

  private static final class MethodHandlers<Req, Resp> implements
      io.grpc.stub.ServerCalls.UnaryMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ServerStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ClientStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.BidiStreamingMethod<Req, Resp> {
    private final TokenServiceImplBase serviceImpl;
    private final int methodId;

    MethodHandlers(TokenServiceImplBase serviceImpl, int methodId) {
      this.serviceImpl = serviceImpl;
      this.methodId = methodId;
    }

    @java.lang.Override
    @java.lang.SuppressWarnings("unchecked")
    public void invoke(Req request, io.grpc.stub.StreamObserver<Resp> responseObserver) {
      switch (methodId) {
        case METHODID_GET_TOKEN:
          serviceImpl.getToken((io.gitpod.supervisor.api.Token.GetTokenRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Token.GetTokenResponse>) responseObserver);
          break;
        case METHODID_SET_TOKEN:
          serviceImpl.setToken((io.gitpod.supervisor.api.Token.SetTokenRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Token.SetTokenResponse>) responseObserver);
          break;
        case METHODID_CLEAR_TOKEN:
          serviceImpl.clearToken((io.gitpod.supervisor.api.Token.ClearTokenRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Token.ClearTokenResponse>) responseObserver);
          break;
        default:
          throw new AssertionError();
      }
    }

    @java.lang.Override
    @java.lang.SuppressWarnings("unchecked")
    public io.grpc.stub.StreamObserver<Req> invoke(
        io.grpc.stub.StreamObserver<Resp> responseObserver) {
      switch (methodId) {
        case METHODID_PROVIDE_TOKEN:
          return (io.grpc.stub.StreamObserver<Req>) serviceImpl.provideToken(
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Token.ProvideTokenResponse>) responseObserver);
        default:
          throw new AssertionError();
      }
    }
  }

  private static abstract class TokenServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoFileDescriptorSupplier, io.grpc.protobuf.ProtoServiceDescriptorSupplier {
    TokenServiceBaseDescriptorSupplier() {}

    @java.lang.Override
    public com.google.protobuf.Descriptors.FileDescriptor getFileDescriptor() {
      return io.gitpod.supervisor.api.Token.getDescriptor();
    }

    @java.lang.Override
    public com.google.protobuf.Descriptors.ServiceDescriptor getServiceDescriptor() {
      return getFileDescriptor().findServiceByName("TokenService");
    }
  }

  private static final class TokenServiceFileDescriptorSupplier
      extends TokenServiceBaseDescriptorSupplier {
    TokenServiceFileDescriptorSupplier() {}
  }

  private static final class TokenServiceMethodDescriptorSupplier
      extends TokenServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoMethodDescriptorSupplier {
    private final String methodName;

    TokenServiceMethodDescriptorSupplier(String methodName) {
      this.methodName = methodName;
    }

    @java.lang.Override
    public com.google.protobuf.Descriptors.MethodDescriptor getMethodDescriptor() {
      return getServiceDescriptor().findMethodByName(methodName);
    }
  }

  private static volatile io.grpc.ServiceDescriptor serviceDescriptor;

  public static io.grpc.ServiceDescriptor getServiceDescriptor() {
    io.grpc.ServiceDescriptor result = serviceDescriptor;
    if (result == null) {
      synchronized (TokenServiceGrpc.class) {
        result = serviceDescriptor;
        if (result == null) {
          serviceDescriptor = result = io.grpc.ServiceDescriptor.newBuilder(SERVICE_NAME)
              .setSchemaDescriptor(new TokenServiceFileDescriptorSupplier())
              .addMethod(getGetTokenMethod())
              .addMethod(getSetTokenMethod())
              .addMethod(getClearTokenMethod())
              .addMethod(getProvideTokenMethod())
              .build();
        }
      }
    }
    return result;
  }
}
