FROM scratch

WORKDIR "/.supervisor"

# BEWARE: This must be the first layer in the image, s.t. that blobserve
#         can serve the IDE host.
COPY components-supervisor-ide-host--app/* /.supervisor/ide-host/
COPY components-supervisor--app/supervisor /.supervisor/supervisor
COPY supervisor-config.json /.supervisor/supervisor-config.json

ENTRYPOINT ["/.supervisor/supervisor"]