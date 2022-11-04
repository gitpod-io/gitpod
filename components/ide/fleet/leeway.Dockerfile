FROM alpine:3.16 as builder

RUN mkdir /fleet && \
    apk add curl && \
    cd /fleet && \
    curl -LSs "https://download.jetbrains.com/product?code=FLL&release.type=preview&release.type=eap&platform=linux_x64" --output ./fleet && chmod +x fleet

FROM scratch

COPY --from=builder --chown=33333:33333 /fleet/ /ide-desktop
COPY --chown=33333:33333 ${SUPERVISOR_IDE_CONFIG} /ide-desktop/supervisor-ide-config.json
COPY --chown=33333:33333 startup.sh /ide-desktop/
