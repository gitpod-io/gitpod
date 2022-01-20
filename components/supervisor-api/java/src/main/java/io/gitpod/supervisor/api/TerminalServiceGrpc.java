// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.supervisor.api;

import static io.grpc.MethodDescriptor.generateFullMethodName;

/**
 */
@javax.annotation.Generated(
    value = "by gRPC proto compiler (version 1.41.0)",
    comments = "Source: terminal.proto")
@io.grpc.stub.annotations.GrpcGenerated
public final class TerminalServiceGrpc {

  private TerminalServiceGrpc() {}

  public static final String SERVICE_NAME = "supervisor.TerminalService";

  // Static method descriptors that strictly reflect the proto.
  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalRequest,
      io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalResponse> getOpenMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "Open",
      requestType = io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalRequest.class,
      responseType = io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalRequest,
      io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalResponse> getOpenMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalRequest, io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalResponse> getOpenMethod;
    if ((getOpenMethod = TerminalServiceGrpc.getOpenMethod) == null) {
      synchronized (TerminalServiceGrpc.class) {
        if ((getOpenMethod = TerminalServiceGrpc.getOpenMethod) == null) {
          TerminalServiceGrpc.getOpenMethod = getOpenMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalRequest, io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "Open"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalResponse.getDefaultInstance()))
              .setSchemaDescriptor(new TerminalServiceMethodDescriptorSupplier("Open"))
              .build();
        }
      }
    }
    return getOpenMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalRequest,
      io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalResponse> getShutdownMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "Shutdown",
      requestType = io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalRequest.class,
      responseType = io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalRequest,
      io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalResponse> getShutdownMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalRequest, io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalResponse> getShutdownMethod;
    if ((getShutdownMethod = TerminalServiceGrpc.getShutdownMethod) == null) {
      synchronized (TerminalServiceGrpc.class) {
        if ((getShutdownMethod = TerminalServiceGrpc.getShutdownMethod) == null) {
          TerminalServiceGrpc.getShutdownMethod = getShutdownMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalRequest, io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "Shutdown"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalResponse.getDefaultInstance()))
              .setSchemaDescriptor(new TerminalServiceMethodDescriptorSupplier("Shutdown"))
              .build();
        }
      }
    }
    return getShutdownMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.GetTerminalRequest,
      io.gitpod.supervisor.api.TerminalOuterClass.Terminal> getGetMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "Get",
      requestType = io.gitpod.supervisor.api.TerminalOuterClass.GetTerminalRequest.class,
      responseType = io.gitpod.supervisor.api.TerminalOuterClass.Terminal.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.GetTerminalRequest,
      io.gitpod.supervisor.api.TerminalOuterClass.Terminal> getGetMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.GetTerminalRequest, io.gitpod.supervisor.api.TerminalOuterClass.Terminal> getGetMethod;
    if ((getGetMethod = TerminalServiceGrpc.getGetMethod) == null) {
      synchronized (TerminalServiceGrpc.class) {
        if ((getGetMethod = TerminalServiceGrpc.getGetMethod) == null) {
          TerminalServiceGrpc.getGetMethod = getGetMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.TerminalOuterClass.GetTerminalRequest, io.gitpod.supervisor.api.TerminalOuterClass.Terminal>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "Get"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.TerminalOuterClass.GetTerminalRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.TerminalOuterClass.Terminal.getDefaultInstance()))
              .setSchemaDescriptor(new TerminalServiceMethodDescriptorSupplier("Get"))
              .build();
        }
      }
    }
    return getGetMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsRequest,
      io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsResponse> getListMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "List",
      requestType = io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsRequest.class,
      responseType = io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsRequest,
      io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsResponse> getListMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsRequest, io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsResponse> getListMethod;
    if ((getListMethod = TerminalServiceGrpc.getListMethod) == null) {
      synchronized (TerminalServiceGrpc.class) {
        if ((getListMethod = TerminalServiceGrpc.getListMethod) == null) {
          TerminalServiceGrpc.getListMethod = getListMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsRequest, io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "List"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsResponse.getDefaultInstance()))
              .setSchemaDescriptor(new TerminalServiceMethodDescriptorSupplier("List"))
              .build();
        }
      }
    }
    return getListMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.ListenTerminalRequest,
      io.gitpod.supervisor.api.TerminalOuterClass.ListenTerminalResponse> getListenMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "Listen",
      requestType = io.gitpod.supervisor.api.TerminalOuterClass.ListenTerminalRequest.class,
      responseType = io.gitpod.supervisor.api.TerminalOuterClass.ListenTerminalResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.SERVER_STREAMING)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.ListenTerminalRequest,
      io.gitpod.supervisor.api.TerminalOuterClass.ListenTerminalResponse> getListenMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.ListenTerminalRequest, io.gitpod.supervisor.api.TerminalOuterClass.ListenTerminalResponse> getListenMethod;
    if ((getListenMethod = TerminalServiceGrpc.getListenMethod) == null) {
      synchronized (TerminalServiceGrpc.class) {
        if ((getListenMethod = TerminalServiceGrpc.getListenMethod) == null) {
          TerminalServiceGrpc.getListenMethod = getListenMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.TerminalOuterClass.ListenTerminalRequest, io.gitpod.supervisor.api.TerminalOuterClass.ListenTerminalResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.SERVER_STREAMING)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "Listen"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.TerminalOuterClass.ListenTerminalRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.TerminalOuterClass.ListenTerminalResponse.getDefaultInstance()))
              .setSchemaDescriptor(new TerminalServiceMethodDescriptorSupplier("Listen"))
              .build();
        }
      }
    }
    return getListenMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalRequest,
      io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalResponse> getWriteMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "Write",
      requestType = io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalRequest.class,
      responseType = io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalRequest,
      io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalResponse> getWriteMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalRequest, io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalResponse> getWriteMethod;
    if ((getWriteMethod = TerminalServiceGrpc.getWriteMethod) == null) {
      synchronized (TerminalServiceGrpc.class) {
        if ((getWriteMethod = TerminalServiceGrpc.getWriteMethod) == null) {
          TerminalServiceGrpc.getWriteMethod = getWriteMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalRequest, io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "Write"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalResponse.getDefaultInstance()))
              .setSchemaDescriptor(new TerminalServiceMethodDescriptorSupplier("Write"))
              .build();
        }
      }
    }
    return getWriteMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeRequest,
      io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeResponse> getSetSizeMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "SetSize",
      requestType = io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeRequest.class,
      responseType = io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeRequest,
      io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeResponse> getSetSizeMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeRequest, io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeResponse> getSetSizeMethod;
    if ((getSetSizeMethod = TerminalServiceGrpc.getSetSizeMethod) == null) {
      synchronized (TerminalServiceGrpc.class) {
        if ((getSetSizeMethod = TerminalServiceGrpc.getSetSizeMethod) == null) {
          TerminalServiceGrpc.getSetSizeMethod = getSetSizeMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeRequest, io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "SetSize"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeResponse.getDefaultInstance()))
              .setSchemaDescriptor(new TerminalServiceMethodDescriptorSupplier("SetSize"))
              .build();
        }
      }
    }
    return getSetSizeMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleRequest,
      io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleResponse> getSetTitleMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "SetTitle",
      requestType = io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleRequest.class,
      responseType = io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleRequest,
      io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleResponse> getSetTitleMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleRequest, io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleResponse> getSetTitleMethod;
    if ((getSetTitleMethod = TerminalServiceGrpc.getSetTitleMethod) == null) {
      synchronized (TerminalServiceGrpc.class) {
        if ((getSetTitleMethod = TerminalServiceGrpc.getSetTitleMethod) == null) {
          TerminalServiceGrpc.getSetTitleMethod = getSetTitleMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleRequest, io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "SetTitle"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleResponse.getDefaultInstance()))
              .setSchemaDescriptor(new TerminalServiceMethodDescriptorSupplier("SetTitle"))
              .build();
        }
      }
    }
    return getSetTitleMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsRequest,
      io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsResponse> getUpdateAnnotationsMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "UpdateAnnotations",
      requestType = io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsRequest.class,
      responseType = io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsRequest,
      io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsResponse> getUpdateAnnotationsMethod() {
    io.grpc.MethodDescriptor<io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsRequest, io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsResponse> getUpdateAnnotationsMethod;
    if ((getUpdateAnnotationsMethod = TerminalServiceGrpc.getUpdateAnnotationsMethod) == null) {
      synchronized (TerminalServiceGrpc.class) {
        if ((getUpdateAnnotationsMethod = TerminalServiceGrpc.getUpdateAnnotationsMethod) == null) {
          TerminalServiceGrpc.getUpdateAnnotationsMethod = getUpdateAnnotationsMethod =
              io.grpc.MethodDescriptor.<io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsRequest, io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "UpdateAnnotations"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsResponse.getDefaultInstance()))
              .setSchemaDescriptor(new TerminalServiceMethodDescriptorSupplier("UpdateAnnotations"))
              .build();
        }
      }
    }
    return getUpdateAnnotationsMethod;
  }

  /**
   * Creates a new async stub that supports all call types for the service
   */
  public static TerminalServiceStub newStub(io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<TerminalServiceStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<TerminalServiceStub>() {
        @java.lang.Override
        public TerminalServiceStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new TerminalServiceStub(channel, callOptions);
        }
      };
    return TerminalServiceStub.newStub(factory, channel);
  }

  /**
   * Creates a new blocking-style stub that supports unary and streaming output calls on the service
   */
  public static TerminalServiceBlockingStub newBlockingStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<TerminalServiceBlockingStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<TerminalServiceBlockingStub>() {
        @java.lang.Override
        public TerminalServiceBlockingStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new TerminalServiceBlockingStub(channel, callOptions);
        }
      };
    return TerminalServiceBlockingStub.newStub(factory, channel);
  }

  /**
   * Creates a new ListenableFuture-style stub that supports unary calls on the service
   */
  public static TerminalServiceFutureStub newFutureStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<TerminalServiceFutureStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<TerminalServiceFutureStub>() {
        @java.lang.Override
        public TerminalServiceFutureStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new TerminalServiceFutureStub(channel, callOptions);
        }
      };
    return TerminalServiceFutureStub.newStub(factory, channel);
  }

  /**
   */
  public static abstract class TerminalServiceImplBase implements io.grpc.BindableService {

    /**
     * <pre>
     * Open opens a new terminal running the login shell
     * </pre>
     */
    public void open(io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getOpenMethod(), responseObserver);
    }

    /**
     * <pre>
     * Shutdown closes a terminal for the given alias, SIGKILL'ing all child processes
     * before closing the pseudo-terminal.
     * </pre>
     */
    public void shutdown(io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getShutdownMethod(), responseObserver);
    }

    /**
     * <pre>
     * Get returns an opened terminal info
     * </pre>
     */
    public void get(io.gitpod.supervisor.api.TerminalOuterClass.GetTerminalRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.Terminal> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getGetMethod(), responseObserver);
    }

    /**
     * <pre>
     * List lists all open terminals
     * </pre>
     */
    public void list(io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getListMethod(), responseObserver);
    }

    /**
     * <pre>
     * Listen listens to a terminal
     * </pre>
     */
    public void listen(io.gitpod.supervisor.api.TerminalOuterClass.ListenTerminalRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.ListenTerminalResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getListenMethod(), responseObserver);
    }

    /**
     * <pre>
     * Write writes to a terminal
     * </pre>
     */
    public void write(io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getWriteMethod(), responseObserver);
    }

    /**
     * <pre>
     * SetSize sets the terminal's size
     * </pre>
     */
    public void setSize(io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getSetSizeMethod(), responseObserver);
    }

    /**
     * <pre>
     * SetTitle sets the terminal's title
     * </pre>
     */
    public void setTitle(io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getSetTitleMethod(), responseObserver);
    }

    /**
     * <pre>
     * UpdateAnnotations updates the terminal's annotations
     * </pre>
     */
    public void updateAnnotations(io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getUpdateAnnotationsMethod(), responseObserver);
    }

    @java.lang.Override public final io.grpc.ServerServiceDefinition bindService() {
      return io.grpc.ServerServiceDefinition.builder(getServiceDescriptor())
          .addMethod(
            getOpenMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalRequest,
                io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalResponse>(
                  this, METHODID_OPEN)))
          .addMethod(
            getShutdownMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalRequest,
                io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalResponse>(
                  this, METHODID_SHUTDOWN)))
          .addMethod(
            getGetMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.TerminalOuterClass.GetTerminalRequest,
                io.gitpod.supervisor.api.TerminalOuterClass.Terminal>(
                  this, METHODID_GET)))
          .addMethod(
            getListMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsRequest,
                io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsResponse>(
                  this, METHODID_LIST)))
          .addMethod(
            getListenMethod(),
            io.grpc.stub.ServerCalls.asyncServerStreamingCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.TerminalOuterClass.ListenTerminalRequest,
                io.gitpod.supervisor.api.TerminalOuterClass.ListenTerminalResponse>(
                  this, METHODID_LISTEN)))
          .addMethod(
            getWriteMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalRequest,
                io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalResponse>(
                  this, METHODID_WRITE)))
          .addMethod(
            getSetSizeMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeRequest,
                io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeResponse>(
                  this, METHODID_SET_SIZE)))
          .addMethod(
            getSetTitleMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleRequest,
                io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleResponse>(
                  this, METHODID_SET_TITLE)))
          .addMethod(
            getUpdateAnnotationsMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsRequest,
                io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsResponse>(
                  this, METHODID_UPDATE_ANNOTATIONS)))
          .build();
    }
  }

  /**
   */
  public static final class TerminalServiceStub extends io.grpc.stub.AbstractAsyncStub<TerminalServiceStub> {
    private TerminalServiceStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected TerminalServiceStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new TerminalServiceStub(channel, callOptions);
    }

    /**
     * <pre>
     * Open opens a new terminal running the login shell
     * </pre>
     */
    public void open(io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getOpenMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * Shutdown closes a terminal for the given alias, SIGKILL'ing all child processes
     * before closing the pseudo-terminal.
     * </pre>
     */
    public void shutdown(io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getShutdownMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * Get returns an opened terminal info
     * </pre>
     */
    public void get(io.gitpod.supervisor.api.TerminalOuterClass.GetTerminalRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.Terminal> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getGetMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * List lists all open terminals
     * </pre>
     */
    public void list(io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getListMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * Listen listens to a terminal
     * </pre>
     */
    public void listen(io.gitpod.supervisor.api.TerminalOuterClass.ListenTerminalRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.ListenTerminalResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncServerStreamingCall(
          getChannel().newCall(getListenMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * Write writes to a terminal
     * </pre>
     */
    public void write(io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getWriteMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * SetSize sets the terminal's size
     * </pre>
     */
    public void setSize(io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getSetSizeMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * SetTitle sets the terminal's title
     * </pre>
     */
    public void setTitle(io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getSetTitleMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     * <pre>
     * UpdateAnnotations updates the terminal's annotations
     * </pre>
     */
    public void updateAnnotations(io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getUpdateAnnotationsMethod(), getCallOptions()), request, responseObserver);
    }
  }

  /**
   */
  public static final class TerminalServiceBlockingStub extends io.grpc.stub.AbstractBlockingStub<TerminalServiceBlockingStub> {
    private TerminalServiceBlockingStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected TerminalServiceBlockingStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new TerminalServiceBlockingStub(channel, callOptions);
    }

    /**
     * <pre>
     * Open opens a new terminal running the login shell
     * </pre>
     */
    public io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalResponse open(io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getOpenMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * Shutdown closes a terminal for the given alias, SIGKILL'ing all child processes
     * before closing the pseudo-terminal.
     * </pre>
     */
    public io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalResponse shutdown(io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getShutdownMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * Get returns an opened terminal info
     * </pre>
     */
    public io.gitpod.supervisor.api.TerminalOuterClass.Terminal get(io.gitpod.supervisor.api.TerminalOuterClass.GetTerminalRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getGetMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * List lists all open terminals
     * </pre>
     */
    public io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsResponse list(io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getListMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * Listen listens to a terminal
     * </pre>
     */
    public java.util.Iterator<io.gitpod.supervisor.api.TerminalOuterClass.ListenTerminalResponse> listen(
        io.gitpod.supervisor.api.TerminalOuterClass.ListenTerminalRequest request) {
      return io.grpc.stub.ClientCalls.blockingServerStreamingCall(
          getChannel(), getListenMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * Write writes to a terminal
     * </pre>
     */
    public io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalResponse write(io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getWriteMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * SetSize sets the terminal's size
     * </pre>
     */
    public io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeResponse setSize(io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getSetSizeMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * SetTitle sets the terminal's title
     * </pre>
     */
    public io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleResponse setTitle(io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getSetTitleMethod(), getCallOptions(), request);
    }

    /**
     * <pre>
     * UpdateAnnotations updates the terminal's annotations
     * </pre>
     */
    public io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsResponse updateAnnotations(io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getUpdateAnnotationsMethod(), getCallOptions(), request);
    }
  }

  /**
   */
  public static final class TerminalServiceFutureStub extends io.grpc.stub.AbstractFutureStub<TerminalServiceFutureStub> {
    private TerminalServiceFutureStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected TerminalServiceFutureStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new TerminalServiceFutureStub(channel, callOptions);
    }

    /**
     * <pre>
     * Open opens a new terminal running the login shell
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalResponse> open(
        io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getOpenMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * Shutdown closes a terminal for the given alias, SIGKILL'ing all child processes
     * before closing the pseudo-terminal.
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalResponse> shutdown(
        io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getShutdownMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * Get returns an opened terminal info
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.TerminalOuterClass.Terminal> get(
        io.gitpod.supervisor.api.TerminalOuterClass.GetTerminalRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getGetMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * List lists all open terminals
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsResponse> list(
        io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getListMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * Write writes to a terminal
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalResponse> write(
        io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getWriteMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * SetSize sets the terminal's size
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeResponse> setSize(
        io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getSetSizeMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * SetTitle sets the terminal's title
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleResponse> setTitle(
        io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getSetTitleMethod(), getCallOptions()), request);
    }

    /**
     * <pre>
     * UpdateAnnotations updates the terminal's annotations
     * </pre>
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsResponse> updateAnnotations(
        io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getUpdateAnnotationsMethod(), getCallOptions()), request);
    }
  }

  private static final int METHODID_OPEN = 0;
  private static final int METHODID_SHUTDOWN = 1;
  private static final int METHODID_GET = 2;
  private static final int METHODID_LIST = 3;
  private static final int METHODID_LISTEN = 4;
  private static final int METHODID_WRITE = 5;
  private static final int METHODID_SET_SIZE = 6;
  private static final int METHODID_SET_TITLE = 7;
  private static final int METHODID_UPDATE_ANNOTATIONS = 8;

  private static final class MethodHandlers<Req, Resp> implements
      io.grpc.stub.ServerCalls.UnaryMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ServerStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ClientStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.BidiStreamingMethod<Req, Resp> {
    private final TerminalServiceImplBase serviceImpl;
    private final int methodId;

    MethodHandlers(TerminalServiceImplBase serviceImpl, int methodId) {
      this.serviceImpl = serviceImpl;
      this.methodId = methodId;
    }

    @java.lang.Override
    @java.lang.SuppressWarnings("unchecked")
    public void invoke(Req request, io.grpc.stub.StreamObserver<Resp> responseObserver) {
      switch (methodId) {
        case METHODID_OPEN:
          serviceImpl.open((io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.OpenTerminalResponse>) responseObserver);
          break;
        case METHODID_SHUTDOWN:
          serviceImpl.shutdown((io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.ShutdownTerminalResponse>) responseObserver);
          break;
        case METHODID_GET:
          serviceImpl.get((io.gitpod.supervisor.api.TerminalOuterClass.GetTerminalRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.Terminal>) responseObserver);
          break;
        case METHODID_LIST:
          serviceImpl.list((io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.ListTerminalsResponse>) responseObserver);
          break;
        case METHODID_LISTEN:
          serviceImpl.listen((io.gitpod.supervisor.api.TerminalOuterClass.ListenTerminalRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.ListenTerminalResponse>) responseObserver);
          break;
        case METHODID_WRITE:
          serviceImpl.write((io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.WriteTerminalResponse>) responseObserver);
          break;
        case METHODID_SET_SIZE:
          serviceImpl.setSize((io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalSizeResponse>) responseObserver);
          break;
        case METHODID_SET_TITLE:
          serviceImpl.setTitle((io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.SetTerminalTitleResponse>) responseObserver);
          break;
        case METHODID_UPDATE_ANNOTATIONS:
          serviceImpl.updateAnnotations((io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.supervisor.api.TerminalOuterClass.UpdateTerminalAnnotationsResponse>) responseObserver);
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

  private static abstract class TerminalServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoFileDescriptorSupplier, io.grpc.protobuf.ProtoServiceDescriptorSupplier {
    TerminalServiceBaseDescriptorSupplier() {}

    @java.lang.Override
    public com.google.protobuf.Descriptors.FileDescriptor getFileDescriptor() {
      return io.gitpod.supervisor.api.TerminalOuterClass.getDescriptor();
    }

    @java.lang.Override
    public com.google.protobuf.Descriptors.ServiceDescriptor getServiceDescriptor() {
      return getFileDescriptor().findServiceByName("TerminalService");
    }
  }

  private static final class TerminalServiceFileDescriptorSupplier
      extends TerminalServiceBaseDescriptorSupplier {
    TerminalServiceFileDescriptorSupplier() {}
  }

  private static final class TerminalServiceMethodDescriptorSupplier
      extends TerminalServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoMethodDescriptorSupplier {
    private final String methodName;

    TerminalServiceMethodDescriptorSupplier(String methodName) {
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
      synchronized (TerminalServiceGrpc.class) {
        result = serviceDescriptor;
        if (result == null) {
          serviceDescriptor = result = io.grpc.ServiceDescriptor.newBuilder(SERVICE_NAME)
              .setSchemaDescriptor(new TerminalServiceFileDescriptorSupplier())
              .addMethod(getOpenMethod())
              .addMethod(getShutdownMethod())
              .addMethod(getGetMethod())
              .addMethod(getListMethod())
              .addMethod(getListenMethod())
              .addMethod(getWriteMethod())
              .addMethod(getSetSizeMethod())
              .addMethod(getSetTitleMethod())
              .addMethod(getUpdateAnnotationsMethod())
              .build();
        }
      }
    }
    return result;
  }
}
