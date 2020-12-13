package handover

import (
	"context"
	"fmt"
	"net"
	"os"

	"golang.org/x/sync/errgroup"
	"golang.org/x/sys/unix"
	"golang.org/x/xerrors"
)

// OfferHandover opens a Unix socket on socketFN and waits for another process to ask
// for the listeners socket file descriptor. Once that happens, it closes the Unix socket and returns.
// If the context is canceled before someone asks for the listener's socket,
// this function returns context.Canceled.
func OfferHandover(ctx context.Context, socketFN string, l *net.TCPListener) error {
	skt, err := net.Listen("unix", socketFN)
	if err != nil {
		return xerrors.Errorf("cannot create handover socket: %w", err)
	}
	defer skt.Close()

	done := make(chan struct{})
	eg, ctx := errgroup.WithContext(ctx)
	eg.Go(func() error {
		recv, err := skt.Accept()
		if err != nil {
			return xerrors.Errorf("cannot accept incoming handover connection: %w", err)
		}
		defer recv.Close()

		if ctx.Err() != nil {
			return ctx.Err()
		}

		listenConn := recv.(*net.UnixConn)
		err = sendListener(listenConn, l)
		if err != nil {
			return xerrors.Errorf("cannot send listener: %w", err)
		}

		defer close(done)
		return nil
	})
	eg.Go(func() error {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-done:
			return nil
		}
	})
	return eg.Wait()
}

// ReceiveHandover requests a net.Listener handover from a Unix socket on socketFN.
// If the context cancels before the transfer is complete, context.Canceled is returned.
func ReceiveHandover(ctx context.Context, socketFN string) (l net.Listener, err error) {
	conn, err := net.Dial("unix", socketFN)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	return receiveListener(ctx, conn.(*net.UnixConn))
}

// sendListener sends a copy of a TCP listener's file descriptor to a Unix socket.
// Callers should close l upon successful return of this function.
// Use in conjunction with receiveListener().
func sendListener(conn *net.UnixConn, l *net.TCPListener) error {
	connf, err := conn.File()
	if err != nil {
		return err
	}
	defer connf.Close()
	sktfd := int(connf.Fd())

	lf, err := l.File()
	if err != nil {
		return err
	}
	lfd := int(lf.Fd())

	rights := unix.UnixRights(lfd)
	return unix.Sendmsg(sktfd, nil, rights, nil, 0)
}

// receiveListener attempts to receieve a file descriptor from a Unix socket,
// and turns that fd into a net.Listener. This function makes several assumptions
// about the nature of the messages it receives:
//   - there is exactly one control message,
//     that contains exactly one SCM_RIGHTS message,
//     that contains exaxtly one file descriptor.
//   - the received file descriptor is a listening socket, s.t. we can call net.FileListener on it.
func receiveListener(ctx context.Context, conn *net.UnixConn) (l net.Listener, err error) {
	buf := make([]byte, unix.CmsgSpace(4))

	connf, err := conn.File()
	if err != nil {
		return nil, err
	}
	defer connf.Close()
	connfd := int(connf.Fd())

	recvC := make(chan error, 1)
	go func() {
		_, _, _, _, err := unix.Recvmsg(connfd, nil, buf, 0)
		recvC <- err
	}()
	select {
	case err = <-recvC:
	case <-ctx.Done():
		err = ctx.Err()
	}
	if err != nil {
		return nil, err
	}

	msgs, err := unix.ParseSocketControlMessage(buf)
	if err != nil {
		return nil, err
	}
	if len(msgs) != 1 {
		return nil, fmt.Errorf("expected a single socket control message")
	}

	fds, err := unix.ParseUnixRights(&msgs[0])
	if err != nil {
		return nil, err
	}
	if len(fds) == 0 {
		return nil, fmt.Errorf("expected a single socket FD")
	}

	return net.FileListener(os.NewFile(uintptr(fds[0]), ""))
}
