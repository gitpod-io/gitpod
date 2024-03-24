# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM gitpod/workspace-gitpod-dev:latest

ENV TRIGGER_REBUILD 41

USER root

### cloud_sql_proxy ###
ARG CLOUD_SQL_PROXY=/usr/local/bin/cloud_sql_proxy
RUN curl -fsSL https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 > $CLOUD_SQL_PROXY \
    && chmod +x $CLOUD_SQL_PROXY

### Helm3 ###
RUN mkdir -p /tmp/helm/ \
    && curl -fsSL https://get.helm.sh/helm-v3.8.1-linux-amd64.tar.gz | tar -xzvC /tmp/helm/ --strip-components=1 \
    && cp /tmp/helm/helm /usr/local/bin/helm \
    && ln -s /usr/local/bin/helm /usr/local/bin/helm3 \
    && rm -rf /tmp/helm/ \
    && helm completion bash > /usr/share/bash-completion/completions/helm

### kubectl ###
RUN curl -fsSL -o /usr/bin/kubectl "https://dl.k8s.io/release/v1.27.11/bin/linux/amd64/kubectl" && chmod +x /usr/bin/kubectl \
    && kubectl completion bash > /usr/share/bash-completion/completions/kubectl

RUN curl -fsSL -o /usr/bin/kubectx https://raw.githubusercontent.com/ahmetb/kubectx/master/kubectx && chmod +x /usr/bin/kubectx \
    && curl -fsSL -o /usr/bin/kubens  https://raw.githubusercontent.com/ahmetb/kubectx/master/kubens  && chmod +x /usr/bin/kubens

RUN curl -fsSL https://github.com/kubernetes-sigs/kubebuilder/releases/download/v2.3.2/kubebuilder_2.3.2_linux_amd64.tar.gz | tar -xz -C /tmp/ \
    && sudo mkdir -p /usr/local/kubebuilder \
    && sudo mv /tmp/kubebuilder_2.3.2_linux_amd64/* /usr/local/kubebuilder \
    && rm -rf /tmp/*

RUN curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/focal.gpg | sudo apt-key add -

### MySQL client ###
RUN install-packages mysql-client

### CertManager's cmctl
RUN cd /usr/bin && curl -fsSL https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cmctl-linux-amd64.tar.gz | tar xzv --no-anchored cmctl

# gokart
RUN cd /usr/bin && curl -fsSL https://github.com/praetorian-inc/gokart/releases/download/v0.4.0/gokart_0.4.0_linux_x86_64.tar.gz | tar xzv --no-anchored gokart

# leeway
ARG LEEWAY_VERSION=0.8.0
ENV LEEWAY_MAX_PROVENANCE_BUNDLE_SIZE=8388608
ENV LEEWAY_WORKSPACE_ROOT=/workspace/gitpod
ENV LEEWAY_REMOTE_CACHE_BUCKET=gitpod-core-leeway-cache-branch
ENV LEEWAY_CACHE_DIR=/workspace/.leeway/cache
ENV LEEWAY_BUILD_DIR=/workspace/.leeway/build
RUN cd /usr/bin && curl -fsSL https://github.com/gitpod-io/leeway/releases/download/v${LEEWAY_VERSION}/leeway_${LEEWAY_VERSION}_Linux_x86_64.tar.gz | tar xz

# evans (gRPC client)
RUN cd /usr/bin && curl -fsSL https://github.com/ktr0731/evans/releases/download/v0.10.6/evans_linux_amd64.tar.gz | tar xz evans

# dazzle
RUN cd /usr/bin && curl -fsSL https://github.com/gitpod-io/dazzle/releases/download/v0.1.12/dazzle_0.1.12_Linux_x86_64.tar.gz | tar xz

# werft CLI
ENV WERFT_CREDENTIAL_HELPER=/workspace/gitpod/dev/preview/werft-credential-helper.sh
ENV WERFT_HOST=werft-grpc.gitpod-dev.com:443
ENV WERFT_TLS_MODE=system
RUN cd /usr/bin && curl -fsSL https://github.com/csweichel/werft/releases/download/v0.3.3/werft-client-linux-amd64.tar.gz | tar xz && mv werft-client-linux-amd64 werft

# yq - jq for YAML files
# Note: we rely on version 3.x.x in various places, 4.x breaks this!
RUN cd /usr/bin && curl -fsSL https://github.com/mikefarah/yq/releases/download/3.4.1/yq_linux_amd64 > yq && chmod +x yq
# yq4 as separate binary
RUN cd /usr/bin && curl -fsSL https://github.com/mikefarah/yq/releases/download/v4.23.1/yq_linux_amd64 > yq4 && chmod +x yq4

# release helper
RUN cd /usr/bin && curl -fsSL https://github.com/c4milo/github-release/releases/download/v1.1.0/github-release_v1.1.0_linux_amd64.tar.gz | tar xz

### Protobuf
RUN set -ex \
    && tmpdir=$(mktemp -d) \
    && curl -fsSL -o $tmpdir/protoc.zip https://github.com/protocolbuffers/protobuf/releases/download/v3.20.1/protoc-3.20.1-linux-x86_64.zip \
    && mkdir -p /usr/lib/protoc && cd /usr/lib/protoc && unzip $tmpdir/protoc.zip \
    && chmod -R o+r+x /usr/lib/protoc/include \
    && chmod -R +x /usr/lib/protoc/bin \
    && ln -s /usr/lib/protoc/bin/* /usr/bin \
    && rm -rf $tmpdir

### Telepresence ###
RUN curl -fsSL https://packagecloud.io/datawireio/telepresence/gpgkey | apt-key add - \
    # 'cosmic' not supported
    && add-apt-repository -yu "deb https://packagecloud.io/datawireio/telepresence/ubuntu/ bionic main" \
    # 0.95 (current at the time of this commit) is broken
    && install-packages \
    iproute2 \
    iptables \
    net-tools \
    socat \
    telepresence=0.109

### Toxiproxy CLI
RUN curl -fsSL -o /usr/bin/toxiproxy https://github.com/Shopify/toxiproxy/releases/download/v2.4.0/toxiproxy-cli-linux-amd64 \
    && chmod +x /usr/bin/toxiproxy

### libseccomp > 2.5.2
RUN install-packages gperf \
    && cd $(mktemp -d) \
    && curl -fsSL https://github.com/seccomp/libseccomp/releases/download/v2.5.4/libseccomp-2.5.4.tar.gz | tar xz \
    && cd libseccomp-2.5.4 && ./configure && make && make install

### Cypress deps
RUN install-packages \
    libgtk2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    libnotify-dev \
    libgconf-2-4 \
    libnss3 \
    libxss1 \
    libasound2 \
    libxtst6 \
    xauth
# Install netcat to use it as proxy for SSH access to Harvester VMs
RUN install-packages netcat

USER gitpod

# Fix node version we develop against
ARG GITPOD_NODE_VERSION=18.18.2
RUN bash -c ". .nvm/nvm.sh \
    && nvm install $GITPOD_NODE_VERSION \
    && npm install -g typescript yarn"
ENV PATH=/home/gitpod/.nvm/versions/node/v${GITPOD_NODE_VERSION}/bin:$PATH

## Register leeway autocompletion in bashrc
RUN bash -c "echo . \<\(leeway bash-completion\) >> ~/.bashrc"

### Google Cloud ###
# not installed via repository as then 'docker-credential-gcr' is not available
ARG GCS_DIR=/opt/google-cloud-sdk
ENV PATH=$GCS_DIR/bin:$PATH
RUN sudo chown gitpod: /opt \
    && mkdir $GCS_DIR \
    && curl -fsSL https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-sdk-445.0.0-linux-x86_64.tar.gz \
    | tar -xzvC /opt \
    && /opt/google-cloud-sdk/install.sh --quiet --usage-reporting=false --bash-completion=true \
    --additional-components gke-gcloud-auth-plugin docker-credential-gcr alpha beta \
    # needed for access to our private registries
    && docker-credential-gcr configure-docker

ENV USE_GKE_GCLOUD_AUTH_PLUGIN=True

# Install tools for gsutil
RUN sudo install-packages \
    gcc \
    python3-pip \
    python-setuptools

RUN sudo python3 -m pip uninstall crcmod; sudo python3 -m pip install --no-cache-dir -U crcmod

### gitpod-core specific gcloud config
# Copy GCloud default config that points to gitpod-dev
ARG GCLOUD_CONFIG_DIR=/home/gitpod/.config/gcloud
COPY --chown=gitpod gcloud-default-config $GCLOUD_CONFIG_DIR/configurations/config_default

ENV DB_HOST=127.0.0.1

# awscliv2
# See also: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-version.html
# See also: https://github.com/aws/aws-cli/blob/v2/CHANGELOG.rst
RUN curl -L "https://awscli.amazonaws.com/awscli-exe-linux-x86_64-2.7.25.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && sudo ./aws/install \
    && rm -f awscliv2.zip

# Install Terraform
ARG RELEASE_URL="https://releases.hashicorp.com/terraform/1.3.1/terraform_1.3.1_linux_amd64.zip"
RUN mkdir -p ~/.terraform \
    && cd ~/.terraform \
    && curl -fsSL -o terraform_linux_amd64.zip ${RELEASE_URL} \
    && unzip *.zip \
    && rm -f *.zip \
    && printf "terraform -install-autocomplete 2> /dev/null\n" >>~/.bashrc

# Install GraphViz to help debug terraform scripts
RUN sudo install-packages graphviz

ENV PATH=$PATH:$HOME/.aws-iam:$HOME/.terraform

# Install codecov uploader
# https://about.codecov.io/blog/introducing-codecovs-new-uploader
RUN sudo curl -fsSL https://uploader.codecov.io/latest/codecov-linux -o /usr/local/bin/codecov \
    && sudo chmod +x /usr/local/bin/codecov

# Install pre-commit https://pre-commit.com/#install
RUN sudo install-packages shellcheck \
    && sudo python3 -m pip install pre-commit

# gh (Github CLI) binary:
RUN cd /usr/bin && curl -fsSL https://github.com/cli/cli/releases/download/v2.35.0/gh_2.35.0_linux_amd64.tar.gz \
    | sudo tar xzv --strip-components=2 gh_2.35.0_linux_amd64/bin/gh

# Install observability-related binaries
ARG PROM_VERSION="2.36.0"
RUN curl -LO https://github.com/prometheus/prometheus/releases/download/v${PROM_VERSION}/prometheus-${PROM_VERSION}.linux-amd64.tar.gz && \
    tar -xzvf prometheus-${PROM_VERSION}.linux-amd64.tar.gz && \
    sudo mv prometheus-${PROM_VERSION}.linux-amd64/promtool /usr/local/bin/promtool && \
    rm -rf prometheus-${PROM_VERSION}.linux-amd64/ && \
    rm -f prometheus-${PROM_VERSION}.linux-amd64.tar.gz

ARG JSONNET_BUNDLER_VERSION="0.4.0"
RUN curl -fsSL -o jb https://github.com/jsonnet-bundler/jsonnet-bundler/releases/download/v${JSONNET_BUNDLER_VERSION}/jb-linux-amd64 && \
    chmod +x jb && sudo mv jb /usr/local/bin

ARG JSONNET_VERSION="0.17.0"
RUN curl -fsSLO https://github.com/google/go-jsonnet/releases/download/v${JSONNET_VERSION}/go-jsonnet_${JSONNET_VERSION}_Linux_x86_64.tar.gz && \
    tar -xzvf go-jsonnet_${JSONNET_VERSION}_Linux_x86_64.tar.gz && \
    sudo mv jsonnet /usr/local/bin/jsonnet && \
    sudo mv jsonnetfmt /usr/local/bin/jsonnetfmt && \
    tar -tzf go-jsonnet_${JSONNET_VERSION}_Linux_x86_64.tar.gz | xargs rm -f && \
    rm -f go-jsonnet_${JSONNET_VERSION}_Linux_x86_64.tar.gz

ARG GOJSONTOYAML_VERSION="0.1.0"
RUN curl -fsSLO https://github.com/brancz/gojsontoyaml/releases/download/v${GOJSONTOYAML_VERSION}/gojsontoyaml_${GOJSONTOYAML_VERSION}_linux_amd64.tar.gz && \
    tar -xzvf gojsontoyaml_${GOJSONTOYAML_VERSION}_linux_amd64.tar.gz && \
    sudo mv gojsontoyaml /usr/local/bin/gojsontoyaml && \
    tar -tzf gojsontoyaml_${GOJSONTOYAML_VERSION}_linux_amd64.tar.gz | xargs rm -f && \
    rm -f gojsontoyaml_${GOJSONTOYAML_VERSION}_linux_amd64.tar.gz

# Install fish shell
RUN sudo apt-add-repository -y ppa:fish-shell/release-3 && \
    sudo apt update && \
    sudo apt install -y fish

# Install tmux + tmuxinator
RUN brew install tmux tmuxinator \
    # Install redis-server
    && brew install redis \
    # Install zed & spicedb CLI
    && brew install authzed/tap/zed \
    && brew install authzed/tap/spicedb \
    && brew cleanup

# Copy our own tools
ENV NEW_KUBECDL=2
COPY dev-kubecdl--app/kubecdl dev-gpctl--app/gpctl /usr/bin/

# Configure our tools' autocompletion
RUN bash -c "echo . \<\(gpctl completion bash\) >> ~/.bashrc"

ENV PATH=$PATH:/workspace/bin

# Setting the environment variable here so that it will be accessible to all tasks and
# terminal sessions in Gitpod workspaces.
ENV PREVIEW_ENV_DEV_SA_KEY_PATH=/home/gitpod/.config/gcloud/preview-environment-dev-sa.json

# So we can parse the report.html output by leeway, and remove the output produced by this image build
# why? it's too verbose, exceeding the Github Actions summary limit
RUN go install github.com/ericchiang/pup@v0.4.0

# Install oci-tool
RUN curl -fsSL https://github.com/csweichel/oci-tool/releases/download/v0.2.0/oci-tool_0.2.0_linux_amd64.tar.gz | sudo tar xz -C /usr/local/bin \
    && sudo chmod +x /usr/local/bin/oci-tool

# Install golangci-lint
RUN go install -v github.com/golangci/golangci-lint/cmd/golangci-lint@latest

RUN sudo install-packages pigz

# Install pre-commit hooks under /workspace during prebuilds
ENV PRE_COMMIT_HOME=/workspace/.pre-commit
