module github.com/gitpod-io/gitpod/content-service-api/util

go 1.20

replace github.com/gitpod-io/gitpod/content-service/api => ../../go

require (
	github.com/32leaves/bel v1.0.1
	github.com/gitpod-io/gitpod/content-service/api v0.0.0-00010101000000-000000000000
)

require (
	github.com/golang/protobuf v1.5.3 // indirect
	github.com/iancoleman/strcase v0.0.0-20180726023541-3605ed457bf7 // indirect
	github.com/opencontainers/go-digest v1.0.0 // indirect
	github.com/opencontainers/image-spec v1.0.2 // indirect
	golang.org/x/net v0.8.0 // indirect
	golang.org/x/sys v0.6.0 // indirect
	golang.org/x/text v0.8.0 // indirect
	golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1 // indirect
	google.golang.org/genproto v0.0.0-20221118155620-16455021b5e6 // indirect
	google.golang.org/grpc v1.52.3 // indirect
	google.golang.org/protobuf v1.28.1 // indirect
)
