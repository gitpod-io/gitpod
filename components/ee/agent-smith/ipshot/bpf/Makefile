CLANG ?= clang
CFLAGS ?= -Wno-unused-value -Wno-pointer-sign -Wno-compare-distinct-pointer-types -Wno-gnu-variable-sized-type-not-at-end -Wno-address-of-packed-member -Wno-tautological-compare -Wno-unknown-warning-option
EXTRA_CFLAGS ?= -O2 -target bpf
ARCH := $(shell uname -m | sed 's/x86_64/x86/')

# Get Clang's default includes on this system. We'll explicitly add these dirs
# to the includes list when compiling with `-target bpf` because otherwise some
# architecture-specific dirs will be "missing" on some architectures/distros -
# headers such as asm/types.h, asm/byteorder.h, asm/socket.h, asm/sockios.h,
# sys/cdefs.h etc. might be missing.
#
# Use '-idirafter' to do not interfere with include mechanics
# except when the build would have failed anyways.
CLANG_BPF_SYS_INCLUDES = $(shell $(CLANG) -v -E - </dev/null 2>&1 \
	| sed -n '/<...> search starts here:/,/End of search list./{ s| \(/.*\)|-idirafter \1|p }')

ifeq ($(V),1)
	Q =
	msg =
else
	Q = @
	msg = @printf '  %-8s %s%s\n'					\
		      "$(1)"						\
		      "$(patsubst $(abspath $(OUTPUT))/%,%,$(2))"	\
		      "$(if $(3), $(3))";
	MAKEFLAGS += --no-print-directory
endif

OBJS = tc.bpf.o

.PHONY: all
all: $(OBJS)

.PHONY: clean
clean:
	$(call msg,CLEAN)
	$(Q)rm -rf $(OBJS)

$(OBJS): $(patsubst %.o,%.c,$(OBJS))
	$(call msg,BPF,$@)
	$(Q)$(CLANG) $(CFLAGS) $(EXTRA_CFLAGS) -D__TARGET_ARCH_$(ARCH) $(CLANG_BPF_SYS_INCLUDES) -c $(filter %.c,$^) -o $@
