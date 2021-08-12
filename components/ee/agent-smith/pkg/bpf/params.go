// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package bpf

type ParamType uint32

// param types
const (
	PT_NONE               ParamType = 0
	PT_INT8               ParamType = 1
	PT_INT16              ParamType = 2
	PT_INT32              ParamType = 3
	PT_INT64              ParamType = 4
	PT_UINT8              ParamType = 5
	PT_UINT16             ParamType = 6
	PT_UINT32             ParamType = 7
	PT_UINT64             ParamType = 8
	PT_CHARBUF            ParamType = 9  /* A printable buffer of bytes, NULL terminated */
	PT_BYTEBUF            ParamType = 10 /* A raw buffer of bytes not suitable for printing */
	PT_ERRNO              ParamType = 11 /* this is an INT64, but will be interpreted as an error code */
	PT_SOCKADDR           ParamType = 12 /* A sockaddr structure, 1byte family + data */
	PT_SOCKTUPLE          ParamType = 13 /* A sockaddr tuple,1byte family + 12byte data + 12byte data */
	PT_FD                 ParamType = 14 /* An fd, 64bit */
	PT_PID                ParamType = 15 /* A pid/tid, 64bit */
	PT_FDLIST             ParamType = 16 /* A list of fds, 16bit count + count * (64bit fd + 16bit flags) */
	PT_FSPATH             ParamType = 17 /* A string containing a relative or absolute file system path, null terminated */
	PT_SYSCALLID          ParamType = 18 /* A 16bit system call ID. Can be used as a key for the g_syscall_info_table table. */
	PT_SIGTYPE            ParamType = 19 /* An 8bit signal number */
	PT_RELTIME            ParamType = 20 /* A relative time. Seconds * 10^9  + nanoseconds. 64bit. */
	PT_ABSTIME            ParamType = 21 /* An absolute time interval. Seconds from epoch * 10^9  + nanoseconds. 64bit. */
	PT_PORT               ParamType = 22 /* A TCP/UDP prt. 2 bytes. */
	PT_L4PROTO            ParamType = 23 /* A 1 byte IP protocol type. */
	PT_SOCKFAMILY         ParamType = 24 /* A 1 byte socket family. */
	PT_BOOL               ParamType = 25 /* A boolean value, 4 bytes. */
	PT_IPV4ADDR           ParamType = 26 /* A 4 byte raw IPv4 address. */
	PT_DYN                ParamType = 27 /* Type can vary depending on the context. Used for filter fields like evt.rawarg. */
	PT_FLAGS8             ParamType = 28 /* this is an UINT8, but will be interpreted as 8 bit flags. */
	PT_FLAGS16            ParamType = 29 /* this is an UINT16, but will be interpreted as 16 bit flags. */
	PT_FLAGS32            ParamType = 30 /* this is an UINT32, but will be interpreted as 32 bit flags. */
	PT_UID                ParamType = 31 /* this is an UINT32, MAX_UINT32 will be interpreted as no value. */
	PT_GID                ParamType = 32 /* this is an UINT32, MAX_UINT32 will be interpreted as no value. */
	PT_DOUBLE             ParamType = 33 /* this is a double precision floating point number. */
	PT_SIGSET             ParamType = 34 /* sigset_t. I only store the lower UINT32 of it */
	PT_CHARBUFARRAY       ParamType = 35 /* Pointer to an array of strings, exported by the user events decoder. 64bit. For internal use only. */
	PT_CHARBUF_PAIR_ARRAY ParamType = 36 /* Pointer to an array of string pairs, exported by the user events decoder. 64bit. For internal use only. */
	PT_IPV4NET            ParamType = 37 /* An IPv4 network. */
	PT_IPV6ADDR           ParamType = 38 /* A 16 byte raw IPv6 address. */
	PT_IPV6NET            ParamType = 39 /* An IPv6 network. */
	PT_IPADDR             ParamType = 40 /* Either an IPv4 or IPv6 address. The length indicates which one it is. */
	PT_IPNET              ParamType = 41 /* Either an IPv4 or IPv6 network. The length indicates which one it is. */
	PT_MODE               ParamType = 42 /* a 32 bit bitmask to represent file modes. */
	PT_FSRELPATH          ParamType = 43 /* A path relative to a dirfd. */
	PT_MAX                ParamType = 44 /* array size */
)

type ParamPrintFormat uint32

// print format
const (
	PF_NA            ParamPrintFormat = 0
	PF_DEC           ParamPrintFormat = 1 /* decimal */
	PF_HEX           ParamPrintFormat = 2 /* hexadecimal */
	PF_10_PADDED_DEC ParamPrintFormat = 3 /* decimal padded to 10 digits, useful to print the fractional part of a ns timestamp */
	PF_ID            ParamPrintFormat = 4
	PF_DIR           ParamPrintFormat = 5
	PF_OCT           ParamPrintFormat = 6 /* octal */
)

type PPMNameValue struct {
	Name  *[]byte
	Value uint32
}

type PPMParamInfo struct {
	Name  [PPM_MAX_NAME_LEN]byte
	Type  ParamType
	Fmt   ParamPrintFormat
	Info  [8]uint8 // a pointer to: an array of PPMNameValue array or an array of PPMParamInfo or the related dirfd
	Ninfo uint8
}

func makePPMParamInfo(name string, typ ParamType, fmt ParamPrintFormat, info ...[8]uint8) PPMParamInfo {
	pi := PPMParamInfo{
		Name: strToPPMName(name),
		Type: typ,
		Fmt:  fmt,
	}
	if len(info) > 0 {
		pi.Info = info[0]
		// Note
		// Ignoring .Ninfo because it is never declared from the event table, as far as I know.
		// Also, it would be straightforward to compute it here by looking at info[0] content.
	}

	return pi
}
