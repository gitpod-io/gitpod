# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM golang:1.26.9-alpine AS buildkit-tool-builder

ARG BUILDKIT_VERSION=v0.20.1-gitpod.8
ARG BUILDKIT_REVISION=37c65868a73a80780ab4f2f5f302810471941d6f
ARG CNI_VERSION=v1.9.1
ARG RUNC_VERSION=v1.2.5

RUN apk add --no-cache ca-certificates gcc git libc-dev libseccomp-dev libseccomp-static

RUN mkdir -p /build/buildkit \
    && git -C /build/buildkit init \
    && git -C /build/buildkit remote add origin https://github.com/gitpod-io/buildkit.git \
    && git -C /build/buildkit fetch --depth 1 origin "${BUILDKIT_REVISION}" \
    && git -C /build/buildkit checkout --detach FETCH_HEAD
WORKDIR /build/buildkit
RUN go get golang.org/x/net@v0.60.0 \
    && go mod tidy \
    && ldflags="-s -w -X github.com/moby/buildkit/version.Version=${BUILDKIT_VERSION} -X github.com/moby/buildkit/version.Revision=${BUILDKIT_REVISION} -X github.com/moby/buildkit/version.Package=github.com/moby/buildkit" \
    && CGO_ENABLED=0 go build -mod=mod -trimpath -ldflags "${ldflags}" -o /out/buildctl ./cmd/buildctl \
    && CGO_ENABLED=0 go build -mod=mod -trimpath -tags "osusergo netgo static_build seccomp" -ldflags "${ldflags} -extldflags '-static'" -o /out/buildkitd ./cmd/buildkitd

RUN git clone --branch "${CNI_VERSION}" --depth 1 https://github.com/containernetworking/plugins.git /build/cni
WORKDIR /build/cni
RUN go get golang.org/x/net@v0.60.0 \
    && go mod tidy \
    && CGO_ENABLED=0 go build -mod=mod -trimpath -o /out/buildkit-cni-bridge ./plugins/main/bridge \
    && CGO_ENABLED=0 go build -mod=mod -trimpath -o /out/buildkit-cni-loopback ./plugins/main/loopback \
    && CGO_ENABLED=0 go build -mod=mod -trimpath -o /out/buildkit-cni-host-local ./plugins/ipam/host-local \
    && CGO_ENABLED=0 go build -mod=mod -trimpath -o /out/buildkit-cni-firewall ./plugins/meta/firewall

RUN git clone --branch "${RUNC_VERSION}" --depth 1 https://github.com/opencontainers/runc.git /build/runc
WORKDIR /build/runc
RUN go get golang.org/x/net@v0.60.0 \
    && go mod tidy \
    && runc_version_without_v="${RUNC_VERSION#v}" \
    && CGO_ENABLED=1 go build -mod=mod -trimpath \
        -tags "apparmor seccomp netgo cgo static_build osusergo" \
        -ldflags "-s -w -X main.version=${runc_version_without_v} -linkmode external -extldflags -static" \
        -o /out/buildkit-runc ./

FROM ghcr.io/gitpod-io/buildkit:v0.20.1-gitpod.8

USER root
RUN apk upgrade --no-cache curl libcurl libssl3 libcrypto3 \
    && apk upgrade --no-cache \
    && apk --no-cache add sudo bash \
    && addgroup -g 33333 gitpod \
    && adduser -D -h /home/gitpod -s /bin/sh -u 33333 -G gitpod gitpod \
    && echo "gitpod ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/gitpod \
    && chmod 0440 /etc/sudoers.d/gitpod

COPY --from=buildkit-tool-builder /out/buildctl /usr/bin/buildctl
COPY --from=buildkit-tool-builder /out/buildkitd /usr/bin/buildkitd
COPY --from=buildkit-tool-builder /out/buildkit-cni-bridge /usr/bin/buildkit-cni-bridge
COPY --from=buildkit-tool-builder /out/buildkit-cni-loopback /usr/bin/buildkit-cni-loopback
COPY --from=buildkit-tool-builder /out/buildkit-cni-host-local /usr/bin/buildkit-cni-host-local
COPY --from=buildkit-tool-builder /out/buildkit-cni-firewall /usr/bin/buildkit-cni-firewall
COPY --from=buildkit-tool-builder /out/buildkit-runc /usr/bin/buildkit-runc

COPY components-image-builder-bob--runc-facade/bob /app/runc-facade
RUN chmod 4755 /app/runc-facade \
    && mv /usr/bin/buildkit-runc /usr/bin/bob-runc \
    && mv /app/runc-facade /usr/bin/buildkit-runc

COPY components-image-builder-bob--app/bob /app/
RUN chmod 4755 /app/bob

RUN mkdir /ide
COPY ide-startup.sh /ide/startup.sh
COPY supervisor-ide-config.json /ide/

ARG __GIT_COMMIT
ARG VERSION

ENV GITPOD_BUILD_GIT_COMMIT=${__GIT_COMMIT}
ENV GITPOD_BUILD_VERSION=${VERSION}
# sudo buildctl-daemonless.sh
ENTRYPOINT [ "/app/bob" ]
CMD [ "build" ]
