// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.supervisor.api;

import static io.grpc.MethodDescriptor.generateFullMethodName;

/**
 */
@javax.annotation.Generated(
    value = "by gRPC proto compiler (version 1.41.0)",
    comments = "Source: port.proto")
@io.grpc.stub.annotations.GrpcGenerated
public final class PortServiceGrpc {

  private PortServiceGrpc() {}

  public static final String SERVICE_NAME = "supervisor.PortService";

  // Static method descriptors that strictly reflect the proto.
  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Port.TunnelPortRequest,
      io.gitpod.supervisor.api.Port.TunnelPortResponse> getTunnelMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "Tunnel",
      requestType = io.gitpod.supervisor.api.Port.TunnelPortRequest.class,
      responseType = io.gitpod.supervisor.api.Port.TunnelPortResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Port.TunnelPortRequest,
      io.gitpod.supervisor.api.Port.TunnelPortResponse> getTunnelMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Port.TunnelPortRequest, io.gitpod.supervisor.api.Port.TunnelPortResponse> getTunnelMethod;
    if ((getTunnelMethod = PortServiceGrpc.getTunnelMethod) == null) {
      synchronized (PortServiceGrpc.class) {
        if ((getTunnelMethod = PortServiceGrpc.getTunnelMethod) == null) {
          PortServiceGrpc.getTunnelMethod = getTunnelMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Port.TunnelPortRequest, io.gitpod.supervisor.api.Port.TunnelPortResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "Tunnel"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Port.TunnelPortRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Port.TunnelPortResponse.getDefaultInstance()))
              .setSchemaDescriptor(new PortServiceMethodDescriptorSupplier("Tunnel"))
              .build();
        }
      }
    }
    return getTunnelMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Port.CloseTunnelRequest,
      io.gitpod.supervisor.api.Port.CloseTunnelResponse> getCloseTunnelMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "CloseTunnel",
      requestType = io.gitpod.supervisor.api.Port.CloseTunnelRequest.class,
      responseType = io.gitpod.supervisor.api.Port.CloseTunnelResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Port.CloseTunnelRequest,
      io.gitpod.supervisor.api.Port.CloseTunnelResponse> getCloseTunnelMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Port.CloseTunnelRequest, io.gitpod.supervisor.api.Port.CloseTunnelResponse> getCloseTunnelMethod;
    if ((getCloseTunnelMethod = PortServiceGrpc.getCloseTunnelMethod) == null) {
      synchronized (PortServiceGrpc.class) {
        if ((getCloseTunnelMethod = PortServiceGrpc.getCloseTunnelMethod) == null) {
          PortServiceGrpc.getCloseTunnelMethod = getCloseTunnelMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Port.CloseTunnelRequest, io.gitpod.supervisor.api.Port.CloseTunnelResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "CloseTunnel"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Port.CloseTunnelRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Port.CloseTunnelResponse.getDefaultInstance()))
              .setSchemaDescriptor(new PortServiceMethodDescriptorSupplier("CloseTunnel"))
              .build();
        }
      }
    }
    return getCloseTunnelMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Port.EstablishTunnelRequest,
      io.gitpod.supervisor.api.Port.EstablishTunnelResponse> getEstablishTunnelMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "EstablishTunnel",
      requestType = io.gitpod.supervisor.api.Port.EstablishTunnelRequest.class,
      responseType = io.gitpod.supervisor.api.Port.EstablishTunnelResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.BIDI_STREAMING)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Port.EstablishTunnelRequest,
      io.gitpod.supervisor.api.Port.EstablishTunnelResponse> getEstablishTunnelMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Port.EstablishTunnelRequest, io.gitpod.supervisor.api.Port.EstablishTunnelResponse> getEstablishTunnelMethod;
    if ((getEstablishTunnelMethod = PortServiceGrpc.getEstablishTunnelMethod) == null) {
      synchronized (PortServiceGrpc.class) {
        if ((getEstablishTunnelMethod = PortServiceGrpc.getEstablishTunnelMethod) == null) {
          PortServiceGrpc.getEstablishTunnelMethod = getEstablishTunnelMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Port.EstablishTunnelRequest, io.gitpod.supervisor.api.Port.EstablishTunnelResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.BIDI_STREAMING)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "EstablishTunnel"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Port.EstablishTunnelRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Port.EstablishTunnelResponse.getDefaultInstance()))
              .setSchemaDescriptor(new PortServiceMethodDescriptorSupplier("EstablishTunnel"))
              .build();
        }
      }
    }
    return getEstablishTunnelMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Port.AutoTunnelRequest,
      io.gitpod.supervisor.api.Port.AutoTunnelResponse> getAutoTunnelMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "AutoTunnel",
      requestType = io.gitpod.supervisor.api.Port.AutoTunnelRequest.class,
      responseType = io.gitpod.supervisor.api.Port.AutoTunnelResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Port.AutoTunnelRequest,
      io.gitpod.supervisor.api.Port.AutoTunnelResponse> getAutoTunnelMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Port.AutoTunnelRequest, io.gitpod.supervisor.api.Port.AutoTunnelResponse> getAutoTunnelMethod;
    if ((getAutoTunnelMethod = PortServiceGrpc.getAutoTunnelMethod) == null) {
      synchronized (PortServiceGrpc.class) {
        if ((getAutoTunnelMethod = PortServiceGrpc.getAutoTunnelMethod) == null) {
          PortServiceGrpc.getAutoTunnelMethod = getAutoTunnelMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Port.AutoTunnelRequest, io.gitpod.supervisor.api.Port.AutoTunnelResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "AutoTunnel"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Port.AutoTunnelRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Port.AutoTunnelResponse.getDefaultInstance()))
              .setSchemaDescriptor(new PortServiceMethodDescriptorSupplier("AutoTunnel"))
              .build();
        }
      }
    }
    return getAutoTunnelMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Port.RetryAutoExposeRequest,
      io.gitpod.supervisor.api.Port.RetryAutoExposeResponse> getRetryAutoExposeMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "RetryAutoExpose",
      requestType = io.gitpod.supervisor.api.Port.RetryAutoExposeRequest.class,
      responseType = io.gitpod.supervisor.api.Port.RetryAutoExposeResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Port.RetryAutoExposeRequest,
      io.gitpod.supervisor.api.Port.RetryAutoExposeResponse> getRetryAutoExposeMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Port.RetryAutoExposeRequest, io.gitpod.supervisor.api.Port.RetryAutoExposeResponse> getRetryAutoExposeMethod;
    if ((getRetryAutoExposeMethod = PortServiceGrpc.getRetryAutoExposeMethod) == null) {
      synchronized (PortServiceGrpc.class) {
        if ((getRetryAutoExposeMethod = PortServiceGrpc.getRetryAutoExposeMethod) == null) {
          PortServiceGrpc.getRetryAutoExposeMethod = getRetryAutoExposeMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Port.RetryAutoExposeRequest, io.gitpod.supervisor.api.Port.RetryAutoExposeResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "RetryAutoExpose"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Port.RetryAutoExposeRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Port.RetryAutoExposeResponse.getDefaultInstance()))
              .setSchemaDescriptor(new PortServiceMethodDescriptorSupplier("RetryAutoExpose"))
              .build();
        }
      }
    }
    return getRetryAutoExposeMethod;
  }

  /**
   * Creates a new async stub that supports all call types for the service
   */
  public static PortServiceStub newStub(io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<PortServiceStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<PortServiceStub>() {
        @java.lang.Override
        public PortServiceStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new PortServiceStub(channel, callOptions);
        }
      };
    return PortServiceStub.newStub(factory, channel);
  }

  /**
   * Creates a new blocking-style stub that supports unary and streaming output calls on the service
   */
  public static PortServiceBlockingStub newBlockingStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<PortServiceBlockingStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<PortServiceBlockingStub>() {
        @java.lang.Override
        public PortServiceBlockingStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new PortServiceBlockingStub(channel, callOptions);
        }
      };
    return PortServiceBlockingStub.newStub(factory, channel);
  }

  /**
   * Creates a new ListenableFuture-style stub that supports unary calls on the service
   */
  public static PortServiceFutureStub newFutureStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<PortServiceFutureStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<PortServiceFutureStub>() {
        @java.lang.Override
        public PortServiceFutureStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new PortServiceFutureStub(channel, callOptions);
        }
      };
    return PortServiceFutureStub.newStub(factory, channel);
  }

  /**
   */
  public static abstract class PortServiceImplBase implements io.grpc.BindableService {

    /**
     * <pre>
     * Tunnel notifies clients to install listeners on remote machines.
     * After that such clients should call EstablishTunnel to forward incoming connections.
     * </pre>
     */
    public void tunnel(io.gitpod.supervisor.api.Port.TunnelPortRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Port.TunnelPortResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getTunnelMethod(), responseObserver);
    }

    /**
     * <pre>
     * CloseTunnel notifies clients to remove listeners on remote machines.
     * </pre>
     */
    public void closeTunnel(io.gitpod.supervisor.api.Port.CloseTunnelRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Port.CloseTunnelResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getCloseTunnelMethod(), responseObserver);
    }

    /**
     * <pre>
     * EstablishTunnel actually establishes the tunnel for an incoming connection on a remote machine.
     * </pre>
     */
    public io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Port.EstablishTunnelRequest> establishTunnel(
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Port.EstablishTunnelResponse> responseObserver) {
      return io.grpc.stub.ServerCalls.asyncUnimplementedStreamingCall(getEstablishTunnelMethod(), responseObserver);
    }

    /**
     * <pre>
     * AutoTunnel controls enablement of auto tunneling
     * </pre>
     */
    public void autoTunnel(io.gitpod.supervisor.api.Port.AutoTunnelRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Port.AutoTunnelResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getAutoTunnelMethod(), responseObserver);
    }

    /**
     * <pre>
     * RetryAutoExpose retries auto exposing the give port
     * </pre>
     */
    public void retryAutoExpose(io.gitpod.supervisor.api.Port.RetryAutoExposeRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Port.RetryAutoExposeResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getRetryAutoExposeMethod(), responseObserver);
    }

    @java.lang.Override public final io.grpc.ServerServiceDefinition bindService() {
      return io.grpc.ServerServiceDefinition.builder(getServiceDescriptor())
          .addMethod(
            getTunnelMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Port.TunnelPortRequest,
                io.gitpod.supervisor.api.Port.TunnelPortResponse>(
                  this, METHODID_TUNNEL)))
          .addMethod(
            getCloseTunnelMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Port.CloseTunnelRequest,
                io.gitpod.supervisor.api.Port.CloseTunnelResponse>(
                  this, METHODID_CLOSE_TUNNEL)))
          .addMethod(
            getEstablishTunnelMethod(),
            io.grpc.stub.ServerCalls.asyncBidiStreamingCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Port.EstablishTunnelRequest,
                io.gitpod.supervisor.api.Port.EstablishTunnelResponse>(
                  this, METHODID_ESTABLISH_TUNNEL)))
          .addMethod(
            getAutoTunnelMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Port.AutoTunnelRequest,
                io.gitpod.supervisor.api.Port.AutoTunnelResponse>(
                  this, METHODID_AUTO_TUNNEL)))
          .addMethod(
            getRetryAutoExposeMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Port.RetryAutoExposeRequest,
                io.gitpod.supervisor.api.Port.RetryAutoExposeResponse>(
                  this, METHODID_RETRY_AUTO_EXPOSE)))
          .build();
    }
  }

  /**
   */
  public static final class PortServiceStub extends io.grpc.stub.AbstractAsyncStub<PortServiceStub> {
    private PortServiceStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected PortServiceStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new PortServiceStub(channel, callOptions);
    }

    /**
     * <pre>
     * Tunnel notifies clients to install listeners on remote machines.
     * After that such clients should call EstablishTunnel to forward incoming connections.
     * </pre>
     */
    public void tunnel(io.gitpod.supervisor.api.Port.TunnelPortRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Port.TunnelPortResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getTunnelMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * CloseTunnel notifies clients to remove listeners on remote machines.
     * </pre>
     */
    public void closeTunnel(io.gitpod.supervisor.api.Port.CloseTunnelRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Port.CloseTunnelResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getCloseTunnelMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * EstablishTunnel actually establishes the tunnel for an incoming connection on a remote machine.
     * </pre>
     */
    public io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Port.EstablishTunnelRequest> establishTunnel(
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Port.EstablishTunnelResponse> responseObserver) {
      return io.grpc.stub.ClientCalls.asyncBidiStreamingCall(
          getChannel().newCall(getEstablishTunnelMethod(), getCallOptions()), responseObserver);
    }

    /**
     * <pre>
     * AutoTunnel controls enablement of auto tunneling
     * </pre>
     */
    public void autoTunnel(io.gitpod.supervisor.api.Port.AutoTunnelRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Port.AutoTunnelResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getAutoTunnelMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * RetryAutoExpose retries auto exposing the give port
     * </pre>
     */
    public void retryAutoExpose(io.gitpod.supervisor.api.Port.RetryAutoExposeRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Port.RetryAutoExposeResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getRetryAutoExposeMethod(), getCallOptions()), request, responseObserver);
    }
  }

  /**
   */
  public static final class PortServiceBlockingStub extends io.grpc.stub.AbstractBlockingStub<PortServiceBlockingStub> {
    private PortServiceBlockingStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected PortServiceBlockingStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new PortServiceBlockingStub(channel, callOptions);
    }

    /**
     * <pre>
     * Tunnel notifies clients to install listeners on remote machines.
     * After that such clients should call EstablishTunnel to forward incoming connections.
     * </pre>
     */
    public io.gitpod.supervisor.api.Port.TunnelPortResponse tunnel(io.gitpod.supervisor.api.Port.TunnelPortRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getTunnelMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * CloseTunnel notifies clients to remove listeners on remote machines.
     * </pre>
     */
    public io.gitpod.supervisor.api.Port.CloseTunnelResponse closeTunnel(io.gitpod.supervisor.api.Port.CloseTunnelRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getCloseTunnelMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * AutoTunnel controls enablement of auto tunneling
     * </pre>
     */
    public io.gitpod.supervisor.api.Port.AutoTunnelResponse autoTunnel(io.gitpod.supervisor.api.Port.AutoTunnelRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getAutoTunnelMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * RetryAutoExpose retries auto exposing the give port
     * </pre>
     */
    public io.gitpod.supervisor.api.Port.RetryAutoExposeResponse retryAutoExpose(io.gitpod.supervisor.api.Port.RetryAutoExposeRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getRetryAutoExposeMethod(), getCallOptions(), request);
    }
  }

  /**
   */
  public static final class PortServiceFutureStub extends io.grpc.stub.AbstractFutureStub<PortServiceFutureStub> {
    private PortServiceFutureStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected PortServiceFutureStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new PortServiceFutureStub(channel, callOptions);
    }

    /**
     * <pre>
     * Tunnel notifies clients to install listeners on remote machines.
     * After that such clients should call EstablishTunnel to forward incoming connections.
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.Port.TunnelPortResponse> tunnel(
        io.gitpod.supervisor.api.Port.TunnelPortRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getTunnelMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * CloseTunnel notifies clients to remove listeners on remote machines.
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.Port.CloseTunnelResponse> closeTunnel(
        io.gitpod.supervisor.api.Port.CloseTunnelRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getCloseTunnelMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * AutoTunnel controls enablement of auto tunneling
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.Port.AutoTunnelResponse> autoTunnel(
        io.gitpod.supervisor.api.Port.AutoTunnelRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getAutoTunnelMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * RetryAutoExpose retries auto exposing the give port
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.Port.RetryAutoExposeResponse> retryAutoExpose(
        io.gitpod.supervisor.api.Port.RetryAutoExposeRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getRetryAutoExposeMethod(), getCallOptions()), request);
    }
  }

  private static final int METHODID_TUNNEL = 0;
  private static final int METHODID_CLOSE_TUNNEL = 1;
  private static final int METHODID_AUTO_TUNNEL = 2;
  private static final int METHODID_RETRY_AUTO_EXPOSE = 3;
  private static final int METHODID_ESTABLISH_TUNNEL = 4;

  private static final class MethodHandlers<Req, Resp> implements
      io.grpc.stub.ServerCalls.UnaryMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ServerStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ClientStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.BidiStreamingMethod<Req, Resp> {
    private final PortServiceImplBase serviceImpl;
    private final int methodId;

    MethodHandlers(PortServiceImplBase serviceImpl, int methodId) {
      this.serviceImpl = serviceImpl;
      this.methodId = methodId;
    }

    @java.lang.Override
    @java.lang.SuppressWarnings("unchecked")
    public void invoke(Req request, io.grpc.stub.StreamObserver<Resp> responseObserver) {
      switch (methodId) {
        case METHODID_TUNNEL:
          serviceImpl.tunnel((io.gitpod.supervisor.api.Port.TunnelPortRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Port.TunnelPortResponse>) responseObserver);
          break;
        case METHODID_CLOSE_TUNNEL:
          serviceImpl.closeTunnel((io.gitpod.supervisor.api.Port.CloseTunnelRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Port.CloseTunnelResponse>) responseObserver);
          break;
        case METHODID_AUTO_TUNNEL:
          serviceImpl.autoTunnel((io.gitpod.supervisor.api.Port.AutoTunnelRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Port.AutoTunnelResponse>) responseObserver);
          break;
        case METHODID_RETRY_AUTO_EXPOSE:
          serviceImpl.retryAutoExpose((io.gitpod.supervisor.api.Port.RetryAutoExposeRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Port.RetryAutoExposeResponse>) responseObserver);
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
        case METHODID_ESTABLISH_TUNNEL:
          return (io.grpc.stub.StreamObserver<Req>) serviceImpl.establishTunnel(
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Port.EstablishTunnelResponse>) responseObserver);
        default:
          throw new AssertionError();
      }
    }
  }

  private static abstract class PortServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoFileDescriptorSupplier, io.grpc.protobuf.ProtoServiceDescriptorSupplier {
    PortServiceBaseDescriptorSupplier() {}

    @java.lang.Override
    public com.google.protobuf.Descriptors.FileDescriptor getFileDescriptor() {
      return io.gitpod.supervisor.api.Port.getDescriptor();
    }

    @java.lang.Override
    public com.google.protobuf.Descriptors.ServiceDescriptor getServiceDescriptor() {
      return getFileDescriptor().findServiceByName("PortService");
    }
  }

  private static final class PortServiceFileDescriptorSupplier
      extends PortServiceBaseDescriptorSupplier {
    PortServiceFileDescriptorSupplier() {}
  }

  private static final class PortServiceMethodDescriptorSupplier
      extends PortServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoMethodDescriptorSupplier {
    private final String methodName;

    PortServiceMethodDescriptorSupplier(String methodName) {
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
      synchronized (PortServiceGrpc.class) {
        result = serviceDescriptor;
        if (result == null) {
          serviceDescriptor = result = io.grpc.ServiceDescriptor.newBuilder(SERVICE_NAME)
              .setSchemaDescriptor(new PortServiceFileDescriptorSupplier())
              .addMethod(getTunnelMethod())
              .addMethod(getCloseTunnelMethod())
              .addMethod(getEstablishTunnelMethod())
              .addMethod(getAutoTunnelMethod())
              .addMethod(getRetryAutoExposeMethod())
              .build();
        }
      }
    }
    return result;
  }
}
