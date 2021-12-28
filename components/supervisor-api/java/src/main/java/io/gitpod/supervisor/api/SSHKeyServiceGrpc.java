// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.supervisor.api;

import static io.grpc.MethodDescriptor.generateFullMethodName;

/**
 */
@javax.annotation.Generated(
    value = "by gRPC proto compiler (version 1.41.0)",
    comments = "Source: sshkey.proto")
@io.grpc.stub.annotations.GrpcGenerated
public final class SSHKeyServiceGrpc {

  private SSHKeyServiceGrpc() {}

  public static final String SERVICE_NAME = "supervisor.SSHKeyService";

  // Static method descriptors that strictly reflect the proto.
  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairRequest,
      io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairResponse> getCreateSSHKeyPairMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "CreateSSHKeyPair",
      requestType = io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairRequest.class,
      responseType = io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairRequest,
      io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairResponse> getCreateSSHKeyPairMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairRequest, io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairResponse> getCreateSSHKeyPairMethod;
    if ((getCreateSSHKeyPairMethod = SSHKeyServiceGrpc.getCreateSSHKeyPairMethod) == null) {
      synchronized (SSHKeyServiceGrpc.class) {
        if ((getCreateSSHKeyPairMethod = SSHKeyServiceGrpc.getCreateSSHKeyPairMethod) == null) {
          SSHKeyServiceGrpc.getCreateSSHKeyPairMethod = getCreateSSHKeyPairMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairRequest, io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "CreateSSHKeyPair"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairResponse.getDefaultInstance()))
              .setSchemaDescriptor(new SSHKeyServiceMethodDescriptorSupplier("CreateSSHKeyPair"))
              .build();
        }
      }
    }
    return getCreateSSHKeyPairMethod;
  }

  /**
   * Creates a new async stub that supports all call types for the service
   */
  public static SSHKeyServiceStub newStub(io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<SSHKeyServiceStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<SSHKeyServiceStub>() {
        @java.lang.Override
        public SSHKeyServiceStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new SSHKeyServiceStub(channel, callOptions);
        }
      };
    return SSHKeyServiceStub.newStub(factory, channel);
  }

  /**
   * Creates a new blocking-style stub that supports unary and streaming output calls on the service
   */
  public static SSHKeyServiceBlockingStub newBlockingStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<SSHKeyServiceBlockingStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<SSHKeyServiceBlockingStub>() {
        @java.lang.Override
        public SSHKeyServiceBlockingStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new SSHKeyServiceBlockingStub(channel, callOptions);
        }
      };
    return SSHKeyServiceBlockingStub.newStub(factory, channel);
  }

  /**
   * Creates a new ListenableFuture-style stub that supports unary calls on the service
   */
  public static SSHKeyServiceFutureStub newFutureStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<SSHKeyServiceFutureStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<SSHKeyServiceFutureStub>() {
        @java.lang.Override
        public SSHKeyServiceFutureStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new SSHKeyServiceFutureStub(channel, callOptions);
        }
      };
    return SSHKeyServiceFutureStub.newStub(factory, channel);
  }

  /**
   */
  public static abstract class SSHKeyServiceImplBase implements io.grpc.BindableService {

    /**
     */
    public void createSSHKeyPair(io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getCreateSSHKeyPairMethod(), responseObserver);
    }

    @java.lang.Override public final io.grpc.ServerServiceDefinition bindService() {
      return io.grpc.ServerServiceDefinition.builder(getServiceDescriptor())
          .addMethod(
            getCreateSSHKeyPairMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairRequest,
                io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairResponse>(
                  this, METHODID_CREATE_SSHKEY_PAIR)))
          .build();
    }
  }

  /**
   */
  public static final class SSHKeyServiceStub extends io.grpc.stub.AbstractAsyncStub<SSHKeyServiceStub> {
    private SSHKeyServiceStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected SSHKeyServiceStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new SSHKeyServiceStub(channel, callOptions);
    }

    /**
     */
    public void createSSHKeyPair(io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getCreateSSHKeyPairMethod(), getCallOptions()), request, responseObserver);
    }
  }

  /**
   */
  public static final class SSHKeyServiceBlockingStub extends io.grpc.stub.AbstractBlockingStub<SSHKeyServiceBlockingStub> {
    private SSHKeyServiceBlockingStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected SSHKeyServiceBlockingStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new SSHKeyServiceBlockingStub(channel, callOptions);
    }

    /**
     */
    public io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairResponse createSSHKeyPair(io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getCreateSSHKeyPairMethod(), getCallOptions(), request);
    }
  }

  /**
   */
  public static final class SSHKeyServiceFutureStub extends io.grpc.stub.AbstractFutureStub<SSHKeyServiceFutureStub> {
    private SSHKeyServiceFutureStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected SSHKeyServiceFutureStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new SSHKeyServiceFutureStub(channel, callOptions);
    }

    /**
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairResponse> createSSHKeyPair(
        io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getCreateSSHKeyPairMethod(), getCallOptions()), request);
    }
  }

  private static final int METHODID_CREATE_SSHKEY_PAIR = 0;

  private static final class MethodHandlers<Req, Resp> implements
      io.grpc.stub.ServerCalls.UnaryMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ServerStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ClientStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.BidiStreamingMethod<Req, Resp> {
    private final SSHKeyServiceImplBase serviceImpl;
    private final int methodId;

    MethodHandlers(SSHKeyServiceImplBase serviceImpl, int methodId) {
      this.serviceImpl = serviceImpl;
      this.methodId = methodId;
    }

    @java.lang.Override
    @java.lang.SuppressWarnings("unchecked")
    public void invoke(Req request, io.grpc.stub.StreamObserver<Resp> responseObserver) {
      switch (methodId) {
        case METHODID_CREATE_SSHKEY_PAIR:
          serviceImpl.createSSHKeyPair((io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Sshkey.CreateSSHKeyPairResponse>) responseObserver);
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

  private static abstract class SSHKeyServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoFileDescriptorSupplier, io.grpc.protobuf.ProtoServiceDescriptorSupplier {
    SSHKeyServiceBaseDescriptorSupplier() {}

    @java.lang.Override
    public com.google.protobuf.Descriptors.FileDescriptor getFileDescriptor() {
      return io.gitpod.supervisor.api.Sshkey.getDescriptor();
    }

    @java.lang.Override
    public com.google.protobuf.Descriptors.ServiceDescriptor getServiceDescriptor() {
      return getFileDescriptor().findServiceByName("SSHKeyService");
    }
  }

  private static final class SSHKeyServiceFileDescriptorSupplier
      extends SSHKeyServiceBaseDescriptorSupplier {
    SSHKeyServiceFileDescriptorSupplier() {}
  }

  private static final class SSHKeyServiceMethodDescriptorSupplier
      extends SSHKeyServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoMethodDescriptorSupplier {
    private final String methodName;

    SSHKeyServiceMethodDescriptorSupplier(String methodName) {
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
      synchronized (SSHKeyServiceGrpc.class) {
        result = serviceDescriptor;
        if (result == null) {
          serviceDescriptor = result = io.grpc.ServiceDescriptor.newBuilder(SERVICE_NAME)
              .setSchemaDescriptor(new SSHKeyServiceFileDescriptorSupplier())
              .addMethod(getCreateSSHKeyPairMethod())
              .build();
        }
      }
    }
    return result;
  }
}
