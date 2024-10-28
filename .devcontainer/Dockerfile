FROM ubuntu:jammy

ADD https://raw.githubusercontent.com/gitpod-io/workspace-images/main/base/install-packages /usr/bin/install-packages
RUN chmod +x /usr/bin/install-packages

# Improve resilience during build (DNS timeouts, intermediate repo unavailability, broken proxy, etc.)
# Also, disable APT color output, and set the queue mode to 'host' to avoid issues with Docker's overlayfs.
# https://serverfault.com/questions/722893/debian-mirror-hash-sum-mismatch/743015#743015
RUN <<EOF cat >/etc/apt/apt.conf.d/99-gitpod
Acquire::Retries "10";
Acquire::https::Timeout "100";
Acquire::http::Pipeline-Depth "0";
Acquire::http::No-Cache=True;
Acquire::BrokenProxy=true;
APT::Color "0";
APT::Acquire::Queue-Mode "host";
Dpkg::Progress-Fancy "0";
EOF

RUN yes | unminimize \
    && install-packages \
    zip \
    unzip \
    bash-completion \
    build-essential \
    ninja-build \
    htop \
    iputils-ping \
    jq \
    less \
    locales \
    nano \
    ripgrep \
    software-properties-common \
    sudo \
    stow \
    time \
    emacs-nox \
    vim \
    multitail \
    lsof \
    ssl-cert \
    fish \
    zsh \
    python3-pip \
    shellcheck \
    curl \
    gnupg2 \
    isal \
    gperf \
    # Install tools for gsutil
    gcc \
    python3-pip \
    python-setuptools \
    # Install GraphViz to help debug terraform scripts
    graphviz \
    shellcheck \
    pigz \
    ### MySQL client ###
    mysql-client \
    ### Cypress deps
    libgtk2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    libnotify-dev \
    libgconf-2-4 \
    libnss3 \
    libxss1 \
    libasound2 \
    libxtst6 \
    xauth \
    openssh-client \
    && locale-gen en_US.UTF-8

ENV LANG=en_US.UTF-8

### Git ###
ADD https://raw.githubusercontent.com/gitpod-io/workspace-images/main/base/default.gitconfig /etc/gitconfig

RUN add-apt-repository -y ppa:git-core/ppa
# https://github.com/git-lfs/git-lfs/blob/main/INSTALLING.md
RUN export os=ubuntu; export dist=jammy; curl -s https://packagecloud.io/install/repositories/github/git-lfs/script.deb.sh | bash && \
    install-packages git git-lfs && \
    git lfs install --system --skip-repo && \
    chmod 644 /etc/gitconfig

ARG TARGETPLATFORM
ARG TARGETARCH
ARG TARGETOS

# Install dependencies
USER root
ARG LEEWAY_VERSION=0.8.2
ENV LEEWAY_MAX_PROVENANCE_BUNDLE_SIZE=8388608
ENV LEEWAY_WORKSPACE_ROOT=/workspace/gitpod
ENV LEEWAY_REMOTE_CACHE_BUCKET=leeway-cache-dev-3ac8ef5
ENV LEEWAY_CACHE_DIR=/workspace/.leeway/cache
ENV LEEWAY_BUILD_DIR=/workspace/.leeway/build
RUN arch=$(uname -m); \
    case $arch in \
    x86_64) arch=x86_64 ;; \
    aarch64|arm64) arch=arm64 ;; \
    *) echo "Unsupported architecture: $arch"; exit 1 ;; \
    esac; \
    cd /tmp && \
    curl -OsSL https://github.com/gitpod-io/leeway/releases/download/v${LEEWAY_VERSION}/leeway_${LEEWAY_VERSION}_Linux_${arch}.tar.gz && \
    tar -xzf leeway_${LEEWAY_VERSION}_Linux_${arch}.tar.gz && \
    mv leeway /usr/local/bin/leeway && \
    rm leeway_${LEEWAY_VERSION}_Linux_${arch}.tar.gz


### cloud_sql_proxy ###
ARG CLOUD_SQL_PROXY=/usr/local/bin/cloud_sql_proxy
RUN curl -fsSL https://dl.google.com/cloudsql/cloud_sql_proxy.linux.${TARGETARCH} > $CLOUD_SQL_PROXY \
    && chmod +x $CLOUD_SQL_PROXY

### Helm3 ###
RUN mkdir -p /tmp/helm/ \
    && curl -fsSL https://get.helm.sh/helm-v3.8.1-linux-${TARGETARCH}.tar.gz | tar -xzvC /tmp/helm/ --strip-components=1 \
    && cp /tmp/helm/helm /usr/local/bin/helm \
    && ln -s /usr/local/bin/helm /usr/local/bin/helm3 \
    && rm -rf /tmp/helm/ \
    && helm completion bash > /usr/share/bash-completion/completions/helm

### kubectl ###
RUN curl -fsSL -o /usr/bin/kubectl "https://dl.k8s.io/release/v1.28.9/bin/linux/${TARGETARCH}/kubectl" && chmod +x /usr/bin/kubectl \
    && kubectl completion bash > /usr/share/bash-completion/completions/kubectl

RUN curl -fsSL -o /usr/bin/kubectx https://raw.githubusercontent.com/ahmetb/kubectx/master/kubectx && chmod +x /usr/bin/kubectx \
    && curl -fsSL -o /usr/bin/kubens  https://raw.githubusercontent.com/ahmetb/kubectx/master/kubens  && chmod +x /usr/bin/kubens

RUN curl -fsSL https://github.com/kubernetes-sigs/kubebuilder/releases/download/v2.3.2/kubebuilder_2.3.2_linux_${TARGETARCH}.tar.gz | tar -xz -C /tmp/ \
    && sudo mkdir -p /usr/local/kubebuilder \
    && sudo mv /tmp/kubebuilder_2.3.2_linux_${TARGETARCH}/* /usr/local/kubebuilder \
    && rm -rf /tmp/*

RUN curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/focal.gpg | sudo apt-key add -

### CertManager's cmctl
RUN cd /usr/bin && curl -fsSL https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cmctl-linux-amd64.tar.gz | tar xzv --no-anchored cmctl

# gokart
RUN cd /usr/bin && curl -fsSL https://github.com/praetorian-inc/gokart/releases/download/v0.4.0/gokart_0.4.0_linux_x86_64.tar.gz | tar xzv --no-anchored gokart

# evans (gRPC client)
RUN cd /usr/bin && curl -fsSL https://github.com/ktr0731/evans/releases/download/v0.10.6/evans_linux_${TARGETARCH}.tar.gz | tar xz evans

# dazzle
RUN cd /usr/bin && curl -fsSL https://github.com/gitpod-io/dazzle/releases/download/v0.1.12/dazzle_0.1.12_Linux_x86_64.tar.gz | tar xz

# yq - jq for YAML files
# Note: we rely on version 3.x.x in various places, 4.x breaks this!
RUN cd /usr/bin && curl -fsSL https://github.com/mikefarah/yq/releases/download/3.4.1/yq_linux_${TARGETARCH} > yq && chmod +x yq
# yq4 as separate binary
RUN cd /usr/bin && curl -fsSL https://github.com/mikefarah/yq/releases/download/v4.23.1/yq_linux_${TARGETARCH} > yq4 && chmod +x yq4

# release helper
RUN cd /usr/bin && curl -fsSL https://github.com/c4milo/github-release/releases/download/v1.1.0/github-release_v1.1.0_linux_${TARGETARCH}.tar.gz | tar xz

### Protobuf
RUN arch=$(uname -m); \
    case $arch in \
    x86_64) arch=x86_64 ;; \
    aarch64|arm64) arch=aarch_64 ;; \
    *) echo "Unsupported architecture: $arch"; exit 1 ;; \
    esac; \
    tmpdir=$(mktemp -d) \
    && curl -fsSL -o $tmpdir/protoc.zip https://github.com/protocolbuffers/protobuf/releases/download/v3.20.1/protoc-3.20.1-linux-${arch}.zip \
    && mkdir -p /usr/lib/protoc && cd /usr/lib/protoc && unzip $tmpdir/protoc.zip \
    && chmod -R o+r+x /usr/lib/protoc/include \
    && chmod -R +x /usr/lib/protoc/bin \
    && ln -s /usr/lib/protoc/bin/* /usr/bin \
    && rm -rf $tmpdir

### Toxiproxy CLI
RUN curl -fsSL -o /usr/bin/toxiproxy https://github.com/Shopify/toxiproxy/releases/download/v2.4.0/toxiproxy-cli-linux-${TARGETARCH} \
    && chmod +x /usr/bin/toxiproxy

### libseccomp > 2.5.2
RUN cd $(mktemp -d) \
    && curl -fsSL https://github.com/seccomp/libseccomp/releases/download/v2.5.4/libseccomp-2.5.4.tar.gz | tar xz \
    && cd libseccomp-2.5.4 && ./configure && make && make install



RUN curl -sSL "https://awscli.amazonaws.com/awscli-exe-linux-$(arch).zip" -o awscliv2.zip && \
    unzip -q awscliv2.zip && \
    ./aws/install --bin-dir /usr/local/bin --install-dir /usr/local/aws-cli --update && \
    rm -rf awscliv2.zip ./aws

ENV GO_VERSION=1.22.2
ENV GOPATH=/root/go-packages
ENV GOROOT=/root/go
ENV PATH=$GOROOT/bin:$GOPATH/bin:$PATH

RUN mkdir -p $GOROOT && \
    cd /root && \
    curl -fsSL https://dl.google.com/go/go$GO_VERSION.${TARGETOS}-${TARGETARCH}.tar.gz | tar xzs
RUN go install github.com/go-delve/delve/cmd/dlv@latest

# Install codecov uploader
# https://about.codecov.io/blog/introducing-codecovs-new-uploader
RUN curl -fsSL https://uploader.codecov.io/latest/codecov-linux -o /usr/local/bin/codecov \
    && chmod +x /usr/local/bin/codecov


# gh (Github CLI) binary:
RUN cd /usr/bin && curl -fsSL https://github.com/cli/cli/releases/download/v2.35.0/gh_2.35.0_linux_${TARGETARCH}.tar.gz \
    | tar xzv --strip-components=2 gh_2.35.0_linux_${TARGETARCH}/bin/gh

# Install observability-related binaries
ARG PROM_VERSION="2.36.0"
RUN curl -LO https://github.com/prometheus/prometheus/releases/download/v${PROM_VERSION}/prometheus-${PROM_VERSION}.linux-${TARGETARCH}.tar.gz && \
    tar -xzvf prometheus-${PROM_VERSION}.linux-${TARGETARCH}.tar.gz && \
    mv prometheus-${PROM_VERSION}.linux-${TARGETARCH}/promtool /usr/local/bin/promtool && \
    rm -rf prometheus-${PROM_VERSION}.linux-${TARGETARCH}/ && \
    rm -f prometheus-${PROM_VERSION}.linux-${TARGETARCH}.tar.gz

ARG JSONNET_BUNDLER_VERSION="0.4.0"
RUN curl -fsSL -o jb https://github.com/jsonnet-bundler/jsonnet-bundler/releases/download/v${JSONNET_BUNDLER_VERSION}/jb-linux-${TARGETARCH} && \
    chmod +x jb && mv jb /usr/local/bin

ARG JSONNET_VERSION="0.17.0"
RUN curl -fsSLO https://github.com/google/go-jsonnet/releases/download/v${JSONNET_VERSION}/go-jsonnet_${JSONNET_VERSION}_Linux_x86_64.tar.gz && \
    tar -xzvf go-jsonnet_${JSONNET_VERSION}_Linux_x86_64.tar.gz && \
    mv jsonnet /usr/local/bin/jsonnet && \
    mv jsonnetfmt /usr/local/bin/jsonnetfmt && \
    tar -tzf go-jsonnet_${JSONNET_VERSION}_Linux_x86_64.tar.gz | xargs rm -f && \
    rm -f go-jsonnet_${JSONNET_VERSION}_Linux_x86_64.tar.gz

ARG GOJSONTOYAML_VERSION="0.1.0"
RUN curl -fsSLO https://github.com/brancz/gojsontoyaml/releases/download/v${GOJSONTOYAML_VERSION}/gojsontoyaml_${GOJSONTOYAML_VERSION}_linux_${TARGETARCH}.tar.gz && \
    tar -xzvf gojsontoyaml_${GOJSONTOYAML_VERSION}_linux_${TARGETARCH}.tar.gz && \
    mv gojsontoyaml /usr/local/bin/gojsontoyaml && \
    tar -tzf gojsontoyaml_${GOJSONTOYAML_VERSION}_linux_${TARGETARCH}.tar.gz | xargs rm -f && \
    rm -f gojsontoyaml_${GOJSONTOYAML_VERSION}_linux_${TARGETARCH}.tar.gz

# So we can parse the report.html output by leeway, and remove the output produced by this image build
# why? it's too verbose, exceeding the Github Actions summary limit
RUN go install github.com/ericchiang/pup@v0.4.0

# Install oci-tool
RUN curl -fsSL https://github.com/csweichel/oci-tool/releases/download/v0.2.0/oci-tool_0.2.0_linux_${TARGETARCH}.tar.gz | tar xz -C /usr/local/bin \
    && chmod +x /usr/local/bin/oci-tool

# Install golangci-lint
RUN go install -v github.com/golangci/golangci-lint/cmd/golangci-lint@latest

ENV USE_GKE_GCLOUD_AUTH_PLUGIN=True

# create completions
RUN mkdir -p /root/.bashrc.d && \
    (echo; echo "source /etc/bash_completion"; echo) >> /root/.bashrc && \
    (echo; echo "for i in \$(ls -A \$HOME/.bashrc.d/); do source \$HOME/.bashrc.d/\$i; done"; echo) >> /root/.bashrc && \
    mkdir -p /root/.local/share/bash-completion/completions

RUN { echo && echo "PS1='\[\033[01;32m\]\u\[\033[00m\] \[\033[01;34m\]\w\[\033[00m\]\$(__git_ps1 \" (%s)\") $ '" ; } >> /root/.bashrc

## Register leeway autocompletion in bashrc
RUN bash -c "echo . \<\(leeway bash-completion\) >> /root/.bashrc"

### Google Cloud ###
# not installed via repository as then 'docker-credential-gcr' is not available
ARG GCS_DIR=/opt/google-cloud-sdk
ENV PATH=$GCS_DIR/bin:$PATH
RUN arch=$(uname -m); \
    case $arch in \
    x86_64) arch=x86_64 ;; \
    aarch64|arm64) arch=arm ;; \
    *) echo "Unsupported architecture: $arch"; exit 1 ;; \
    esac; \
    mkdir -p $GCS_DIR \
    && curl -fsSL https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-sdk-472.0.0-linux-${arch}.tar.gz \
    | tar -xzC /opt \
    && /opt/google-cloud-sdk/install.sh --quiet --usage-reporting=false --bash-completion=true \
    --additional-components gke-gcloud-auth-plugin docker-credential-gcr alpha beta \
    # needed for access to our private registries
    && docker-credential-gcr configure-docker

RUN sudo python3 -m pip uninstall crcmod; sudo python3 -m pip install --no-cache-dir -U crcmod pre-commit


ENV DB_HOST=127.0.0.1


# Install Terraform
ARG RELEASE_URL="https://releases.hashicorp.com/terraform/1.8.1/terraform_1.8.1_linux_${TARGETARCH}.zip"
RUN mkdir -p ~/.terraform \
    && cd ~/.terraform \
    && curl -fsSL -o terraform_linux_${TARGETARCH}.zip ${RELEASE_URL} \
    && unzip *.zip \
    && rm -f *.zip \
    && printf "terraform -install-autocomplete 2> /dev/null\n" >>~/.bashrc

## Java
ENV JAVA_VERSION=11.0.23.fx-zulu
RUN curl -fsSL "https://get.sdkman.io" | bash \
    && bash -c ". /root/.sdkman/bin/sdkman-init.sh \
    && sed -i 's/sdkman_selfupdate_enable=true/sdkman_selfupdate_enable=false/g' /root/.sdkman/etc/config \
    && sed -i 's/sdkman_selfupdate_feature=true/sdkman_selfupdate_feature=false/g' /root/.sdkman/etc/config \
    && sdk install java ${JAVA_VERSION} \
    && sdk default java ${JAVA_VERSION} \
    && sdk install gradle \
    && sdk install maven \
    && sdk flush archives \
    && sdk flush temp \
    && mkdir /root/.m2 \
    && printf '<settings>\n  <localRepository>/workspace/m2-repository/</localRepository>\n</settings>\n' > /root/.m2/settings.xml \
    && echo 'export SDKMAN_DIR=\"/root/.sdkman\"' >> /root/.bashrc.d/99-java \
    && echo '[[ -s \"/root/.sdkman/bin/sdkman-init.sh\" ]] && source \"/root/.sdkman/bin/sdkman-init.sh\"' >> /root/.bashrc.d/99-java"
# above, we are adding the sdkman init to .bashrc (executing sdkman-init.sh does that), because one is executed on interactive shells, the other for non-interactive shells (e.g. plugin-host)
ENV GRADLE_USER_HOME=/workspace/.gradle/

ENV NODE_VERSION=18.20.4

ENV PNPM_HOME=/root/.pnpm
ENV PATH=/root/.nvm/versions/node/v${NODE_VERSION}/bin:/root/.yarn/bin:${PNPM_HOME}:$PATH
ENV HOME=/root
RUN curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash \
    && bash -c ". $HOME/.nvm/nvm.sh \
    && nvm install v${NODE_VERSION} \
    && nvm alias default v${NODE_VERSION} \
    && npm install -g typescript yarn pnpm node-gyp"

ENV PATH=$PATH:/root/.aws-iam:/root/.terraform:/workspace/bin

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

# Install pre-commit hooks under /workspace during prebuilds
ENV PRE_COMMIT_HOME=/workspace/.pre-commit

# Setting the environment variable here so that it will be accessible to all tasks and
# terminal sessions in Gitpod workspaces.
ENV PREVIEW_ENV_DEV_SA_KEY_PATH=/root/.config/gcloud/sa.json
ENV GOOGLE_EXTERNAL_ACCOUNT_ALLOW_EXECUTABLES=1
