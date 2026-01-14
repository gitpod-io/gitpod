.PHONY: all clean build-all

VERSION := 0.1.0
BINARY := gitpod-network-diag
BUILD_DIR := dist

all: build-all

build-all: $(BUILD_DIR)/$(BINARY)-linux-amd64 $(BUILD_DIR)/$(BINARY)-linux-arm64 $(BUILD_DIR)/$(BINARY)-darwin-amd64 $(BUILD_DIR)/$(BINARY)-darwin-arm64 $(BUILD_DIR)/$(BINARY)-windows-amd64.exe

$(BUILD_DIR)/$(BINARY)-linux-amd64:
	GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o $@ .

$(BUILD_DIR)/$(BINARY)-linux-arm64:
	GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o $@ .

$(BUILD_DIR)/$(BINARY)-darwin-amd64:
	GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o $@ .

$(BUILD_DIR)/$(BINARY)-darwin-arm64:
	GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o $@ .

$(BUILD_DIR)/$(BINARY)-windows-amd64.exe:
	GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o $@ .

clean:
	rm -rf $(BUILD_DIR) $(BINARY)
