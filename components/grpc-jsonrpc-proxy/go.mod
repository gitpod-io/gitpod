module github.com/gitpod/gitpod-io/grpc-jsonrpc-proxy

go 1.15

replace github.com/gitpod-io/gitpod/supervisor/api => ../supervisor-api/go

require (
	github.com/RussellLuo/protoc-go-plugins v0.0.0-20180106031146-3e0c2af04929
	github.com/gitpod-io/gitpod/supervisor/api v0.0.0-00010101000000-000000000000
	github.com/gogo/protobuf v1.2.1
	github.com/golang/protobuf v1.4.2
	github.com/gorilla/websocket v1.4.2
	github.com/sourcegraph/jsonrpc2 v0.0.0-20200429184054-15c2290dcb37
	github.com/spf13/cobra v1.0.0
	golang.org/x/net v0.0.0-20200707034311-ab3426394381
	google.golang.org/grpc v1.31.1
	google.golang.org/grpc/examples v0.0.0-20200916215349-9ec6f11015bc
)
