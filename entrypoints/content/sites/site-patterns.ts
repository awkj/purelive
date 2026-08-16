// 这个文件必须保持轻量：content 启动器和 manifest 构建都会直接导入它。
// 不要在这里导入 React、状态仓库或具体站点 adapter。
export const MATCH_PATTERNS = ['*://www.douyu.com/*', '*://v.douyu.com/show/*'];
