// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.supervisor.api;

import static io.grpc.MethodDescriptor.generateFullMethodName;

/**
 * <pre>
 * StatusService provides status feedback for the various in-workspace services.
 * </pre>
 */
@javax.annotation.Generated(
    value = "by gRPC proto compiler (version 1.40.1)",
    comments = "Source: status.proto")
@io.grpc.stub.annotations.GrpcGenerated
public final class StatusServiceGrpc {

  private StatusServiceGrpc() {}

  public static final String SERVICE_NAME = "supervisor.StatusService";

  // Static method descriptors that strictly reflect the proto.
  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Status.SupervisorStatusRequest,
      io.gitpod.supervisor.api.Status.SupervisorStatusResponse> getSupervisorStatusMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "SupervisorStatus",
      requestType = io.gitpod.supervisor.api.Status.SupervisorStatusRequest.class,
      responseType = io.gitpod.supervisor.api.Status.SupervisorStatusResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Status.SupervisorStatusRequest,
      io.gitpod.supervisor.api.Status.SupervisorStatusResponse> getSupervisorStatusMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Status.SupervisorStatusRequest, io.gitpod.supervisor.api.Status.SupervisorStatusResponse> getSupervisorStatusMethod;
    if ((getSupervisorStatusMethod = StatusServiceGrpc.getSupervisorStatusMethod) == null) {
      synchronized (StatusServiceGrpc.class) {
        if ((getSupervisorStatusMethod = StatusServiceGrpc.getSupervisorStatusMethod) == null) {
          StatusServiceGrpc.getSupervisorStatusMethod = getSupervisorStatusMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Status.SupervisorStatusRequest, io.gitpod.supervisor.api.Status.SupervisorStatusResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "SupervisorStatus"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Status.SupervisorStatusRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Status.SupervisorStatusResponse.getDefaultInstance()))
              .setSchemaDescriptor(new StatusServiceMethodDescriptorSupplier("SupervisorStatus"))
              .build();
        }
      }
    }
    return getSupervisorStatusMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Status.IDEStatusRequest,
      io.gitpod.supervisor.api.Status.IDEStatusResponse> getIDEStatusMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "IDEStatus",
      requestType = io.gitpod.supervisor.api.Status.IDEStatusRequest.class,
      responseType = io.gitpod.supervisor.api.Status.IDEStatusResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Status.IDEStatusRequest,
      io.gitpod.supervisor.api.Status.IDEStatusResponse> getIDEStatusMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Status.IDEStatusRequest, io.gitpod.supervisor.api.Status.IDEStatusResponse> getIDEStatusMethod;
    if ((getIDEStatusMethod = StatusServiceGrpc.getIDEStatusMethod) == null) {
      synchronized (StatusServiceGrpc.class) {
        if ((getIDEStatusMethod = StatusServiceGrpc.getIDEStatusMethod) == null) {
          StatusServiceGrpc.getIDEStatusMethod = getIDEStatusMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Status.IDEStatusRequest, io.gitpod.supervisor.api.Status.IDEStatusResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "IDEStatus"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Status.IDEStatusRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Status.IDEStatusResponse.getDefaultInstance()))
              .setSchemaDescriptor(new StatusServiceMethodDescriptorSupplier("IDEStatus"))
              .build();
        }
      }
    }
    return getIDEStatusMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Status.ContentStatusRequest,
      io.gitpod.supervisor.api.Status.ContentStatusResponse> getContentStatusMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "ContentStatus",
      requestType = io.gitpod.supervisor.api.Status.ContentStatusRequest.class,
      responseType = io.gitpod.supervisor.api.Status.ContentStatusResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Status.ContentStatusRequest,
      io.gitpod.supervisor.api.Status.ContentStatusResponse> getContentStatusMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Status.ContentStatusRequest, io.gitpod.supervisor.api.Status.ContentStatusResponse> getContentStatusMethod;
    if ((getContentStatusMethod = StatusServiceGrpc.getContentStatusMethod) == null) {
      synchronized (StatusServiceGrpc.class) {
        if ((getContentStatusMethod = StatusServiceGrpc.getContentStatusMethod) == null) {
          StatusServiceGrpc.getContentStatusMethod = getContentStatusMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Status.ContentStatusRequest, io.gitpod.supervisor.api.Status.ContentStatusResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "ContentStatus"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Status.ContentStatusRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Status.ContentStatusResponse.getDefaultInstance()))
              .setSchemaDescriptor(new StatusServiceMethodDescriptorSupplier("ContentStatus"))
              .build();
        }
      }
    }
    return getContentStatusMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Status.BackupStatusRequest,
      io.gitpod.supervisor.api.Status.BackupStatusResponse> getBackupStatusMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "BackupStatus",
      requestType = io.gitpod.supervisor.api.Status.BackupStatusRequest.class,
      responseType = io.gitpod.supervisor.api.Status.BackupStatusResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Status.BackupStatusRequest,
      io.gitpod.supervisor.api.Status.BackupStatusResponse> getBackupStatusMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Status.BackupStatusRequest, io.gitpod.supervisor.api.Status.BackupStatusResponse> getBackupStatusMethod;
    if ((getBackupStatusMethod = StatusServiceGrpc.getBackupStatusMethod) == null) {
      synchronized (StatusServiceGrpc.class) {
        if ((getBackupStatusMethod = StatusServiceGrpc.getBackupStatusMethod) == null) {
          StatusServiceGrpc.getBackupStatusMethod = getBackupStatusMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Status.BackupStatusRequest, io.gitpod.supervisor.api.Status.BackupStatusResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "BackupStatus"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Status.BackupStatusRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Status.BackupStatusResponse.getDefaultInstance()))
              .setSchemaDescriptor(new StatusServiceMethodDescriptorSupplier("BackupStatus"))
              .build();
        }
      }
    }
    return getBackupStatusMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Status.PortsStatusRequest,
      io.gitpod.supervisor.api.Status.PortsStatusResponse> getPortsStatusMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "PortsStatus",
      requestType = io.gitpod.supervisor.api.Status.PortsStatusRequest.class,
      responseType = io.gitpod.supervisor.api.Status.PortsStatusResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.SERVER_STREAMING)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Status.PortsStatusRequest,
      io.gitpod.supervisor.api.Status.PortsStatusResponse> getPortsStatusMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Status.PortsStatusRequest, io.gitpod.supervisor.api.Status.PortsStatusResponse> getPortsStatusMethod;
    if ((getPortsStatusMethod = StatusServiceGrpc.getPortsStatusMethod) == null) {
      synchronized (StatusServiceGrpc.class) {
        if ((getPortsStatusMethod = StatusServiceGrpc.getPortsStatusMethod) == null) {
          StatusServiceGrpc.getPortsStatusMethod = getPortsStatusMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Status.PortsStatusRequest, io.gitpod.supervisor.api.Status.PortsStatusResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.SERVER_STREAMING)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "PortsStatus"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Status.PortsStatusRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Status.PortsStatusResponse.getDefaultInstance()))
              .setSchemaDescriptor(new StatusServiceMethodDescriptorSupplier("PortsStatus"))
              .build();
        }
      }
    }
    return getPortsStatusMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Status.TasksStatusRequest,
      io.gitpod.supervisor.api.Status.TasksStatusResponse> getTasksStatusMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "TasksStatus",
      requestType = io.gitpod.supervisor.api.Status.TasksStatusRequest.class,
      responseType = io.gitpod.supervisor.api.Status.TasksStatusResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.SERVER_STREAMING)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Status.TasksStatusRequest,
      io.gitpod.supervisor.api.Status.TasksStatusResponse> getTasksStatusMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Status.TasksStatusRequest, io.gitpod.supervisor.api.Status.TasksStatusResponse> getTasksStatusMethod;
    if ((getTasksStatusMethod = StatusServiceGrpc.getTasksStatusMethod) == null) {
      synchronized (StatusServiceGrpc.class) {
        if ((getTasksStatusMethod = StatusServiceGrpc.getTasksStatusMethod) == null) {
          StatusServiceGrpc.getTasksStatusMethod = getTasksStatusMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Status.TasksStatusRequest, io.gitpod.supervisor.api.Status.TasksStatusResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.SERVER_STREAMING)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "TasksStatus"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Status.TasksStatusRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Status.TasksStatusResponse.getDefaultInstance()))
              .setSchemaDescriptor(new StatusServiceMethodDescriptorSupplier("TasksStatus"))
              .build();
        }
      }
    }
    return getTasksStatusMethod;
  }

  /**
   * Creates a new async stub that supports all call types for the service
   */
  public static StatusServiceStub newStub(io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<StatusServiceStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<StatusServiceStub>() {
        @java.lang.Override
        public StatusServiceStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new StatusServiceStub(channel, callOptions);
        }
      };
    return StatusServiceStub.newStub(factory, channel);
  }

  /**
   * Creates a new blocking-style stub that supports unary and streaming output calls on the service
   */
  public static StatusServiceBlockingStub newBlockingStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<StatusServiceBlockingStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<StatusServiceBlockingStub>() {
        @java.lang.Override
        public StatusServiceBlockingStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new StatusServiceBlockingStub(channel, callOptions);
        }
      };
    return StatusServiceBlockingStub.newStub(factory, channel);
  }

  /**
   * Creates a new ListenableFuture-style stub that supports unary calls on the service
   */
  public static StatusServiceFutureStub newFutureStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<StatusServiceFutureStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<StatusServiceFutureStub>() {
        @java.lang.Override
        public StatusServiceFutureStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new StatusServiceFutureStub(channel, callOptions);
        }
      };
    return StatusServiceFutureStub.newStub(factory, channel);
  }

  /**
   * <pre>
   * StatusService provides status feedback for the various in-workspace services.
   * </pre>
   */
  public static abstract class StatusServiceImplBase implements io.grpc.BindableService {

    /**
     * <pre>
     * SupervisorStatus returns once supervisor is running.
     * </pre>
     */
    public void supervisorStatus(io.gitpod.supervisor.api.Status.SupervisorStatusRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Status.SupervisorStatusResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getSupervisorStatusMethod(), responseObserver);
    }

    /**
     * <pre>
     * IDEStatus returns OK if the IDE can serve requests.
     * </pre>
     */
    public void iDEStatus(io.gitpod.supervisor.api.Status.IDEStatusRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Status.IDEStatusResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getIDEStatusMethod(), responseObserver);
    }

    /**
     * <pre>
     * ContentStatus returns the status of the workspace content. When used with `wait`, the call
     * returns when the content has become available.
     * </pre>
     */
    public void contentStatus(io.gitpod.supervisor.api.Status.ContentStatusRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Status.ContentStatusResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getContentStatusMethod(), responseObserver);
    }

    /**
     * <pre>
     * BackupStatus offers feedback on the workspace backup status. This status information can
     * be relayed to the user to provide transparency as to how "safe" their files/content
     * data are w.r.t. to being lost.
     * </pre>
     */
    public void backupStatus(io.gitpod.supervisor.api.Status.BackupStatusRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Status.BackupStatusResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getBackupStatusMethod(), responseObserver);
    }

    /**
     * <pre>
     * PortsStatus provides feedback about the network ports currently in use.
     * </pre>
     */
    public void portsStatus(io.gitpod.supervisor.api.Status.PortsStatusRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Status.PortsStatusResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getPortsStatusMethod(), responseObserver);
    }

    /**
     * <pre>
     * TasksStatus provides tasks status information.
     * </pre>
     */
    public void tasksStatus(io.gitpod.supervisor.api.Status.TasksStatusRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Status.TasksStatusResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getTasksStatusMethod(), responseObserver);
    }

    @java.lang.Override public final io.grpc.ServerServiceDefinition bindService() {
      return io.grpc.ServerServiceDefinition.builder(getServiceDescriptor())
          .addMethod(
            getSupervisorStatusMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Status.SupervisorStatusRequest,
                io.gitpod.supervisor.api.Status.SupervisorStatusResponse>(
                  this, METHODID_SUPERVISOR_STATUS)))
          .addMethod(
            getIDEStatusMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Status.IDEStatusRequest,
                io.gitpod.supervisor.api.Status.IDEStatusResponse>(
                  this, METHODID_IDESTATUS)))
          .addMethod(
            getContentStatusMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Status.ContentStatusRequest,
                io.gitpod.supervisor.api.Status.ContentStatusResponse>(
                  this, METHODID_CONTENT_STATUS)))
          .addMethod(
            getBackupStatusMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Status.BackupStatusRequest,
                io.gitpod.supervisor.api.Status.BackupStatusResponse>(
                  this, METHODID_BACKUP_STATUS)))
          .addMethod(
            getPortsStatusMethod(),
            io.grpc.stub.ServerCalls.asyncServerStreamingCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Status.PortsStatusRequest,
                io.gitpod.supervisor.api.Status.PortsStatusResponse>(
                  this, METHODID_PORTS_STATUS)))
          .addMethod(
            getTasksStatusMethod(),
            io.grpc.stub.ServerCalls.asyncServerStreamingCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Status.TasksStatusRequest,
                io.gitpod.supervisor.api.Status.TasksStatusResponse>(
                  this, METHODID_TASKS_STATUS)))
          .build();
    }
  }

  /**
   * <pre>
   * StatusService provides status feedback for the various in-workspace services.
   * </pre>
   */
  public static final class StatusServiceStub extends io.grpc.stub.AbstractAsyncStub<StatusServiceStub> {
    private StatusServiceStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected StatusServiceStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new StatusServiceStub(channel, callOptions);
    }

    /**
     * <pre>
     * SupervisorStatus returns once supervisor is running.
     * </pre>
     */
    public void supervisorStatus(io.gitpod.supervisor.api.Status.SupervisorStatusRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Status.SupervisorStatusResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getSupervisorStatusMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * IDEStatus returns OK if the IDE can serve requests.
     * </pre>
     */
    public void iDEStatus(io.gitpod.supervisor.api.Status.IDEStatusRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Status.IDEStatusResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getIDEStatusMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * ContentStatus returns the status of the workspace content. When used with `wait`, the call
     * returns when the content has become available.
     * </pre>
     */
    public void contentStatus(io.gitpod.supervisor.api.Status.ContentStatusRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Status.ContentStatusResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getContentStatusMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * BackupStatus offers feedback on the workspace backup status. This status information can
     * be relayed to the user to provide transparency as to how "safe" their files/content
     * data are w.r.t. to being lost.
     * </pre>
     */
    public void backupStatus(io.gitpod.supervisor.api.Status.BackupStatusRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Status.BackupStatusResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getBackupStatusMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * PortsStatus provides feedback about the network ports currently in use.
     * </pre>
     */
    public void portsStatus(io.gitpod.supervisor.api.Status.PortsStatusRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Status.PortsStatusResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncServerStreamingCall(
          getChannel().newCall(getPortsStatusMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * TasksStatus provides tasks status information.
     * </pre>
     */
    public void tasksStatus(io.gitpod.supervisor.api.Status.TasksStatusRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Status.TasksStatusResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncServerStreamingCall(
          getChannel().newCall(getTasksStatusMethod(), getCallOptions()), request, responseObserver);
    }
  }

  /**
   * <pre>
   * StatusService provides status feedback for the various in-workspace services.
   * </pre>
   */
  public static final class StatusServiceBlockingStub extends io.grpc.stub.AbstractBlockingStub<StatusServiceBlockingStub> {
    private StatusServiceBlockingStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected StatusServiceBlockingStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new StatusServiceBlockingStub(channel, callOptions);
    }

    /**
     * <pre>
     * SupervisorStatus returns once supervisor is running.
     * </pre>
     */
    public io.gitpod.supervisor.api.Status.SupervisorStatusResponse supervisorStatus(io.gitpod.supervisor.api.Status.SupervisorStatusRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getSupervisorStatusMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * IDEStatus returns OK if the IDE can serve requests.
     * </pre>
     */
    public io.gitpod.supervisor.api.Status.IDEStatusResponse iDEStatus(io.gitpod.supervisor.api.Status.IDEStatusRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getIDEStatusMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * ContentStatus returns the status of the workspace content. When used with `wait`, the call
     * returns when the content has become available.
     * </pre>
     */
    public io.gitpod.supervisor.api.Status.ContentStatusResponse contentStatus(io.gitpod.supervisor.api.Status.ContentStatusRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getContentStatusMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * BackupStatus offers feedback on the workspace backup status. This status information can
     * be relayed to the user to provide transparency as to how "safe" their files/content
     * data are w.r.t. to being lost.
     * </pre>
     */
    public io.gitpod.supervisor.api.Status.BackupStatusResponse backupStatus(io.gitpod.supervisor.api.Status.BackupStatusRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getBackupStatusMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * PortsStatus provides feedback about the network ports currently in use.
     * </pre>
     */
    public java.util.Iterator<io.gitpod.supervisor.api.Status.PortsStatusResponse> portsStatus(
        io.gitpod.supervisor.api.Status.PortsStatusRequest request) {
      return io.grpc.stub.ClientCalls.blockingServerStreamingCall(
          getChannel(), getPortsStatusMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * TasksStatus provides tasks status information.
     * </pre>
     */
    public java.util.Iterator<io.gitpod.supervisor.api.Status.TasksStatusResponse> tasksStatus(
        io.gitpod.supervisor.api.Status.TasksStatusRequest request) {
      return io.grpc.stub.ClientCalls.blockingServerStreamingCall(
          getChannel(), getTasksStatusMethod(), getCallOptions(), request);
    }
  }

  /**
   * <pre>
   * StatusService provides status feedback for the various in-workspace services.
   * </pre>
   */
  public static final class StatusServiceFutureStub extends io.grpc.stub.AbstractFutureStub<StatusServiceFutureStub> {
    private StatusServiceFutureStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected StatusServiceFutureStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new StatusServiceFutureStub(channel, callOptions);
    }

    /**
     * <pre>
     * SupervisorStatus returns once supervisor is running.
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.Status.SupervisorStatusResponse> supervisorStatus(
        io.gitpod.supervisor.api.Status.SupervisorStatusRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getSupervisorStatusMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * IDEStatus returns OK if the IDE can serve requests.
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.Status.IDEStatusResponse> iDEStatus(
        io.gitpod.supervisor.api.Status.IDEStatusRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getIDEStatusMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * ContentStatus returns the status of the workspace content. When used with `wait`, the call
     * returns when the content has become available.
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.Status.ContentStatusResponse> contentStatus(
        io.gitpod.supervisor.api.Status.ContentStatusRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getContentStatusMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * BackupStatus offers feedback on the workspace backup status. This status information can
     * be relayed to the user to provide transparency as to how "safe" their files/content
     * data are w.r.t. to being lost.
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.Status.BackupStatusResponse> backupStatus(
        io.gitpod.supervisor.api.Status.BackupStatusRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getBackupStatusMethod(), getCallOptions()), request);
    }
  }

  private static final int METHODID_SUPERVISOR_STATUS = 0;
  private static final int METHODID_IDESTATUS = 1;
  private static final int METHODID_CONTENT_STATUS = 2;
  private static final int METHODID_BACKUP_STATUS = 3;
  private static final int METHODID_PORTS_STATUS = 4;
  private static final int METHODID_TASKS_STATUS = 5;

  private static final class MethodHandlers<Req, Resp> implements
      io.grpc.stub.ServerCalls.UnaryMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ServerStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ClientStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.BidiStreamingMethod<Req, Resp> {
    private final StatusServiceImplBase serviceImpl;
    private final int methodId;

    MethodHandlers(StatusServiceImplBase serviceImpl, int methodId) {
      this.serviceImpl = serviceImpl;
      this.methodId = methodId;
    }

    @java.lang.Override
    @java.lang.SuppressWarnings("unchecked")
    public void invoke(Req request, io.grpc.stub.StreamObserver<Resp> responseObserver) {
      switch (methodId) {
        case METHODID_SUPERVISOR_STATUS:
          serviceImpl.supervisorStatus((io.gitpod.supervisor.api.Status.SupervisorStatusRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Status.SupervisorStatusResponse>) responseObserver);
          break;
        case METHODID_IDESTATUS:
          serviceImpl.iDEStatus((io.gitpod.supervisor.api.Status.IDEStatusRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Status.IDEStatusResponse>) responseObserver);
          break;
        case METHODID_CONTENT_STATUS:
          serviceImpl.contentStatus((io.gitpod.supervisor.api.Status.ContentStatusRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Status.ContentStatusResponse>) responseObserver);
          break;
        case METHODID_BACKUP_STATUS:
          serviceImpl.backupStatus((io.gitpod.supervisor.api.Status.BackupStatusRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Status.BackupStatusResponse>) responseObserver);
          break;
        case METHODID_PORTS_STATUS:
          serviceImpl.portsStatus((io.gitpod.supervisor.api.Status.PortsStatusRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Status.PortsStatusResponse>) responseObserver);
          break;
        case METHODID_TASKS_STATUS:
          serviceImpl.tasksStatus((io.gitpod.supervisor.api.Status.TasksStatusRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Status.TasksStatusResponse>) responseObserver);
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

  private static abstract class StatusServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoFileDescriptorSupplier, io.grpc.protobuf.ProtoServiceDescriptorSupplier {
    StatusServiceBaseDescriptorSupplier() {}

    @java.lang.Override
    public com.google.protobuf.Descriptors.FileDescriptor getFileDescriptor() {
      return io.gitpod.supervisor.api.Status.getDescriptor();
    }

    @java.lang.Override
    public com.google.protobuf.Descriptors.ServiceDescriptor getServiceDescriptor() {
      return getFileDescriptor().findServiceByName("StatusService");
    }
  }

  private static final class StatusServiceFileDescriptorSupplier
      extends StatusServiceBaseDescriptorSupplier {
    StatusServiceFileDescriptorSupplier() {}
  }

  private static final class StatusServiceMethodDescriptorSupplier
      extends StatusServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoMethodDescriptorSupplier {
    private final String methodName;

    StatusServiceMethodDescriptorSupplier(String methodName) {
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
      synchronized (StatusServiceGrpc.class) {
        result = serviceDescriptor;
        if (result == null) {
          serviceDescriptor = result = io.grpc.ServiceDescriptor.newBuilder(SERVICE_NAME)
              .setSchemaDescriptor(new StatusServiceFileDescriptorSupplier())
              .addMethod(getSupervisorStatusMethod())
              .addMethod(getIDEStatusMethod())
              .addMethod(getContentStatusMethod())
              .addMethod(getBackupStatusMethod())
              .addMethod(getPortsStatusMethod())
              .addMethod(getTasksStatusMethod())
              .build();
        }
      }
    }
    return result;
  }
}
