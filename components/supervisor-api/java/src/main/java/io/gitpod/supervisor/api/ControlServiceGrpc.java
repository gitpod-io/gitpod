// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.supervisor.api;

import static io.grpc.MethodDescriptor.generateFullMethodName;

/**
 * <pre>
 * ControlService provides workspace-facing, misc control related services
 * </pre>
 */
@javax.annotation.Generated(
    value = "by gRPC proto compiler (version 1.49.0)",
    comments = "Source: control.proto")
@io.grpc.stub.annotations.GrpcGenerated
public final class ControlServiceGrpc {

  private ControlServiceGrpc() {}

  public static final String SERVICE_NAME = "supervisor.ControlService";

  // Static method descriptors that strictly reflect the proto.
  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Control.ExposePortRequest,
      io.gitpod.supervisor.api.Control.ExposePortResponse> getExposePortMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "ExposePort",
      requestType = io.gitpod.supervisor.api.Control.ExposePortRequest.class,
      responseType = io.gitpod.supervisor.api.Control.ExposePortResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Control.ExposePortRequest,
      io.gitpod.supervisor.api.Control.ExposePortResponse> getExposePortMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Control.ExposePortRequest, io.gitpod.supervisor.api.Control.ExposePortResponse> getExposePortMethod;
    if ((getExposePortMethod = ControlServiceGrpc.getExposePortMethod) == null) {
      synchronized (ControlServiceGrpc.class) {
        if ((getExposePortMethod = ControlServiceGrpc.getExposePortMethod) == null) {
          ControlServiceGrpc.getExposePortMethod = getExposePortMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Control.ExposePortRequest, io.gitpod.supervisor.api.Control.ExposePortResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "ExposePort"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Control.ExposePortRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Control.ExposePortResponse.getDefaultInstance()))
              .setSchemaDescriptor(new ControlServiceMethodDescriptorSupplier("ExposePort"))
              .build();
        }
      }
    }
    return getExposePortMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Control.CreateSSHKeyPairRequest,
      io.gitpod.supervisor.api.Control.CreateSSHKeyPairResponse> getCreateSSHKeyPairMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "CreateSSHKeyPair",
      requestType = io.gitpod.supervisor.api.Control.CreateSSHKeyPairRequest.class,
      responseType = io.gitpod.supervisor.api.Control.CreateSSHKeyPairResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Control.CreateSSHKeyPairRequest,
      io.gitpod.supervisor.api.Control.CreateSSHKeyPairResponse> getCreateSSHKeyPairMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Control.CreateSSHKeyPairRequest, io.gitpod.supervisor.api.Control.CreateSSHKeyPairResponse> getCreateSSHKeyPairMethod;
    if ((getCreateSSHKeyPairMethod = ControlServiceGrpc.getCreateSSHKeyPairMethod) == null) {
      synchronized (ControlServiceGrpc.class) {
        if ((getCreateSSHKeyPairMethod = ControlServiceGrpc.getCreateSSHKeyPairMethod) == null) {
          ControlServiceGrpc.getCreateSSHKeyPairMethod = getCreateSSHKeyPairMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Control.CreateSSHKeyPairRequest, io.gitpod.supervisor.api.Control.CreateSSHKeyPairResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "CreateSSHKeyPair"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Control.CreateSSHKeyPairRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Control.CreateSSHKeyPairResponse.getDefaultInstance()))
              .setSchemaDescriptor(new ControlServiceMethodDescriptorSupplier("CreateSSHKeyPair"))
              .build();
        }
      }
    }
    return getCreateSSHKeyPairMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Control.CreateDebugEnvRequest,
      io.gitpod.supervisor.api.Control.CreateDebugEnvResponse> getCreateDebugEnvMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "CreateDebugEnv",
      requestType = io.gitpod.supervisor.api.Control.CreateDebugEnvRequest.class,
      responseType = io.gitpod.supervisor.api.Control.CreateDebugEnvResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Control.CreateDebugEnvRequest,
      io.gitpod.supervisor.api.Control.CreateDebugEnvResponse> getCreateDebugEnvMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Control.CreateDebugEnvRequest, io.gitpod.supervisor.api.Control.CreateDebugEnvResponse> getCreateDebugEnvMethod;
    if ((getCreateDebugEnvMethod = ControlServiceGrpc.getCreateDebugEnvMethod) == null) {
      synchronized (ControlServiceGrpc.class) {
        if ((getCreateDebugEnvMethod = ControlServiceGrpc.getCreateDebugEnvMethod) == null) {
          ControlServiceGrpc.getCreateDebugEnvMethod = getCreateDebugEnvMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Control.CreateDebugEnvRequest, io.gitpod.supervisor.api.Control.CreateDebugEnvResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "CreateDebugEnv"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Control.CreateDebugEnvRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Control.CreateDebugEnvResponse.getDefaultInstance()))
              .setSchemaDescriptor(new ControlServiceMethodDescriptorSupplier("CreateDebugEnv"))
              .build();
        }
      }
    }
    return getCreateDebugEnvMethod;
  }

  /**
   * Creates a new async stub that supports all call types for the service
   */
  public static ControlServiceStub newStub(io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<ControlServiceStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<ControlServiceStub>() {
        @java.lang.Override
        public ControlServiceStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new ControlServiceStub(channel, callOptions);
        }
      };
    return ControlServiceStub.newStub(factory, channel);
  }

  /**
   * Creates a new blocking-style stub that supports unary and streaming output calls on the service
   */
  public static ControlServiceBlockingStub newBlockingStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<ControlServiceBlockingStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<ControlServiceBlockingStub>() {
        @java.lang.Override
        public ControlServiceBlockingStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new ControlServiceBlockingStub(channel, callOptions);
        }
      };
    return ControlServiceBlockingStub.newStub(factory, channel);
  }

  /**
   * Creates a new ListenableFuture-style stub that supports unary calls on the service
   */
  public static ControlServiceFutureStub newFutureStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<ControlServiceFutureStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<ControlServiceFutureStub>() {
        @java.lang.Override
        public ControlServiceFutureStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new ControlServiceFutureStub(channel, callOptions);
        }
      };
    return ControlServiceFutureStub.newStub(factory, channel);
  }

  /**
   * <pre>
   * ControlService provides workspace-facing, misc control related services
   * </pre>
   */
  public static abstract class ControlServiceImplBase implements io.grpc.BindableService {

    /**
     * <pre>
     * ExposePort exposes a port
     * </pre>
     */
    public void exposePort(io.gitpod.supervisor.api.Control.ExposePortRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Control.ExposePortResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getExposePortMethod(), responseObserver);
    }

    /**
     * <pre>
     * CreateSSHKeyPair Create a pair of SSH Keys and put them in ~/.ssh/authorized_keys, this will only be generated once in the entire workspace lifecycle
     * </pre>
     */
    public void createSSHKeyPair(io.gitpod.supervisor.api.Control.CreateSSHKeyPairRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Control.CreateSSHKeyPairResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getCreateSSHKeyPairMethod(), responseObserver);
    }

    /**
     * <pre>
     * CreateDebugEnv creates a debug workspace envs
     * </pre>
     */
    public void createDebugEnv(io.gitpod.supervisor.api.Control.CreateDebugEnvRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Control.CreateDebugEnvResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getCreateDebugEnvMethod(), responseObserver);
    }

    @java.lang.Override public final io.grpc.ServerServiceDefinition bindService() {
      return io.grpc.ServerServiceDefinition.builder(getServiceDescriptor())
          .addMethod(
            getExposePortMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Control.ExposePortRequest,
                io.gitpod.supervisor.api.Control.ExposePortResponse>(
                  this, METHODID_EXPOSE_PORT)))
          .addMethod(
            getCreateSSHKeyPairMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Control.CreateSSHKeyPairRequest,
                io.gitpod.supervisor.api.Control.CreateSSHKeyPairResponse>(
                  this, METHODID_CREATE_SSHKEY_PAIR)))
          .addMethod(
            getCreateDebugEnvMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Control.CreateDebugEnvRequest,
                io.gitpod.supervisor.api.Control.CreateDebugEnvResponse>(
                  this, METHODID_CREATE_DEBUG_ENV)))
          .build();
    }
  }

  /**
   * <pre>
   * ControlService provides workspace-facing, misc control related services
   * </pre>
   */
  public static final class ControlServiceStub extends io.grpc.stub.AbstractAsyncStub<ControlServiceStub> {
    private ControlServiceStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected ControlServiceStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new ControlServiceStub(channel, callOptions);
    }

    /**
     * <pre>
     * ExposePort exposes a port
     * </pre>
     */
    public void exposePort(io.gitpod.supervisor.api.Control.ExposePortRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Control.ExposePortResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getExposePortMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * CreateSSHKeyPair Create a pair of SSH Keys and put them in ~/.ssh/authorized_keys, this will only be generated once in the entire workspace lifecycle
     * </pre>
     */
    public void createSSHKeyPair(io.gitpod.supervisor.api.Control.CreateSSHKeyPairRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Control.CreateSSHKeyPairResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getCreateSSHKeyPairMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * CreateDebugEnv creates a debug workspace envs
     * </pre>
     */
    public void createDebugEnv(io.gitpod.supervisor.api.Control.CreateDebugEnvRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Control.CreateDebugEnvResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getCreateDebugEnvMethod(), getCallOptions()), request, responseObserver);
    }
  }

  /**
   * <pre>
   * ControlService provides workspace-facing, misc control related services
   * </pre>
   */
  public static final class ControlServiceBlockingStub extends io.grpc.stub.AbstractBlockingStub<ControlServiceBlockingStub> {
    private ControlServiceBlockingStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected ControlServiceBlockingStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new ControlServiceBlockingStub(channel, callOptions);
    }

    /**
     * <pre>
     * ExposePort exposes a port
     * </pre>
     */
    public io.gitpod.supervisor.api.Control.ExposePortResponse exposePort(io.gitpod.supervisor.api.Control.ExposePortRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getExposePortMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * CreateSSHKeyPair Create a pair of SSH Keys and put them in ~/.ssh/authorized_keys, this will only be generated once in the entire workspace lifecycle
     * </pre>
     */
    public io.gitpod.supervisor.api.Control.CreateSSHKeyPairResponse createSSHKeyPair(io.gitpod.supervisor.api.Control.CreateSSHKeyPairRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getCreateSSHKeyPairMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * CreateDebugEnv creates a debug workspace envs
     * </pre>
     */
    public io.gitpod.supervisor.api.Control.CreateDebugEnvResponse createDebugEnv(io.gitpod.supervisor.api.Control.CreateDebugEnvRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getCreateDebugEnvMethod(), getCallOptions(), request);
    }
  }

  /**
   * <pre>
   * ControlService provides workspace-facing, misc control related services
   * </pre>
   */
  public static final class ControlServiceFutureStub extends io.grpc.stub.AbstractFutureStub<ControlServiceFutureStub> {
    private ControlServiceFutureStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected ControlServiceFutureStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new ControlServiceFutureStub(channel, callOptions);
    }

    /**
     * <pre>
     * ExposePort exposes a port
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.Control.ExposePortResponse> exposePort(
        io.gitpod.supervisor.api.Control.ExposePortRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getExposePortMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * CreateSSHKeyPair Create a pair of SSH Keys and put them in ~/.ssh/authorized_keys, this will only be generated once in the entire workspace lifecycle
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.Control.CreateSSHKeyPairResponse> createSSHKeyPair(
        io.gitpod.supervisor.api.Control.CreateSSHKeyPairRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getCreateSSHKeyPairMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * CreateDebugEnv creates a debug workspace envs
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.Control.CreateDebugEnvResponse> createDebugEnv(
        io.gitpod.supervisor.api.Control.CreateDebugEnvRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getCreateDebugEnvMethod(), getCallOptions()), request);
    }
  }

  private static final int METHODID_EXPOSE_PORT = 0;
  private static final int METHODID_CREATE_SSHKEY_PAIR = 1;
  private static final int METHODID_CREATE_DEBUG_ENV = 2;

  private static final class MethodHandlers<Req, Resp> implements
      io.grpc.stub.ServerCalls.UnaryMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ServerStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ClientStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.BidiStreamingMethod<Req, Resp> {
    private final ControlServiceImplBase serviceImpl;
    private final int methodId;

    MethodHandlers(ControlServiceImplBase serviceImpl, int methodId) {
      this.serviceImpl = serviceImpl;
      this.methodId = methodId;
    }

    @java.lang.Override
    @java.lang.SuppressWarnings("unchecked")
    public void invoke(Req request, io.grpc.stub.StreamObserver<Resp> responseObserver) {
      switch (methodId) {
        case METHODID_EXPOSE_PORT:
          serviceImpl.exposePort((io.gitpod.supervisor.api.Control.ExposePortRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Control.ExposePortResponse>) responseObserver);
          break;
        case METHODID_CREATE_SSHKEY_PAIR:
          serviceImpl.createSSHKeyPair((io.gitpod.supervisor.api.Control.CreateSSHKeyPairRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Control.CreateSSHKeyPairResponse>) responseObserver);
          break;
        case METHODID_CREATE_DEBUG_ENV:
          serviceImpl.createDebugEnv((io.gitpod.supervisor.api.Control.CreateDebugEnvRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Control.CreateDebugEnvResponse>) responseObserver);
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
        default:
          throw new AssertionError();
      }
    }
  }

  private static abstract class ControlServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoFileDescriptorSupplier, io.grpc.protobuf.ProtoServiceDescriptorSupplier {
    ControlServiceBaseDescriptorSupplier() {}

    @java.lang.Override
    public com.google.protobuf.Descriptors.FileDescriptor getFileDescriptor() {
      return io.gitpod.supervisor.api.Control.getDescriptor();
    }

    @java.lang.Override
    public com.google.protobuf.Descriptors.ServiceDescriptor getServiceDescriptor() {
      return getFileDescriptor().findServiceByName("ControlService");
    }
  }

  private static final class ControlServiceFileDescriptorSupplier
      extends ControlServiceBaseDescriptorSupplier {
    ControlServiceFileDescriptorSupplier() {}
  }

  private static final class ControlServiceMethodDescriptorSupplier
      extends ControlServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoMethodDescriptorSupplier {
    private final String methodName;

    ControlServiceMethodDescriptorSupplier(String methodName) {
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
      synchronized (ControlServiceGrpc.class) {
        result = serviceDescriptor;
        if (result == null) {
          serviceDescriptor = result = io.grpc.ServiceDescriptor.newBuilder(SERVICE_NAME)
              .setSchemaDescriptor(new ControlServiceFileDescriptorSupplier())
              .addMethod(getExposePortMethod())
              .addMethod(getCreateSSHKeyPairMethod())
              .addMethod(getCreateDebugEnvMethod())
              .build();
        }
      }
    }
    return result;
  }
}
