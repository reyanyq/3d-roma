# 3D 景区漫游平台

这是西湖、颐和园 3D 旅游地图的可扩展新版项目。公共程序只保留一份，每个景区的数据和图片独立存放。

## 本地预览

在这个文件夹中运行：

```bash
npm start
```

然后访问 <http://localhost:4173>。

## 目录说明

- `app/`：网站界面和通用 3D 地图引擎
- `destinations/`：城市、景区、景点和交通配置
- `public/images/`：景区图片与缩略图
- `public/models/`：可选的 3D 建筑模型
- `tools/`：地图数据整理、校验和构建工具

## 新增景区

复制 `destinations/west-lake/` 作为新景区模板，再修改配置、地图、景点、交通和图片。最后把新景区登记到 `destinations/index.json`，页面会自动显示景区入口。

详细字段说明见 [`destinations/README.md`](./destinations/README.md)。

## 当前进度

- 西湖：已迁移为独立数据包
- 颐和园：已迁移为独立数据包
- GitHub 上的旧版继续作为稳定版本，不受本地改造影响
