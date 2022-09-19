module github.com/gitpod-io/gitpod/code-desktop/status

go 1.18

require google.golang.org/grpc v1.49.0

require (
	github.com/golang/glog v1.0.0 // indirect
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.5.0 // indirect
)

require (
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/supervisor/api v0.0.0-00010101000000-000000000000
	github.com/golang/protobuf v1.5.2 // indirect
	golang.org/x/net v0.0.0-20220812174116-3211cb980234 // indirect
	golang.org/x/sys v0.0.0-20220919091848-fb04ddd9f9c8 // indirect
	golang.org/x/text v0.3.8-0.20211004125949-5bd84dd9b33b // indirect
	golang.org/x/xerrors v0.0.0-20220609144429-65e65417b02f
	google.golang.org/genproto v0.0.0-20220617124728-180714bec0ad // indirect
	google.golang.org/protobuf v1.28.1 // indirect
)

replace github.com/gitpod-io/gitpod/supervisor/api => ../../../supervisor-api/go // leeway

replace github.com/gitpod-io/gitpod/common-go => ../../../common-go // leeway
