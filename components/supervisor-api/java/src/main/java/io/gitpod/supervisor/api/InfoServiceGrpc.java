// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.supervisor.api;

import static io.grpc.MethodDescriptor.generateFullMethodName;

/**
 */
@javax.annotation.Generated(
    value = "by gRPC proto compiler (version 1.40.1)",
    comments = "Source: info.proto")
@io.grpc.stub.annotations.GrpcGenerated
public final class InfoServiceGrpc {

  private InfoServiceGrpc() {}

  public static final String SERVICE_NAME = "supervisor.InfoService";

  // Static method descriptors that strictly reflect the proto.
  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Info.WorkspaceInfoRequest,
      io.gitpod.supervisor.api.Info.WorkspaceInfoResponse> getWorkspaceInfoMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "WorkspaceInfo",
      requestType = io.gitpod.supervisor.api.Info.WorkspaceInfoRequest.class,
      responseType = io.gitpod.supervisor.api.Info.WorkspaceInfoResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Info.WorkspaceInfoRequest,
      io.gitpod.supervisor.api.Info.WorkspaceInfoResponse> getWorkspaceInfoMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Info.WorkspaceInfoRequest, io.gitpod.supervisor.api.Info.WorkspaceInfoResponse> getWorkspaceInfoMethod;
    if ((getWorkspaceInfoMethod = InfoServiceGrpc.getWorkspaceInfoMethod) == null) {
      synchronized (InfoServiceGrpc.class) {
        if ((getWorkspaceInfoMethod = InfoServiceGrpc.getWorkspaceInfoMethod) == null) {
          InfoServiceGrpc.getWorkspaceInfoMethod = getWorkspaceInfoMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Info.WorkspaceInfoRequest, io.gitpod.supervisor.api.Info.WorkspaceInfoResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "WorkspaceInfo"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Info.WorkspaceInfoRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Info.WorkspaceInfoResponse.getDefaultInstance()))
              .setSchemaDescriptor(new InfoServiceMethodDescriptorSupplier("WorkspaceInfo"))
              .build();
        }
      }
    }
    return getWorkspaceInfoMethod;
  }

  /**
   * Creates a new async stub that supports all call types for the service
   */
  public static InfoServiceStub newStub(io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<InfoServiceStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<InfoServiceStub>() {
        @java.lang.Override
        public InfoServiceStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new InfoServiceStub(channel, callOptions);
        }
      };
    return InfoServiceStub.newStub(factory, channel);
  }

  /**
   * Creates a new blocking-style stub that supports unary and streaming output calls on the service
   */
  public static InfoServiceBlockingStub newBlockingStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<InfoServiceBlockingStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<InfoServiceBlockingStub>() {
        @java.lang.Override
        public InfoServiceBlockingStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new InfoServiceBlockingStub(channel, callOptions);
        }
      };
    return InfoServiceBlockingStub.newStub(factory, channel);
  }

  /**
   * Creates a new ListenableFuture-style stub that supports unary calls on the service
   */
  public static InfoServiceFutureStub newFutureStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<InfoServiceFutureStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<InfoServiceFutureStub>() {
        @java.lang.Override
        public InfoServiceFutureStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new InfoServiceFutureStub(channel, callOptions);
        }
      };
    return InfoServiceFutureStub.newStub(factory, channel);
  }

  /**
   */
  public static abstract class InfoServiceImplBase implements io.grpc.BindableService {

    /**
     */
    public void workspaceInfo(io.gitpod.supervisor.api.Info.WorkspaceInfoRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Info.WorkspaceInfoResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getWorkspaceInfoMethod(), responseObserver);
    }

    @java.lang.Override public final io.grpc.ServerServiceDefinition bindService() {
      return io.grpc.ServerServiceDefinition.builder(getServiceDescriptor())
          .addMethod(
            getWorkspaceInfoMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Info.WorkspaceInfoRequest,
                io.gitpod.supervisor.api.Info.WorkspaceInfoResponse>(
                  this, METHODID_WORKSPACE_INFO)))
          .build();
    }
  }

  /**
   */
  public static final class InfoServiceStub extends io.grpc.stub.AbstractAsyncStub<InfoServiceStub> {
    private InfoServiceStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected InfoServiceStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new InfoServiceStub(channel, callOptions);
    }

    /**
     */
    public void workspaceInfo(io.gitpod.supervisor.api.Info.WorkspaceInfoRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Info.WorkspaceInfoResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getWorkspaceInfoMethod(), getCallOptions()), request, responseObserver);
    }
  }

  /**
   */
  public static final class InfoServiceBlockingStub extends io.grpc.stub.AbstractBlockingStub<InfoServiceBlockingStub> {
    private InfoServiceBlockingStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected InfoServiceBlockingStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new InfoServiceBlockingStub(channel, callOptions);
    }

    /**
     */
    public io.gitpod.supervisor.api.Info.WorkspaceInfoResponse workspaceInfo(io.gitpod.supervisor.api.Info.WorkspaceInfoRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getWorkspaceInfoMethod(), getCallOptions(), request);
    }
  }

  /**
   */
  public static final class InfoServiceFutureStub extends io.grpc.stub.AbstractFutureStub<InfoServiceFutureStub> {
    private InfoServiceFutureStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected InfoServiceFutureStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new InfoServiceFutureStub(channel, callOptions);
    }

    /**
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.Info.WorkspaceInfoResponse> workspaceInfo(
        io.gitpod.supervisor.api.Info.WorkspaceInfoRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getWorkspaceInfoMethod(), getCallOptions()), request);
    }
  }

  private static final int METHODID_WORKSPACE_INFO = 0;

  private static final class MethodHandlers<Req, Resp> implements
      io.grpc.stub.ServerCalls.UnaryMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ServerStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ClientStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.BidiStreamingMethod<Req, Resp> {
    private final InfoServiceImplBase serviceImpl;
    private final int methodId;

    MethodHandlers(InfoServiceImplBase serviceImpl, int methodId) {
      this.serviceImpl = serviceImpl;
      this.methodId = methodId;
    }

    @java.lang.Override
    @java.lang.SuppressWarnings("unchecked")
    public void invoke(Req request, io.grpc.stub.StreamObserver<Resp> responseObserver) {
      switch (methodId) {
        case METHODID_WORKSPACE_INFO:
          serviceImpl.workspaceInfo((io.gitpod.supervisor.api.Info.WorkspaceInfoRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Info.WorkspaceInfoResponse>) responseObserver);
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

  private static abstract class InfoServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoFileDescriptorSupplier, io.grpc.protobuf.ProtoServiceDescriptorSupplier {
    InfoServiceBaseDescriptorSupplier() {}

    @java.lang.Override
    public com.google.protobuf.Descriptors.FileDescriptor getFileDescriptor() {
      return io.gitpod.supervisor.api.Info.getDescriptor();
    }

    @java.lang.Override
    public com.google.protobuf.Descriptors.ServiceDescriptor getServiceDescriptor() {
      return getFileDescriptor().findServiceByName("InfoService");
    }
  }

  private static final class InfoServiceFileDescriptorSupplier
      extends InfoServiceBaseDescriptorSupplier {
    InfoServiceFileDescriptorSupplier() {}
  }

  private static final class InfoServiceMethodDescriptorSupplier
      extends InfoServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoMethodDescriptorSupplier {
    private final String methodName;

    InfoServiceMethodDescriptorSupplier(String methodName) {
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
      synchronized (InfoServiceGrpc.class) {
        result = serviceDescriptor;
        if (result == null) {
          serviceDescriptor = result = io.grpc.ServiceDescriptor.newBuilder(SERVICE_NAME)
              .setSchemaDescriptor(new InfoServiceFileDescriptorSupplier())
              .addMethod(getWorkspaceInfoMethod())
              .build();
        }
      }
    }
    return result;
  }
}
