// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.idemetrics.api;

import static io.grpc.MethodDescriptor.generateFullMethodName;

/**
 */
@javax.annotation.Generated(
    value = "by gRPC proto compiler (version 1.49.0)",
    comments = "Source: idemetrics.proto")
@io.grpc.stub.annotations.GrpcGenerated
public final class MetricsServiceGrpc {

  private MetricsServiceGrpc() {}

  public static final String SERVICE_NAME = "ide_metrics_api.MetricsService";

  // Static method descriptors that strictly reflect the proto.
  private static volatile io.grpc.MethodDescriptor<io.gitpod.idemetrics.api.Idemetrics.AddCounterRequest,
      io.gitpod.idemetrics.api.Idemetrics.AddCounterResponse> getAddCounterMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "AddCounter",
      requestType = io.gitpod.idemetrics.api.Idemetrics.AddCounterRequest.class,
      responseType = io.gitpod.idemetrics.api.Idemetrics.AddCounterResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.idemetrics.api.Idemetrics.AddCounterRequest,
      io.gitpod.idemetrics.api.Idemetrics.AddCounterResponse> getAddCounterMethod() {
    io.grpc.MethodDescriptor<io.gitpod.idemetrics.api.Idemetrics.AddCounterRequest, io.gitpod.idemetrics.api.Idemetrics.AddCounterResponse> getAddCounterMethod;
    if ((getAddCounterMethod = MetricsServiceGrpc.getAddCounterMethod) == null) {
      synchronized (MetricsServiceGrpc.class) {
        if ((getAddCounterMethod = MetricsServiceGrpc.getAddCounterMethod) == null) {
          MetricsServiceGrpc.getAddCounterMethod = getAddCounterMethod =
              io.grpc.MethodDescriptor.<io.gitpod.idemetrics.api.Idemetrics.AddCounterRequest, io.gitpod.idemetrics.api.Idemetrics.AddCounterResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "AddCounter"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.idemetrics.api.Idemetrics.AddCounterRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.idemetrics.api.Idemetrics.AddCounterResponse.getDefaultInstance()))
              .setSchemaDescriptor(new MetricsServiceMethodDescriptorSupplier("AddCounter"))
              .build();
        }
      }
    }
    return getAddCounterMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramRequest,
      io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramResponse> getObserveHistogramMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "ObserveHistogram",
      requestType = io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramRequest.class,
      responseType = io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramRequest,
      io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramResponse> getObserveHistogramMethod() {
    io.grpc.MethodDescriptor<io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramRequest, io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramResponse> getObserveHistogramMethod;
    if ((getObserveHistogramMethod = MetricsServiceGrpc.getObserveHistogramMethod) == null) {
      synchronized (MetricsServiceGrpc.class) {
        if ((getObserveHistogramMethod = MetricsServiceGrpc.getObserveHistogramMethod) == null) {
          MetricsServiceGrpc.getObserveHistogramMethod = getObserveHistogramMethod =
              io.grpc.MethodDescriptor.<io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramRequest, io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "ObserveHistogram"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramResponse.getDefaultInstance()))
              .setSchemaDescriptor(new MetricsServiceMethodDescriptorSupplier("ObserveHistogram"))
              .build();
        }
      }
    }
    return getObserveHistogramMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.idemetrics.api.Idemetrics.AddHistogramRequest,
      io.gitpod.idemetrics.api.Idemetrics.AddHistogramResponse> getAddHistogramMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "AddHistogram",
      requestType = io.gitpod.idemetrics.api.Idemetrics.AddHistogramRequest.class,
      responseType = io.gitpod.idemetrics.api.Idemetrics.AddHistogramResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.idemetrics.api.Idemetrics.AddHistogramRequest,
      io.gitpod.idemetrics.api.Idemetrics.AddHistogramResponse> getAddHistogramMethod() {
    io.grpc.MethodDescriptor<io.gitpod.idemetrics.api.Idemetrics.AddHistogramRequest, io.gitpod.idemetrics.api.Idemetrics.AddHistogramResponse> getAddHistogramMethod;
    if ((getAddHistogramMethod = MetricsServiceGrpc.getAddHistogramMethod) == null) {
      synchronized (MetricsServiceGrpc.class) {
        if ((getAddHistogramMethod = MetricsServiceGrpc.getAddHistogramMethod) == null) {
          MetricsServiceGrpc.getAddHistogramMethod = getAddHistogramMethod =
              io.grpc.MethodDescriptor.<io.gitpod.idemetrics.api.Idemetrics.AddHistogramRequest, io.gitpod.idemetrics.api.Idemetrics.AddHistogramResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "AddHistogram"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.idemetrics.api.Idemetrics.AddHistogramRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.idemetrics.api.Idemetrics.AddHistogramResponse.getDefaultInstance()))
              .setSchemaDescriptor(new MetricsServiceMethodDescriptorSupplier("AddHistogram"))
              .build();
        }
      }
    }
    return getAddHistogramMethod;
  }

  private static volatile io.grpc.MethodDescriptor<io.gitpod.idemetrics.api.Idemetrics.ReportErrorRequest,
      io.gitpod.idemetrics.api.Idemetrics.ReportErrorResponse> getReportErrorMethod;

  @io.grpc.stub.annotations.RpcMethod(
      fullMethodName = SERVICE_NAME + '/' + "reportError",
      requestType = io.gitpod.idemetrics.api.Idemetrics.ReportErrorRequest.class,
      responseType = io.gitpod.idemetrics.api.Idemetrics.ReportErrorResponse.class,
      methodType = io.grpc.MethodDescriptor.MethodType.UNARY)
  public static io.grpc.MethodDescriptor<io.gitpod.idemetrics.api.Idemetrics.ReportErrorRequest,
      io.gitpod.idemetrics.api.Idemetrics.ReportErrorResponse> getReportErrorMethod() {
    io.grpc.MethodDescriptor<io.gitpod.idemetrics.api.Idemetrics.ReportErrorRequest, io.gitpod.idemetrics.api.Idemetrics.ReportErrorResponse> getReportErrorMethod;
    if ((getReportErrorMethod = MetricsServiceGrpc.getReportErrorMethod) == null) {
      synchronized (MetricsServiceGrpc.class) {
        if ((getReportErrorMethod = MetricsServiceGrpc.getReportErrorMethod) == null) {
          MetricsServiceGrpc.getReportErrorMethod = getReportErrorMethod =
              io.grpc.MethodDescriptor.<io.gitpod.idemetrics.api.Idemetrics.ReportErrorRequest, io.gitpod.idemetrics.api.Idemetrics.ReportErrorResponse>newBuilder()
              .setType(io.grpc.MethodDescriptor.MethodType.UNARY)
              .setFullMethodName(generateFullMethodName(SERVICE_NAME, "reportError"))
              .setSampledToLocalTracing(true)
              .setRequestMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.idemetrics.api.Idemetrics.ReportErrorRequest.getDefaultInstance()))
              .setResponseMarshaller(io.grpc.protobuf.ProtoUtils.marshaller(
                  io.gitpod.idemetrics.api.Idemetrics.ReportErrorResponse.getDefaultInstance()))
              .setSchemaDescriptor(new MetricsServiceMethodDescriptorSupplier("reportError"))
              .build();
        }
      }
    }
    return getReportErrorMethod;
  }

  /**
   * Creates a new async stub that supports all call types for the service
   */
  public static MetricsServiceStub newStub(io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<MetricsServiceStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<MetricsServiceStub>() {
        @java.lang.Override
        public MetricsServiceStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new MetricsServiceStub(channel, callOptions);
        }
      };
    return MetricsServiceStub.newStub(factory, channel);
  }

  /**
   * Creates a new blocking-style stub that supports unary and streaming output calls on the service
   */
  public static MetricsServiceBlockingStub newBlockingStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<MetricsServiceBlockingStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<MetricsServiceBlockingStub>() {
        @java.lang.Override
        public MetricsServiceBlockingStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new MetricsServiceBlockingStub(channel, callOptions);
        }
      };
    return MetricsServiceBlockingStub.newStub(factory, channel);
  }

  /**
   * Creates a new ListenableFuture-style stub that supports unary calls on the service
   */
  public static MetricsServiceFutureStub newFutureStub(
      io.grpc.Channel channel) {
    io.grpc.stub.AbstractStub.StubFactory<MetricsServiceFutureStub> factory =
      new io.grpc.stub.AbstractStub.StubFactory<MetricsServiceFutureStub>() {
        @java.lang.Override
        public MetricsServiceFutureStub newStub(io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
          return new MetricsServiceFutureStub(channel, callOptions);
        }
      };
    return MetricsServiceFutureStub.newStub(factory, channel);
  }

  /**
   */
  public static abstract class MetricsServiceImplBase implements io.grpc.BindableService {

    /**
     */
    public void addCounter(io.gitpod.idemetrics.api.Idemetrics.AddCounterRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.idemetrics.api.Idemetrics.AddCounterResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getAddCounterMethod(), responseObserver);
    }

    /**
     */
    public void observeHistogram(io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getObserveHistogramMethod(), responseObserver);
    }

    /**
     */
    public void addHistogram(io.gitpod.idemetrics.api.Idemetrics.AddHistogramRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.idemetrics.api.Idemetrics.AddHistogramResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getAddHistogramMethod(), responseObserver);
    }

    /**
     */
    public void reportError(io.gitpod.idemetrics.api.Idemetrics.ReportErrorRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.idemetrics.api.Idemetrics.ReportErrorResponse> responseObserver) {
      io.grpc.stub.ServerCalls.asyncUnimplementedUnaryCall(getReportErrorMethod(), responseObserver);
    }

    @java.lang.Override public final io.grpc.ServerServiceDefinition bindService() {
      return io.grpc.ServerServiceDefinition.builder(getServiceDescriptor())
          .addMethod(
            getAddCounterMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.idemetrics.api.Idemetrics.AddCounterRequest,
                io.gitpod.idemetrics.api.Idemetrics.AddCounterResponse>(
                  this, METHODID_ADD_COUNTER)))
          .addMethod(
            getObserveHistogramMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramRequest,
                io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramResponse>(
                  this, METHODID_OBSERVE_HISTOGRAM)))
          .addMethod(
            getAddHistogramMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.idemetrics.api.Idemetrics.AddHistogramRequest,
                io.gitpod.idemetrics.api.Idemetrics.AddHistogramResponse>(
                  this, METHODID_ADD_HISTOGRAM)))
          .addMethod(
            getReportErrorMethod(),
            io.grpc.stub.ServerCalls.asyncUnaryCall(
              new MethodHandlers<
                io.gitpod.idemetrics.api.Idemetrics.ReportErrorRequest,
                io.gitpod.idemetrics.api.Idemetrics.ReportErrorResponse>(
                  this, METHODID_REPORT_ERROR)))
          .build();
    }
  }

  /**
   */
  public static final class MetricsServiceStub extends io.grpc.stub.AbstractAsyncStub<MetricsServiceStub> {
    private MetricsServiceStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected MetricsServiceStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new MetricsServiceStub(channel, callOptions);
    }

    /**
     */
    public void addCounter(io.gitpod.idemetrics.api.Idemetrics.AddCounterRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.idemetrics.api.Idemetrics.AddCounterResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getAddCounterMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     */
    public void observeHistogram(io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getObserveHistogramMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     */
    public void addHistogram(io.gitpod.idemetrics.api.Idemetrics.AddHistogramRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.idemetrics.api.Idemetrics.AddHistogramResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getAddHistogramMethod(), getCallOptions()), request, responseObserver);
    }

    /**
     */
    public void reportError(io.gitpod.idemetrics.api.Idemetrics.ReportErrorRequest request,
        io.grpc.stub.StreamObserver<io.gitpod.idemetrics.api.Idemetrics.ReportErrorResponse> responseObserver) {
      io.grpc.stub.ClientCalls.asyncUnaryCall(
          getChannel().newCall(getReportErrorMethod(), getCallOptions()), request, responseObserver);
    }
  }

  /**
   */
  public static final class MetricsServiceBlockingStub extends io.grpc.stub.AbstractBlockingStub<MetricsServiceBlockingStub> {
    private MetricsServiceBlockingStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected MetricsServiceBlockingStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new MetricsServiceBlockingStub(channel, callOptions);
    }

    /**
     */
    public io.gitpod.idemetrics.api.Idemetrics.AddCounterResponse addCounter(io.gitpod.idemetrics.api.Idemetrics.AddCounterRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getAddCounterMethod(), getCallOptions(), request);
    }

    /**
     */
    public io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramResponse observeHistogram(io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getObserveHistogramMethod(), getCallOptions(), request);
    }

    /**
     */
    public io.gitpod.idemetrics.api.Idemetrics.AddHistogramResponse addHistogram(io.gitpod.idemetrics.api.Idemetrics.AddHistogramRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getAddHistogramMethod(), getCallOptions(), request);
    }

    /**
     */
    public io.gitpod.idemetrics.api.Idemetrics.ReportErrorResponse reportError(io.gitpod.idemetrics.api.Idemetrics.ReportErrorRequest request) {
      return io.grpc.stub.ClientCalls.blockingUnaryCall(
          getChannel(), getReportErrorMethod(), getCallOptions(), request);
    }
  }

  /**
   */
  public static final class MetricsServiceFutureStub extends io.grpc.stub.AbstractFutureStub<MetricsServiceFutureStub> {
    private MetricsServiceFutureStub(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      super(channel, callOptions);
    }

    @java.lang.Override
    protected MetricsServiceFutureStub build(
        io.grpc.Channel channel, io.grpc.CallOptions callOptions) {
      return new MetricsServiceFutureStub(channel, callOptions);
    }

    /**
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.idemetrics.api.Idemetrics.AddCounterResponse> addCounter(
        io.gitpod.idemetrics.api.Idemetrics.AddCounterRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getAddCounterMethod(), getCallOptions()), request);
    }

    /**
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramResponse> observeHistogram(
        io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getObserveHistogramMethod(), getCallOptions()), request);
    }

    /**
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.idemetrics.api.Idemetrics.AddHistogramResponse> addHistogram(
        io.gitpod.idemetrics.api.Idemetrics.AddHistogramRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getAddHistogramMethod(), getCallOptions()), request);
    }

    /**
     */
    public com.google.common.util.concurrent.ListenableFuture<io.gitpod.idemetrics.api.Idemetrics.ReportErrorResponse> reportError(
        io.gitpod.idemetrics.api.Idemetrics.ReportErrorRequest request) {
      return io.grpc.stub.ClientCalls.futureUnaryCall(
          getChannel().newCall(getReportErrorMethod(), getCallOptions()), request);
    }
  }

  private static final int METHODID_ADD_COUNTER = 0;
  private static final int METHODID_OBSERVE_HISTOGRAM = 1;
  private static final int METHODID_ADD_HISTOGRAM = 2;
  private static final int METHODID_REPORT_ERROR = 3;

  private static final class MethodHandlers<Req, Resp> implements
      io.grpc.stub.ServerCalls.UnaryMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ServerStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.ClientStreamingMethod<Req, Resp>,
      io.grpc.stub.ServerCalls.BidiStreamingMethod<Req, Resp> {
    private final MetricsServiceImplBase serviceImpl;
    private final int methodId;

    MethodHandlers(MetricsServiceImplBase serviceImpl, int methodId) {
      this.serviceImpl = serviceImpl;
      this.methodId = methodId;
    }

    @java.lang.Override
    @java.lang.SuppressWarnings("unchecked")
    public void invoke(Req request, io.grpc.stub.StreamObserver<Resp> responseObserver) {
      switch (methodId) {
        case METHODID_ADD_COUNTER:
          serviceImpl.addCounter((io.gitpod.idemetrics.api.Idemetrics.AddCounterRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.idemetrics.api.Idemetrics.AddCounterResponse>) responseObserver);
          break;
        case METHODID_OBSERVE_HISTOGRAM:
          serviceImpl.observeHistogram((io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.idemetrics.api.Idemetrics.ObserveHistogramResponse>) responseObserver);
          break;
        case METHODID_ADD_HISTOGRAM:
          serviceImpl.addHistogram((io.gitpod.idemetrics.api.Idemetrics.AddHistogramRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.idemetrics.api.Idemetrics.AddHistogramResponse>) responseObserver);
          break;
        case METHODID_REPORT_ERROR:
          serviceImpl.reportError((io.gitpod.idemetrics.api.Idemetrics.ReportErrorRequest) request,
              (io.grpc.stub.StreamObserver<io.gitpod.idemetrics.api.Idemetrics.ReportErrorResponse>) responseObserver);
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

  private static abstract class MetricsServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoFileDescriptorSupplier, io.grpc.protobuf.ProtoServiceDescriptorSupplier {
    MetricsServiceBaseDescriptorSupplier() {}

    @java.lang.Override
    public com.google.protobuf.Descriptors.FileDescriptor getFileDescriptor() {
      return io.gitpod.idemetrics.api.Idemetrics.getDescriptor();
    }

    @java.lang.Override
    public com.google.protobuf.Descriptors.ServiceDescriptor getServiceDescriptor() {
      return getFileDescriptor().findServiceByName("MetricsService");
    }
  }

  private static final class MetricsServiceFileDescriptorSupplier
      extends MetricsServiceBaseDescriptorSupplier {
    MetricsServiceFileDescriptorSupplier() {}
  }

  private static final class MetricsServiceMethodDescriptorSupplier
      extends MetricsServiceBaseDescriptorSupplier
      implements io.grpc.protobuf.ProtoMethodDescriptorSupplier {
    private final String methodName;

    MetricsServiceMethodDescriptorSupplier(String methodName) {
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
      synchronized (MetricsServiceGrpc.class) {
        result = serviceDescriptor;
        if (result == null) {
          serviceDescriptor = result = io.grpc.ServiceDescriptor.newBuilder(SERVICE_NAME)
              .setSchemaDescriptor(new MetricsServiceFileDescriptorSupplier())
              .addMethod(getAddCounterMethod())
              .addMethod(getObserveHistogramMethod())
              .addMethod(getAddHistogramMethod())
              .addMethod(getReportErrorMethod())
              .build();
        }
      }
    }
    return result;
  }
}
