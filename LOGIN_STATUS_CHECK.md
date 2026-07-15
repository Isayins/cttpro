# 登录状态检测流程

> 适用场景：检测你自己账号在当前浏览器里的 ChatGPT 登录态是否还有效。
>
> 安全原则：只判断登录态，不打印、不保存、不上传 `accessToken`、`sessionToken`、`id_token` 或 cookies。

## 一、判断依据

当前浏览器已经登录 `chatgpt.com` 时，可以在同源页面请求：

```text
https://chatgpt.com/api/auth/session
```

如果请求成功，并且返回内容里存在用户信息或 session 标记，通常说明登录态有效。

常见判断字段：

```text
user
expires
accessToken
sessionToken
```

注意：`accessToken` 和 `sessionToken` 等同登录凭证，不能外发，不能贴给别人，也不要写入日志。

## 二、浏览器手动检测

1. 打开浏览器访问：

```text
https://chatgpt.com
```

2. 确认页面已经是你的账号登录状态。

3. 按 `F12` 打开开发者工具。

4. 切换到 `Console`。

5. 粘贴下面代码并回车：

```js
(async () => {
  const result = {
    url: location.origin,
    httpStatus: null,
    loggedIn: false,
    hasUser: false,
    hasAccessToken: false,
    hasSessionToken: false,
    expires: "",
    error: "",
  };

  try {
    const res = await fetch("/api/auth/session", {
      credentials: "include",
      cache: "no-store",
    });

    result.httpStatus = res.status;

    const type = res.headers.get("content-type") || "";
    const data = type.includes("application/json")
      ? await res.json().catch(() => null)
      : null;

    result.hasUser = !!data?.user;
    result.hasAccessToken = !!data?.accessToken;
    result.hasSessionToken = !!data?.sessionToken;
    result.expires = data?.expires || "";
    result.loggedIn = res.ok && !!data && (
      result.hasUser ||
      result.hasAccessToken ||
      result.hasSessionToken ||
      !!result.expires
    );
  } catch (err) {
    result.error = String(err?.message || err);
  }

  console.table(result);
})();
```

6. 看 `loggedIn`：

```text
true  = 当前浏览器登录态大概率有效
false = 未登录、登录已失效、网络异常，或接口结构变化
```

## 三、结果解释

| 现象 | 含义 |
| --- | --- |
| `loggedIn = true` | 当前浏览器 session 可用 |
| `httpStatus = 200` 但 `loggedIn = false` | 接口返回结构可能变化，或 session 内容为空 |
| `httpStatus = 401 / 403` | 未登录、登录态失效，或触发访问限制 |
| `error = Failed to fetch` | 网络、代理、跨域页面、浏览器扩展或站点访问异常 |
| `hasAccessToken = true` | 已拿到登录访问凭证，但代码只显示布尔值，不显示 token |
| `hasSessionToken = true` | 已拿到 session 标记，但代码只显示布尔值，不显示 token |

## 四、Network 面板复核

如果 Console 结果异常，可以用 Network 面板确认：

1. 打开开发者工具的 `Network`。
2. 勾选 `Preserve log`。
3. 在地址栏重新访问：

```text
https://chatgpt.com
```

4. 过滤：

```text
/api/auth/session
```

5. 查看该请求的状态码：

```text
200      通常表示 session 请求成功
401/403  通常表示登录态不可用或访问被拦截
```

不要复制 `Response` 里的完整内容给别人。

## 五、和提取出来的程序逻辑对应

从提取出的字符串看，这个工具在注册流程后面也会请求：

```text
/api/auth/session
```

并查找：

```text
accessToken
sessionToken
```

后续请求会使用：

```text
Authorization: Bearer <accessToken>
```

所以它的核心判断也是：同一个会话里能否拿到有效 session。

## 六、安全建议

- 不要用陌生 exe 检测真实账号登录态。
- 不要打印完整 `data`，尤其不要执行 `console.log(data)` 后截图外发。
- 不要保存 cookies、`accessToken`、`sessionToken`、`id_token`。
- 不要把检测结果上传到第三方接口。
- 如果只是确认自己是否登录，使用本文件里的 Console 检测就够了。

## 七、最小检测版

只想要一个最短判断，可以用：

```js
fetch("/api/auth/session", { credentials: "include", cache: "no-store" })
  .then(r => r.ok ? r.json() : null)
  .then(s => console.log(!!(s && (s.user || s.expires || s.accessToken || s.sessionToken))))
  .catch(() => console.log(false));
```

返回：

```text
true  登录态大概率有效
false 登录态无效或请求失败
```
