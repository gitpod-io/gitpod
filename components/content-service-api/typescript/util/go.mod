module github.com/gitpod-io/gitpod/content-service-api/util

go 1.14

replace github.com/gitpod-io/gitpod/content-service/api => ../../go

require (
	github.com/32leaves/bel v1.0.1
	github.com/gitpod-io/gitpod/content-service/api v0.0.0-00010101000000-000000000000
	github.com/stretchr/testify v1.6.1 // indirect
	google.golang.org/grpc v1.34.0 // indirect
)
