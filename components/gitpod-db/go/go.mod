module github.com/gitpod-io/gitpod/components/gitpod-db/go

go 1.19

replace github.com/gitpod-io/gitpod/common-go => ../../common-go // leeway

require (
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/go-sql-driver/mysql v1.6.0
	github.com/google/uuid v1.3.0
	github.com/relvacode/iso8601 v1.1.0
	github.com/sirupsen/logrus v1.9.0
	github.com/stretchr/testify v1.8.1
	google.golang.org/grpc v1.52.3
	google.golang.org/protobuf v1.28.1
	gorm.io/datatypes v1.0.7
	gorm.io/driver/mysql v1.4.4
	gorm.io/gorm v1.24.1
	gorm.io/plugin/opentelemetry v0.1.1
)

require (
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/gitpod-io/gitpod/components/scrubber v0.0.0-20230530092704-f7d81a8eef6f // indirect
	github.com/go-logr/logr v1.2.3 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/golang/protobuf v1.5.2 // indirect
	github.com/grpc-ecosystem/go-grpc-middleware v1.3.0 // indirect
	github.com/jinzhu/inflection v1.0.0 // indirect
	github.com/jinzhu/now v1.1.5 // indirect
	github.com/mitchellh/reflectwalk v1.0.2 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	go.opentelemetry.io/otel v1.13.0 // indirect
	go.opentelemetry.io/otel/metric v0.36.0 // indirect
	go.opentelemetry.io/otel/trace v1.13.0 // indirect
	golang.org/x/net v0.7.0 // indirect
	golang.org/x/sys v0.5.0 // indirect
	golang.org/x/text v0.7.0 // indirect
	google.golang.org/genproto v0.0.0-20221118155620-16455021b5e6 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)
