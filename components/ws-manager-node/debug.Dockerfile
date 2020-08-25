FROM golang:1.13-alpine AS debugger
RUN apk add --no-cache git
RUN go get -u github.com/go-delve/delve/cmd/dlv

FROM alpine:latest
RUN apk add ca-certificates
COPY --from=debugger /go/bin/dlv /usr/bin
COPY ws-manager-node /app/ws-manager-node
ENTRYPOINT [ "/app/ws-manager-node" ]
CMD [ "-v", "help" ]