module github.com/gitpod-io/gitpod/code-desktop/status

go 1.18

require google.golang.org/grpc v1.45.0

require github.com/grpc-ecosystem/grpc-gateway/v2 v2.5.0 // indirect

require (
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/supervisor/api v0.0.0-00010101000000-000000000000
	github.com/golang/protobuf v1.5.2 // indirect
	golang.org/x/net v0.0.0-20220127200216-cd36cc0744dd // indirect
	golang.org/x/sys v0.0.0-20220829200755-d48e67d00261 // indirect
	golang.org/x/text v0.3.7 // indirect
	golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1
	google.golang.org/genproto v0.0.0-20210617175327-b9e0b3197ced // indirect
	google.golang.org/protobuf v1.28.0 // indirect
)

replace github.com/gitpod-io/gitpod/supervisor/api => ../../../supervisor-api/go // leeway

replace github.com/gitpod-io/gitpod/common-go => ../../../common-go // leeway
