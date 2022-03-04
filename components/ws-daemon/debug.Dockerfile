FROM golang:1.16-alpine AS debugger
RUN apk add --no-cache git
RUN go get -u github.com/go-delve/delve/cmd/dlv

FROM alpine:3.15

# Ensure latest packages are present, like security updates.
RUN  apk upgrade --no-cache \
  && apk add --no-cache git bash openssh-client lz4 e2fsprogs

RUN apk add --no-cache kubectl --repository=http://dl-cdn.alpinelinux.org/alpine/edge/testing

# Add gitpod user for operations (e.g. checkout because of the post-checkout hook!)
# RUN addgroup -g 33333 gitpod \
#     && adduser -D -h /home/gitpod -s /bin/sh -u 33333 -G gitpod gitpod \
#     && echo "gitpod:gitpod" | chpasswd

COPY --from=debugger /go/bin/dlv /usr/bin
COPY ws-daemond /app/ws-daemond
ENTRYPOINT [ "/app/ws-daemond" ]
CMD [ "-v", "help" ]