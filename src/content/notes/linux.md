---
title: "linux"
summary: "通过实验室服务器学习linux"
date: 2026-05-11
tags: ["Linux", "服务器"]
cover: "/images/notes/linux/cover.jpg"
---
## 账户与权限

### 1. 超级管理员

进入root的方式：
```bash
su - 
sudo -i
```
### 2. 管理员用户
查看用户属于什么组，把用户变成管理员：
```bash
groups 用户名
sudo usermod -aG sudo 用户名
-a #是append 要不就是覆盖了
-G sudo #是加入超级管理员组
```

## 文件权限

学习了三类对象的权限，owner是文件所有者，group是文件所属组，others是其他用户
```bash
ls -lh 文件或目录
ls -ld 目录名
# -l: long listing format
# -h: human-readable 人类容易读的单位显示大小
# 权限        硬链接数  所有者  所属组  大小  修改时间  文件名
# -rw-r--r--   1      baimu  baimu  1234  May 7  test.txt
```

### chmod权限数字
当mod位数为3的时候，第一个数是owner的权限和，第二个数是write的权限和，第三个数是其余用户的权限和
700：只有本人可读、写、进入，常用于 .ssh 目录
600：只有本人可读写，常用于 authorized_keys 文件
755：本人可写，其他人可读可进入，常用于普通目录
644：本人可写，其他人可读，常用于普通文件
770：本人和同组成员可读写进入，其他人无权限
775：本人和同组成员可读写进入，其他人可读可进入
```bash
读：4
写：2
执行：1
# chmod 700 文件或目录
# 所有者：读 + 写 + 执行 = 7
# 所属组：无权限 = 0
# 其他人：无权限 = 0
```

### chown 所有者和所属组
修改文件或者目录所属
```bash
sudo chown 用户名：用户组 文件或目录
sudo -R chown 用户名：用户组 文件或目录
# -R：recursive 是递归
```

## 添加用户与配置密码

用adduser创建用户时，也会自动创建用户组，以及创建家目录/home/用户名
用useradd则不会自动配置家目录和密码
```bash
sudo adduser 用户名
sudo passwd 用户名 # 管理员给别人配置密码
passwd # 修改自己的密码
sudo chage -d 0 用户名 # 强制用户下次登录后修改密码
sudo chage -l 用户名 # 查看密码过期策略

# -d = --lastday 用户上一次修改密码的日期
# -l == --list 列出这个用户的密码有效期信息
# Last password change                                    : May 07, 2026
# Password expires                                        : never
# Password inactive                                       : never
# Account expires                                         : never
# Minimum number of days between password change          : 0
# Maximum number of days between password change          : 99999
# Number of days of warning before password expires       : 7

# Last password change
# 上次修改密码的时间

# Password expires
# 密码什么时候过期

# Password inactive
# 密码过期后多久账号变成不可用

# Account expires
# 账号什么时候过期

# Minimum number of days between password change
# 两次改密码之间最少间隔几天

# Maximum number of days between password change
# 密码最多可以用多少天

# Number of days of warning before password expires
# 密码过期前提前几天提醒用户
```

### 修改用户名

用户不能正在登录。先查看在线用户：
```bash
who
```

```bash
sudo usermod -l 新用户名 旧用户名
# -l = --login 修改用户的登录名
sudo groupmod -n 新用户名 旧用户名
# -n = --new-name 修改用户组名
sudo usermod -d /home/新用户名 -m 新用户名
# -d = --home 设置用户的家目录路径
# -m = --move-home  把旧家目录里的内容移动到新家目录
sudo chown -R 新用户名:新用户名 /home/新用户名
```

## 配置SSH key登录

```bash
sudo mkdir -p /home/用户名/.ssh
sudo nano /home/用户名/.ssh/authorized_keys
sudo chown -R 用户名:用户名 /home/用户名/.ssh
sudo chmod 700 /home/用户名/.ssh
sudo chmod 600 /home/用户名/.ssh/authorized_keys
```

### 成员本地连接服务器
本地shell：
```bash
ssh -p 端口号 用户名@IP地址
```
如果用SSH config：
```bash
Host eda-1
    HostName IP地址
    Port 端口号
    User 用户名
    IdentityFile ~/.ssh/私有密钥文件
```
之后直接运行
```bash
ssh eda-1
```

### 传文件

```bash
scp -P 端口号 本地文件目录 用户名@服务器IP:远程文件目录
```

## 挂载硬盘

Linux 里没有 Windows 那种 C盘、D盘 为主的概念，而是把磁盘分区挂载到某个目录。


```bash
# 临时挂载：
sudo mkdir -p /data
sudo mount 硬盘 /data

# 查看是否挂载成功：
df -h
lsblk -f

# 开机自动挂载：
sudo nano /etc/fstab

# 测试是否写对：
sudo mount -a
```

## 查看设备信息

```bash
hostnamectl # 主机名 系统版本 内核版本 架构
lsb_release -a # 查看Ubuntu发行版版本
uname -a # 查看Linux内核版本和系统架构

lscpu # 查看CPU

free -h # 查看内存 -h 是human-readable

lsblk # 查看硬盘、分区、挂载点
lsblk -f # 看 UUID、文件系统、挂载状态
df -h # 查看已经挂载的文件系统用了多少空间、还剩多少空间

lspci | grep -Ei "vga|3d|display|nvidia" # 查看是否有显卡
nvidia-smi # 查看显卡状态

ip addr # 查看网卡名称、状态、MAC 地址、IP 地址
ip route # ip route
nmcli connection show # 看网卡硬件

lsusb # 看usb设备

sudo lshw -short # 以简短表格形式查看整机硬件，包括 CPU、内存、磁盘、网卡、显卡等。
```

## 计算机网络

`127.0.0.1` 叫 localhost，本机回环地址。

内网常用形式：
```
192.168.x.x
10.x.x.x
172.16.x.x - 172.31.x.x
```

常用端口号：
```bash
22    # SSH 登录
80    # HTTP 网站
443   # HTTPS 网站
```

以ComfyUI为例，在远程访问：
其中 `--listen`是只允许服务器本机访问 ComfyUI，`--port`是指定的进程端口号（ComfyUI默认端口号也是8188）
`-L`是local port forwarding，本地端口转发，第一个8188是本地端口，冒号后面的是转发到服务器的什么IP地址和端口。在本地网页输入localhost:8188即可访问。

```bash
python main.py --listen 127.0.0.1 --port 8818
ssh -L 8188:127.0.0.1:8188 用户名@服务器IP
```