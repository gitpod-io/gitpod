module github.com/gitpod-io/gitpod/supervisor/api

go 1.25.0

godebug tlsmlkem=0

require (
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.11.3
	google.golang.org/genproto v0.0.0-20220822174746-9e6da59bd2fc
	google.golang.org/grpc v1.79.3
	google.golang.org/protobuf v1.36.10
)

require (
	golang.org/x/net v0.55.0 // indirect
	golang.org/x/sys v0.45.0 // indirect
	golang.org/x/text v0.37.0 // indirect
)
