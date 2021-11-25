FROM alpine:3.15

RUN apk add --no-cache --update bash

RUN addgroup -g 33333 gitpod
RUN adduser -D -h /home/gitpod -s /bin/sh -u 33333 -G gitpod gitpod