// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.supervisor.api;

import static io.grpc.MethodDescriptor.generateFullMethodName;

/**
 */
@javax.annotation.Generated(
    value = "by gRPC proto compiler (version 1.49.0)",
    comments = "Source: task.proto")
@io.grpc.stub.annotations.GrpcGenerated
public final class TaskServiceGrpc {

  private TaskServiceGrpc() {}

  public static final String SERVICE_NAME = "supervisor.TaskService";

  // Static method descriptors that strictly reflect the proto.
  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Task.GetOutputRequest,
      io.gitpod.supervisor.api.Task.GetOutputResponse> getGetOutputMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "GetOutput",
      requestType = io.gitpod.supervisor.api.Task.GetOutputRequest.class,
      responseType = io.gitpod.supervisor.api.Task.GetOutputResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.SERVER_STREAMING)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Task.GetOutputRequest,
      io.gitpod.supervisor.api.Task.GetOutputResponse> getGetOutputMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Task.GetOutputRequest, io.gitpod.supervisor.api.Task.GetOutputResponse> getGetOutputMethod;
    if ((getGetOutputMethod = TaskServiceGrpc.getGetOutputMethod) == null) {
      synchronized (TaskServiceGrpc.class) {
        if ((getGetOutputMethod = TaskServiceGrpc.getGetOutputMethod) == null) {
          TaskServiceGrpc.getGetOutputMethod = getGetOutputMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Task.GetOutputRequest, io.gitpod.supervisor.api.Task.GetOutputResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.SERVER_STREAMING)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "GetOutput"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Task.GetOutputRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Task.GetOutputResponse.getDefaultInstance()))
              .setSchemaDescriptor(new TaskServiceMethodDescriptorSupplier("GetOutput"))
              .build();
        }
      }
    }
    return getGetOutputMethod;
  }

  /**
   * Creates a new async stub that supports all call types for the service
   */
  public static TaskServiceStub newStub(io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<TaskServiceStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<TaskServiceStub>() {
        @java.lang.Override
        public TaskServiceStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new TaskServiceStub(channel, callOptions);
        }
      };
    return TaskServiceStub.newStub(factory, channel);
  }

  /**
   * Creates a new blocking-style stub that supports unary and streaming output calls on the service
   */
  public static TaskServiceBlockingStub newBlockingStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<TaskServiceBlockingStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<TaskServiceBlockingStub>() {
        @java.lang.Override
        public TaskServiceBlockingStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new TaskServiceBlockingStub(channel, callOptions);
        }
      };
    return TaskServiceBlockingStub.newStub(factory, channel);
  }

  /**
   * Creates a new ListenableFuture-style stub that supports unary calls on the service
   */
  public static TaskServiceFutureStub newFutureStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<TaskServiceFutureStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<TaskServiceFutureStub>() {
        @java.lang.Override
        public TaskServiceFutureStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new TaskServiceFutureStub(channel, callOptions);
        }
      };
    return TaskServiceFutureStub.newStub(factory, channel);
  }

  /**
   */
  public static abstract class TaskServiceImplBase implements io.grpc.BindableService {

    /**
     * <pre>
     * Gets the output of a given task
     * </pre>
     */
    public void getOutput(io.gitpod.supervisor.api.Task.GetOutputRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Task.GetOutputResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getGetOutputMethod(), responseObserver);
    }

    @java.lang.Override public final io.grpc.ServerServiceDefinition bindService() {
      return io.grpc.ServerServiceDefinition.builder(getServiceDescriptor())
          .addMethod(
            getGetOutputMethod(),
            io.grpc.stub.ServerCalls.asyncServerStreamingCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Task.GetOutputRequest,
                io.gitpod.supervisor.api.Task.GetOutputResponse>(
                  this, METHODID_GET_OUTPUT)))
          .build();
    }
  }

  /**
   */
  public static final class TaskServiceStub extends io.grpc.stub.AbstractAsyncStub<TaskServiceStub> {
    private TaskServiceStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected TaskServiceStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new TaskServiceStub(channel, callOptions);
    }

    /**
     * <pre>
     * Gets the output of a given task
     * </pre>
     */
    public void getOutput(io.gitpod.supervisor.api.Task.GetOutputRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Task.GetOutputResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncServerStreamingCall(
          getChannel().newCall(getGetOutputMethod(), getCallOptions()), request, responseObserver);
    }
  }

  /**
   */
  public static final class TaskServiceBlockingStub extends io.grpc.stub.AbstractBlockingStub<TaskServiceBlockingStub> {
    private TaskServiceBlockingStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected TaskServiceBlockingStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new TaskServiceBlockingStub(channel, callOptions);
    }

    /**
     * <pre>
     * Gets the output of a given task
     * </pre>
     */
    public java.util.Iterator<io.gitpod.supervisor.api.Task.GetOutputResponse> getOutput(
        io.gitpod.supervisor.api.Task.GetOutputRequest request) {
      return io.grpc.stub.ClientCalls.blockingServerStreamingCall(
          getChannel(), getGetOutputMethod(), getCallOptions(), request);
    }
  }

  /**
   */
  public static final class TaskServiceFutureStub extends io.grpc.stub.AbstractFutureStub<TaskServiceFutureStub> {
    private TaskServiceFutureStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected TaskServiceFutureStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new TaskServiceFutureStub(channel, callOptions);
    }
  }

  private static final int METHODID_GET_OUTPUT = 0;

  private static final class MethodHandlers<Req, Resp> implements
      io.grpc.stub.ServerCalls.UnaryMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ServerStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ClientStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.BidiStreamingMethod<Req, Resp> {
    private final TaskServiceImplBase serviceImpl;
    private final int methodId;

    MethodHandlers(TaskServiceImplBase serviceImpl, int methodId) {
      this.serviceImpl = serviceImpl;
      this.methodId = methodId;
    }

    @java.lang.Override
    @java.lang.SuppressWarnings("unchecked")
    public void invoke(Req request, io.grpc.stub.StreamObserver<Resp> responseObserver) {
      switch (methodId) {
        case METHODID_GET_OUTPUT:
          serviceImpl.getOutput((io.gitpod.supervisor.api.Task.GetOutputRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Task.GetOutputResponse>) responseObserver);
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

  private static abstract class TaskServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoFileDescriptorSupplier, io.grpc.protobuf.ProtoServiceDescriptorSupplier {
    TaskServiceBaseDescriptorSupplier() {}

    @java.lang.Override
    public com.google.protobuf.Descriptors.FileDescriptor getFileDescriptor() {
      return io.gitpod.supervisor.api.Task.getDescriptor();
    }

    @java.lang.Override
    public com.google.protobuf.Descriptors.ServiceDescriptor getServiceDescriptor() {
      return getFileDescriptor().findServiceByName("TaskService");
    }
  }

  private static final class TaskServiceFileDescriptorSupplier
      extends TaskServiceBaseDescriptorSupplier {
    TaskServiceFileDescriptorSupplier() {}
  }

  private static final class TaskServiceMethodDescriptorSupplier
      extends TaskServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoMethodDescriptorSupplier {
    private final String methodName;

    TaskServiceMethodDescriptorSupplier(String methodName) {
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
      synchronized (TaskServiceGrpc.class) {
        result = serviceDescriptor;
        if (result == null) {
          serviceDescriptor = result = io.grpc.ServiceDescriptor.newBuilder(SERVICE_NAME)
              .setSchemaDescriptor(new TaskServiceFileDescriptorSupplier())
              .addMethod(getGetOutputMethod())
              .build();
        }
      }
    }
    return result;
  }
}
