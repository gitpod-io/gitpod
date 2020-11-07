package sshproxy

import (
	"io/ioutil"
	"net"

	"github.com/gitpod-io/gitpod/common-go/log"
	ssh "golang.org/x/crypto/ssh"
)

func handleConn(conn net.Conn, conf *ssh.ServerConfig) {
	defer conn.Close()
	sshConn, chans, reqs, err := ssh.NewServerConn(conn, conf)
	if err != nil {
		log.WithError(err).Warn("handshake failed:", err)
		return
	}
	go ssh.DiscardRequests(reqs)

	for ch := range chans {
		if ch.ChannelType() != "session" {
			ch.Reject(ssh.UnknownChannelType, "unsupported channel type")
			log.Warnf("channel rejected, unsupported type: %v", ch.ChannelType())
			continue
		}
		go handleChannel(sshConn, ch)
	}
}

func setupHostKey(config *ssh.ServerConfig) {
	// ssh-keygen -t rsa
	hostKeyData, err := ioutil.ReadFile("ssh_host_rsa_key")
	if err != nil {
		log.Fatalf("failed to load host key (%s)", err)
	}
	signer, err := ssh.ParsePrivateKey(hostKeyData)
	if err != nil {
		log.Fatalf("failed to parse host key (%s)", err)
	}
	config.AddHostKey(signer)
}

func Run() error {
	config := &ssh.ServerConfig{
		PublicKeyCallback: func(conn ssh.ConnMetadata, key ssh.PublicKey) (*ssh.Permissions, error) {
			return &ssh.Permissions{}, nil
		},
		PasswordCallback: func(conn ssh.ConnMetadata, password []byte) (*ssh.Permissions, error) {
			return &ssh.Permissions{}, nil
		},
	}
	setupHostKey(config)

	listener, err := net.Listen("tcp", ":2222")
	if err != nil {
		return err
	}
	for {
		conn, err := listener.Accept()
		if err != nil {
			log.WithError(err).Warn("accept failed")
			continue
		}
		go handleConn(conn, config)
	}
}
