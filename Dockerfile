FROM ghcr.io/gitpod-arm/workspace-images/gitpod-dev

SHELL [ "/bin/bash", "-c" ]

ARG SEGMENT_IO_TOKEN
ARG PUBLISH_TO_NPM
ARG VERSION

RUN sudo chown gitpod:gitpod -R /github/home/ && \
    docker login ${{ env.REGISTRY }} -u ${{ github.actor }} -p ${{ secrets.GITHUB_TOKEN }} && \
    leeway -DSEGMENT_IO_TOKEN=$SEGMENT_IO_TOKEN -DpublishToNPM=$PUBLISH_TO_NPM -DimageRepoBase=ghcr.io/gitpod-arm/gitpod -Dversion=$VERSION-$(dpkg --print-architecture) build components:all-docker --dont-test --dont-retag
