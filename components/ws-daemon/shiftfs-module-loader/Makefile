# source: https://github.com/toby63/shiftfs-dkms/blob/master/Makefile

modname := shiftfs
obj-m := $(modname).o

KVERSION := $(shell uname -r)
KDIR := /lib/modules/$(KVERSION)/build
PWD := "$$(pwd)"

ifdef DEBUG
CFLAGS_$(obj-m) := -DDEBUG
endif

EXTRA_CFLAGS := -DSHIFTFS_MAGIC=0x6a656a62

default:
	$(MAKE) -C $(KDIR) M=$(PWD) EXTRA_CFLAGS="${EXTRA_CFLAGS}" modules

clean:
	$(MAKE) O=$(PWD) -C $(KDIR) M=$(PWD) clean

load:
	-rmmod $(modname)
	insmod $(modname).ko

install:
	install -m 0755 -o root -g root $(modname).ko /lib/modules/$(KVERSION)/fs/
	depmod -a

uninstall:
	rm /lib/modules/$(KVERSION)/fs/$(modname).ko
	depmod -a

