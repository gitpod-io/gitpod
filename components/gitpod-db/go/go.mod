module github.com/gitpod-io/gitpod/components/gitpod-db/go

go 1.20

replace github.com/gitpod-io/gitpod/common-go => ../../common-go // leeway

require (
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/go-sql-driver/mysql v1.6.0
	github.com/google/uuid v1.3.0
	github.com/relvacode/iso8601 v1.1.0
	github.com/sirupsen/logrus v1.9.2
	github.com/stretchr/testify v1.8.3
	google.golang.org/grpc v1.55.0
	google.golang.org/protobuf v1.30.0
	gorm.io/datatypes v1.0.7
	gorm.io/driver/mysql v1.4.4
	gorm.io/gorm v1.25.1
	gorm.io/plugin/opentelemetry v0.1.3
)

require (
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/gitpod-io/gitpod/components/scrubber v0.0.0-00010101000000-000000000000 // indirect
	github.com/go-logr/logr v1.2.4 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/golang/protobuf v1.5.3 // indirect
	github.com/grpc-ecosystem/go-grpc-middleware v1.3.0 // indirect
	github.com/jinzhu/inflection v1.0.0 // indirect
	github.com/jinzhu/now v1.1.5 // indirect
	github.com/mitchellh/reflectwalk v1.0.2 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	go.opentelemetry.io/otel v1.16.0 // indirect
	go.opentelemetry.io/otel/metric v1.16.0 // indirect
	go.opentelemetry.io/otel/trace v1.16.0 // indirect
	golang.org/x/net v0.10.0 // indirect
	golang.org/x/sys v0.8.0 // indirect
	golang.org/x/text v0.9.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20230526161137-0005af68ea54 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

replace github.com/gitpod-io/gitpod/components/scrubber => ../../scrubber // leeway
