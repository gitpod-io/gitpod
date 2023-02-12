module github.com/gitpod-io/gitpod/devcontainer/launcher

go 1.19

require github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000

require (
	github.com/golang/protobuf v1.5.2 // indirect
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.11.3 // indirect
	golang.org/x/net v0.5.0 // indirect
	golang.org/x/text v0.6.0 // indirect
	google.golang.org/genproto v0.0.0-20230110181048-76db0878b65f // indirect
	google.golang.org/protobuf v1.28.1 // indirect
)

require (
	github.com/gitpod-io/gitpod/supervisor/api v0.0.0-00010101000000-000000000000
	github.com/sirupsen/logrus v1.8.1 // indirect
	golang.org/x/sys v0.4.0 // indirect
	google.golang.org/grpc v1.53.0
)

replace github.com/gitpod-io/gitpod/common-go => ../../common-go // leeway

replace github.com/gitpod-io/gitpod/gitpod-protocol => ../../gitpod-protocol/go // leeway

replace github.com/gitpod-io/gitpod/supervisor/api => ../../supervisor-api/go // leeway
