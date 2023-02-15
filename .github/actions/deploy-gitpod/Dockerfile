FROM eu.gcr.io/gitpod-core-dev/dev/dev-environment:kylos101-kubecdl-home.1

USER root
ENV OCI_TOOL_VERSION="0.2.0"
RUN curl -fsSL https://github.com/csweichel/oci-tool/releases/download/v${OCI_TOOL_VERSION}/oci-tool_${OCI_TOOL_VERSION}_linux_amd64.tar.gz | tar xz -C /usr/local/bin && chmod +x /usr/local/bin/oci-tool
USER gitpod

COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
