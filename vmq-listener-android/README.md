# IDN V免签监听端

这是一个独立的安卓监听端，用来配合当前项目内置的 V免签接口：

- 心跳接口：`/appHeart`
- 收款推送接口：`/appPush`
- 心跳签名：`MD5(t + 通讯密钥)`
- 收款签名：`MD5(type + price + paidAt + eventId + mode + t + 通讯密钥)`

`type=1` 表示微信，`type=2` 表示支付宝。监听端没有订单号时，会同时上送通知发生时间和唯一事件 ID。后端只会在事件时间位于订单有效期内、签名未过期且事件从未处理过时，才按“支付方式 + 金额”匹配待支付订单。

App 内“手动推送”使用 `mode=TEST`，只用于检查通讯和签名，不会匹配订单、改变支付状态或触发发货；系统通知监听使用 `mode=LIVE`。

## 打包

用 Android Studio 打开本目录：

```text
vmq-listener-android
```

等待 Gradle 同步完成后，执行：

```text
Build > Build Bundle(s) / APK(s) > Build APK(s)
```

当前项目没有提交 Gradle Wrapper，需要本机 Android Studio 自带 Gradle 环境。建议使用 JDK 17 或更高版本。

## 手机配置

1. 安装 APK。
2. 填写服务地址，例如：

```text
https://idncar.com
```

也可以粘贴后台显示的 `https://idncar.com/appPush`，App 会自动裁剪为根地址。

如果域名反代或 Nginx 配置异常导致一直超时，可以临时填服务器 API 前缀：

```text
https://124.223.19.117/api/payments/vmq
```

这个直连 IP 模式只建议临时排障使用。正式使用建议修好服务器 Nginx 反代，让 `https://idncar.com/getState`、`https://idncar.com/appHeart`、`https://idncar.com/appPush` 正常返回后端 JSON。

3. 填写后台“V免签配置”里的通讯密钥。
4. 勾选要监听的渠道：支付宝、微信。
5. 点“保存配置”。
6. 点“打开通知读取权限”，允许 `IDN V免签通知监听`。
7. 点“允许前台通知”。
8. 点“启动心跳”。
9. 回后台点“刷新状态”，看到“监听在线”就说明心跳已连通。

## 测试收款

先创建一个小额测试订单，例如 `0.01`。用另一台手机付款后观察：

- 手机 Logcat 里是否出现 `Payment pushed`
- 后台 V免签配置页“最近收款”是否更新
- 订单是否变成已支付
- 支付宝/微信账单是否真实到账

## 生产注意

安卓系统容易杀后台，建议在手机系统里给这个 App、支付宝、微信都设置：

- 允许自启动
- 允许后台运行
- 关闭电池优化
- 锁屏后保持联网
- 通知权限保持开启

如果后台一直显示“未绑定/离线”，先确认公网能访问：

```text
https://你的域名/appHeart
https://你的域名/appPush
```

当前仓库里的 `deploy/ubuntu/nginx.conf` 已经包含 `/getState`、`/appHeart`、`/appPush` 的代理规则。如果你使用自己的 Nginx，也要把这三个根路径代理到 Java 后端，否则这些请求会被前端页面接走。
