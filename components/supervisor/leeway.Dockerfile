FROM scratch

COPY components-supervisor--app/supervisor /app/supervisor
COPY supervisor-config.json /app/

WORKDIR "/app"
ENTRYPOINT ["/app/supervisor"]