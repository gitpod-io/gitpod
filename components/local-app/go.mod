module github.com/gitpod-io/local-app

go 1.16

require (
	github.com/dgrijalva/jwt-go v3.2.0+incompatible // indirect
	github.com/gitpod-io/gitpod/gitpod-protocol v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/supervisor/api v0.0.0-00010101000000-000000000000
	github.com/google/uuid v1.1.2
	github.com/gorilla/handlers v1.5.1
	github.com/gorilla/websocket v1.4.2 // indirect
	github.com/kevinburke/ssh_config v1.1.0
	github.com/sirupsen/logrus v1.7.0
	github.com/skratchdot/open-golang v0.0.0-20200116055534-eef842397966 // indirect
	github.com/urfave/cli/v2 v2.3.0
	github.com/zalando/go-keyring v0.1.1
	golang.org/x/oauth2 v0.0.0-20210201163806-010130855d6c // indirect
	golang.org/x/sys v0.0.0-20210403161142-5e06dd20ab57 // indirect
	google.golang.org/grpc v1.37.0
	google.golang.org/protobuf v1.26.0 // indirect
)

replace github.com/gitpod-io/gitpod/gitpod-protocol => ../gitpod-protocol/go // leeway

replace github.com/gitpod-io/gitpod/supervisor/api => ../supervisor-api/go // leeway
