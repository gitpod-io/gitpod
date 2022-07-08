module github.com/gitpod-io/gitpod/common-go/watch

go 1.18

require github.com/sirupsen/logrus v1.8.1 // indirect

require (
	github.com/fsnotify/fsnotify v1.4.9
	github.com/gitpod-io/gitpod/common-go/log v0.0.0-00010101000000-000000000000
)

require golang.org/x/sys v0.0.0-20220114195835-da31bd327af9 // indirect

replace github.com/gitpod-io/gitpod/common-go/log => ../log // leeway
