import { createI18n } from 'vue-i18n'

const messages = {
  'zh-CN': {
    brand: '码锋', brandSub: 'GitEdge', signIn: '登录', signUp: '注册', signOut: '退出', email: '邮箱', password: '密码', name: '用户名',
    welcome: '把代码放在边缘', welcomeText: '轻量、可靠的 Git 协作空间。', dashboard: '工作台', repositories: '仓库', newRepo: '新建仓库', recent: '最近更新',
    code: '代码', issues: 'Issues', pulls: 'Pull Requests', wiki: 'Wiki', settings: '设置', open: '开放', closed: '已关闭', merged: '已合并',
    empty: '这里还没有内容', loading: '正在加载…', retry: '重试', submit: '继续', create: '创建', search: '搜索', defaultBranch: '默认分支',
    noDescription: '暂无描述', public: '公开', private: '私有', loginHint: '登录后访问你的仓库与协作空间', registerHint: '创建你的码锋账户', back: '返回工作台', branches: '分支', commits: '提交',
    repository: '仓库', documentation: '文档', edge: '运行在 Cloudflare 边缘', apiError: '请求失败，请稍后重试', demoNote: 'API 尚未连接时展示示例数据',
  },
  en: {
    brand: '码锋', brandSub: 'GitEdge', signIn: 'Sign in', signUp: 'Create account', signOut: 'Sign out', email: 'Email', password: 'Password', name: 'Username',
    welcome: 'Code at the edge', welcomeText: 'A small, reliable space for Git collaboration.', dashboard: 'Dashboard', repositories: 'Repositories', newRepo: 'New repository', recent: 'Recently updated',
    code: 'Code', issues: 'Issues', pulls: 'Pull Requests', wiki: 'Wiki', settings: 'Settings', open: 'Open', closed: 'Closed', merged: 'Merged',
    empty: 'Nothing here yet', loading: 'Loading…', retry: 'Retry', submit: 'Continue', create: 'Create', search: 'Search', defaultBranch: 'Default branch',
    noDescription: 'No description', public: 'Public', private: 'Private', loginHint: 'Sign in to access your repositories and collaboration space', registerHint: 'Create your GitEdge account', back: 'Back to dashboard', branches: 'branches', commits: 'commits',
    repository: 'Repository', documentation: 'Documentation', edge: 'Running on the Cloudflare edge', apiError: 'Request failed. Try again later.', demoNote: 'Showing sample data until the API is connected',
  },
}

export const i18n = createI18n({ legacy: false, locale: 'zh-CN', fallbackLocale: 'en', messages })
