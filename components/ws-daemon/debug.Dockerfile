FROM golang:1.16-alpine AS debugger
RUN apk add --no-cache git
RUN go get -u github.com/go-delve/delve/cmd/dlv

FROM alpine:3.16

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache \
  && apk add --no-cache git bash openssh-client lz4 e2fsprogs wait4x

RUN apk add --no-cache kubectl --repository=http://dl-cdn.alpinelinux.org/alpine/edge/testing

ARG CLOUD_SDK_VERSION=388.0.0
ENV CLOUD_SDK_VERSION=$CLOUD_SDK_VERSION
ENV PATH /google-cloud-sdk/bin:$PATH

# Source: https://github.com/GoogleCloudPlatform/cloud-sdk-docker/blob/master/alpine/Dockerfile
RUN apk --no-cache add \
        curl \
        python3 \
        py3-crcmod \
        py3-openssl \
        bash \
        libc6-compat \
        openssh-client \
        git \
        gnupg \
    && curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-sdk-${CLOUD_SDK_VERSION}-linux-x86_64.tar.gz && \
    tar xzf google-cloud-sdk-${CLOUD_SDK_VERSION}-linux-x86_64.tar.gz && \
    rm google-cloud-sdk-${CLOUD_SDK_VERSION}-linux-x86_64.tar.gz && \
    gcloud config set core/disable_usage_reporting true && \
    gcloud config set component_manager/disable_update_check true && \
    gcloud config set metrics/environment github_docker_image && \
    gcloud --version

# Add gitpod user for operations (e.g. checkout because of the post-checkout hook!)
# RUN addgroup -g 33333 gitpod \
#     && adduser -D -h /home/gitpod -s /bin/sh -u 33333 -G gitpod gitpod \
#     && echo "gitpod:gitpod" | chpasswd

COPY --from=debugger /go/bin/dlv /usr/bin
COPY ws-daemond /app/ws-daemond
ENTRYPOINT [ "/app/ws-daemond" ]
CMD [ "-v", "help" ]
