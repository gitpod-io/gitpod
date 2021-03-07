module github.com/gitpod-io/gitpod/malet

go 1.16

replace github.com/gitpod-io/gitpod/supervisor/api => ../../components/supervisor-api/go // leeway

require (
	github.com/gitpod-io/gitpod/supervisor/api v0.0.0-00010101000000-000000000000
	github.com/golang/protobuf v1.4.3
	github.com/jpillora/chisel v1.7.6
	github.com/urfave/cli/v2 v2.3.0
	google.golang.org/grpc v1.36.0
)
