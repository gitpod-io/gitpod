module github.com/gitpod-io/gitpod/content-service-api/util

go 1.24

toolchain go1.24.3

godebug tlsmlkem=0

replace github.com/gitpod-io/gitpod/content-service/api => ../../go

require (
	github.com/32leaves/bel v1.0.1
	github.com/gitpod-io/gitpod/content-service/api v0.0.0-00010101000000-000000000000
)

require (
	github.com/iancoleman/strcase v0.0.0-20180726023541-3605ed457bf7 // indirect
	github.com/opencontainers/go-digest v1.0.0 // indirect
	github.com/opencontainers/image-spec v1.0.2 // indirect
	golang.org/x/net v0.26.0 // indirect
	golang.org/x/sys v0.21.0 // indirect
	golang.org/x/text v0.16.0 // indirect
	golang.org/x/xerrors v0.0.0-20220907171357-04be3eba64a2 // indirect
	google.golang.org/genproto v0.0.0-20221118155620-16455021b5e6 // indirect
	google.golang.org/grpc v1.65.0 // indirect
	google.golang.org/protobuf v1.34.2 // indirect
)
