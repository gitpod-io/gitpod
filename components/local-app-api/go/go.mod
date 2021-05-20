module github.com/gitpod-io/gitpod/local-app/api

go 1.16

require (
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.2.0
	google.golang.org/genproto v0.0.0-20210207032614-bba0dbe2a9ea
	google.golang.org/grpc v1.37.0
	google.golang.org/protobuf v1.26.0
	github.com/gitpod-io/gitpod/supervisor/api v0.0.0-00010101000000-000000000000
)

replace github.com/gitpod-io/gitpod/supervisor/api => ../../supervisor-api/go // leeway
