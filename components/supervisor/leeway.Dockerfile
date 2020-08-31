FROM scratch

COPY components-supervisor--app/supervisor /app/supervisor
COPY supervisor-config.json /app/
COPY components-supervisor-web--app /web/

WORKDIR "/app"
ENTRYPOINT ["/app/supervisor"]