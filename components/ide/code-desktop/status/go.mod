module github.com/gitpod-io/gitpod/code-desktop/status

go 1.19

require google.golang.org/grpc v1.49.0

require github.com/grpc-ecosystem/grpc-gateway/v2 v2.11.3 // indirect

require (
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/supervisor/api v0.0.0-00010101000000-000000000000
	github.com/golang/protobuf v1.5.2 // indirect
	golang.org/x/net v0.0.0-20220624214902-1bab6f366d9e // indirect
	golang.org/x/sys v0.0.0-20220610221304-9f5ed59c137d // indirect
	golang.org/x/text v0.3.7 // indirect
	golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1
	google.golang.org/genproto v0.0.0-20220822174746-9e6da59bd2fc // indirect
	google.golang.org/protobuf v1.28.1 // indirect
)

replace github.com/gitpod-io/gitpod/supervisor/api => ../../../supervisor-api/go // leeway

replace github.com/gitpod-io/gitpod/common-go => ../../../common-go // leeway
