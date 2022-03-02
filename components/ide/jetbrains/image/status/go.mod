module github.com/gitpod-io/gitpod/jetbrains/status

go 1.17

replace github.com/gitpod-io/gitpod/common-go => ../../../../common-go // leeway

replace github.com/gitpod-io/gitpod/gitpod-protocol => ../../../../gitpod-protocol/go // leeway

replace github.com/gitpod-io/gitpod/supervisor/api => ../../../../supervisor-api/go // leeway

require github.com/gitpod-io/gitpod/supervisor/api v0.0.0-00010101000000-000000000000

require (
	github.com/golang/mock v1.6.0 // indirect
	github.com/gorilla/websocket v1.4.2 // indirect
	github.com/sirupsen/logrus v1.8.1 // indirect
	github.com/sourcegraph/jsonrpc2 v0.0.0-20200429184054-15c2290dcb37 // indirect
)

require (
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/gitpod-protocol v0.0.0-00010101000000-000000000000
	github.com/golang/protobuf v1.5.2 // indirect
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.5.0 // indirect
	golang.org/x/net v0.0.0-20211209124913-491a49abca63 // indirect
	golang.org/x/sys v0.0.0-20220114195835-da31bd327af9 // indirect
	golang.org/x/text v0.3.7 // indirect
	golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1
	google.golang.org/genproto v0.0.0-20210617175327-b9e0b3197ced // indirect
	google.golang.org/grpc v1.39.1
	google.golang.org/protobuf v1.27.1 // indirect
	gopkg.in/yaml.v2 v2.4.0
)
