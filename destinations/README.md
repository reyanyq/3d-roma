# 景区数据包说明

每个景区使用一个独立文件夹。以 `west-lake` 为例：

- `config.json`：景区名称、地图比例、色彩和界面文字
- `map.json`：湖面、岛屿、道路、建筑和山体数据
- `places.json`：可点击飞行的景点列表
- `photos.json`：景点照片、作者、授权和来源
- `transport.json`：主要道路和地铁站
- `land-triangles.json`：可选的精细地形边界
- `sources.html`：地图及资料来源说明

新增景区时：

1. 复制 `west-lake` 文件夹并改名。
2. 替换该文件夹内的数据文件。
3. 把照片放进 `public/images/景区名/`。
4. 在 `destinations/index.json` 增加一条登记信息。

程序会按访问时选择的景区加载数据，因此增加景区不会让所有地图和图片一起下载。没有精细地形数据的景区可以不配置 `landTriangles`。
