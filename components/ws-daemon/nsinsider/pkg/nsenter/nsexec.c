/*
 *
 * Copyright The runc authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#define _GNU_SOURCE
#include <endian.h>
#include <errno.h>
#include <fcntl.h>
#include <grp.h>
#include <sched.h>
#include <setjmp.h>
#include <signal.h>
#include <stdarg.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>
#include <unistd.h>

#include <sys/ioctl.h>
#include <sys/prctl.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <sys/wait.h>

#include <linux/limits.h>
#include <linux/netlink.h>
#include <linux/types.h>

#define PANIC   "panic"
#define FATAL   "fatal"
#define ERROR   "error"
#define WARNING "warning"
#define INFO    "info"
#define DEBUG   "debug"

/*
 * Use the raw syscall for versions of glibc which don't include a function for
 * it, namely (glibc 2.12).
 */
#if __GLIBC__ == 2 && __GLIBC_MINOR__ < 14
#	define _GNU_SOURCE
#	include "syscall.h"
#	if !defined(SYS_setns) && defined(__NR_setns)
#		define SYS_setns __NR_setns
#	endif

#ifndef SYS_setns
#	error "setns(2) syscall not supported by glibc version"
#endif

int setns(int fd, int nstype)
{
	return syscall(SYS_setns, fd, nstype);
}
#endif

static void write_log_with_info(const char *level, const char *function, int line, const char *format, ...)
{
	char message[1024] = {};

	va_list args;

	if (level == NULL)
		return;

	va_start(args, format);
	if (vsnprintf(message, sizeof(message), format, args) < 0)
		goto done;

	printf("{\"level\":\"%s\", \"msg\": \"%s:%d %s\"}\n", level, function, line, message);
	fflush(stdout);
done:
	va_end(args);
}

#define write_log(level, fmt, ...) \
	write_log_with_info((level), __FUNCTION__, __LINE__, (fmt), ##__VA_ARGS__)

#define bail(fmt, ...)                                       \
	do {                                                       \
		write_log(FATAL, "nsenter: " fmt ": %m", ##__VA_ARGS__); \
		exit(1);                                                 \
	} while(0)

void join_ns(char *fdstr, int nstype)
{
	int fd = atoi(fdstr);

	if (setns(fd, nstype) < 0)
		bail("failed to setns to fd %s", fdstr);

	close(fd);
}

void nsexec(void)
{
	char *in_init = getenv("_LIBNSENTER_INIT");
	if (in_init == NULL || *in_init == '\0')
		return;

	write_log(DEBUG, "nsexec started");

	/*
	 * Make the process non-dumpable, to avoid various race conditions that
	 * could cause processes in namespaces we're joining to access host
	 * resources (or potentially execute code).
	 */
	if (prctl(PR_SET_DUMPABLE, 0, 0, 0, 0) < 0)
		bail("failed to set process as non-dumpable");

	/* For debugging. */
	prctl(PR_SET_NAME, (unsigned long)"workspacekit:[CHILD]", 0, 0, 0);

	char *mntnsfd = getenv("_LIBNSENTER_MNTNSFD");
	if (mntnsfd != NULL) {
		write_log(DEBUG, "join mnt namespace: %s", mntnsfd);
		join_ns(mntnsfd, CLONE_NEWNS);
	}

	char *rootfd = getenv("_LIBNSENTER_ROOTFD");
	if (rootfd != NULL) {
		write_log(DEBUG, "chroot: %s", rootfd);
		fchdir(atoi(rootfd));
		chroot(".");
	}
	char *cwdfd = getenv("_LIBNSENTER_CWDFD");
	if (cwdfd != NULL) {
		write_log(DEBUG, "chcwd: %s", cwdfd);
		fchdir(atoi(cwdfd));
	}

	char *netnsfd = getenv("_LIBNSENTER_NETNSFD");
	if (netnsfd != NULL) {
		write_log(DEBUG, "join net namespace: %s", netnsfd);
		join_ns(netnsfd, CLONE_NEWNET);
	}

	char *pidnsfd = getenv("_LIBNSENTER_PIDNSFD");
	if (pidnsfd != NULL) {
		write_log(DEBUG, "join pid namespace: %s", pidnsfd);
		join_ns(pidnsfd, CLONE_NEWPID);
	}

	pid_t pid = fork();
	if (pid == -1) {
		bail("failed to fork");
	}
	if (pid == 0) {
		/* child process*/
		/* Finish executing, let the Go runtime take over. */
		write(1, "", 1); // write NULL byte
		return;
	}

	int wstatus;
	if (wait(&wstatus) < 0)
		bail("failed to wait for child process");

	if (WIFEXITED(wstatus)) {
		exit(WEXITSTATUS(wstatus));
	} else {
		exit(1);
	}
}
