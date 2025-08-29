## TODO

- [ ] **标题优化**  
  - 支持更灵活的标题编辑与校验（如字数限制提示、格式检查）

- [ ] **图片支持**  
  - 增强图片上传/粘贴体验  （Github测试成功，微信图传还有代测试)
  - 增加图片压缩与自适应显示  
  - 修复部分情况下图片丢失或无法预览的问题  

- [ ] **草稿管理**  
  - 支持新增草稿、删除草稿  
  - 自动保存草稿，避免因系统错误导致内容丢失  
  - 提供草稿版本对比与回退功能  

- [ ] **公众号名片插入**  
  - 解决插入公众号名片时的编辑错误  
  - 优化名片展示效果与兼容性  

- [ ] **跨域问题（CORS）**  
  - 排查并修复编辑器在加载远程资源时的 CORS 报错  
  - 提供更健壮的跨域处理方案  


## 如何配置Github 图传

仓库必须是 Public

进入你的 GitHub 仓库
Settings → 最底部 → Danger Zone → Change visibility → Make public


重新生成 Personal Access Token

GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
Generate new token → 勾选完整的 repo 权限 → 复制保存
---

