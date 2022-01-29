FROM ghcr.io/gitpod-arm/workspace-images/gitpod-dev

SHELL [ "/bin/bash", "-c" ]

ARG SEGMENT_IO_TOKEN
ARG PUBLISH_TO_NPM
ARG VERSION
ARG GITHUB_TOKEN
ARG REGISTRY
ARG DO_PUBLISH
ARG GITHUB_ACTOR

ENV LEEWAY_WORKSPACE_ROOT="/github/workspace"
ENV JAVA_HOME="/home/gitpod/.sdkman/candidates/java/current"

RUN sudo chown gitpod:gitpod -R /github/home/ && \
    docker login $REGISTRY -u $GITHUB_ACTOR -p $GITHUB_TOKEN && \
    leeway -DSEGMENT_IO_TOKEN=$SEGMENT_IO_TOKEN -DpublishToNPM=$PUBLISH_TO_NPM -DimageRepoBase=ghcr.io/gitpod-arm/gitpod -Dversion=$VERSION-$(dpkg --print-architecture) build components:all-docker --dont-test --dont-retag
