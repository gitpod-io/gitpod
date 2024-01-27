// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.supervisor.api;

import static io.grpc.MethodDescriptor.generateFullMethodName;

/**
 * <pre>
 * Notification serivce allows external processes to notify the user and ask for
 * decisions.
 * </pre>
 */
@javax.annotation.Generated(
    value = "by gRPC proto compiler (version 1.49.0)",
    comments = "Source: notification.proto")
@io.grpc.stub.annotations.GrpcGenerated
public final class NotificationServiceGrpc {

  private NotificationServiceGrpc() {}

  public static final String SERVICE_NAME = "supervisor.NotificationService";

  // Static method descriptors that strictly reflect the proto.
  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Notification.NotifyRequest,
      io.gitpod.supervisor.api.Notification.NotifyResponse> getNotifyMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "Notify",
      requestType = io.gitpod.supervisor.api.Notification.NotifyRequest.class,
      responseType = io.gitpod.supervisor.api.Notification.NotifyResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Notification.NotifyRequest,
      io.gitpod.supervisor.api.Notification.NotifyResponse> getNotifyMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Notification.NotifyRequest, io.gitpod.supervisor.api.Notification.NotifyResponse> getNotifyMethod;
    if ((getNotifyMethod = NotificationServiceGrpc.getNotifyMethod) == null) {
      synchronized (NotificationServiceGrpc.class) {
        if ((getNotifyMethod = NotificationServiceGrpc.getNotifyMethod) == null) {
          NotificationServiceGrpc.getNotifyMethod = getNotifyMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Notification.NotifyRequest, io.gitpod.supervisor.api.Notification.NotifyResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "Notify"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Notification.NotifyRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Notification.NotifyResponse.getDefaultInstance()))
              .setSchemaDescriptor(new NotificationServiceMethodDescriptorSupplier("Notify"))
              .build();
        }
      }
    }
    return getNotifyMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Notification.SubscribeRequest,
      io.gitpod.supervisor.api.Notification.SubscribeResponse> getSubscribeMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "Subscribe",
      requestType = io.gitpod.supervisor.api.Notification.SubscribeRequest.class,
      responseType = io.gitpod.supervisor.api.Notification.SubscribeResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.SERVER_STREAMING)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Notification.SubscribeRequest,
      io.gitpod.supervisor.api.Notification.SubscribeResponse> getSubscribeMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Notification.SubscribeRequest, io.gitpod.supervisor.api.Notification.SubscribeResponse> getSubscribeMethod;
    if ((getSubscribeMethod = NotificationServiceGrpc.getSubscribeMethod) == null) {
      synchronized (NotificationServiceGrpc.class) {
        if ((getSubscribeMethod = NotificationServiceGrpc.getSubscribeMethod) == null) {
          NotificationServiceGrpc.getSubscribeMethod = getSubscribeMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Notification.SubscribeRequest, io.gitpod.supervisor.api.Notification.SubscribeResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.SERVER_STREAMING)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "Subscribe"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Notification.SubscribeRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Notification.SubscribeResponse.getDefaultInstance()))
              .setSchemaDescriptor(new NotificationServiceMethodDescriptorSupplier("Subscribe"))
              .build();
        }
      }
    }
    return getSubscribeMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Notification.RespondRequest,
      io.gitpod.supervisor.api.Notification.RespondResponse> getRespondMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "Respond",
      requestType = io.gitpod.supervisor.api.Notification.RespondRequest.class,
      responseType = io.gitpod.supervisor.api.Notification.RespondResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Notification.RespondRequest,
      io.gitpod.supervisor.api.Notification.RespondResponse> getRespondMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Notification.RespondRequest, io.gitpod.supervisor.api.Notification.RespondResponse> getRespondMethod;
    if ((getRespondMethod = NotificationServiceGrpc.getRespondMethod) == null) {
      synchronized (NotificationServiceGrpc.class) {
        if ((getRespondMethod = NotificationServiceGrpc.getRespondMethod) == null) {
          NotificationServiceGrpc.getRespondMethod = getRespondMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Notification.RespondRequest, io.gitpod.supervisor.api.Notification.RespondResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "Respond"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Notification.RespondRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Notification.RespondResponse.getDefaultInstance()))
              .setSchemaDescriptor(new NotificationServiceMethodDescriptorSupplier("Respond"))
              .build();
        }
      }
    }
    return getRespondMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Notification.SubscribeActiveRequest,
      io.gitpod.supervisor.api.Notification.SubscribeActiveResponse> getSubscribeActiveMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "SubscribeActive",
      requestType = io.gitpod.supervisor.api.Notification.SubscribeActiveRequest.class,
      responseType = io.gitpod.supervisor.api.Notification.SubscribeActiveResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.SERVER_STREAMING)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Notification.SubscribeActiveRequest,
      io.gitpod.supervisor.api.Notification.SubscribeActiveResponse> getSubscribeActiveMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Notification.SubscribeActiveRequest, io.gitpod.supervisor.api.Notification.SubscribeActiveResponse> getSubscribeActiveMethod;
    if ((getSubscribeActiveMethod = NotificationServiceGrpc.getSubscribeActiveMethod) == null) {
      synchronized (NotificationServiceGrpc.class) {
        if ((getSubscribeActiveMethod = NotificationServiceGrpc.getSubscribeActiveMethod) == null) {
          NotificationServiceGrpc.getSubscribeActiveMethod = getSubscribeActiveMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Notification.SubscribeActiveRequest, io.gitpod.supervisor.api.Notification.SubscribeActiveResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.SERVER_STREAMING)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "SubscribeActive"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Notification.SubscribeActiveRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Notification.SubscribeActiveResponse.getDefaultInstance()))
              .setSchemaDescriptor(new NotificationServiceMethodDescriptorSupplier("SubscribeActive"))
              .build();
        }
      }
    }
    return getSubscribeActiveMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Notification.NotifyActiveRequest,
      io.gitpod.supervisor.api.Notification.NotifyActiveResponse> getNotifyActiveMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "NotifyActive",
      requestType = io.gitpod.supervisor.api.Notification.NotifyActiveRequest.class,
      responseType = io.gitpod.supervisor.api.Notification.NotifyActiveResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Notification.NotifyActiveRequest,
      io.gitpod.supervisor.api.Notification.NotifyActiveResponse> getNotifyActiveMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Notification.NotifyActiveRequest, io.gitpod.supervisor.api.Notification.NotifyActiveResponse> getNotifyActiveMethod;
    if ((getNotifyActiveMethod = NotificationServiceGrpc.getNotifyActiveMethod) == null) {
      synchronized (NotificationServiceGrpc.class) {
        if ((getNotifyActiveMethod = NotificationServiceGrpc.getNotifyActiveMethod) == null) {
          NotificationServiceGrpc.getNotifyActiveMethod = getNotifyActiveMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Notification.NotifyActiveRequest, io.gitpod.supervisor.api.Notification.NotifyActiveResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "NotifyActive"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Notification.NotifyActiveRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Notification.NotifyActiveResponse.getDefaultInstance()))
              .setSchemaDescriptor(new NotificationServiceMethodDescriptorSupplier("NotifyActive"))
              .build();
        }
      }
    }
    return getNotifyActiveMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Notification.NotifyActiveRespondRequest,
      io.gitpod.supervisor.api.Notification.NotifyActiveRespondResponse> getNotifyActiveRespondMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "NotifyActiveRespond",
      requestType = io.gitpod.supervisor.api.Notification.NotifyActiveRespondRequest.class,
      responseType = io.gitpod.supervisor.api.Notification.NotifyActiveRespondResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Notification.NotifyActiveRespondRequest,
      io.gitpod.supervisor.api.Notification.NotifyActiveRespondResponse> getNotifyActiveRespondMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.Notification.NotifyActiveRespondRequest, io.gitpod.supervisor.api.Notification.NotifyActiveRespondResponse> getNotifyActiveRespondMethod;
    if ((getNotifyActiveRespondMethod = NotificationServiceGrpc.getNotifyActiveRespondMethod) == null) {
      synchronized (NotificationServiceGrpc.class) {
        if ((getNotifyActiveRespondMethod = NotificationServiceGrpc.getNotifyActiveRespondMethod) == null) {
          NotificationServiceGrpc.getNotifyActiveRespondMethod = getNotifyActiveRespondMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.Notification.NotifyActiveRespondRequest, io.gitpod.supervisor.api.Notification.NotifyActiveRespondResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "NotifyActiveRespond"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Notification.NotifyActiveRespondRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.Notification.NotifyActiveRespondResponse.getDefaultInstance()))
              .setSchemaDescriptor(new NotificationServiceMethodDescriptorSupplier("NotifyActiveRespond"))
              .build();
        }
      }
    }
    return getNotifyActiveRespondMethod;
  }

  /**
   * Creates a new async stub that supports all call types for the service
   */
  public static NotificationServiceStub newStub(io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<NotificationServiceStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<NotificationServiceStub>() {
        @java.lang.Override
        public NotificationServiceStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new NotificationServiceStub(channel, callOptions);
        }
      };
    return NotificationServiceStub.newStub(factory, channel);
  }

  /**
   * Creates a new blocking-style stub that supports unary and streaming output calls on the service
   */
  public static NotificationServiceBlockingStub newBlockingStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<NotificationServiceBlockingStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<NotificationServiceBlockingStub>() {
        @java.lang.Override
        public NotificationServiceBlockingStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new NotificationServiceBlockingStub(channel, callOptions);
        }
      };
    return NotificationServiceBlockingStub.newStub(factory, channel);
  }

  /**
   * Creates a new ListenableFuture-style stub that supports unary calls on the service
   */
  public static NotificationServiceFutureStub newFutureStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<NotificationServiceFutureStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<NotificationServiceFutureStub>() {
        @java.lang.Override
        public NotificationServiceFutureStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new NotificationServiceFutureStub(channel, callOptions);
        }
      };
    return NotificationServiceFutureStub.newStub(factory, channel);
  }

  /**
   * <pre>
   * Notification serivce allows external processes to notify the user and ask for
   * decisions.
   * </pre>
   */
  public static abstract class NotificationServiceImplBase implements io.grpc.BindableService {

    /**
     * <pre>
     * Prompts the user and asks for a decision. Typically called by some external
     * process. If the list of actions is empty this service returns immediately,
     * otherwise it blocks until the user has made their choice.
     * </pre>
     */
    public void notify(io.gitpod.supervisor.api.Notification.NotifyRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Notification.NotifyResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getNotifyMethod(), responseObserver);
    }

    /**
     * <pre>
     * Subscribe to notifications. Typically called by the IDE.
     * </pre>
     */
    public void subscribe(io.gitpod.supervisor.api.Notification.SubscribeRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Notification.SubscribeResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getSubscribeMethod(), responseObserver);
    }

    /**
     * <pre>
     * Report a user's choice as a response to a notification. Typically called by
     * the IDE.
     * </pre>
     */
    public void respond(io.gitpod.supervisor.api.Notification.RespondRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Notification.RespondResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getRespondMethod(), responseObserver);
    }

    /**
     * <pre>
     * Called by the IDE to inform supervisor about which is the latest client
     * actively used by the user. We consider active the last IDE with focus.
     * Only 1 stream is kept open at any given time. A new subscription
     * overrides the previous one, causing the stream to close.
     * Supervisor will respond with a stream to which the IDE will listen
     * waiting to receive actions to run, for example: `open` or `preview`
     * </pre>
     */
    public void subscribeActive(io.gitpod.supervisor.api.Notification.SubscribeActiveRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Notification.SubscribeActiveResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getSubscribeActiveMethod(), responseObserver);
    }

    /**
     * <pre>
     * Used by gp-cli to ask supervisor to request the active client
     * to run a given command (eg. open or preview)
     * </pre>
     */
    public void notifyActive(io.gitpod.supervisor.api.Notification.NotifyActiveRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Notification.NotifyActiveResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getNotifyActiveMethod(), responseObserver);
    }

    /**
     * <pre>
     * Used by the IDE to inform supervisor about the result (eg. success or
     * failure) of the action (eg. open or preview) requested via NotifyActive
     * </pre>
     */
    public void notifyActiveRespond(io.gitpod.supervisor.api.Notification.NotifyActiveRespondRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Notification.NotifyActiveRespondResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getNotifyActiveRespondMethod(), responseObserver);
    }

    @java.lang.Override public final io.grpc.ServerServiceDefinition bindService() {
      return io.grpc.ServerServiceDefinition.builder(getServiceDescriptor())
          .addMethod(
            getNotifyMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Notification.NotifyRequest,
                io.gitpod.supervisor.api.Notification.NotifyResponse>(
                  this, METHODID_NOTIFY)))
          .addMethod(
            getSubscribeMethod(),
            io.grpc.stub.ServerCalls.asyncServerStreamingCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Notification.SubscribeRequest,
                io.gitpod.supervisor.api.Notification.SubscribeResponse>(
                  this, METHODID_SUBSCRIBE)))
          .addMethod(
            getRespondMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Notification.RespondRequest,
                io.gitpod.supervisor.api.Notification.RespondResponse>(
                  this, METHODID_RESPOND)))
          .addMethod(
            getSubscribeActiveMethod(),
            io.grpc.stub.ServerCalls.asyncServerStreamingCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Notification.SubscribeActiveRequest,
                io.gitpod.supervisor.api.Notification.SubscribeActiveResponse>(
                  this, METHODID_SUBSCRIBE_ACTIVE)))
          .addMethod(
            getNotifyActiveMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Notification.NotifyActiveRequest,
                io.gitpod.supervisor.api.Notification.NotifyActiveResponse>(
                  this, METHODID_NOTIFY_ACTIVE)))
          .addMethod(
            getNotifyActiveRespondMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.Notification.NotifyActiveRespondRequest,
                io.gitpod.supervisor.api.Notification.NotifyActiveRespondResponse>(
                  this, METHODID_NOTIFY_ACTIVE_RESPOND)))
          .build();
    }
  }

  /**
   * <pre>
   * Notification serivce allows external processes to notify the user and ask for
   * decisions.
   * </pre>
   */
  public static final class NotificationServiceStub extends io.grpc.stub.AbstractAsyncStub<NotificationServiceStub> {
    private NotificationServiceStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected NotificationServiceStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new NotificationServiceStub(channel, callOptions);
    }

    /**
     * <pre>
     * Prompts the user and asks for a decision. Typically called by some external
     * process. If the list of actions is empty this service returns immediately,
     * otherwise it blocks until the user has made their choice.
     * </pre>
     */
    public void notify(io.gitpod.supervisor.api.Notification.NotifyRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Notification.NotifyResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getNotifyMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * Subscribe to notifications. Typically called by the IDE.
     * </pre>
     */
    public void subscribe(io.gitpod.supervisor.api.Notification.SubscribeRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Notification.SubscribeResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncServerStreamingCall(
          getChannel().newCall(getSubscribeMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * Report a user's choice as a response to a notification. Typically called by
     * the IDE.
     * </pre>
     */
    public void respond(io.gitpod.supervisor.api.Notification.RespondRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Notification.RespondResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getRespondMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * Called by the IDE to inform supervisor about which is the latest client
     * actively used by the user. We consider active the last IDE with focus.
     * Only 1 stream is kept open at any given time. A new subscription
     * overrides the previous one, causing the stream to close.
     * Supervisor will respond with a stream to which the IDE will listen
     * waiting to receive actions to run, for example: `open` or `preview`
     * </pre>
     */
    public void subscribeActive(io.gitpod.supervisor.api.Notification.SubscribeActiveRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Notification.SubscribeActiveResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncServerStreamingCall(
          getChannel().newCall(getSubscribeActiveMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * Used by gp-cli to ask supervisor to request the active client
     * to run a given command (eg. open or preview)
     * </pre>
     */
    public void notifyActive(io.gitpod.supervisor.api.Notification.NotifyActiveRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Notification.NotifyActiveResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getNotifyActiveMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * Used by the IDE to inform supervisor about the result (eg. success or
     * failure) of the action (eg. open or preview) requested via NotifyActive
     * </pre>
     */
    public void notifyActiveRespond(io.gitpod.supervisor.api.Notification.NotifyActiveRespondRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Notification.NotifyActiveRespondResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getNotifyActiveRespondMethod(), getCallOptions()), request, responseObserver);
    }
  }

  /**
   * <pre>
   * Notification serivce allows external processes to notify the user and ask for
   * decisions.
   * </pre>
   */
  public static final class NotificationServiceBlockingStub extends io.grpc.stub.AbstractBlockingStub<NotificationServiceBlockingStub> {
    private NotificationServiceBlockingStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected NotificationServiceBlockingStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new NotificationServiceBlockingStub(channel, callOptions);
    }

    /**
     * <pre>
     * Prompts the user and asks for a decision. Typically called by some external
     * process. If the list of actions is empty this service returns immediately,
     * otherwise it blocks until the user has made their choice.
     * </pre>
     */
    public io.gitpod.supervisor.api.Notification.NotifyResponse notify(io.gitpod.supervisor.api.Notification.NotifyRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getNotifyMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * Subscribe to notifications. Typically called by the IDE.
     * </pre>
     */
    public java.util.Iterator<io.gitpod.supervisor.api.Notification.SubscribeResponse> subscribe(
        io.gitpod.supervisor.api.Notification.SubscribeRequest request) {
      return io.grpc.stub.ClientCalls.blockingServerStreamingCall(
          getChannel(), getSubscribeMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * Report a user's choice as a response to a notification. Typically called by
     * the IDE.
     * </pre>
     */
    public io.gitpod.supervisor.api.Notification.RespondResponse respond(io.gitpod.supervisor.api.Notification.RespondRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getRespondMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * Called by the IDE to inform supervisor about which is the latest client
     * actively used by the user. We consider active the last IDE with focus.
     * Only 1 stream is kept open at any given time. A new subscription
     * overrides the previous one, causing the stream to close.
     * Supervisor will respond with a stream to which the IDE will listen
     * waiting to receive actions to run, for example: `open` or `preview`
     * </pre>
     */
    public java.util.Iterator<io.gitpod.supervisor.api.Notification.SubscribeActiveResponse> subscribeActive(
        io.gitpod.supervisor.api.Notification.SubscribeActiveRequest request) {
      return io.grpc.stub.ClientCalls.blockingServerStreamingCall(
          getChannel(), getSubscribeActiveMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * Used by gp-cli to ask supervisor to request the active client
     * to run a given command (eg. open or preview)
     * </pre>
     */
    public io.gitpod.supervisor.api.Notification.NotifyActiveResponse notifyActive(io.gitpod.supervisor.api.Notification.NotifyActiveRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getNotifyActiveMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * Used by the IDE to inform supervisor about the result (eg. success or
     * failure) of the action (eg. open or preview) requested via NotifyActive
     * </pre>
     */
    public io.gitpod.supervisor.api.Notification.NotifyActiveRespondResponse notifyActiveRespond(io.gitpod.supervisor.api.Notification.NotifyActiveRespondRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getNotifyActiveRespondMethod(), getCallOptions(), request);
    }
  }

  /**
   * <pre>
   * Notification serivce allows external processes to notify the user and ask for
   * decisions.
   * </pre>
   */
  public static final class NotificationServiceFutureStub extends io.grpc.stub.AbstractFutureStub<NotificationServiceFutureStub> {
    private NotificationServiceFutureStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected NotificationServiceFutureStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new NotificationServiceFutureStub(channel, callOptions);
    }

    /**
     * <pre>
     * Prompts the user and asks for a decision. Typically called by some external
     * process. If the list of actions is empty this service returns immediately,
     * otherwise it blocks until the user has made their choice.
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.Notification.NotifyResponse> notify(
        io.gitpod.supervisor.api.Notification.NotifyRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getNotifyMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * Report a user's choice as a response to a notification. Typically called by
     * the IDE.
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.Notification.RespondResponse> respond(
        io.gitpod.supervisor.api.Notification.RespondRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getRespondMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * Used by gp-cli to ask supervisor to request the active client
     * to run a given command (eg. open or preview)
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.Notification.NotifyActiveResponse> notifyActive(
        io.gitpod.supervisor.api.Notification.NotifyActiveRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getNotifyActiveMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * Used by the IDE to inform supervisor about the result (eg. success or
     * failure) of the action (eg. open or preview) requested via NotifyActive
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.Notification.NotifyActiveRespondResponse> notifyActiveRespond(
        io.gitpod.supervisor.api.Notification.NotifyActiveRespondRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getNotifyActiveRespondMethod(), getCallOptions()), request);
    }
  }

  private static final int METHODID_NOTIFY = 0;
  private static final int METHODID_SUBSCRIBE = 1;
  private static final int METHODID_RESPOND = 2;
  private static final int METHODID_SUBSCRIBE_ACTIVE = 3;
  private static final int METHODID_NOTIFY_ACTIVE = 4;
  private static final int METHODID_NOTIFY_ACTIVE_RESPOND = 5;

  private static final class MethodHandlers<Req, Resp> implements
      io.grpc.stub.ServerCalls.UnaryMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ServerStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ClientStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.BidiStreamingMethod<Req, Resp> {
    private final NotificationServiceImplBase serviceImpl;
    private final int methodId;

    MethodHandlers(NotificationServiceImplBase serviceImpl, int methodId) {
      this.serviceImpl = serviceImpl;
      this.methodId = methodId;
    }

    @java.lang.Override
    @java.lang.SuppressWarnings("unchecked")
    public void invoke(Req request, io.grpc.stub.StreamObserver<Resp> responseObserver) {
      switch (methodId) {
        case METHODID_NOTIFY:
          serviceImpl.notify((io.gitpod.supervisor.api.Notification.NotifyRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Notification.NotifyResponse>) responseObserver);
          break;
        case METHODID_SUBSCRIBE:
          serviceImpl.subscribe((io.gitpod.supervisor.api.Notification.SubscribeRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Notification.SubscribeResponse>) responseObserver);
          break;
        case METHODID_RESPOND:
          serviceImpl.respond((io.gitpod.supervisor.api.Notification.RespondRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Notification.RespondResponse>) responseObserver);
          break;
        case METHODID_SUBSCRIBE_ACTIVE:
          serviceImpl.subscribeActive((io.gitpod.supervisor.api.Notification.SubscribeActiveRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Notification.SubscribeActiveResponse>) responseObserver);
          break;
        case METHODID_NOTIFY_ACTIVE:
          serviceImpl.notifyActive((io.gitpod.supervisor.api.Notification.NotifyActiveRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Notification.NotifyActiveResponse>) responseObserver);
          break;
        case METHODID_NOTIFY_ACTIVE_RESPOND:
          serviceImpl.notifyActiveRespond((io.gitpod.supervisor.api.Notification.NotifyActiveRespondRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.Notification.NotifyActiveRespondResponse>) responseObserver);
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

  private static abstract class NotificationServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoFileDescriptorSupplier, io.grpc.protobuf.ProtoServiceDescriptorSupplier {
    NotificationServiceBaseDescriptorSupplier() {}

    @java.lang.Override
    public com.google.protobuf.Descriptors.FileDescriptor getFileDescriptor() {
      return io.gitpod.supervisor.api.Notification.getDescriptor();
    }

    @java.lang.Override
    public com.google.protobuf.Descriptors.ServiceDescriptor getServiceDescriptor() {
      return getFileDescriptor().findServiceByName("NotificationService");
    }
  }

  private static final class NotificationServiceFileDescriptorSupplier
      extends NotificationServiceBaseDescriptorSupplier {
    NotificationServiceFileDescriptorSupplier() {}
  }

  private static final class NotificationServiceMethodDescriptorSupplier
      extends NotificationServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoMethodDescriptorSupplier {
    private final String methodName;

    NotificationServiceMethodDescriptorSupplier(String methodName) {
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
      synchronized (NotificationServiceGrpc.class) {
        result = serviceDescriptor;
        if (result == null) {
          serviceDescriptor = result = io.grpc.ServiceDescriptor.newBuilder(SERVICE_NAME)
              .setSchemaDescriptor(new NotificationServiceFileDescriptorSupplier())
              .addMethod(getNotifyMethod())
              .addMethod(getSubscribeMethod())
              .addMethod(getRespondMethod())
              .addMethod(getSubscribeActiveMethod())
              .addMethod(getNotifyActiveMethod())
              .addMethod(getNotifyActiveRespondMethod())
              .build();
        }
      }
    }
    return result;
  }
}
