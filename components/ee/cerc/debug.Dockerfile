FROM golang:alpine AS builder
WORKDIR /workspace
COPY . .
RUN go build


FROM alpine:3.13

COPY examples/selftest.json selftest.json
COPY --from=builder /workspace/cerc /

ENTRYPOINT [ "/cerc" ]
CMD [ "selftest.json" ]
