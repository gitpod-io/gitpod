module github.com/gitpod-io/gitpod/components/gitpod-db/go

go 1.22.0

toolchain go1.23.3

replace github.com/gitpod-io/gitpod/common-go => ../../common-go // leeway

require (
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/go-sql-driver/mysql v1.6.0
	github.com/google/uuid v1.3.0
	github.com/relvacode/iso8601 v1.1.0
	github.com/sirupsen/logrus v1.9.3
	github.com/stretchr/testify v1.8.4
	google.golang.org/grpc v1.58.3
	google.golang.org/protobuf v1.33.0
	gorm.io/datatypes v1.0.7
	gorm.io/driver/mysql v1.4.4
	gorm.io/gorm v1.25.1
	gorm.io/plugin/opentelemetry v0.1.3
)

require (
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/gitpod-io/gitpod/components/scrubber v0.0.0-00010101000000-000000000000 // indirect
	github.com/go-logr/logr v1.4.1 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/golang/protobuf v1.5.4 // indirect
	github.com/grpc-ecosystem/go-grpc-middleware v1.3.0 // indirect
	github.com/hashicorp/golang-lru v1.0.2 // indirect
	github.com/jinzhu/inflection v1.0.0 // indirect
	github.com/jinzhu/now v1.1.5 // indirect
	github.com/matttproud/golang_protobuf_extensions v1.0.4 // indirect
	github.com/mitchellh/reflectwalk v1.0.2 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/prometheus/client_golang v1.16.0 // indirect
	github.com/prometheus/client_model v0.4.0 // indirect
	github.com/prometheus/common v0.44.0 // indirect
	github.com/prometheus/procfs v0.10.1 // indirect
	go.opentelemetry.io/otel v1.16.0 // indirect
	go.opentelemetry.io/otel/metric v1.16.0 // indirect
	go.opentelemetry.io/otel/trace v1.16.0 // indirect
	golang.org/x/net v0.23.0 // indirect
	golang.org/x/sys v0.18.0 // indirect
	golang.org/x/text v0.14.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20230822172742-b8732ec3820d // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

replace github.com/gitpod-io/gitpod/components/scrubber => ../../scrubber // leeway
