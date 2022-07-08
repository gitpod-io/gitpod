module github.com/gitpod-io/gitpod/ws-daemon/api

go 1.18

require (
	github.com/fatih/gomodifytags v1.14.0
	github.com/gitpod-io/gitpod/content-service/api v0.0.0-00010101000000-000000000000
	github.com/golang/mock v1.6.0
	google.golang.org/grpc v1.45.0
	google.golang.org/protobuf v1.28.0
)

require (
	github.com/fatih/camelcase v1.0.0 // indirect
	github.com/fatih/structtag v1.2.0 // indirect
	github.com/golang/protobuf v1.5.2 // indirect
	github.com/opencontainers/go-digest v1.0.0 // indirect
	github.com/opencontainers/image-spec v1.0.2 // indirect
	golang.org/x/net v0.0.0-20211209124913-491a49abca63 // indirect
	golang.org/x/sys v0.0.0-20220114195835-da31bd327af9 // indirect
	golang.org/x/text v0.3.7 // indirect
	golang.org/x/tools v0.1.1 // indirect
	golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1 // indirect
	google.golang.org/genproto v0.0.0-20201019141844-1ed22bb0c154 // indirect
)

replace github.com/gitpod-io/gitpod/common-go/baseserver => ../../common-go/baseserver // leeway

replace github.com/gitpod-io/gitpod/common-go/grpc => ../../common-go/grpc // leeway

replace github.com/gitpod-io/gitpod/common-go/log => ../../common-go/log // leeway

replace github.com/gitpod-io/gitpod/common-go/pprof => ../../common-go/pprof // leeway

replace github.com/gitpod-io/gitpod/common-go/util => ../../common-go/util // leeway

replace github.com/gitpod-io/gitpod/content-service/api => ../../content-service-api/go // leeway
