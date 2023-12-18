# tojson.js

tojson.js 是一个支持解析 Psd、Sketch 转 json 的类库, 该 json 满足 fabric.js 渲染的数据格式.

# 在线体验

https://haixin-fang.github.io/tojson.js/playground

## 环境准备

playground 的示例项目，就是为开发者提供的基础应用示例。

node.js >= 16

先安装 pnpm

```bash
$ npm install -g pnpm
```

然后安装依赖

```bash
$ pnpm bootstrap
```

## 运行项目

执行命令

```bash
$ pnpm pg
```

最后在浏览器中打开

即可得到一个解析 Sketch, Psd 为 json 的项目

## 项目介绍

在本项目中，我们核心内容，是包含在 `packages/*` , 其中是解析各个文件的核心代码

- psd-json.js 解析 psd 转 json 的类库
- sketchtojson 解析 sketch 转 json 的类库
- tojson.js 解析 psd、sketch 转 json 的类库

### 使用

安装

```js
npm i -S tojson.js
```

或

```js
npm i -S psd-json.js
```

或

```js
npm i -S sketchtojson
```

使用

```js
import toJson, { getFileType, types as fileTypes, psdtojson, sketchtojson } from "tojson.js";
// psd、sketch文件
const result = await toJson(files);
// 或
const result = await psdtojson(files);
// 或
const result = await sketchtojson(files);
```

```js
import sketchtojson from "sketchtojson";
// psd、sketch文件
const result = await sketchtojson(files);
```

```js
import psdtojson from "psd-json.js";
// psd、sketch文件
const result = await psdtojson(files);
```

- getFileType 方法能获取文件类型
- types 能返回支持的文件类型

## 未来

后续会支持的功能

- ppt 解析
- pdf 解析
