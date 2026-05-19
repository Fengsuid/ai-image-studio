const state = {
  lang: localStorage.getItem("lang") || "zh",
  user: null,
  settings: null,
  firstRun: false,
  view: "home",
  forceHero: false,
  history: [],
  imageSessions: [],
  activeImageSessionId: "",
  generationMeta: {},
  generating: false,
  generationStartedAt: 0,
  elapsedTimer: null,
  funIndex: 0,
  funTimer: null,
  draftPrompt: "",
  generationOptions: {
    size: "auto",
    quality: "auto",
    background: "auto",
    outputFormat: "png",
    candidateCount: 1
  },
  references: [],
  publishToSquare: false,
  publicGallery: [],
  galleryLeaderboard: [],
  galleryLeaderboardRange: "week",
  galleryLeaderboardType: "all",
  galleryLeaderboardLoading: false,
  announcements: [],
  unreadAnnouncements: [],
  notificationFilter: "all",
  notificationModalShown: new Set(),
  checkin: {
    checkedInToday: false,
    credit: 1
  },
  authMode: "login",
  libraryTag: "all",
  librarySearch: "",
  promptItems: [],
  promptVisible: 20,
  promptLoading: true,
  editor: {
    imageUrl: "",
    imageData: "",
    prompt: "",
    tool: "brush",
    color: "#7c3aed",
    zoom: 1,
    history: [],
    pointerDown: false,
    startPoint: null,
    snapshot: null
  },
  stats: {
    todayGenerated: 4200
  },
  versionInfo: null,
  worksFilter: "all",
  worksSearch: "",
  worksSelected: new Set(),
  editing: false,
  editStartedAt: 0,
  editElapsedTimer: null,
  editLongRunningWarned: false,
  editLastFailure: null,
  editFailureHideTimer: null,
  routeSyncing: false,
  editAbortController: null,
  generateAbortController: null,
  currentGenerationRequestId: "",
  continuationMode: localStorage.getItem("imageStudio.continuationMode") || "auto",
  continuationLockedSessionId: "",
  continuationLastImageUrl: "",
  tagsLibrary: { bySlug: {}, list: [], summary: null, loadedAt: 0 },
  csrfToken: ""
};

const i18n = {
  zh: {
    brand: "ai-image-studio",
    promptLibrary: "画廊",
    imageEditor: "图片编辑",
    notifications: "通知",
    notificationsTitle: "通知",
    notificationsEmpty: "暂无通知",
    notificationsUnread: "未读通知",
    notificationsAll: "全部",
    notificationsImportant: "重要",
    notificationAck: "我已知晓",
    notificationRead: "标记已读",
    notificationImportant: "重要",
    contact: "联系邮箱",
    admin: "后台",
    myWorks: "我的作品",
    login: "登录",
    logout: "退出",
    headPre: "用想象力",
    headItalic: "创造",
    headPost: "世界",
    desc: "用 GPT Image 将你的创意变为精美图片，只需描述你脑海中的画面。",
    reviews: "生成后会自动保存到你的图库",
    todayGeneratedPrefix: "今日已生成",
    todayGeneratedSuffix: "张图片",
    recentTitle: "最近创作",
    recentSubtitle: "来自你的灵感",
    examplesLabel: "灵感示例",
    viewMore: "查看更多",
    placeholder: "描述你想创作的图片...",
    create: "生成",
    imageSessions: "文生图对话",
    openChats: "对话列表",
    currentSession: "当前会话",
    newSession: "新建对话",
    sessionUntitled: "新的生图对话",
    historySession: "历史生成",
    emptySession: "这个对话还没有生图记录",
    roundCount: "轮",
    elapsed: "耗时",
    generatingElapsed: "生成中",
    generating: "生成中...",
    reference: "参考图",
    referencePreviewOnly: "参考图仅作灵感记录",
    referencePreviewToast: "已添加参考图预览；当前版本不会把参考图发送给生图模型",
    options: "参数",
    composerParams: "尺寸 / 质量 / 格式",
    addReference: "添加参考图预览",
    generateDisabledApiKey: "API 未配置",
    generateDisabledGenerating: "正在生成",
    generateDisabledCredits: "积分不足",
    generateReadyHint: "准备好后点击生成",
    continuationContextLabel: "续图",
    continuationOffLabel: "本次不续图",
    closeContinuation: "本次不续图",
    more: "更多",
    editPrompt: "改提示词",
    imageToImageShort: "图生图",
    size: "尺寸",
    quality: "质量",
    background: "背景",
    format: "格式",
    retry: "再次生成",
    download: "保存",
    edit: "改提示词",
    editImage: "编辑",
    openEditor: "图生图",
    emptyWorks: "还没有生成记录",
    uploadEditImage: "上传或从作品中选择图片",
    uploadEditHint: "支持画笔、矩形选区和局部编辑描述",
    copy: "复制提示词",
    use: "去生成",
    libraryBadge: "公开图片画廊",
    libraryTitle: "探索公开作品",
    librarySubtitle: "浏览用户公开的图片、路线和提示词，一键带入生成台。",
    librarySearchLabel: "画廊",
    search: "搜索",
    all: "全部",
    noResults: "没有找到匹配的作品",
    preview: "预览",
    totalPrompts: "画廊作品",
    totalSources: "数据源",
    loadMore: "加载更多灵感",
    loadingPrompts: "正在加载画廊...",
    loginTitle: "登录以继续创作",
    registerTitle: "注册账号",
    authGift: "注册登录以继续创作",
    authContinue: "注册登录以继续创作",
    authBonus: "注册赠送 10 积分，每日签到 +1 积分",
    email: "邮箱",
    password: "密码",
    name: "昵称",
    submitLogin: "登录",
    submitRegister: "注册",
    switchToRegister: "还没有账号？注册",
    switchToLogin: "已有账号？登录",
    skip: "暂不登录",
    creditsTitle: "每日签到",
    creditsBalance: "当前积分",
    oneCredit: "每次生成消耗积分",
    contactTitle: "联系管理员",
    contactDesc: "通过邮箱联系管理员",
    contactEmailLabel: "管理员邮箱",
    contactCopy: "复制邮箱",
    contactCopied: "邮箱已复制",
    contactInput: "邮箱",
    messageInput: "留言内容（选填）",
    submit: "提交",
    received: "已收到",
    receivedDesc: "管理员会尽快联系你",
    close: "关闭",
    adminTitle: "后台管理",
    settings: "接口配置",
    users: "用户",
    apiKey: "OpenAI API Key",
    apiBaseUrl: "API 地址",
    model: "模型",
    defaultCredits: "默认额度",
    generationCost: "每张图消耗积分",
    maxImages: "单次张数",
    contactAdminEmail: "联系管理员邮箱",
    candidateCount: "候选",
    queuePosition: "队列",
    queueRunning: "正在生成",
    allowRegistration: "开放注册",
    requireApproval: "注册后需启用",
    save: "保存",
    clearKey: "清除 Key",
    currentKey: "当前 Key",
    noKey: "当前未配置 Key",
    publishToSquare: "公开到广场",
    publishOriginal: "公开原图",
    publishImage: "公开",
    publishedImage: "已公开",
    publishWithOriginal: "含原图公开",
    publishDone: "已上传广场",
    publishFailed: "上传失败",
    publishSettings: "发布设置",
    publishSettingsDesc: "公开图生图时会保留原图，便于理解来源",
    sourceImage: "原图",
    routeTitle: "对话线路",
    squareWorks: "广场作品",
    publishDialogTitle: "发布到广场",
    editPublicTags: "编辑标签",
    publishDialogDesc: "给作品加上标签，别人就能在广场里更容易搜到它。",
    publicTags: "公开标签",
    tagInputHint: "仅能选择已有标签，新标签请联系管理员处理",
    requiredPublicTag: "系统自动标签",
    chooseExistingTags: "选择已有标签",
    noExistingTags: "暂无可选标签，作品仍会带系统标签公开。",
    publishOriginalOption: "同时公开原图",
    publishOriginalRequired: "图生图公开会同时展示输入原图",
    bindSourceTitle: "选择原图后发布为图生图",
    bindSourceDesc: "这个提示词与已有公开内容高度相似，必须选择一个公开画廊作品作为来源，系统会公开为图生图变体并保留审计链路。",
    bindSourceCurrentPrompt: "本次提示词",
    bindSourceOriginalPrompt: "原图提示词",
    bindSourceEmpty: "暂无可绑定的公开画廊作品",
    bindSourceConfirm: "绑定并发布",
    bindSourceCancel: "返回",
    sourcePrompt: "原图提示词",
    currentPrompt: "本次提示词",
    sourceImageId: "来源图片 ID",
    imageUnavailable: "图片暂不可用",
    likeImage: "点赞",
    unlikeImage: "取消点赞",
    galleryLeaderboard: "点赞排行榜",
    galleryLeaderboardDesc: "按点赞数展示最近受欢迎的公开作品",
    saveTags: "保存标签",
    tagsSaved: "标签已保存",
    authorBy: "作者",
    textToImageAction: "提示词文生图",
    imageToImageAction: "图生图",
    viewDetail: "查看详情",
    inputImage: "输入图",
    outputImage: "结果图",
    imageToImage: "图生图",
    textToImage: "文生图",
    unpublish: "取消公开",
    unpublishDone: "已取消公开",
    role: "角色",
    status: "状态",
    credits: "积分",
    checkinToday: "签到领取积分",
    checkedIn: "今日已签到",
    checkinReward: "每天签到可获得 1 积分",
    noticeTitle: "内容合规管理公告",
    noticeSubtitle: "为营造健康、积极、向上的平台环境，我们现已全面升级内容安全审核机制",
    noticeCore: "核心管控规范",
    noticePrivacy: "隐私承诺",
    noticeTogether: "共同守护：感谢您的理解与配合。清朗的网络空间需要我们每一个人共同维护。",
    noticeAck: "我已了解",
    active: "启用",
    disabled: "停用",
    user: "用户",
    adminRole: "管理员",
    backendVersion: "后端版本",
    backendStartedAt: "启动时间",
    backendUptime: "运行时长",
    timeoutOpenAI: "OpenAI 超时",
    timeoutDownload: "下载超时",
    seconds: "秒",
    versionInfoTitle: "版本信息",
    worksFilterAll: "全部",
    worksFilterPublic: "已公开",
    worksFilterPrivate: "未公开",
    worksFilterText: "文生图",
    worksFilterImage: "图生图",
    worksFilterArchived: "已归档",
    worksFilterEmpty: "当前筛选下没有作品",
    worksBatchDownload: "批量下载",
    worksOpenDetail: "查看详情",
    worksDetailTitle: "作品详情",
    worksSelected: "已选",
    worksDownloadStarted: "已开始下载",
    worksContinue: "延续生成",
    worksCopyPrompt: "复制提示词",
    publishOriginalRequiredToast: "图生图公开必须保留原图",
    promptEdit: "编辑",
    promptDelete: "隐藏",
    promptHidden: "已隐藏",
    promptCreateTitle: "新建提示词",
    promptEditTitle: "编辑提示词",
    promptEditDesc: "修改后会立即对所有访客生效；隐藏的提示词只有管理员能看到。",
    promptFieldTitle: "标题",
    promptFieldImage: "封面图 URL",
    promptFieldPrompt: "提示词内容",
    promptFieldTags: "标签 (用空格或逗号分隔)",
    promptFieldAuthor: "作者",
    promptFieldSource: "来源",
    promptFieldSourceUrl: "来源链接",
    promptFieldStatus: "状态",
    promptFieldSortOrder: "排序权重",
    promptStatusActive: "启用",
    promptStatusHidden: "隐藏",
    promptCreate: "创建",
    promptSave: "保存",
    promptSoftDelete: "隐藏此条",
    publishOriginalNoticeTitle: "公开图生图作品需要保留原图",
    publishOriginalNoticeBody: "为了让其他用户能在广场看到「修改前」和「修改后」的对比，公开的图生图必须包含原图。这条规则会让你的作品更有学习价值，也避免他人误解你的提示词。",
    publishOriginalNoticeRemember: "7 天内不再提示",
    publishOriginalNoticeCancel: "暂不公开",
    publishOriginalNoticeConfirm: "保留原图并公开",
    routeSectionTitle: "创作路线",
    routeSectionExpand: "展开",
    routeSectionCollapse: "收起",
    routeStepUntitled: "（未填写描述）",
    editorElapsed: "耗时",
    editorElapsedLong: "生成时间较长，可继续等待或点击取消重试",
    editorCancel: "取消",
    editorRetry: "重试",
    editorRetryHint: "已保留你的提示词与图片，可直接点击重试",
    continuationToggleLabel: "延续上一张图",
    continuationToggleHint: "下一次生成会基于上一张完成图编辑",
    continuationActiveToast: "已基于上一张图重新生成",
    continuationDisabledToast: "下次生成将从空白文生图开始",
    tagsLibraryTitle: "标签库",
    tagsLibraryEmpty: "暂无标签",
    tagStatsSystem: "系统标签",
    tagStatsWithContent: "已有内容",
    tagStatsEmpty: "待补内容",
    emptyTagTitle: "暂无「{tag}」作品",
    emptyTagBody: "这个标签已经在标签库中，当前还没有对应公开作品。",
    emptyTagGenerate: "用这个标签去生成",
    emptyTagNearby: "相近标签",
    emptyTagAdminCreate: "为这个标签新建示例",
    tagsAddNew: "新建标签",
    tagsSlug: "slug",
    tagsLabelZh: "中文",
    tagsLabelEn: "English",
    tagsAliases: "别名",
    tagsSource: "来源",
    tagsStatus: "状态",
    tagsHue: "色相",
    tagsUsage: "使用次数",
    tagsCoverage: "内容覆盖",
    tagsMerge: "合并",
    tagsSaveTag: "保存",
    tagsStatusActive: "启用",
    tagsStatusHidden: "隐藏",
    editorRecentStripTitle: "本次会话最近输出",
    editorRecentEmpty: "暂无可切换的基底图",
    editorRecentSwitched: "已切换基底图",
    funMsgs: [
      "正在调配完美的色彩...",
      "撒上一些像素灵感...",
      "AI 画笔正在起步...",
      "将光影和构图融合在一起...",
      "正在召唤你的想象...",
      "杰作正在生长...",
      "创意正在酝酿中...",
      "添加最后的点睛之笔..."
    ]
  },
  en: {
    brand: "ai-image-studio",
    promptLibrary: "Gallery",
    imageEditor: "Image Editor",
    notifications: "Notices",
    notificationsTitle: "Notices",
    notificationsEmpty: "No notices",
    notificationsUnread: "Unread notices",
    notificationsAll: "All",
    notificationsImportant: "Important",
    notificationAck: "I understand",
    notificationRead: "Mark read",
    notificationImportant: "Important",
    contact: "Email",
    admin: "Admin",
    myWorks: "My Works",
    login: "Login",
    logout: "Logout",
    headPre: "Create with",
    headItalic: "imagination",
    headPost: "",
    desc: "Transform your ideas into polished visuals with GPT Image. Just describe what you see in your mind.",
    reviews: "Generated images are saved to your gallery",
    todayGeneratedPrefix: "Today generated",
    todayGeneratedSuffix: "images",
    recentTitle: "Recent Creations",
    recentSubtitle: "Your creative history",
    examplesLabel: "Inspiration",
    viewMore: "View more",
    placeholder: "Describe the image you want to create...",
    create: "Create",
    imageSessions: "Text-to-image chats",
    openChats: "Chats",
    currentSession: "Current chat",
    newSession: "New chat",
    sessionUntitled: "New image chat",
    historySession: "Generation history",
    emptySession: "No generations in this chat yet",
    roundCount: "rounds",
    elapsed: "Elapsed",
    generatingElapsed: "Generating",
    generating: "Creating...",
    reference: "Reference",
    referencePreviewOnly: "Reference is saved as inspiration only",
    referencePreviewToast: "Reference previews added; this version does not send them to the image model",
    options: "Options",
    composerParams: "Size / Quality / Format",
    addReference: "Add reference preview",
    generateDisabledApiKey: "API key not configured",
    generateDisabledGenerating: "Generating",
    generateDisabledCredits: "Not enough credits",
    generateReadyHint: "Ready to create",
    continuationContextLabel: "Continue",
    continuationOffLabel: "Not continuing",
    closeContinuation: "Do not continue this time",
    more: "More",
    editPrompt: "Edit prompt",
    imageToImageShort: "Image-to-image",
    size: "Size",
    quality: "Quality",
    background: "Background",
    format: "Format",
    retry: "Regenerate",
    download: "Save",
    edit: "Edit prompt",
    editImage: "Edit",
    openEditor: "Edit image",
    emptyWorks: "No generated images yet",
    uploadEditImage: "Upload or choose an image",
    uploadEditHint: "Brush, rectangle selection, and local edit prompts",
    copy: "Copy prompt",
    use: "Generate",
    libraryBadge: "Public Image Gallery",
    libraryTitle: "Explore Public Works",
    librarySubtitle: "Browse public images, routes, and prompts, then send one straight to the composer.",
    librarySearchLabel: "Gallery",
    search: "Search",
    all: "All",
    noResults: "No matching works found",
    preview: "Preview",
    totalPrompts: "Gallery Works",
    totalSources: "Data Sources",
    loadMore: "Load More Inspiration",
    loadingPrompts: "Loading gallery...",
    loginTitle: "Login to continue",
    registerTitle: "Create account",
    authGift: "Sign in to continue creating",
    authContinue: "Sign in to continue creating",
    authBonus: "10 bonus credits on signup + 1 daily check-in credit",
    email: "Email",
    password: "Password",
    name: "Name",
    submitLogin: "Login",
    submitRegister: "Register",
    switchToRegister: "Need an account? Register",
    switchToLogin: "Already have an account? Login",
    skip: "Skip",
    creditsTitle: "Daily Check-in",
    creditsBalance: "Balance",
    oneCredit: "Credits per image",
    contactTitle: "Contact Admin",
    contactDesc: "Contact the admin by email",
    contactEmailLabel: "Admin email",
    contactCopy: "Copy email",
    contactCopied: "Email copied",
    contactInput: "Email",
    messageInput: "Message (optional)",
    submit: "Submit",
    received: "Received",
    receivedDesc: "Admin will contact you soon",
    close: "Close",
    adminTitle: "Admin",
    settings: "Settings",
    users: "Users",
    apiKey: "OpenAI API Key",
    apiBaseUrl: "API Base URL",
    model: "Model",
    defaultCredits: "Default credits",
    generationCost: "Credits per image",
    maxImages: "Images per request",
    contactAdminEmail: "Contact admin email",
    candidateCount: "Candidates",
    queuePosition: "Queue",
    queueRunning: "Running",
    allowRegistration: "Allow registration",
    requireApproval: "Require approval",
    save: "Save",
    clearKey: "Clear key",
    currentKey: "Current key",
    noKey: "No key configured",
    publishToSquare: "Publish to square",
    publishOriginal: "Publish original",
    publishImage: "Publish",
    publishedImage: "Published",
    publishWithOriginal: "Publish with original",
    publishDone: "Published to square",
    publishFailed: "Publish failed",
    publishSettings: "Publish settings",
    publishSettingsDesc: "Image-to-image publishing keeps the source for context",
    sourceImage: "Source",
    routeTitle: "Conversation route",
    squareWorks: "Square works",
    publishDialogTitle: "Publish to square",
    editPublicTags: "Edit tags",
    publishDialogDesc: "Add tags so people can find this work in the square.",
    publicTags: "Public tags",
    tagInputHint: "Choose existing tags only. Contact an admin for new tag requests.",
    requiredPublicTag: "Required system tag",
    chooseExistingTags: "Choose existing tags",
    noExistingTags: "No optional tags yet. The work will still publish with the system tag.",
    publishOriginalOption: "Also publish original",
    publishOriginalRequired: "Image-to-image works publish with the input image",
    bindSourceTitle: "Choose a source image",
    bindSourceDesc: "This prompt is highly similar to existing public content. Choose a public gallery work as the source, then publish it as an image-to-image variant with an audit trail.",
    bindSourceCurrentPrompt: "Current prompt",
    bindSourceOriginalPrompt: "Source prompt",
    bindSourceEmpty: "No public gallery work is available to bind",
    bindSourceConfirm: "Bind and publish",
    bindSourceCancel: "Back",
    sourcePrompt: "Source prompt",
    currentPrompt: "Current prompt",
    sourceImageId: "Source image ID",
    imageUnavailable: "Image unavailable",
    likeImage: "Like",
    unlikeImage: "Unlike",
    galleryLeaderboard: "Like leaderboard",
    galleryLeaderboardDesc: "Popular public works ranked by likes",
    saveTags: "Save tags",
    tagsSaved: "Tags saved",
    authorBy: "By",
    textToImageAction: "Text to image",
    imageToImageAction: "Image to image",
    viewDetail: "Details",
    inputImage: "Input",
    outputImage: "Result",
    imageToImage: "Image-to-image",
    textToImage: "Text-to-image",
    unpublish: "Unpublish",
    unpublishDone: "Unpublished",
    role: "Role",
    status: "Status",
    credits: "Credits",
    checkinToday: "Check in",
    checkedIn: "Checked in today",
    checkinReward: "Daily check-in gives 1 credit",
    noticeTitle: "Content Safety Notice",
    noticeSubtitle: "To keep this platform healthy, positive, and safe, content safety review has been upgraded.",
    noticeCore: "Core Rules",
    noticePrivacy: "Privacy Promise",
    noticeTogether: "Together: Thank you for your understanding. A safer creative space depends on all of us.",
    noticeAck: "I understand",
    active: "Active",
    disabled: "Disabled",
    user: "User",
    adminRole: "Admin",
    backendVersion: "Backend version",
    backendStartedAt: "Started at",
    backendUptime: "Uptime",
    timeoutOpenAI: "OpenAI timeout",
    timeoutDownload: "Download timeout",
    seconds: "s",
    versionInfoTitle: "Version info",
    worksFilterAll: "All",
    worksFilterPublic: "Published",
    worksFilterPrivate: "Private",
    worksFilterText: "Text to image",
    worksFilterImage: "Image to image",
    worksFilterArchived: "Archived",
    worksFilterEmpty: "Nothing matches this filter",
    worksBatchDownload: "Batch download",
    worksOpenDetail: "Details",
    worksDetailTitle: "Work details",
    worksSelected: "selected",
    worksDownloadStarted: "Download started",
    worksContinue: "Continue",
    worksCopyPrompt: "Copy prompt",
    publishOriginalRequiredToast: "Publishing an image-to-image work requires keeping the original",
    promptEdit: "Edit",
    promptDelete: "Hide",
    promptHidden: "Hidden",
    promptCreateTitle: "New prompt",
    promptEditTitle: "Edit prompt",
    promptEditDesc: "Changes apply to all visitors immediately; hidden prompts are visible only to admins.",
    promptFieldTitle: "Title",
    promptFieldImage: "Cover image URL",
    promptFieldPrompt: "Prompt content",
    promptFieldTags: "Tags (space or comma separated)",
    promptFieldAuthor: "Author",
    promptFieldSource: "Source",
    promptFieldSourceUrl: "Source URL",
    promptFieldStatus: "Status",
    promptFieldSortOrder: "Sort weight",
    promptStatusActive: "Active",
    promptStatusHidden: "Hidden",
    promptCreate: "Create",
    promptSave: "Save",
    promptSoftDelete: "Hide entry",
    publishOriginalNoticeTitle: "Publishing an image-to-image work needs the original",
    publishOriginalNoticeBody: "Other people learn from before/after comparisons. Publishing image-to-image works without the source would hide why you wrote that prompt, so we always keep the input image with the published work.",
    publishOriginalNoticeRemember: "Don't show for 7 days",
    publishOriginalNoticeCancel: "Don't publish",
    publishOriginalNoticeConfirm: "Keep original & publish",
    routeSectionTitle: "Creation route",
    routeSectionExpand: "Expand",
    routeSectionCollapse: "Collapse",
    routeStepUntitled: "(no description)",
    editorElapsed: "Elapsed",
    editorElapsedLong: "Still generating; you can keep waiting or cancel and retry",
    editorCancel: "Cancel",
    editorRetry: "Retry",
    editorRetryHint: "Your prompt and image are preserved; tap retry to send again",
    continuationToggleLabel: "Continue from last image",
    continuationToggleHint: "Next generation will edit your previous output",
    continuationActiveToast: "Continued from your last image",
    continuationDisabledToast: "Next generation will start from a blank prompt",
    tagsLibraryTitle: "Tag library",
    tagsLibraryEmpty: "No tags yet",
    tagStatsSystem: "System tags",
    tagStatsWithContent: "With content",
    tagStatsEmpty: "Empty tags",
    emptyTagTitle: "No works for \"{tag}\" yet",
    emptyTagBody: "This tag exists in the tag library, but there is no matching public work yet.",
    emptyTagGenerate: "Create with this tag",
    emptyTagNearby: "Nearby tags",
    emptyTagAdminCreate: "Create example for this tag",
    tagsAddNew: "Add tag",
    tagsSlug: "slug",
    tagsLabelZh: "Label (zh)",
    tagsLabelEn: "Label (en)",
    tagsAliases: "Aliases",
    tagsSource: "Source",
    tagsStatus: "Status",
    tagsHue: "Hue",
    tagsUsage: "Usage",
    tagsCoverage: "Coverage",
    tagsMerge: "Merge",
    tagsSaveTag: "Save",
    tagsStatusActive: "Active",
    tagsStatusHidden: "Hidden",
    editorRecentStripTitle: "Recent outputs in this chat",
    editorRecentEmpty: "No alternate base image yet",
    editorRecentSwitched: "Base image switched",
    funMsgs: [
      "Mixing the perfect palette...",
      "Sprinkling pixel inspiration...",
      "The AI brush is warming up...",
      "Blending light and composition...",
      "Conjuring your vision...",
      "Growing your masterpiece...",
      "Brewing creativity...",
      "Adding finishing touches..."
    ]
  }
};

const fallbackPrompts = [
  {
    id: 1,
    tag: "product",
    icon: "ri-shopping-bag-3-line",
    title: { zh: "高端产品图", en: "Premium Product Shot" },
    prompt: {
      zh: "一张高端无线充电器产品摄影，哑光黑色机身，柔和棚拍灯光，浅灰背景，精致阴影，商业广告质感，超清细节",
      en: "A premium product photo of a matte black wireless charger, soft studio lighting, light gray background, refined shadows, commercial advertising style, ultra-detailed"
    },
    colors: "linear-gradient(135deg, #0f172a, #64748b)"
  },
  {
    id: 2,
    tag: "poster",
    icon: "ri-layout-4-line",
    title: { zh: "活动海报", en: "Event Poster" },
    prompt: {
      zh: "未来感 AI 创作活动海报，干净排版，强烈视觉焦点，黑白主调点缀电光蓝，高级平面设计，适合社交媒体",
      en: "A futuristic AI creativity event poster, clean typography, strong focal point, black and white palette with electric blue accents, premium graphic design"
    },
    colors: "linear-gradient(135deg, #111827, #2563eb)"
  },
  {
    id: 3,
    tag: "photo",
    icon: "ri-camera-lens-line",
    title: { zh: "生活方式摄影", en: "Lifestyle Photo" },
    prompt: {
      zh: "清晨咖啡桌上的极简工作场景，笔记本电脑、手机和一束花，自然窗光，温暖但不过度复古，真实摄影质感",
      en: "A minimal morning workspace on a coffee table with laptop, phone, and flowers, natural window light, warm but modern, realistic photography"
    },
    colors: "linear-gradient(135deg, #0f766e, #f59e0b)"
  },
  {
    id: 4,
    tag: "character",
    icon: "ri-user-smile-line",
    title: { zh: "角色设定", en: "Character Design" },
    prompt: {
      zh: "一位未来城市中的年轻发明家角色设定，全身像，功能性服装，背包设备，清晰轮廓，电影概念艺术风格",
      en: "A young inventor in a future city, full-body character design, functional clothing, backpack device, clean silhouette, cinematic concept art"
    },
    colors: "linear-gradient(135deg, #7c3aed, #ec4899)"
  },
  {
    id: 5,
    tag: "ui",
    icon: "ri-window-line",
    title: { zh: "应用界面概念", en: "App Interface Concept" },
    prompt: {
      zh: "一款 AI 图片生成应用的移动端界面概念，白色玻璃拟态卡片，底部输入框，图片瀑布流，现代 iOS 风格，高级 UI 截图",
      en: "A mobile interface concept for an AI image generation app, white glass cards, bottom composer, image feed, modern iOS style, polished UI screenshot"
    },
    colors: "linear-gradient(135deg, #38bdf8, #6366f1)"
  },
  {
    id: 6,
    tag: "illustration",
    icon: "ri-brush-line",
    title: { zh: "童书插画", en: "Storybook Illustration" },
    prompt: {
      zh: "温柔的童书插画，一只纸船漂在星光河流上，柔软笔触，梦幻但清晰，留白充足，适合封面",
      en: "A gentle storybook illustration of a paper boat floating on a starlit river, soft brushwork, dreamy but clear, generous negative space, cover art"
    },
    colors: "linear-gradient(135deg, #8b5cf6, #fbbf24)"
  }
];

const tags = ["all", "square", "ui", "photo", "poster", "portrait", "illustration", "anime", "product", "3d", "landscape", "character", "other", "logo", "fashion", "cyberpunk", "infographic", "food"];
const tagLabels = {
  zh: {
    all: "全部",
    square: "广场作品",
    "image-to-image": "图生图",
    "text-to-image": "文生图",
    ui: "UI/界面",
    photo: "摄影",
    poster: "海报插画",
    portrait: "人像摄影",
    illustration: "插画艺术",
    anime: "二次元",
    product: "产品电商",
    "3d": "3D 渲染",
    landscape: "风景城市",
    character: "角色设计",
    other: "其他",
    logo: "Logo 设计",
    fashion: "时尚",
    cyberpunk: "赛博朋克",
    infographic: "信息图",
    food: "美食"
  },
  en: {
    all: "All",
    square: "Square",
    "image-to-image": "Image-to-image",
    "text-to-image": "Text-to-image",
    ui: "UI",
    photo: "Photo",
    poster: "Poster",
    portrait: "Portrait",
    illustration: "Illustration",
    anime: "Anime",
    product: "E-commerce",
    "3d": "3D Render",
    landscape: "Landscape",
    character: "Character",
    other: "Other",
    logo: "Logo",
    fashion: "Fashion",
    cyberpunk: "Cyberpunk",
    infographic: "Infographic",
    food: "Food"
  }
};

const publicTagSuggestions = [
  "photo",
  "landscape",
  "portrait",
  "illustration",
  "anime",
  "product",
  "poster",
  "ui",
  "3d",
  "character",
  "logo",
  "fashion"
];

const tagCategoryLabels = {
  zh: {
    style: "风格",
    subject: "题材",
    use_case: "用途",
    camera: "镜头",
    lighting: "灯光",
    mood: "情绪",
    color: "颜色",
    technique: "技法",
    general: "其他"
  },
  en: {
    style: "Style",
    subject: "Subject",
    use_case: "Use",
    camera: "Camera",
    lighting: "Lighting",
    mood: "Mood",
    color: "Color",
    technique: "Technique",
    general: "Other"
  }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const elements = {
  app: $("#app"),
  homeView: $("#homeView"),
  chatView: $("#chatView"),
  libraryView: $("#libraryView"),
  editorView: $("#editorView"),
  modalLayer: $("#modalLayer"),
  toastLayer: $("#toastLayer"),
  brandBtn: $("#brandBtn"),
  promptLibraryBtn: $("#promptLibraryBtn"),
  imageEditorBtn: $("#imageEditorBtn"),
  notificationBtn: $("#notificationBtn"),
  notificationBadge: $("#notificationBadge"),
  contactBtn: $("#contactBtn"),
  langBtn: $("#langBtn"),
  creditsBtn: $("#creditsBtn"),
  creditsText: $("#creditsText"),
  myWorksBtn: $("#myWorksBtn"),
  adminBtn: $("#adminBtn"),
  loginBtn: $("#loginBtn"),
  logoutBtn: $("#logoutBtn"),
  apiStatus: $("#apiStatus"),
  todayGeneratedText: $("#todayGeneratedText"),
  heroComposerMount: $("#heroComposerMount"),
  stickyComposerMount: $("#stickyComposerMount"),
  generationStatus: $("#generationStatus"),
  funMessage: $("#funMessage"),
  elapsedTimer: $("#elapsedTimer"),
  historyList: $("#historyList"),
  imageSessionList: $("#imageSessionList"),
  newImageSessionBtn: $("#newImageSessionBtn"),
  sessionDrawerToggle: $("#sessionDrawerToggle"),
  recentSection: $("#recentSection"),
  recentMasonry: $("#recentMasonry"),
  exampleGrid: $("#exampleGrid"),
  openLibraryInlineBtn: $("#openLibraryInlineBtn"),
  librarySearchForm: $("#librarySearchForm"),
  librarySearchInput: $("#librarySearchInput"),
  tagFilters: $("#tagFilters"),
  promptGrid: $("#promptGrid"),
  composerTemplate: $("#composerTemplate"),
  editorCanvasArea: $("#editorCanvasArea"),
  editorUploadCard: $("#editorUploadCard"),
  editorUploadInput: $("#editorUploadInput"),
  editorBottomUploadInput: $("#editorBottomUploadInput"),
  editorImageFrame: $("#editorImageFrame"),
  editorImageScaler: $("#editorImageScaler"),
  editorSourceImage: $("#editorSourceImage"),
  editorMaskCanvas: $("#editorMaskCanvas"),
  editorPromptForm: $("#editorPromptForm"),
  editorPromptInput: $("#editorPromptInput"),
  editorPublicInput: $("#editorPublicInput"),
  editorPublishOriginalInput: $("#editorPublishOriginalInput"),
  editorZoomText: $("#editorZoomText"),
  editorColorInput: $("#editorColorInput")
};

let heroVideoWatchdog = null;

const IMAGE_SESSION_STORAGE_KEY = "imageStudio.imageSessions.v1";
const ACTIVE_IMAGE_SESSION_KEY = "imageStudio.activeImageSessionId";
const GENERATION_META_STORAGE_KEY = "imageStudio.generationMeta.v1";

async function api(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers["X-CSRF-Token"] = state.csrfToken || readCookie("csrf");
  }
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (data.csrfToken) state.csrfToken = data.csrfToken;
  if (!response.ok) {
    const auditRequiredMode = data.details?.requiredMode || data.details?.audit?.requiredMode || "";
    const message = auditRequiredMode === "image-to-image"
      ? (state.lang === "zh"
        ? "提示词与已有公开内容高度相似，请改用图生图或含原图发布。"
        : "This prompt is highly similar to existing public content. Publish it as image-to-image instead.")
      : (data.error || "Request failed");
    const error = new Error(message);
    error.status = response.status;
    error.details = data.details || null;
    throw error;
  }
  return data;
}

function promptAuditPublishMessage(error) {
  if (error?.details?.requiredMode !== "image-to-image") return error?.message || "";
  return state.lang === "zh"
    ? "提示词与画廊已有内容高度相似，不能直接以文生图公开。请从画廊选择原图或上传原图后，以图生图形式带原图公开。"
    : "This prompt is highly similar to existing gallery content. Publish it as image-to-image with an original gallery/source image instead.";
}

function reportRumMetric(name, value, detail = {}) {
  const payload = JSON.stringify({
    name,
    value: Number(value || 0),
    path: window.location.pathname,
    detail
  });
  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon("/api/rum", blob)) return;
  }
  fetch("/api/rum", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true
  }).catch(() => {});
}

function setupRumMonitoring() {
  if ("PerformanceObserver" in window) {
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lcp = entries[entries.length - 1];
        if (lcp) reportRumMetric("LCP", lcp.startTime, { id: lcp.id || "", url: lcp.url || "" });
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}
    try {
      let cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) cls += entry.value || 0;
        }
        reportRumMetric("CLS", cls);
      }).observe({ type: "layout-shift", buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        const longest = list.getEntries().reduce((max, entry) => Math.max(max, entry.duration || 0), 0);
        if (longest) reportRumMetric("INP", longest);
      }).observe({ type: "event", buffered: true, durationThreshold: 40 });
    } catch {}
  }
  window.addEventListener("error", (event) => {
    const target = event.target;
    if (target instanceof HTMLImageElement) {
      reportRumMetric("image_error", 1, { src: target.currentSrc || target.src || "" });
      markImageUnavailable(target);
    }
  }, true);
}

function readCookie(name) {
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split("="))
    .find(([key]) => decodeURIComponent(key) === name);
  return match ? decodeURIComponent(match.slice(1).join("=")) : "";
}

function text(key) {
  return i18n[state.lang][key] || i18n.zh[key] || key;
}

function local(value) {
  if (value && typeof value === "object") return value[state.lang] || value.zh || value.en || "";
  return value || "";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function imageVariantUrl(url, variant = "thumb") {
  if (!url || /^(data:|blob:)/i.test(url)) return url || "";
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}variant=${encodeURIComponent(variant)}`;
}

function imageFallbackContainerAttrs(label = text("imageUnavailable")) {
  return `data-image-fallback="${escapeHtml(label)}"`;
}

function imageFallbackImgAttrs() {
  return 'data-fallback-image="1"';
}

function markImageUnavailable(image) {
  if (!image || image.dataset.imageFailed === "1") return;
  image.dataset.imageFailed = "1";
  image.removeAttribute("src");
  image.removeAttribute("srcset");
  image.setAttribute("aria-hidden", "true");
  const frame = image.closest("[data-image-fallback]");
  if (!frame) return;
  if (!frame.dataset.imageFallback) frame.dataset.imageFallback = text("imageUnavailable");
  frame.classList.add("image-unavailable");
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(state.lang === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function truncate(value, length = 120) {
  const textValue = String(value || "");
  return textValue.length > length ? `${textValue.slice(0, length)}...` : textValue;
}

function normalizePublicTags(value) {
  const rawTags = Array.isArray(value)
    ? value
    : String(value || "").split(/[,，、#\s]+/);
  const seen = new Set();
  return rawTags
    .map((tag) => String(tag || "").trim().replace(/^#+/, ""))
    .filter(Boolean)
    .map((tag) => tag.slice(0, 24))
    .filter((tag) => /^[\p{L}\p{N}_\-\u4e00-\u9fff]+$/u.test(tag))
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function publicTagsText(tags = []) {
  return normalizePublicTags(tags).join(", ");
}

function publicKindTagForItem(item = {}) {
  return item.sourceImageData || item.sourceImageUrl || item.sourceFilename || item.sourceImageId
    ? "image-to-image"
    : "text-to-image";
}

function isImageToImageItem(item = {}) {
  return publicKindTagForItem(item) === "image-to-image";
}

function publicTagsForKind(kind, tags = []) {
  const systemTags = new Set(["text-to-image", "image-to-image"]);
  const normalizedKind = kind === "image-to-image" ? "image-to-image" : "text-to-image";
  return [normalizedKind, ...normalizePublicTags(tags).filter((tag) => !systemTags.has(tag.toLowerCase()))];
}

function generationEntryFromApi(generation = {}, fallback = {}) {
  return {
    ...fallback,
    id: generation.id || fallback.id,
    prompt: generation.prompt || fallback.prompt || "",
    images: generation.imageUrl ? [generation.imageUrl] : fallback.images || [],
    sourceImageUrl: generation.sourceImageUrl || fallback.sourceImageUrl || "",
    sourceImageId: generation.sourceImageId || fallback.sourceImageId || "",
    sourcePrompt: generation.sourcePrompt || fallback.sourcePrompt || "",
    originGalleryId: generation.originGalleryId || fallback.originGalleryId || "",
    publishOriginal: Boolean(generation.publishOriginal ?? fallback.publishOriginal),
    conversation: generation.conversation || fallback.conversation || [],
    publicTags: generation.publicTags || fallback.publicTags || [],
    userId: generation.userId || fallback.userId || state.user?.id || "",
    userName: generation.userName || fallback.userName || state.user?.name || "",
    status: fallback.status || "done",
    time: generation.createdAt || fallback.time,
    elapsedMs: Number(generation.durationMs || 0) || fallback.elapsedMs || null,
    model: generation.model || fallback.model,
    isPublic: Boolean(generation.isPublic ?? fallback.isPublic),
    archived: Boolean(generation.archived ?? fallback.archived),
    publishedAt: generation.publishedAt || fallback.publishedAt || "",
    publicRewardStatus: generation.publicRewardStatus || fallback.publicRewardStatus || "none",
    publicRewardAmount: Number(generation.publicRewardAmount || fallback.publicRewardAmount || 0),
    likeCount: Number(generation.likeCount || fallback.likeCount || 0),
    likedByCurrentUser: Boolean(generation.likedByCurrentUser ?? fallback.likedByCurrentUser),
    withdrawalStatus: generation.withdrawalStatus || fallback.withdrawalStatus || "none",
    withdrawalRequestedAt: generation.withdrawalRequestedAt || fallback.withdrawalRequestedAt || "",
    options: fallback.options || {
      size: generation.size,
      quality: generation.quality,
      background: generation.background,
      outputFormat: generation.outputFormat
    }
  };
}

function tagInfo(slug) {
  if (!slug) return { slug: "", label: "", hue: 0, status: "active" };
  const lib = state.tagsLibrary?.bySlug || {};
  const entry = lib[String(slug).toLowerCase()];
  if (entry) {
    const langLabel = state.lang === "en" ? entry.labelEn : entry.labelZh;
    return {
      slug: entry.slug,
      label: langLabel || entry.labelEn || entry.labelZh || entry.slug,
      hue: Number(entry.hue || 0),
      status: entry.status || "active",
      category: entry.category || "general",
      aliases: Array.isArray(entry.aliases) ? entry.aliases : [],
      promptCount: Number(entry.promptCount || 0),
      galleryCount: Number(entry.galleryCount || 0),
      contentCount: Number(entry.contentCount || 0),
      showInFilter: entry.showInFilter !== false
    };
  }
  // fallback：旧版 tagLabels 还能用，颜色用本地 tagColor 的 fallback。
  const fallback = tagLabels[state.lang]?.[slug] || slug;
  return { slug, label: fallback, hue: 0, status: "active" };
}

function displayTag(tag) {
  return tagInfo(tag).label;
}

function displayUserName(item = {}) {
  return item.userName || item.authorName || item.author || (state.lang === "zh" ? "匿名用户" : "Anonymous");
}

function isOwnedByCurrentUser(item = {}) {
  return Boolean(state.user?.id && item.userId && String(state.user.id) === String(item.userId));
}

function showToast(message, icon = "ri-information-line") {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<i class="${icon}"></i><span>${escapeHtml(message)}</span>`;
  elements.toastLayer.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

function applyI18n(root = document) {
  $$("[data-i18n]", root).forEach((node) => {
    if (node.dataset.i18n === "contact" && String(state.settings?.contactEmail ?? state.settings?.contactAdminEmail ?? "").trim()) return;
    node.textContent = text(node.dataset.i18n);
  });
  $$("[data-i18n-title]", root).forEach((node) => {
    node.title = text(node.dataset.i18nTitle);
  });
  $$(".prompt-box").forEach((node) => {
    node.placeholder = text("placeholder");
  });
  elements.langBtn.textContent = state.lang === "zh" ? "中/EN" : "EN/中";
  updateDailyMetric();
}

function formatDailyCount(value) {
  const count = Math.max(0, Number(value) || 0);
  return `${count.toLocaleString(state.lang === "zh" ? "zh-CN" : "en-US")}${count >= 1000 ? "+" : ""}`;
}

function updateDailyMetric() {
  if (!elements.todayGeneratedText) return;
  elements.todayGeneratedText.textContent = `${text("todayGeneratedPrefix")} ${formatDailyCount(state.stats.todayGenerated)} ${text("todayGeneratedSuffix")}`;
}

function updateNav() {
  const loggedIn = Boolean(state.user);
  const capabilities = state.settings?.providerCapabilities || {};
  const contactEmail = String(state.settings?.contactEmail ?? state.settings?.contactAdminEmail ?? "").trim();
  elements.loginBtn.classList.toggle("hidden", loggedIn);
  elements.logoutBtn.classList.toggle("hidden", !loggedIn);
  elements.creditsBtn.classList.toggle("hidden", !loggedIn);
  elements.myWorksBtn.classList.toggle("hidden", !loggedIn);
  elements.notificationBtn?.classList.toggle("hidden", !loggedIn);
  elements.imageEditorBtn.classList.toggle("hidden", capabilities.imageEdit === false);
  elements.contactBtn.classList.toggle("hidden", !contactEmail);
  const contactLabel = elements.contactBtn?.querySelector("[data-i18n='contact']");
  if (contactLabel && contactEmail) contactLabel.textContent = contactEmail;
  elements.adminBtn.classList.toggle("hidden", state.user?.role !== "admin");
  elements.creditsText.textContent = state.user ? `${text("credits")} ${state.user.credits}` : "0";

  const hasApiKey = Boolean(state.settings?.hasApiKey);
  elements.apiStatus.textContent = hasApiKey
    ? "GPT-IMAGE-2"
    : state.lang === "zh"
      ? "后台未配置 API Key"
      : "API key not configured";
  elements.apiStatus.style.color = hasApiKey ? "#64748b" : "#b42318";
  updateNotificationBadge();
}

function updateNotificationBadge() {
  if (!elements.notificationBadge) return;
  const count = state.unreadAnnouncements.length;
  elements.notificationBadge.classList.toggle("hidden", count <= 0);
  elements.notificationBadge.textContent = count > 99 ? "99+" : String(count);
}

function readStoredJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function sessionId() {
  return `session_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function loadImageSessionState() {
  state.imageSessions = Array.isArray(readStoredJson(IMAGE_SESSION_STORAGE_KEY, []))
    ? readStoredJson(IMAGE_SESSION_STORAGE_KEY, [])
    : [];
  state.generationMeta = readStoredJson(GENERATION_META_STORAGE_KEY, {});
  state.activeImageSessionId = localStorage.getItem(ACTIVE_IMAGE_SESSION_KEY) || "";
}

function saveImageSessionState() {
  writeStoredJson(IMAGE_SESSION_STORAGE_KEY, state.imageSessions);
  writeStoredJson(GENERATION_META_STORAGE_KEY, state.generationMeta);
  if (state.activeImageSessionId) localStorage.setItem(ACTIVE_IMAGE_SESSION_KEY, state.activeImageSessionId);
}

function createImageSession(title = text("sessionUntitled"), generationIds = []) {
  const now = new Date().toISOString();
  return {
    id: sessionId(),
    title,
    generationIds: [...new Set(generationIds.map(String))],
    createdAt: now,
    updatedAt: now
  };
}

function ensureImageSessions() {
  const historyIds = state.history.map((item) => String(item.id));
  const knownIds = new Set(state.imageSessions.flatMap((session) => session.generationIds || []));
  const missingIds = historyIds.filter((id) => !knownIds.has(id));

  if (!state.imageSessions.length && historyIds.length) {
    state.imageSessions = [createImageSession(text("historySession"), historyIds)];
  } else if (missingIds.length) {
    const historySession = state.imageSessions.find((session) => session.title === text("historySession"));
    if (historySession) {
      historySession.generationIds = [...new Set([...(historySession.generationIds || []), ...missingIds])];
      historySession.updatedAt = new Date().toISOString();
    } else {
      state.imageSessions.push(createImageSession(text("historySession"), missingIds));
    }
  }

  state.imageSessions = state.imageSessions
    .map((session) => ({
      ...session,
      generationIds: [...new Set((session.generationIds || []).map(String).filter((id) => historyIds.includes(id)))]
    }))
    .filter((session) => session.generationIds.length || session.id === state.activeImageSessionId)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  if (!state.activeImageSessionId || !state.imageSessions.some((session) => session.id === state.activeImageSessionId)) {
    state.activeImageSessionId = state.imageSessions[0]?.id || "";
  }
  saveImageSessionState();
}

function ensureActiveImageSession(prompt = "") {
  let session = state.imageSessions.find((item) => item.id === state.activeImageSessionId);
  if (!session) {
    session = createImageSession(prompt ? truncate(prompt, 24) : text("sessionUntitled"));
    state.imageSessions.unshift(session);
    state.activeImageSessionId = session.id;
  }
  if ((!session.title || session.title === text("sessionUntitled")) && prompt) {
    session.title = truncate(prompt, 24);
  }
  session.updatedAt = new Date().toISOString();
  saveImageSessionState();
  return session;
}

function startNewImageSession(prompt = "") {
  const session = createImageSession(prompt ? truncate(prompt, 24) : text("sessionUntitled"));
  state.imageSessions.unshift(session);
  state.activeImageSessionId = session.id;
  // 新会话：解锁续图，避免继承上一个会话的"上次输出"。
  state.continuationLockedSessionId = "";
  state.continuationLastImageUrl = "";
  saveImageSessionState();
  return session;
}

function addGenerationToActiveSession(itemId, prompt) {
  const session = ensureActiveImageSession(prompt);
  session.generationIds = [...new Set([...(session.generationIds || []), String(itemId)])];
  session.updatedAt = new Date().toISOString();
  saveImageSessionState();
}

function replaceSessionGenerationId(oldId, newId, elapsedMs) {
  state.imageSessions.forEach((session) => {
    session.generationIds = (session.generationIds || []).map((id) => String(id) === String(oldId) ? String(newId) : id);
  });
  if (state.generationMeta[oldId]) delete state.generationMeta[oldId];
  state.generationMeta[newId] = { elapsedMs };
  saveImageSessionState();
}

function getActiveSessionHistory() {
  const activeSession = state.imageSessions.find((session) => session.id === state.activeImageSessionId);
  if (!activeSession) return state.history;
  const historyById = new Map(state.history.map((item) => [String(item.id), item]));
  return (activeSession.generationIds || []).map((id) => historyById.get(String(id))).filter(Boolean);
}

function conversationRouteForItem(item) {
  const visible = getActiveSessionHistory();
  const index = visible.findIndex((entry) => String(entry.id) === String(item.id));
  const route = index >= 0 ? visible.slice(0, index + 1) : [item];
  return route.map((entry) => ({
    id: entry.id,
    prompt: entry.prompt,
    imageUrl: entry.images?.[0] || "",
    type: entry.sourceImageUrl || entry.sourceImageData ? "image-to-image" : "text-to-image",
    createdAt: entry.time
  }));
}

function conversationRouteWithDraft(item) {
  const route = [...getActiveSessionHistory(), item]
    .filter(Boolean)
    .filter((entry, index, list) => list.findIndex((candidate) => String(candidate.id) === String(entry.id)) === index);
  return route.map((entry) => ({
    id: entry.id,
    prompt: entry.prompt,
    imageUrl: entry.images?.[0] || entry.imageUrl || "",
    type: entry.sourceImageUrl || entry.sourceImageData ? "image-to-image" : "text-to-image",
    createdAt: entry.time || entry.createdAt
  }));
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function setView(view) {
  state.view = view;
  const showingChatWorkspace = view === "home" && !shouldShowHero();
  if (view !== "home") elements.app.classList.remove("session-panel-open");
  elements.app.classList.toggle("editor-mode", view === "editor");
  elements.app.classList.toggle("chat-panel-visible", showingChatWorkspace);
  elements.homeView.classList.toggle("hidden", view !== "home" || (!shouldShowHero() && view === "home"));
  elements.chatView.classList.toggle("hidden", view !== "home" || shouldShowHero());
  elements.libraryView.classList.toggle("hidden", view !== "library");
  elements.editorView.classList.toggle("hidden", view !== "editor");
  elements.sessionDrawerToggle?.classList.toggle("hidden", view !== "home");
  if (view === "library") renderLibrary();
  if (view === "editor") renderEditor();
  updateNav();
  if (view === "home" && shouldShowHero()) {
    requestAnimationFrame(playHeroVideo);
  }
}

function routeState(extra = {}) {
  const modal = $(".works-modal", elements.modalLayer)
    ? "works"
    : $(".square-preview-modal", elements.modalLayer)
      ? "square"
      : "";
  const workDetailId = $(".works-detail-drawer", elements.modalLayer)
    ? $(".works-detail-drawer", elements.modalLayer)?.dataset?.workId || ""
    : "";
  const galleryId = modal === "square"
    ? $(".square-preview-modal", elements.modalLayer)?.dataset?.squareId || ""
    : "";
  return {
    view: state.view,
    forceHero: state.forceHero,
    modal,
    workDetailId,
    galleryId,
    libraryTag: state.libraryTag,
    librarySearch: state.librarySearch,
    ...extra
  };
}

function routeUrl(route = routeState()) {
  const params = new URLSearchParams();
  if (route.view && route.view !== "home") params.set("view", route.view);
  if (route.view === "home" && route.forceHero === false) params.set("workspace", "1");
  if (route.modal) params.set("modal", route.modal);
  if (route.workDetailId) params.set("work", route.workDetailId);
  if (route.galleryId) params.set("gallery", route.galleryId);
  if (route.view === "library") {
    if (route.libraryTag && route.libraryTag !== "all") params.set("tag", route.libraryTag);
    if (route.librarySearch) params.set("q", route.librarySearch);
  }
  const query = params.toString();
  const hash = route.galleryId ? "" : (window.location.hash || "");
  return `${window.location.pathname}${query ? `?${query}` : ""}${hash}`;
}

function routeFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const hashGalleryMatch = window.location.hash.match(/^#\/gallery\/([^/?#]+)/);
  const view = params.get("view") || "home";
  const galleryId = params.get("gallery") || (hashGalleryMatch ? decodeURIComponent(hashGalleryMatch[1]) : "");
  return {
    view: ["home", "library", "editor"].includes(view) ? view : (galleryId ? "library" : "home"),
    forceHero: params.get("workspace") !== "1",
    modal: params.get("modal") || (galleryId ? "square" : ""),
    workDetailId: params.get("work") || "",
    galleryId,
    libraryTag: params.get("tag") || "all",
    librarySearch: params.get("q") || ""
  };
}

function replaceRoute(extra = {}) {
  if (!window.history?.replaceState) return;
  window.history.replaceState(routeState(extra), "", routeUrl(routeState(extra)));
}

function navigate(view, options = {}) {
  if (view === "home" && options.hero !== false) {
    state.forceHero = true;
    elements.app.classList.remove("session-panel-open");
    elements.app.classList.remove("chat-panel-collapsed");
  }
  if (view === "home" && options.hero === false) state.forceHero = false;
  if (view === "library") {
    state.forceHero = true;
    closeModal();
    if (options.route?.libraryTag) state.libraryTag = options.route.libraryTag;
    if (Object.hasOwn(options.route || {}, "librarySearch")) state.librarySearch = options.route.librarySearch || "";
  }
  setView(view);
  if (options.scrollTop) window.scrollTo({ top: 0, behavior: options.scrollBehavior || "smooth" });
  if (!state.routeSyncing && window.history?.pushState) {
    const route = routeState(options.route || {});
    window.history.pushState(route, "", routeUrl(route));
  }
}

function applyRoute(route = {}) {
  state.routeSyncing = true;
  closeModal();
  state.libraryTag = route.libraryTag || state.libraryTag || "all";
  state.librarySearch = route.librarySearch || "";
  state.forceHero = route.view === "home" ? route.forceHero !== false : true;
  setView(route.view || "home");
  if (route.modal === "works") {
    openMyWorksModal({ replaceRoute: false });
    if (route.workDetailId) {
      setTimeout(() => openWorkDetail(route.workDetailId, { replaceRoute: false }), 80);
    }
  } else if (route.modal === "square" && route.galleryId) {
    setTimeout(() => openSquarePreviewById(route.galleryId, { replaceRoute: false }), 80);
  }
  state.routeSyncing = false;
}

function shouldShowHero() {
  return state.forceHero || state.history.length === 0;
}

function openHomeHero({ scroll = false } = {}) {
  state.forceHero = true;
  elements.app.classList.remove("session-panel-open");
  elements.app.classList.remove("chat-panel-collapsed");
  navigate("home", { scrollTop: scroll, scrollBehavior: "smooth" });
  if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
  restartHeroVideo();
}

function renderAll() {
  applyI18n();
  updateNav();
  renderRecentCreations();
  renderExamples();
  ensureImageSessions();
  renderImageSessions();
  renderHistory();
  if (state.view === "library") renderLibrary();
  if (state.view === "editor") renderEditor();
  renderComposers();
  setView(state.view);
}

function recentFallbackItems() {
  return getPromptSource().slice(0, 12).map((prompt, index) => ({
    id: `sample_${prompt.id}`,
    prompt: prompt.prompt,
    title: prompt.title,
    image: prompt.image,
    icon: prompt.icon || "ri-image-line",
    colors: prompt.colors,
    isSample: true,
    heightClass: ["tall", "medium", "short", "medium", "tall", "short"][index % 6]
  }));
}

function recentHistoryItems() {
  return state.publicGallery
    .filter((item) => item.images?.[0])
    .slice(0, 16)
    .map((item, index) => ({
      id: item.id,
      prompt: item.prompt,
      title: truncate(item.prompt, 36),
      image: item.images[0],
      sourceImage: item.sourceImageUrl || "",
      conversation: item.conversation || [],
      publishOriginal: Boolean(item.publishOriginal),
      publicTags: item.publicTags || [],
      userId: item.userId || "",
      userName: item.userName || "",
      isSample: false,
      isPublic: true,
      heightClass: ["medium", "tall", "short", "medium"][index % 4],
      time: item.time
    }));
}

function renderRecentCreations() {
  const items = recentHistoryItems();
  const displayItems = items.length ? items : recentFallbackItems();
  elements.recentMasonry.innerHTML = displayItems.map((item) => {
    const visual = item.image
    ? `<img src="${escapeHtml(imageVariantUrl(item.image))}" ${imageFallbackImgAttrs()} loading="lazy" decoding="async" fetchpriority="low" alt="${escapeHtml(truncate(item.prompt, 80))}">`
      : `<div class="recent-gradient" style="--art-bg:${item.colors}"><i class="${item.icon}"></i></div>`;
    const author = item.isPublic ? `<em><i class="ri-user-line"></i>${escapeHtml(displayUserName(item))}</em>` : "";
    return `
      <button class="recent-tile ${item.heightClass}" type="button" data-recent-id="${escapeHtml(item.id)}">
        <div class="recent-visual" ${imageFallbackContainerAttrs()}>${visual}${author}</div>
        <div class="recent-caption">
          <strong>${escapeHtml(item.title || truncate(item.prompt, 34))}</strong>
          <span>${escapeHtml(truncate(item.prompt, 76))}</span>
        </div>
      </button>
    `;
  }).join("");

  $$("[data-recent-id]", elements.recentMasonry).forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.recentId;
      const item = displayItems.find((entry) => String(entry.id) === id);
      if (item) openRecentPreview(item);
    });
  });
}

function openRecentPreview(item) {
  const visual = item.image
    ? `<img class="preview-image" src="${escapeHtml(item.image)}" ${imageFallbackImgAttrs()} alt="${escapeHtml(truncate(item.prompt, 80))}">`
    : `<div class="preview-gradient" style="--art-bg:${item.colors}"><i class="${item.icon}"></i></div>`;
  if (item.isPublic && item.image) {
    openSquarePreview({
      id: item.id,
      prompt: item.prompt,
      images: [item.image],
      sourceImageUrl: item.sourceImage || "",
      conversation: item.conversation || [],
      publicTags: item.publicTags || [],
      userId: item.userId || "",
      userName: item.userName || "",
      time: item.time,
      isPublic: true
    });
    return;
  }
  openModal(`
    <section class="modal preview-modal">
      <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
      ${visual}
      <div class="preview-body">
        <h2>${escapeHtml(item.title || text("preview"))}</h2>
        <p>${escapeHtml(item.prompt)}</p>
        ${item.conversation?.length ? `<ol class="preview-route">${item.conversation.map((step) => `<li>${escapeHtml(step.prompt || step.type || "")}</li>`).join("")}</ol>` : ""}
        <div class="message-actions preview-actions">
          ${item.image ? `<a href="${item.image}" download="${escapeHtml(item.id)}.png"><i class="ri-download-line"></i>${text("download")}</a>` : ""}
          ${item.sourceImage ? `<a href="${escapeHtml(item.sourceImage)}" target="_blank" rel="noreferrer"><i class="ri-image-line"></i>${text("sourceImage")}</a>` : ""}
          ${item.image ? `<button type="button" data-preview-editor><i class="ri-magic-line"></i>${text("openEditor")}</button>` : ""}
          <button type="button" data-preview-use><i class="ri-edit-line"></i>${text("edit")}</button>
          <button type="button" data-preview-copy><i class="ri-file-copy-line"></i>${text("copy")}</button>
        </div>
      </div>
    </section>
  `);
  $("[data-preview-use]", elements.modalLayer).addEventListener("click", () => {
    state.draftPrompt = item.prompt;
    closeModal();
    state.forceHero = true;
    setView("home");
    syncComposers();
    setTimeout(() => $(".prompt-box", elements.heroComposerMount)?.focus(), 120);
  });
  $("[data-preview-editor]", elements.modalLayer)?.addEventListener("click", () => {
    closeModal();
    openImageEditor(item.image, item.prompt);
  });
  $("[data-preview-copy]", elements.modalLayer).addEventListener("click", async () => {
    await copyText(item.prompt);
    showToast(state.lang === "zh" ? "提示词已复制" : "Prompt copied", "ri-file-copy-line");
  });
}

function renderComposers() {
  if (!elements.heroComposerMount.children.length) {
    elements.heroComposerMount.appendChild(createComposer(false));
  }
  if (!elements.stickyComposerMount.children.length) {
    elements.stickyComposerMount.appendChild(createComposer(true));
  }
  syncComposers();
}

function getContinuationCandidate() {
  if (!state.user) return { active: false, reason: "anon" };
  const sessionId = state.activeImageSessionId || "";
  if (!sessionId) return { active: false, reason: "no-session" };
  const lockedTo = state.continuationLockedSessionId || "";
  if (lockedTo && lockedTo !== sessionId) {
    return { active: false, reason: "session-changed" };
  }
  // 找会话里最新一条已完成、属于当前用户的图。
  const sessionEntry = state.imageSessions.find((session) => session.id === sessionId);
  const allowedIds = new Set((sessionEntry?.generationIds || []).map(String));
  const last = [...state.history]
    .reverse()
    .find((item) =>
      item.status === "done"
      && item.images?.[0]
      && (!allowedIds.size || allowedIds.has(String(item.id)))
      && (!item.userId || !state.user?.id || String(item.userId) === String(state.user.id))
    );
  if (!last) return { active: false, reason: "no-last-image" };
  return {
    active: true,
    sessionId,
    lastEntry: last,
    lastImageUrl: last.images[0]
  };
}

function getContinuationContext() {
  const candidate = getContinuationCandidate();
  if (state.continuationMode !== "auto") {
    return { ...candidate, active: false, reason: "off", canContinue: candidate.active };
  }
  return { ...candidate, canContinue: candidate.active };
}

function setContinuationMode(mode) {
  const next = mode === "auto" ? "auto" : "off";
  state.continuationMode = next;
  try { localStorage.setItem("imageStudio.continuationMode", next); } catch { /* ignore */ }
  syncComposers();
  showToast(text(next === "auto" ? "continuationActiveToast" : "continuationDisabledToast"), "ri-magic-line");
}

function ensureContinuationToggle(form) {
  let row = $(".continuation-toggle", form);
  if (row) return row;
  row = document.createElement("div");
  row.className = "continuation-toggle";
  row.dataset.role = "continuation-toggle";
  row.innerHTML = `
    <span class="context-badge">${escapeHtml(text("continuationContextLabel"))}</span>
    <button class="continuation-toggle-main" type="button">
      <span class="continuation-toggle-icon"><i class="ri-image-edit-line"></i></span>
      <span class="continuation-toggle-text">
        <strong>${escapeHtml(text("continuationToggleLabel"))}</strong>
        <em>${escapeHtml(text("continuationToggleHint"))}</em>
      </span>
    </button>
    <span class="continuation-toggle-thumb" hidden><img alt=""></span>
    <button class="continuation-toggle-close" type="button" title="${escapeHtml(text("closeContinuation"))}" aria-label="${escapeHtml(text("closeContinuation"))}">
      <i class="ri-close-line"></i>
    </button>
  `;
  $(".continuation-toggle-main", row).addEventListener("click", () => {
    setContinuationMode(state.continuationMode === "auto" ? "off" : "auto");
  });
  $(".continuation-toggle-close", row).addEventListener("click", () => {
    setContinuationMode("off");
  });
  const settingsRow = $(".composer-settings-row", form);
  const optionsButton = $(".options-toggle", form);
  if (settingsRow && optionsButton) {
    row.classList.add("composer-context-chip");
    settingsRow.insertBefore(row, optionsButton);
  } else if (settingsRow) {
    row.classList.add("composer-context-chip");
    settingsRow.append(row);
  } else {
    const referenceRow = $(".reference-row", form);
    if (referenceRow) {
      form.insertBefore(row, referenceRow);
    } else {
      form.prepend(row);
    }
  }
  return row;
}

function createComposer(sticky) {
  const fragment = elements.composerTemplate.content.cloneNode(true);
  const form = $(".composer", fragment);
  const textarea = $(".prompt-box", form);
  const referenceInput = $(".reference-input", form);
  const referenceRow = $(".reference-row", form);
  const optionsToggle = $(".options-toggle", form);
  const publicInput = $(".public-input", form);
  const advanced = $(".advanced-options", form);

  form.dataset.sticky = sticky ? "1" : "0";
  textarea.addEventListener("input", () => {
    state.draftPrompt = textarea.value;
    syncComposers(form);
  });
  textarea.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      form.requestSubmit();
    }
  });
  referenceInput.addEventListener("change", () => {
    const files = [...referenceInput.files].slice(0, 4);
    state.references = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      name: file.name
    }));
    renderReferences(referenceRow);
    syncReferences(form);
    if (state.references.length) {
      showToast(text("referencePreviewToast"), "ri-image-add-line");
    }
  });
  optionsToggle.addEventListener("click", () => {
    advanced.classList.toggle("hidden");
    optionsToggle.classList.toggle("active", !advanced.classList.contains("hidden"));
  });
  publicInput.addEventListener("change", () => {
    state.publishToSquare = publicInput.checked;
    syncComposers(form);
  });
  $$(".advanced-options select", form).forEach((select) => {
    select.addEventListener("change", () => {
      state.generationOptions = getComposerOptions(form);
      updateCustomSizeVisibility(form);
      syncComposers(form);
    });
  });
  $$(".custom-size-row input", form).forEach((input) => {
    input.addEventListener("input", () => {
      state.generationOptions = getComposerOptions(form);
      syncComposers(form);
    });
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitGeneration(form);
  });
  ensureContinuationToggle(form);
  applyI18n(form);
  return fragment;
}

function getComposerOptions(form) {
  const sizeValue = $(".size-input", form).value;
  const customWidth = $(".custom-width-input", form)?.value || "2048";
  const customHeight = $(".custom-height-input", form)?.value || "2048";
  return {
    size: sizeValue === "custom" ? `${customWidth}x${customHeight}` : sizeValue,
    sizeMode: sizeValue,
    customWidth,
    customHeight,
    quality: $(".quality-input", form).value,
    background: $(".background-input", form).value,
    outputFormat: $(".format-input", form).value,
    candidateCount: Math.max(1, Math.min(Number(state.settings?.maxImagesPerRequest || 1), Number($(".candidate-count-input", form)?.value || 1))),
    isPublic: $(".public-input", form).checked
  };
}

function updateCustomSizeVisibility(form) {
  const row = $(".custom-size-row", form);
  if (!row) return;
  row.classList.toggle("hidden", $(".size-input", form).value !== "custom");
}

function composerOptionSummary() {
  const options = state.generationOptions || {};
  const size = options.sizeMode || options.size || "auto";
  const quality = options.quality || "auto";
  const format = (options.outputFormat || "png").toUpperCase();
  const candidates = Number(options.candidateCount || 1);
  const suffix = candidates > 1 ? ` · ${candidates}x` : "";
  if (state.lang === "zh") return `${size} · ${quality} · ${format}${suffix}`;
  return `${size} · ${quality} · ${format}${suffix}`;
}

function getGenerateDisabledReason() {
  if (state.generating) return text("generateDisabledGenerating");
  if (!state.settings?.hasApiKey) return text("generateDisabledApiKey");
  const credits = Number(state.user?.credits ?? Number.POSITIVE_INFINITY);
  const cost = Number(state.settings?.generationCreditCost ?? 1);
  const candidates = Math.max(1, Number(state.generationOptions?.candidateCount || 1));
  if (state.user && Number.isFinite(credits) && credits < cost * candidates) return text("generateDisabledCredits");
  return "";
}

function syncComposers(sourceForm) {
  const continuation = getContinuationContext();
  const continuationCandidate = getContinuationCandidate();
  const disabledReason = getGenerateDisabledReason();
  $$(".composer").forEach((form) => {
    if (form !== sourceForm) {
      $(".prompt-box", form).value = state.draftPrompt;
      const mode = state.generationOptions.sizeMode || state.generationOptions.size;
      $(".size-input", form).value = [...$(".size-input", form).options].some((option) => option.value === mode) ? mode : "custom";
      $(".custom-width-input", form).value = state.generationOptions.customWidth || "2048";
      $(".custom-height-input", form).value = state.generationOptions.customHeight || "2048";
      $(".quality-input", form).value = state.generationOptions.quality;
      $(".background-input", form).value = state.generationOptions.background;
      $(".format-input", form).value = state.generationOptions.outputFormat;
      $(".candidate-count-input", form).value = String(state.generationOptions.candidateCount || 1);
      $(".public-input", form).checked = state.publishToSquare;
    }
    updateCustomSizeVisibility(form);
    const candidateInput = $(".candidate-count-input", form);
    if (candidateInput) {
      const caps = state.settings?.providerCapabilities || {};
      const maxImages = caps.multiCandidate === false ? 1 : Math.max(1, Number(caps.maxImagesPerRequest || state.settings?.maxImagesPerRequest || 1));
      [...candidateInput.options].forEach((option) => {
        option.disabled = Number(option.value) > maxImages;
      });
      if (Number(candidateInput.value || 1) > maxImages) candidateInput.value = String(maxImages);
    }
    const formatInput = $(".format-input", form);
    if (formatInput) {
      const transparent = state.settings?.providerCapabilities?.transparentBackground !== false;
      if (!transparent && state.generationOptions.background === "transparent") {
        state.generationOptions.background = "opaque";
      }
      [...formatInput.options].forEach((option) => {
        if (option.value === "png") option.disabled = false;
      });
      const transparentOption = $(".background-input option[value='transparent']", form);
      if (transparentOption) transparentOption.disabled = !transparent;
      const backgroundInput = $(".background-input", form);
      if (backgroundInput && !transparent && backgroundInput.value === "transparent") {
        backgroundInput.value = "opaque";
      }
    }
    $(".model-label", form).textContent = "GPT-IMAGE-2";
    $(".options-summary", form).textContent = composerOptionSummary();
    $(".add-reference-button", form).setAttribute("title", text("addReference"));
    const sendButton = $(".send-button", form);
    sendButton.disabled = Boolean(disabledReason);
    sendButton.setAttribute("aria-disabled", String(Boolean(disabledReason)));
    const feedback = $(".composer-feedback", form);
    if (feedback) {
      feedback.textContent = disabledReason || text("generateReadyHint");
      feedback.classList.toggle("hidden", !disabledReason);
    }
    const toggle = ensureContinuationToggle(form);
    if (toggle) {
      const isActive = continuation.active;
      const canContinue = continuationCandidate.active;
      const isOn = state.continuationMode === "auto";
      toggle.classList.toggle("hidden", !canContinue);
      toggle.classList.toggle("active", isOn);
      toggle.classList.toggle("disabled", !isOn);
      const mainButton = $(".continuation-toggle-main", toggle);
      if (mainButton) {
        mainButton.setAttribute("aria-pressed", String(isOn));
      }
      const label = $(".continuation-toggle-text strong", toggle);
      if (label) label.textContent = isOn ? text("continuationToggleLabel") : text("continuationOffLabel");
      const thumbWrap = $(".continuation-toggle-thumb", toggle);
      const thumbImg = $("img", thumbWrap);
      const thumbUrl = continuationCandidate.lastImageUrl || continuation.lastImageUrl;
      if (canContinue && thumbUrl) {
        thumbWrap.removeAttribute("hidden");
        if (thumbImg && thumbImg.src !== thumbUrl) {
          thumbImg.src = thumbUrl;
        }
      } else if (thumbWrap) {
        thumbWrap.setAttribute("hidden", "");
        if (thumbImg) thumbImg.removeAttribute("src");
      }
    }
  });
}

function renderReferences(row) {
  const thumbs = state.references.map((reference, index) => `
    <div class="reference-thumb">
      <img src="${reference.url}" alt="${escapeHtml(reference.name)}">
      <button type="button" data-remove-reference="${index}" title="${escapeHtml(text("close"))}" aria-label="${escapeHtml(text("close"))}"><i class="ri-close-line"></i></button>
    </div>
  `).join("");
  const note = state.references.length ? `
    <span class="context-badge">${escapeHtml(text("reference"))}</span>
    <span class="reference-note">${escapeHtml(text("referencePreviewOnly"))}</span>
  ` : "";
  row.innerHTML = `${note}<div class="reference-thumbs">${thumbs}</div>`;
  row.classList.toggle("hidden", state.references.length === 0);
  $$("[data-remove-reference]", row).forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.removeReference);
      const [removed] = state.references.splice(index, 1);
      if (removed?.url) URL.revokeObjectURL(removed.url);
      $$(".reference-row").forEach(renderReferences);
    });
  });
}

function syncReferences(sourceForm) {
  $$(".reference-row").forEach((row) => {
    if (!sourceForm || row !== $(".reference-row", sourceForm)) renderReferences(row);
  });
}

async function submitGeneration(form) {
  const prompt = $(".prompt-box", form).value.trim();
  if (!prompt) return;
  if (!state.user) {
    state.draftPrompt = prompt;
    openAuthModal("login");
    return;
  }
  if (!state.settings?.hasApiKey) {
    showToast(state.lang === "zh" ? "请先在后台配置 OpenAI API Key" : "Configure the OpenAI API key first", "ri-key-2-line");
    return;
  }
  const disabledReason = getGenerateDisabledReason();
  if (disabledReason) {
    showToast(disabledReason, "ri-information-line");
    if (disabledReason === text("generateDisabledCredits")) openCreditsModal();
    return;
  }
  if (state.generating) return;

  state.draftPrompt = "";
  state.generationOptions = getComposerOptions(form);
  state.publishToSquare = state.generationOptions.isPublic;
  const candidateCount = Math.max(1, Number(state.generationOptions.candidateCount || 1));
  const fromHeroComposer = form?.dataset?.sticky !== "1" && state.view === "home" && shouldShowHero();
  if (fromHeroComposer) {
    startNewImageSession(prompt);
  }
  const tempId = `tmp_${Date.now()}`;
  const startedAt = Date.now();
  const item = {
    id: tempId,
    prompt,
    images: [],
    status: "generating",
    time: new Date().toISOString(),
    startedAt,
    isPublic: state.publishToSquare,
    publicTags: [],
    options: { ...state.generationOptions },
    references: state.references.map((reference) => reference.url)
  };
  addGenerationToActiveSession(tempId, prompt);
  state.history.push(item);
  state.forceHero = false;
  state.generating = true;
  state.generationStartedAt = startedAt;
  state.references = [];
  startFunMessages();
  startGenerationTimer(startedAt);
  renderAll();
  setView("home");
  focusGenerationWorkspace(tempId, "auto");

  let focusId = tempId;
  let postPublishItem = null;
  state.generateAbortController?.abort();
  state.generateAbortController = new AbortController();
  // 续图判断必须放在 fromHeroComposer 之后：hero 入口创建了新会话，必然没有上一张图。
  const continuation = fromHeroComposer ? { active: false, reason: "hero" } : getContinuationContext();
  try {
    let data;
    if (continuation.active && continuation.lastImageUrl) {
      // 走图生图路径：上一张图作为基底图，自动转成 data URL。
      const imageData = await imageReferenceForEdit(continuation.lastImageUrl);
      const sourceImageData = state.publishToSquare && imageData ? imageData : "";
      data = await api("/api/images/edit", {
        method: "POST",
        signal: state.generateAbortController.signal,
        body: JSON.stringify({
          prompt,
          imageData,
          maskData: "",
          isPublic: item.isPublic && candidateCount === 1,
          async: true,
          publishOriginal: Boolean(sourceImageData),
          sourceImageData,
          publicTags: item.publicTags,
          conversationRoute: conversationRouteForItem(item),
          size: item.options.size
        })
      });
    } else {
      data = await api("/api/images/generate", {
        method: "POST",
        signal: state.generateAbortController.signal,
        body: JSON.stringify({
          prompt,
          size: item.options.size,
          quality: item.options.quality,
          background: item.options.background,
          outputFormat: item.options.outputFormat,
          isPublic: item.isPublic && candidateCount === 1,
          async: true,
          publicTags: item.publicTags,
          conversationRoute: conversationRouteForItem(item),
          n: candidateCount
        })
      });
    }
    if (data.request?.id) {
      state.currentGenerationRequestId = data.request.id;
      state.history = state.history.map((entry) =>
        entry.id === tempId ? { ...entry, requestId: data.request.id, queuePosition: data.request.queuePosition, queueTotal: data.request.queueTotal } : entry
      );
      data = await waitForGenerationRequest(data.request.id, tempId, startedAt);
    }
    const generation = data.generations[0];
    focusId = generation.id;
    const elapsedMs = Number(generation.durationMs || 0) || (Date.now() - startedAt);
    replaceSessionGenerationId(tempId, generation.id, elapsedMs);
    const savedEntry = {
      ...generationEntryFromApi(generation, { ...item, status: "done", elapsedMs }),
      images: data.generations.map((candidate) => candidate.imageUrl).filter(Boolean),
      candidateIds: data.generations.map((candidate) => candidate.id).filter(Boolean)
    };
    state.history = state.history.map((entry) =>
      entry.id === tempId
        ? savedEntry
        : entry
    );
    postPublishItem = item.isPublic && data.generations.length === 1 ? savedEntry : null;
    state.user.credits = data.credits;
    state.stats.todayGenerated += data.generations.length;
    updateDailyMetric();
    // 续图成功后：把当前会话锁定为续图源头。
    if (continuation.active) {
      state.continuationLockedSessionId = state.activeImageSessionId || "";
      state.continuationLastImageUrl = generation.imageUrl;
      showToast(text("continuationActiveToast"), "ri-magic-line");
    }
    if (item.isPublic) await loadPublicGallery();
    if (!continuation.active) {
      showToast(state.lang === "zh" ? "已生成" : "Created", "ri-sparkling-2-fill");
    }
    if (item.isPublic && data.generations.length > 1) {
      showToast(state.lang === "zh" ? "请选择最终候选后再公开" : "Choose the final candidate before publishing", "ri-gallery-upload-line");
    }
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    if (error?.name === "AbortError") {
      // 用户主动取消：把临时占位条目移除，不显示错误。
      state.history = state.history.filter((entry) => entry.id !== tempId);
    } else {
      state.history = state.history.map((entry) =>
        entry.id === tempId ? { ...entry, status: "error", error: error.message, elapsedMs } : entry
      );
      if (/credit|额度|积分|Not enough/i.test(error.message)) openCreditsModal();
      else showToast(promptAuditPublishMessage(error) || error.message, "ri-error-warning-line");
    }
  } finally {
    state.generating = false;
    state.generationStartedAt = 0;
    state.generateAbortController = null;
    state.currentGenerationRequestId = "";
    stopFunMessages();
    stopGenerationTimer();
    renderAll();
    focusGenerationWorkspace(focusId, "smooth");
    if (postPublishItem) {
      setTimeout(() => openPublishModal(postPublishItem, false), 180);
    } else {
      setTimeout(maybeOpenUnreadAnnouncementModal, 260);
    }
  }
}

function startFunMessages() {
  stopFunMessages();
  state.funIndex = 0;
  elements.generationStatus.classList.remove("hidden");
  elements.funMessage.textContent = text("funMsgs")[0];
  state.funTimer = setInterval(() => {
    const messages = text("funMsgs");
    state.funIndex = (state.funIndex + 1) % messages.length;
    elements.funMessage.textContent = messages[state.funIndex];
  }, 3000);
}

function stopFunMessages() {
  if (state.funTimer) clearInterval(state.funTimer);
  state.funTimer = null;
  elements.generationStatus.classList.add("hidden");
}

function startGenerationTimer(startedAt = Date.now()) {
  stopGenerationTimer();
  state.generationStartedAt = startedAt;
  updateGenerationTimer();
  state.elapsedTimer = setInterval(() => {
    updateGenerationTimer();
  }, 1000);
}

function stopGenerationTimer() {
  if (state.elapsedTimer) clearInterval(state.elapsedTimer);
  state.elapsedTimer = null;
  if (elements.elapsedTimer) elements.elapsedTimer.textContent = "00:00";
}

function updateGenerationTimer() {
  if (!elements.elapsedTimer || !state.generationStartedAt) return;
  const topElapsed = formatElapsed(Date.now() - state.generationStartedAt);
  elements.elapsedTimer.textContent = topElapsed;
  state.history
    .filter((item) => item.status === "generating")
    .forEach((item) => {
      const elapsed = Date.now() - (Number(item.startedAt) || state.generationStartedAt);
      const selectorId = String(item.id || "").replace(/["\\]/g, "\\$&");
      const node = $(`[data-elapsed-for="${selectorId}"]`, elements.historyList);
      if (node) node.textContent = `${text("generatingElapsed")} ${formatElapsed(elapsed)}`;
    });
}

function focusGenerationWorkspace(itemId, behavior = "smooth") {
  const focusTarget = () => {
    const selectorId = String(itemId || "").replace(/["\\]/g, "\\$&");
    const target = itemId
      ? $(`[data-history-id="${selectorId}"]`, elements.historyList)
      : $(".message-card:last-of-type", elements.historyList);
    (target || elements.chatView).scrollIntoView({ behavior, block: "start" });
  };
  requestAnimationFrame(() => setTimeout(focusTarget, 40));
}

function generationRequestStatus(request = {}) {
  return request.normalizedStatus || (request.status === "success" ? "succeeded" : request.status || "");
}

function updateQueuedHistoryItem(itemId, request = {}) {
  state.history = state.history.map((entry) => {
    if (String(entry.id) !== String(itemId) && String(entry.requestId || "") !== String(request.id || "")) return entry;
    return {
      ...entry,
      requestId: request.id || entry.requestId,
      queuePosition: request.queuePosition,
      queueTotal: request.queueTotal,
      estimatedWaitSeconds: request.estimatedWaitSeconds,
      status: ["pending", "running"].includes(generationRequestStatus(request)) ? "generating" : entry.status
    };
  });
}

async function waitForGenerationRequest(requestId, itemId, startedAt = Date.now()) {
  let lastError = null;
  for (;;) {
    try {
      const data = await api(`/api/images/requests/${encodeURIComponent(requestId)}`);
      const request = data.request || {};
      const status = generationRequestStatus(request);
      updateQueuedHistoryItem(itemId, request);
      if (status === "succeeded") {
        if (!data.generations?.length) throw new Error("Generation completed without images");
        return data;
      }
      if (status === "failed" || status === "cancelled") {
        throw new Error(request.errorMessage || (status === "cancelled" ? "Generation cancelled" : "Generation failed"));
      }
      renderAll();
      lastError = null;
    } catch (error) {
      lastError = error;
      if (!/Failed to fetch|NetworkError/i.test(error.message || "")) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, lastError ? 3500 : 1800));
    state.history = state.history.map((entry) =>
      String(entry.id) === String(itemId) ? { ...entry, elapsedMs: Date.now() - startedAt } : entry
    );
  }
}

async function loadActiveGenerationRequests() {
  if (!state.user) return;
  const data = await api("/api/images/requests/active");
  const active = data.requests || [];
  if (!active.length) return;
  active.forEach((request) => {
    const id = request.id;
    if (!state.history.some((entry) => entry.requestId === id || entry.id === id)) {
      const startedAt = request.createdAt ? new Date(request.createdAt).getTime() : Date.now();
      state.history.push({
        id,
        requestId: id,
        prompt: request.prompt || "",
        images: [],
        status: "generating",
        time: request.createdAt || new Date().toISOString(),
        startedAt,
        queuePosition: request.queuePosition,
        queueTotal: request.queueTotal,
        isPublic: Boolean(request.isPublic),
        publicTags: []
      });
      addGenerationToActiveSession(id, request.prompt || "");
      waitForGenerationRequest(id, id, startedAt)
        .then((result) => finishRestoredGeneration(id, result))
        .catch((error) => {
          state.history = state.history.map((entry) =>
            entry.id === id ? { ...entry, status: "error", error: error.message } : entry
          );
          renderAll();
        });
    }
  });
}

function finishRestoredGeneration(tempId, data) {
  const generation = data.generations?.[0];
  if (!generation) return;
  const elapsedMs = Number(generation.durationMs || 0) || null;
  replaceSessionGenerationId(tempId, generation.id, elapsedMs);
  state.history = state.history.map((entry) =>
    entry.id === tempId
      ? {
          ...generationEntryFromApi(generation, { ...entry, status: "done", elapsedMs }),
          images: data.generations.map((candidate) => candidate.imageUrl).filter(Boolean),
          candidateIds: data.generations.map((candidate) => candidate.id).filter(Boolean)
        }
      : entry
  );
  renderAll();
}

async function loadHistory() {
  if (!state.user) {
    state.history = [];
    return;
  }
  try {
    const data = await api("/api/images/history?includeArchived=1&limit=200");
    state.history = [...(data.generations || [])]
      .reverse()
      .map((generation) => generationEntryFromApi(generation, {
        status: "done",
        elapsedMs: state.generationMeta[generation.id]?.elapsedMs,
        options: {
          size: generation.size,
          quality: generation.quality,
          background: generation.background,
          outputFormat: generation.outputFormat
        }
      }));
  } catch (error) {
    showToast(error.message, "ri-error-warning-line");
  }
}

function renderImageSessions() {
  if (!elements.imageSessionList) return;
  const historyById = new Map(state.history.map((item) => [String(item.id), item]));
  if (!state.imageSessions.length) {
    elements.imageSessionList.innerHTML = `<div class="session-empty">${text("emptyWorks")}</div>`;
    return;
  }

  elements.imageSessionList.innerHTML = state.imageSessions.map((session) => {
    const items = (session.generationIds || []).map((id) => historyById.get(String(id))).filter(Boolean);
    const latest = [...items].reverse().find((item) => item.images?.[0]);
    const latestPrompt = items.at(-1)?.prompt || "";
    const count = items.length;
    const active = session.id === state.activeImageSessionId ? "active" : "";
    const thumb = latest
    ? `<img src="${escapeHtml(imageVariantUrl(latest.images[0]))}" ${imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="${escapeHtml(truncate(latest.prompt, 60))}">`
      : `<i class="ri-chat-3-line"></i>`;
    return `
      <button class="chat-session-card ${active}" type="button" data-session-id="${escapeHtml(session.id)}">
        <span class="session-thumb" ${imageFallbackContainerAttrs()}>${thumb}</span>
        <span class="session-copy">
          <strong>${escapeHtml(session.title || text("sessionUntitled"))}</strong>
          <em>${count} ${text("roundCount")}</em>
          <small>${escapeHtml(truncate(latestPrompt || session.updatedAt || "", 42))}</small>
        </span>
      </button>
    `;
  }).join("");

  $$("[data-session-id]", elements.imageSessionList).forEach((button) => {
    button.addEventListener("click", () => {
      state.activeImageSessionId = button.dataset.sessionId;
      state.continuationLockedSessionId = "";
      state.continuationLastImageUrl = "";
      saveImageSessionState();
      state.forceHero = false;
      elements.app.classList.remove("session-panel-open");
      elements.app.classList.remove("chat-panel-collapsed");
      renderAll();
      setView("home");
      focusGenerationWorkspace(null, "auto");
    });
  });
}

function renderHistory() {
  let lastDate = "";
  const visibleHistory = getActiveSessionHistory();
  if (!visibleHistory.length) {
    elements.historyList.innerHTML = `
      <div class="chat-empty-state">
        <i class="ri-image-add-line"></i>
        <strong>${text("emptySession")}</strong>
      </div>
    `;
    return;
  }
  elements.historyList.innerHTML = visibleHistory.map((item, itemIndex) => {
    const date = formatDate(item.time);
    const separator = date && date !== lastDate ? `<div class="date-separator">${date}</div>` : "";
    if (date) lastDate = date;
    const route = conversationRouteForItem(item);
    const elapsedMs = item.status === "generating"
      ? Date.now() - (Number(item.startedAt) || state.generationStartedAt || Date.now())
      : item.elapsedMs || state.generationMeta[item.id]?.elapsedMs;
    const meta = elapsedMs
      ? `<div class="message-meta"><span ${item.status === "generating" ? `data-elapsed-for="${escapeHtml(item.id)}"` : ""}>${item.status === "generating" ? text("generatingElapsed") : text("elapsed")} ${formatElapsed(elapsedMs)}</span></div>`
      : "";
    const queueMeta = item.status === "generating" && item.queuePosition !== undefined && item.queuePosition !== null
      ? `<span class="queue-pill">${item.queuePosition === 0 ? text("queueRunning") : `${text("queuePosition")} ${item.queuePosition}/${item.queueTotal || item.queuePosition}`}</span>`
      : "";
    const image = item.status === "done" && item.images[0]
      ? `<img class="img-reveal" src="${escapeHtml(item.images[0])}" ${imageFallbackImgAttrs()} alt="${escapeHtml(truncate(item.prompt, 80))}">`
      : item.status === "generating"
        ? `<div class="paint-drip"><span></span><span></span><span></span><span></span><span></span></div>`
        : `<i class="ri-image-line"></i>`;
    const error = item.status === "error" ? `<div class="error-box">${escapeHtml(item.error || "Error")}</div>` : "";
    const canPublishOriginal = Boolean(item.sourceImageData || item.sourceImageUrl);
    const tagRow = item.publicTags?.length ? `
      <div class="public-tag-row">
        ${item.publicTags.map((tag) => {
          const info = tagInfo(tag);
          return `<span class="tag-chip" style="--tag-hue:${info.hue}">${escapeHtml(info.label)}</span>`;
        }).join("")}
      </div>
    ` : "";
    const routeStrip = route.length > 1 ? `
      <div class="route-strip" aria-label="${text("routeTitle")}">
        ${route.slice(-4).map((step, routeIndex) => `
          <span title="${escapeHtml(step.prompt || "")}" ${imageFallbackContainerAttrs()}>
            ${step.imageUrl ? `<img src="${escapeHtml(step.imageUrl)}" ${imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="">` : `<i class="ri-sparkling-2-line"></i>`}
            <em>${routeIndex + Math.max(1, route.length - 3)}</em>
          </span>
        `).join("")}
      </div>
    ` : "";
    const candidateStrip = item.status === "done" && (item.images || []).length > 1 ? `
      <div class="candidate-strip">
        ${item.images.map((imageUrl, index) => `
          <button type="button" class="${index === 0 ? "active" : ""}" data-candidate="${escapeHtml(item.id)}" data-candidate-index="${index}" ${imageFallbackContainerAttrs()}>
            <img src="${escapeHtml(imageVariantUrl(imageUrl))}" ${imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="">
            <span>${index + 1}</span>
          </button>
        `).join("")}
      </div>
    ` : "";
    const moreActions = item.status === "done" && item.images[0] ? `
      <details class="message-more">
        <summary><i class="ri-more-2-line"></i>${text("more")}</summary>
        <div class="message-more-menu">
          <button type="button" data-edit-image="${escapeHtml(item.id)}"><i class="ri-image-edit-line"></i>${text("imageToImageShort")}</button>
          <button type="button" data-publish-image="${escapeHtml(item.id)}">
            <i class="${item.isPublic ? "ri-price-tag-3-line" : "ri-gallery-upload-line"}"></i>
            ${item.isPublic ? text("editPublicTags") : text("publishImage")}
          </button>
          ${canPublishOriginal && !item.publishOriginal ? `<button type="button" data-publish-original="${escapeHtml(item.id)}"><i class="ri-image-add-line"></i>${text("publishWithOriginal")}</button>` : ""}
          ${item.sourceImageUrl && item.publishOriginal ? `<a href="${escapeHtml(item.sourceImageUrl)}" target="_blank" rel="noreferrer"><i class="ri-image-line"></i>${text("sourceImage")}</a>` : ""}
        </div>
      </details>
    ` : "";
    const actions = item.status === "done" ? `
      <div class="message-actions result-action-bar">
        <button type="button" data-retry="${escapeHtml(item.prompt)}"><i class="ri-refresh-line"></i>${text("retry")}</button>
        <a href="${item.images[0]}" download="${item.id}.png"><i class="ri-download-line"></i>${text("download")}</a>
        <button type="button" data-edit="${escapeHtml(item.prompt)}"><i class="ri-edit-line"></i>${text("editPrompt")}</button>
        ${moreActions}
      </div>
    ` : item.status === "error" ? `
      <div class="message-actions">
        <button type="button" data-retry="${escapeHtml(item.prompt)}"><i class="ri-refresh-line"></i>${text("retry")}</button>
        <button type="button" data-edit="${escapeHtml(item.prompt)}"><i class="ri-edit-line"></i>${text("editPrompt")}</button>
      </div>
    ` : item.status === "generating" ? `
      <div class="message-actions generating-actions">
        <span><i class="ri-loader-4-line"></i>${queueMeta}${text("generatingElapsed")} ${elapsedMs ? formatElapsed(elapsedMs) : ""}</span>
        <button type="button" data-generate-cancel="${escapeHtml(item.requestId || state.currentGenerationRequestId || "")}"><i class="ri-stop-circle-line"></i>${text("editorCancel")}</button>
      </div>
    ` : "";
    return `
      ${separator}
      <article class="message-card fade-up" data-history-id="${escapeHtml(item.id)}">
        <div class="message-card-top">
          <div class="message-prompt">
            <i class="ri-chat-quote-line"></i>
            <div>${escapeHtml(item.prompt)}${meta}</div>
          </div>
          <span class="round-pill">${itemIndex + 1} ${text("roundCount")}</span>
        </div>
        <div class="message-image"><div class="image-shell" ${imageFallbackContainerAttrs()}>${image}</div></div>
        ${routeStrip}
        ${candidateStrip}
        ${tagRow}
        ${error}
        ${actions}
      </article>
    `;
  }).join("");

  $$("[data-retry]", elements.historyList).forEach((button) => {
    button.addEventListener("click", () => {
      state.draftPrompt = button.dataset.retry;
      syncComposers();
      const form = $(".composer", elements.stickyComposerMount) || $(".composer", elements.heroComposerMount);
      submitGeneration(form);
    });
  });
  $$("[data-edit]", elements.historyList).forEach((button) => {
    button.addEventListener("click", () => {
      state.draftPrompt = button.dataset.edit;
      syncComposers();
      $(".prompt-box", $(".composer", elements.stickyComposerMount) || document).focus();
    });
  });
  $$("[data-edit-image]", elements.historyList).forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.history.find((entry) => String(entry.id) === button.dataset.editImage);
      if (item?.images?.[0]) openImageEditor(item.images[0], item.prompt);
    });
  });
  $$("[data-candidate]", elements.historyList).forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.candidateIndex || 0);
      state.history = state.history.map((entry) => {
        if (String(entry.id) !== button.dataset.candidate || !entry.images?.[index]) return entry;
        const images = [...entry.images];
        const candidateIds = [...(entry.candidateIds || [])];
        const [selectedImage] = images.splice(index, 1);
        const [selectedId] = candidateIds.splice(index, 1);
        if (selectedId) replaceSessionGenerationId(entry.id, selectedId, entry.elapsedMs);
        return {
          ...entry,
          id: selectedId || entry.id,
          images: [selectedImage, ...images],
          candidateIds: selectedId ? [selectedId, ...candidateIds] : entry.candidateIds
        };
      });
      renderAll();
    });
  });
  $$("[data-generate-cancel]", elements.historyList).forEach((button) => {
    button.addEventListener("click", () => {
      const requestId = button.dataset.generateCancel || state.currentGenerationRequestId;
      if (requestId) {
        api(`/api/images/requests/${encodeURIComponent(requestId)}`, { method: "POST", body: "{}" }).catch(() => null);
        state.history = state.history.filter((entry) => entry.requestId !== requestId);
        renderAll();
      }
      if (state.generateAbortController) {
        state.generateAbortController.abort();
        showToast(state.lang === "zh" ? "已取消生成，积分已退还" : "Cancelled; credits refunded", "ri-stop-circle-line");
      }
    });
  });
  $$("[data-publish-image]", elements.historyList).forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.history.find((entry) => String(entry.id) === button.dataset.publishImage);
      if (item) openPublishModal(item, false);
    });
  });
  $$("[data-publish-original]", elements.historyList).forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.history.find((entry) => String(entry.id) === button.dataset.publishOriginal);
      if (item) openPublishModal(item, true);
    });
  });
}

function openPublishModal(item, publishOriginal = false) {
  if (!state.user) {
    openAuthModal("login");
    return;
  }
  const canPublishOriginal = Boolean(item.sourceImageData || item.sourceImageUrl);
  const requiresOriginal = Boolean(item.sourceImageData || item.sourceImageUrl || item.sourceFilename);
  const kindTag = publicKindTagForItem(item);
  const currentTags = normalizePublicTags(item.publicTags || [])
    .filter((tag) => !["text-to-image", "image-to-image"].includes(tag.toLowerCase()));
  const selectedTags = new Set(currentTags.map((tag) => tag.toLowerCase()));
  const kindInfo = tagInfo(kindTag);
  const choices = existingPublishTagChoices(currentTags);
  const suggestionButtons = choices.map((tag) => {
    const info = tagInfo(tag.slug);
    return `
    <button class="tag-chip ${selectedTags.has(tag.slug.toLowerCase()) ? "active" : ""}" style="--tag-hue:${info.hue}" type="button" data-tag-choice="${escapeHtml(tag.slug)}">
      ${escapeHtml(info.label)}
    </button>
  `;
  }).join("") || `<p class="publish-tag-empty">${escapeHtml(text("noExistingTags"))}</p>`;
  openModal(`
    <section class="modal publish-modal">
      <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
      <div class="publish-modal-head">
        <img src="${escapeHtml(imageVariantUrl(item.images?.[0] || ""))}" ${imageFallbackImgAttrs()} alt="${escapeHtml(truncate(item.prompt, 80))}">
        <div>
          <h2>${item.isPublic ? text("editPublicTags") : text("publishDialogTitle")}</h2>
          <p>${text("publishDialogDesc")}</p>
        </div>
      </div>
      <form id="publishForm" class="publish-form">
        <div class="publish-required-tag">
          <span>${escapeHtml(text("requiredPublicTag"))}</span>
          <strong class="tag-chip active" style="--tag-hue:${kindInfo.hue}">${escapeHtml(kindInfo.label)}</strong>
        </div>
        <div class="publish-tag-picker">
          <span>${escapeHtml(text("chooseExistingTags"))}</span>
          <small>${escapeHtml(text("tagInputHint"))}</small>
        </div>
        <div class="publish-tag-options">${suggestionButtons}</div>
        ${canPublishOriginal ? `
          <label class="publish-original-check">
            <input id="publishOriginalInput" type="checkbox" ${requiresOriginal || publishOriginal || item.publishOriginal ? "checked" : ""} ${requiresOriginal ? "disabled" : ""}>
            <span>${requiresOriginal ? text("publishOriginalRequired") : text("publishOriginalOption")}</span>
          </label>
        ` : ""}
        <button class="modal-primary" type="submit">${item.isPublic ? text("saveTags") : text("publishToSquare")}</button>
        ${item.isPublic ? `<button class="modal-secondary" type="button" data-unpublish-public><i class="ri-eye-off-line"></i>${text("unpublish")}</button>` : ""}
      </form>
    </section>
  `);

  const syncTagButtons = () => {
    $$("[data-tag-choice]", elements.modalLayer).forEach((button) => {
      button.classList.toggle("active", selectedTags.has(button.dataset.tagChoice.toLowerCase()));
    });
  };
  $$("[data-tag-choice]", elements.modalLayer).forEach((button) => {
    button.addEventListener("click", () => {
      const tag = button.dataset.tagChoice;
      const key = tag.toLowerCase();
      if (selectedTags.has(key)) selectedTags.delete(key);
      else selectedTags.add(key);
      syncTagButtons();
    });
  });
  $("#publishForm", elements.modalLayer).addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.currentTarget.querySelector("button[type='submit']");
    submit.disabled = true;
    const ok = await publishGenerationToSquare(
      item,
      requiresOriginal || $("#publishOriginalInput", elements.modalLayer)?.checked || false,
      [kindTag, ...selectedTags]
    );
    submit.disabled = false;
    if (ok) closeModal();
  });
  $("[data-unpublish-public]", elements.modalLayer)?.addEventListener("click", async () => {
    const ok = await unpublishGeneration(item);
    if (ok) closeModal();
  });
}

async function publishGenerationToSquare(item, publishOriginal = false, publicTags = item.publicTags || []) {
  if (!state.user) {
    openAuthModal("login");
    return false;
  }
  const attemptPublish = async (sourceItem = null) => {
    const forceOriginal = Boolean(item.sourceImageData || item.sourceImageUrl || item.sourceFilename || sourceItem?.id);
    const kind = sourceItem?.id ? "image-to-image" : publicKindTagForItem({ ...item, sourceImageId: item.sourceImageId || "" });
    const payload = {
      isPublic: true,
      publishOriginal: publishOriginal || forceOriginal,
      sourceImageData: publishOriginal || forceOriginal ? item.sourceImageData || "" : "",
      sourceImageId: sourceItem?.id || item.sourceImageId || "",
      publicTags: publicTagsForKind(kind, publicTags),
      conversationRoute: conversationRouteForItem(item)
    };
    return api(`/api/images/${item.id}/public`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  };
  try {
    const data = await attemptPublish();
    const generation = data.generation;
    state.history = state.history.map((entry) =>
      String(entry.id) === String(item.id)
        ? generationEntryFromApi(generation, {
            ...entry,
            conversation: generation.conversation || conversationRouteForItem(entry),
            publicTags: generation.publicTags || publicTagsForKind(publicKindTagForItem(entry), publicTags)
          })
        : entry
    );
    await loadPublicGallery();
    renderAll();
    showToast(item.isPublic ? text("tagsSaved") : text("publishDone"), "ri-gallery-upload-line");
    return true;
  } catch (error) {
    if (error?.details?.requiredMode === "image-to-image" && !item.sourceImageId && !item.sourceImageUrl && !item.sourceImageData) {
      openBindSourceModal({ item, publishOriginal, publicTags, attemptPublish });
      return false;
    }
    showToast(promptAuditPublishMessage(error) || error.message || text("publishFailed"), "ri-error-warning-line");
    return false;
  }
}

function bindableGallerySources(item) {
  return state.publicGallery
    .filter((source) => source.images?.[0] && source.prompt && String(source.id) !== String(item.id))
    .slice(0, 48);
}

function openBindSourceModal({ item, publishOriginal = false, publicTags = [], attemptPublish }) {
  const sources = bindableGallerySources(item);
  let selectedId = sources[0]?.id || "";
  openModal(`
    <section class="modal publish-modal bind-source-modal">
      <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
      <div class="publish-modal-head">
        <img src="${escapeHtml(imageVariantUrl(item.images?.[0] || ""))}" ${imageFallbackImgAttrs()} alt="${escapeHtml(truncate(item.prompt, 80))}">
        <div>
          <h2>${escapeHtml(text("bindSourceTitle"))}</h2>
          <p>${escapeHtml(text("bindSourceDesc"))}</p>
        </div>
      </div>
      <div class="bind-current-prompt">
        <strong>${escapeHtml(text("bindSourceCurrentPrompt"))}</strong>
        <p>${escapeHtml(item.prompt || "")}</p>
      </div>
      ${sources.length ? `
        <div class="bind-source-grid">
          ${sources.map((source) => `
            <button class="bind-source-card${String(source.id) === String(selectedId) ? " active" : ""}" type="button" data-bind-source="${escapeHtml(source.id)}" ${imageFallbackContainerAttrs()}>
              <img src="${escapeHtml(imageVariantUrl(source.images[0]))}" ${imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="${escapeHtml(truncate(source.prompt, 80))}">
              <span>${escapeHtml(truncate(source.prompt, 72))}</span>
            </button>
          `).join("")}
        </div>
      ` : `<p class="publish-tag-empty">${escapeHtml(text("bindSourceEmpty"))}</p>`}
      <div class="bind-source-actions">
        <button class="modal-secondary" type="button" data-bind-cancel>${escapeHtml(text("bindSourceCancel"))}</button>
        <button class="modal-primary" type="button" data-bind-confirm ${sources.length ? "" : "disabled"}>${escapeHtml(text("bindSourceConfirm"))}</button>
      </div>
    </section>
  `);
  const sync = () => {
    $$("[data-bind-source]", elements.modalLayer).forEach((button) => {
      button.classList.toggle("active", String(button.dataset.bindSource) === String(selectedId));
    });
  };
  $$("[data-bind-source]", elements.modalLayer).forEach((button) => {
    button.addEventListener("click", () => {
      selectedId = button.dataset.bindSource || "";
      sync();
    });
  });
  $("[data-bind-cancel]", elements.modalLayer)?.addEventListener("click", () => openPublishModal(item, publishOriginal));
  $("[data-bind-confirm]", elements.modalLayer)?.addEventListener("click", async (event) => {
    const source = sources.find((entry) => String(entry.id) === String(selectedId));
    if (!source) return;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const data = await attemptPublish(source);
      const generation = data.generation;
      state.history = state.history.map((entry) =>
        String(entry.id) === String(item.id)
          ? generationEntryFromApi(generation, {
              ...entry,
              sourceImageId: source.id,
              sourcePrompt: source.prompt,
              sourceImageUrl: source.images?.[0] || "",
              originGalleryId: source.originGalleryId || source.id,
              publicTags: generation.publicTags || publicTagsForKind("image-to-image", publicTags),
              conversation: generation.conversation || conversationRouteForItem(entry)
            })
          : entry
      );
      await loadPublicGallery();
      renderAll();
      closeModal();
      showToast(text("publishDone"), "ri-gallery-upload-line");
    } catch (error) {
      button.disabled = false;
      showToast(promptAuditPublishMessage(error) || error.message || text("publishFailed"), "ri-error-warning-line");
    }
  });
}

async function unpublishGeneration(item) {
  if (!state.user) {
    openAuthModal("login");
    return false;
  }
  try {
    await api(`/api/images/${item.id}/public`, {
      method: "PATCH",
      body: JSON.stringify({ isPublic: false })
    });
    state.history = state.history.map((entry) =>
      String(entry.id) === String(item.id) ? { ...entry, isPublic: false } : entry
    );
    state.publicGallery = state.publicGallery.filter((entry) => String(entry.id) !== String(item.id));
    renderAll();
    showToast(text("unpublishDone"), "ri-eye-off-line");
    return true;
  } catch (error) {
    showToast(error.message || text("publishFailed"), "ri-error-warning-line");
    return false;
  }
}

function renderExamples() {
  elements.exampleGrid.innerHTML = getPromptSource().slice(0, 4).map(promptCardHtml).join("");
  bindPromptCards(elements.exampleGrid);
}

function filterableSystemTags() {
  const list = Array.isArray(state.tagsLibrary?.list) ? state.tagsLibrary.list : [];
  if (!list.length) {
    return tags
      .filter((slug) => slug !== "all")
      .map((slug, index) => ({ ...tagInfo(slug), slug, sortOrder: index * 10, contentCount: 0 }));
  }
  return list
    .filter((tag) => tag.status !== "hidden" && tag.showInFilter !== false)
    .sort(sortGalleryTags);
}

function sortGalleryTags(left, right) {
  const pinned = { "text-to-image": 1, "image-to-image": 2 };
  const leftPinned = pinned[left.slug] || 0;
  const rightPinned = pinned[right.slug] || 0;
  if (leftPinned || rightPinned) return (leftPinned || 99) - (rightPinned || 99);
  return Number(right.galleryCount || 0) - Number(left.galleryCount || 0)
    || Number(right.contentCount || 0) - Number(left.contentCount || 0)
    || Number(left.sortOrder || 0) - Number(right.sortOrder || 0)
    || String(left.slug).localeCompare(String(right.slug));
}

function existingPublishTagChoices(currentTags = []) {
  const blocked = new Set(["all", "square", "text-to-image", "image-to-image"]);
  const selected = new Set(normalizePublicTags(currentTags).map((tag) => tag.toLowerCase()));
  const library = Array.isArray(state.tagsLibrary?.list) ? state.tagsLibrary.list : [];
  const source = library.length
    ? library.filter((tag) => tag.status !== "hidden" && tag.showInFilter !== false)
    : publicTagSuggestions.map((slug, index) => ({ ...tagInfo(slug), slug, sortOrder: index * 10, galleryCount: 0 }));
  return source
    .filter((tag) => tag?.slug && !blocked.has(String(tag.slug).toLowerCase()))
    .sort((left, right) => {
      const leftSelected = selected.has(String(left.slug).toLowerCase()) ? 1 : 0;
      const rightSelected = selected.has(String(right.slug).toLowerCase()) ? 1 : 0;
      return rightSelected - leftSelected || sortGalleryTags(left, right);
    })
    .slice(0, 24);
}

function tagSearchText(slug) {
  const info = tagInfo(slug);
  return [info.slug, info.label, ...(info.aliases || [])].filter(Boolean).join(" ");
}

function relatedTagsFor(tag) {
  const category = tag.category || "general";
  return filterableSystemTags()
    .filter((item) => item.slug !== tag.slug && (item.category || "general") === category)
    .slice(0, 4);
}

function emptyTagMessageHtml(tag) {
  const related = relatedTagsFor(tag);
  const title = text("emptyTagTitle").replace("{tag}", tag.label || tag.slug);
  const adminAction = state.user?.role === "admin"
    ? `<button type="button" data-empty-tag-admin-create><i class="ri-add-circle-line"></i>${escapeHtml(text("emptyTagAdminCreate"))}</button>`
    : "";
  return `
    <div class="empty-message empty-tag-state">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(text("emptyTagBody"))}</span>
      <div class="empty-tag-actions">
        <button type="button" data-empty-tag-generate><i class="ri-sparkling-2-line"></i>${escapeHtml(text("emptyTagGenerate"))}</button>
        ${adminAction}
      </div>
      ${related.length ? `
        <div class="empty-tag-related">
          <em>${escapeHtml(text("emptyTagNearby"))}</em>
          ${related.map((item) => {
            const info = tagInfo(item.slug);
            return `<button type="button" data-tag="${escapeHtml(item.slug)}">${escapeHtml(info.label)}</button>`;
          }).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function renderLibrary() {
  elements.librarySearchInput.value = state.librarySearch;
  const source = getLibrarySource();
  const counts = getTagCounts(source);
  const systemTags = filterableSystemTags();
  const known = new Set(systemTags.map((tag) => tag.slug));
  const dynamicTags = Object.keys(counts)
    .filter((tag) => !known.has(tag) && !tags.includes(tag))
    .sort((left, right) => counts[right] - counts[left] || left.localeCompare(right))
    .slice(0, 20)
    .map((slug) => ({ ...tagInfo(slug), slug, contentCount: counts[slug] || 0, category: "general" }));
  const filterTags = [
    { slug: "all", label: tagLabels[state.lang].all, contentCount: source.length, category: "core" },
    ...systemTags,
    ...dynamicTags
  ];
  elements.tagFilters.innerHTML = filterTags.map((tag) => {
    const info = tag.slug === "all" ? tag : tagInfo(tag.slug);
    const count = tag.slug === "all" ? source.length : (counts[tag.slug] || info.contentCount || 0);
    const empty = tag.slug !== "all" && count === 0;
    const category = info.category && info.category !== "core"
      ? tagCategoryLabels[state.lang]?.[info.category] || info.category
      : "";
    const title = `${info.slug}${info.aliases?.length ? ` · ${info.aliases.join(" · ")}` : ""}`;
    return `
    <button type="button" class="${state.libraryTag === tag.slug ? "active" : ""} ${empty ? "empty" : ""}" data-tag="${escapeHtml(tag.slug)}" title="${escapeHtml(title)}">
      ${category ? `<em>${escapeHtml(category)}</em>` : ""}
      ${escapeHtml(info.label || tag.label || tag.slug)}
      <span>${count}</span>
    </button>
  `;
  }).join("");
  $$("[data-tag]", elements.tagFilters).forEach((button) => {
    button.addEventListener("click", () => {
      state.libraryTag = button.dataset.tag;
      state.promptVisible = 20;
      renderLibrary();
    });
  });

  const query = state.librarySearch.trim().toLowerCase();
  const filtered = source.filter((prompt) => {
    const promptTags = Array.isArray(prompt.tags) ? prompt.tags : [prompt.tag].filter(Boolean);
    const matchesTags = state.libraryTag === "all" || promptTags.includes(state.libraryTag);
    const haystack = `${prompt.title} ${prompt.prompt} ${promptTags.join(" ")} ${prompt.author || ""} ${promptTags.map(tagSearchText).join(" ")}`.toLowerCase();
    return matchesTags && (!query || haystack.includes(query));
  });
  const visible = filtered.slice(0, state.promptVisible);
  const sourceCount = getSourceCount(source);
  const summary = state.tagsLibrary?.summary || {};
  const stats = `
    <div class="library-stats">
      <div><strong>${source.length.toLocaleString()}+</strong><span>${text("totalPrompts")}</span></div>
      <div class="stat-divider"></div>
      <div><strong>${sourceCount}</strong><span>${text("totalSources")}</span></div>
      <div class="stat-divider"></div>
      <div><strong>${Number(summary.systemCount || filterableSystemTags().length)}</strong><span>${text("tagStatsSystem")}</span></div>
      <div><strong>${Number(summary.withContentCount || 0)}</strong><span>${text("tagStatsWithContent")}</span></div>
      <div><strong>${Number(summary.emptyCount || 0)}</strong><span>${text("tagStatsEmpty")}</span></div>
    </div>
  `;
  const selectedInfo = state.libraryTag !== "all" ? tagInfo(state.libraryTag) : null;
  elements.promptGrid.innerHTML = state.promptLoading
    ? `<div class="empty-message">${text("loadingPrompts")}</div>`
    : filtered.length
      ? `${renderGalleryLeaderboard()}${visible.map(promptCardHtml).join("")}${visible.length < filtered.length ? `<div class="load-more-wrap"><button id="loadMorePrompts" type="button">${text("loadMore")} <span>(${visible.length}/${filtered.length})</span></button></div>` : ""}`
      : selectedInfo
        ? emptyTagMessageHtml(selectedInfo)
        : `<div class="empty-message">${text("noResults")}</div>`;
  const statsTarget = $(".library-stats");
  if (statsTarget) statsTarget.remove();
  const adminCreate = $(".library-admin-create");
  if (adminCreate) adminCreate.remove();
  $(".library-hero").insertAdjacentHTML("beforeend", stats);
  if (state.user?.role === "admin") {
    $(".library-hero").insertAdjacentHTML("beforeend", `
      <button class="library-admin-create" type="button" data-prompt-create>
        <i class="ri-add-circle-line"></i>${escapeHtml(text("promptCreateTitle"))}
      </button>
    `);
    $("[data-prompt-create]", elements.libraryView)?.addEventListener("click", () => openPromptEditorModal());
  }
  $("[data-empty-tag-generate]", elements.promptGrid)?.addEventListener("click", () => {
    const label = selectedInfo?.label || state.libraryTag;
    state.draftPrompt = state.lang === "zh" ? `${label}风格的图片` : `${label} image`;
    state.forceHero = true;
    setView("home");
    syncComposers();
  });
  $("[data-empty-tag-admin-create]", elements.promptGrid)?.addEventListener("click", () => {
    openPromptEditorModal();
    const tagsInput = $("#promptEditorTags", elements.modalLayer);
    if (tagsInput) tagsInput.value = state.libraryTag;
    const titleInput = $("#promptEditorTitle", elements.modalLayer);
    if (titleInput && !titleInput.value) titleInput.value = selectedInfo?.label || state.libraryTag;
  });
  $$("[data-tag]", elements.promptGrid).forEach((button) => {
    button.addEventListener("click", () => {
      state.libraryTag = button.dataset.tag;
      state.promptVisible = 20;
      renderLibrary();
    });
  });
  $("#loadMorePrompts")?.addEventListener("click", () => {
    state.promptVisible += 20;
    renderLibrary();
  });
  bindPromptCards(elements.promptGrid);
  bindGalleryLeaderboardControls(elements.promptGrid);
}

function renderGalleryLeaderboard() {
  const items = (state.galleryLeaderboard || []).filter((item) => item.images?.[0]).slice(0, 24);
  const rangeTabs = [
    ["day", state.lang === "zh" ? "日榜" : "Day"],
    ["week", state.lang === "zh" ? "周榜" : "Week"],
    ["month", state.lang === "zh" ? "月榜" : "Month"],
    ["all", state.lang === "zh" ? "总榜" : "All-time"]
  ];
  const typeTabs = [
    ["all", state.lang === "zh" ? "全部" : "All"],
    ["text-to-image", text("textToImage")],
    ["image-to-image", text("imageToImage")]
  ];
  return `
    <section class="gallery-leaderboard${state.galleryLeaderboardLoading ? " loading" : ""}">
      <div class="gallery-leaderboard-head">
        <div>
          <strong>${escapeHtml(text("galleryLeaderboard"))}</strong>
          <span>${escapeHtml(text("galleryLeaderboardDesc"))}</span>
        </div>
        <i class="ri-trophy-line"></i>
      </div>
      <div class="gallery-rank-tabs" aria-label="${escapeHtml(text("galleryLeaderboard"))}">
        <div>
          ${rangeTabs.map(([value, label]) => `<button type="button" data-rank-range="${value}" class="${state.galleryLeaderboardRange === value ? "active" : ""}">${escapeHtml(label)}</button>`).join("")}
        </div>
        <div>
          ${typeTabs.map(([value, label]) => `<button type="button" data-rank-type="${value}" class="${state.galleryLeaderboardType === value ? "active" : ""}">${escapeHtml(label)}</button>`).join("")}
        </div>
      </div>
      <div class="gallery-leaderboard-list">
        ${items.length ? items.map((item, index) => `
          <article class="gallery-rank-card ${index < 3 ? `top-${index + 1}` : ""}">
            <button type="button" class="gallery-rank-visual" data-open-square="${escapeHtml(`square_${item.id}`)}" ${imageFallbackContainerAttrs()}>
              <img src="${escapeHtml(imageVariantUrl(item.images[0]))}" ${imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="${escapeHtml(truncate(item.prompt, 70))}">
              <em>#${index + 1}</em>
            </button>
            <div>
              <p>${escapeHtml(truncate(item.prompt, 64))}</p>
              <button type="button" data-like-gallery="${escapeHtml(item.id)}" class="${item.likedByCurrentUser ? "liked" : ""}">
                <i class="${item.likedByCurrentUser ? "ri-heart-fill" : "ri-heart-line"}"></i>${Number(item.likeCount || 0)}
              </button>
            </div>
          </article>
        `).join("") : `<div class="gallery-rank-empty">${state.lang === "zh" ? "暂无榜单作品" : "No ranked works yet"}</div>`}
      </div>
    </section>
  `;
}

function bindGalleryLeaderboardControls(root = document) {
  $$("[data-rank-range]", root).forEach((button) => {
    button.addEventListener("click", async () => {
      if (button.dataset.rankRange === state.galleryLeaderboardRange || state.galleryLeaderboardLoading) return;
      state.galleryLeaderboardRange = button.dataset.rankRange;
      await loadGalleryLeaderboard();
      renderLibrary();
    });
  });
  $$("[data-rank-type]", root).forEach((button) => {
    button.addEventListener("click", async () => {
      if (button.dataset.rankType === state.galleryLeaderboardType || state.galleryLeaderboardLoading) return;
      state.galleryLeaderboardType = button.dataset.rankType;
      await loadGalleryLeaderboard();
      renderLibrary();
    });
  });
}

function getSourceCount(source) {
  const origins = new Set();
  source.forEach((prompt) => {
    if (prompt.source) origins.add(prompt.source);
    if (!prompt.sourceUrl) return;
    try {
      origins.add(new URL(prompt.sourceUrl).hostname.replace(/^www\./, ""));
    } catch {
      origins.add(prompt.sourceUrl);
    }
  });
  return Math.max(1, origins.size);
}

function promptCardHtml(prompt) {
  const promptText = prompt.prompt;
  const title = prompt.title;
  const tagsHtml = (prompt.tags || [prompt.tag].filter(Boolean)).slice(0, 3).map((tag) => {
    const info = tagInfo(tag);
    return `
    <span class="tag-chip" style="--tag-hue:${info.hue}">${escapeHtml(info.label)}</span>
  `;
  }).join("");
  const art = prompt.image
    ? `<img src="${escapeHtml(imageVariantUrl(prompt.image))}" ${imageFallbackImgAttrs()} loading="lazy" decoding="async" fetchpriority="low" alt="${escapeHtml(title)}">`
    : `<i class="${prompt.icon || "ri-image-line"}"></i>`;
  const sourceBadge = prompt.kind === "square"
    ? `<em class="square-badge"><i class="ri-user-line"></i>${escapeHtml(displayUserName(prompt))}</em><b>${prompt.sourceImageUrl ? text("imageToImage") : text("textToImage")}</b>`
    : `<em><i class="ri-user-line"></i>${escapeHtml(prompt.author || "@open")}</em>`;
  const hasImage = Boolean(prompt.image);
  const openAttr = prompt.kind === "square"
    ? ` data-open-square="${escapeHtml(prompt.id)}" role="button" tabindex="0"`
    : hasImage
      ? ` data-open-prompt="${escapeHtml(prompt.id)}" role="button" tabindex="0"`
      : "";
  const cardArtClickable = prompt.kind === "square" || hasImage ? " card-art-clickable" : "";
  const isAdmin = state.user?.role === "admin";
  const adminBadge = isAdmin && prompt.kind !== "square" && prompt.status === "hidden"
    ? `<span class="prompt-status-badge hidden">${escapeHtml(text("promptHidden"))}</span>`
    : "";
  const adminActions = isAdmin && prompt.kind !== "square"
    ? `
      <button type="button" data-edit-prompt="${escapeHtml(prompt.id)}" class="prompt-admin-edit"><i class="ri-pencil-line"></i>${text("promptEdit")}</button>
      <button type="button" data-delete-prompt="${escapeHtml(prompt.id)}" class="prompt-admin-delete"><i class="ri-delete-bin-line"></i>${text("promptDelete")}</button>
    `
    : "";
  const viewDetailButton = prompt.kind === "square"
    ? `<button type="button" data-view-square="${escapeHtml(prompt.id)}"><i class="ri-eye-line"></i>${text("viewDetail")}</button>`
    : hasImage
      ? `<button type="button" data-view-prompt="${escapeHtml(prompt.id)}"><i class="ri-eye-line"></i>${text("viewDetail")}</button>`
      : "";
  const engagement = prompt.kind === "square" ? `
    <div class="prompt-engagement">
      <button type="button" data-like-gallery="${escapeHtml(prompt.generationId || prompt.id)}" class="${prompt.likedByCurrentUser ? "liked" : ""}">
        <i class="${prompt.likedByCurrentUser ? "ri-heart-fill" : "ri-heart-line"}"></i>${Number(prompt.likeCount || 0)}
      </button>
    </div>
  ` : `
    <div class="prompt-engagement">
      <button type="button" data-like-prompt="${escapeHtml(prompt.id)}" class="${prompt.likedByCurrentUser ? "liked" : ""}">
        <i class="${prompt.likedByCurrentUser ? "ri-heart-fill" : "ri-heart-line"}"></i>${Number(prompt.likeCount || 0)}
      </button>
      <span><i class="ri-fire-line"></i>${Number(prompt.heatScore || 0).toFixed(0)}</span>
    </div>
  `;
  return `
    <article class="prompt-card${prompt.status === "hidden" ? " prompt-hidden" : ""}" style="--art-bg:${prompt.colors || "linear-gradient(135deg,#64748b,#cbd5e1)"}">
      <div class="card-art${cardArtClickable}" ${imageFallbackContainerAttrs()}${openAttr}>${art}${sourceBadge}${adminBadge}</div>
      <h3>${escapeHtml(title)}</h3>
      ${engagement}
      <div class="prompt-tags">${tagsHtml}</div>
      <p>${escapeHtml(promptText)}</p>
      <div class="card-actions">
        <button type="button" data-copy-prompt="${escapeHtml(prompt.id)}"><i class="ri-file-copy-line"></i>${text("copy")}</button>
        ${viewDetailButton}
        <button class="use-button" type="button" data-use-prompt="${escapeHtml(prompt.id)}">${text("use")} <i class="ri-arrow-right-line"></i></button>
        ${adminActions}
      </div>
    </article>
  `;
}

function bindPromptCards(root) {
  $$("[data-open-square], [data-view-square]", root).forEach((node) => {
    const open = () => {
      const prompt = getPromptById(node.dataset.openSquare || node.dataset.viewSquare);
      if (prompt) openSquarePreview(prompt);
    };
    node.addEventListener("click", open);
    if (node.hasAttribute("data-open-square")) {
      node.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    }
  });
  $$("[data-open-prompt], [data-view-prompt]", root).forEach((node) => {
    const open = () => {
      const prompt = getPromptById(node.dataset.openPrompt || node.dataset.viewPrompt);
      if (prompt) openPromptDetailModal(prompt);
    };
    node.addEventListener("click", open);
    if (node.hasAttribute("data-open-prompt")) {
      node.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    }
  });
  $$("[data-copy-prompt]", root).forEach((button) => {
    button.addEventListener("click", async () => {
      const prompt = getPromptById(button.dataset.copyPrompt);
      if (!prompt) return;
      await copyText(prompt.prompt);
      showToast(state.lang === "zh" ? "提示词已复制" : "Prompt copied", "ri-file-copy-line");
    });
  });
  $$("[data-use-prompt]", root).forEach((button) => {
    button.addEventListener("click", async () => {
      const prompt = getPromptById(button.dataset.usePrompt);
      if (!prompt) return;
      api(`/api/prompts/${encodeURIComponent(prompt.id)}/use`, { method: "POST" }).catch(() => null);
      state.draftPrompt = prompt.prompt;
      state.forceHero = true;
      setView("home");
      syncComposers();
      showToast(state.lang === "zh" ? "已填入生成框" : "Sent to composer", "ri-arrow-right-line");
      setTimeout(() => $(".prompt-box", elements.heroComposerMount)?.focus(), 120);
    });
  });
  $$("[data-like-prompt]", root).forEach((button) => {
    button.addEventListener("click", async () => {
      if (!state.user) {
        openAuthModal("login");
        return;
      }
      const prompt = getPromptById(button.dataset.likePrompt);
      if (!prompt) return;
      try {
        const data = await api(`/api/prompts/${encodeURIComponent(prompt.id)}/like`, {
          method: "POST",
          body: JSON.stringify({ liked: !prompt.likedByCurrentUser })
        });
        state.promptItems = state.promptItems.map((item) => String(item.id) === String(prompt.id) ? { ...item, ...data.prompt } : item);
        renderLibrary();
      } catch (error) {
        showToast(error.message, "ri-error-warning-line");
      }
    });
  });
  $$("[data-like-gallery]", root).forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      await toggleGalleryLike(button.dataset.likeGallery);
    });
  });
  $$("[data-edit-prompt]", root).forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.editPrompt;
      const prompt = getPromptById(id);
      if (prompt) openPromptEditorModal(prompt);
    });
  });
  $$("[data-delete-prompt]", root).forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.deletePrompt;
      const prompt = getPromptById(id);
      if (!prompt) return;
      if (!confirm(state.lang === "zh"
        ? `确认隐藏提示词「${prompt.title || prompt.id}」？该操作会软删，可由管理员重新激活。`
        : `Hide prompt "${prompt.title || prompt.id}"? This is a soft delete and can be re-activated by an admin.`)) {
        return;
      }
      try {
        await api(`/api/prompts/${encodeURIComponent(id)}`, { method: "DELETE" });
        showToast(state.lang === "zh" ? "已隐藏提示词" : "Prompt hidden", "ri-archive-line");
        await loadPromptLibrary();
      } catch (error) {
        showToast(error.message, "ri-error-warning-line");
      }
    });
  });
}

function openPromptEditorModal(promptItem = null) {
  if (!state.user || state.user.role !== "admin") {
    showToast(state.lang === "zh" ? "需要管理员身份" : "Admin only", "ri-shield-line");
    return;
  }
  const isCreate = !promptItem;
  const initial = promptItem || {
    id: "",
    title: "",
    prompt: "",
    image: "",
    tags: [],
    author: "",
    source: "",
    sourceUrl: "",
    status: "active",
    sortOrder: 0
  };
  openModal(`
    <section class="modal publish-modal prompt-editor-modal">
      <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
      <div class="publish-modal-head">
        ${initial.image ? `<img src="${escapeHtml(initial.image)}" alt="${escapeHtml(initial.title || "")}" onerror="this.style.display='none'">` : `<div class="prompt-editor-thumb"><i class="ri-image-line"></i></div>`}
        <div>
          <h2>${escapeHtml(text(isCreate ? "promptCreateTitle" : "promptEditTitle"))}</h2>
          <p>${escapeHtml(text("promptEditDesc"))}</p>
        </div>
      </div>
      <form id="promptEditorForm" class="publish-form prompt-editor-form">
        <label>
          <span>${escapeHtml(text("promptFieldTitle"))}</span>
          <input id="promptEditorTitle" maxlength="200" value="${escapeHtml(initial.title || "")}" required>
        </label>
        <label>
          <span>${escapeHtml(text("promptFieldImage"))}</span>
          <input id="promptEditorImage" maxlength="500" value="${escapeHtml(initial.image || "")}" placeholder="https://...">
        </label>
        <label>
          <span>${escapeHtml(text("promptFieldPrompt"))}</span>
          <textarea id="promptEditorContent" rows="6" required>${escapeHtml(initial.prompt || "")}</textarea>
        </label>
        <label>
          <span>${escapeHtml(text("promptFieldTags"))}</span>
          <input id="promptEditorTags" value="${escapeHtml((initial.tags || []).join(", "))}" placeholder="${escapeHtml(text("tagInputHint"))}">
        </label>
        <div class="prompt-editor-grid">
          <label>
            <span>${escapeHtml(text("promptFieldAuthor"))}</span>
            <input id="promptEditorAuthor" maxlength="120" value="${escapeHtml(initial.author || "")}">
          </label>
          <label>
            <span>${escapeHtml(text("promptFieldSource"))}</span>
            <input id="promptEditorSource" maxlength="120" value="${escapeHtml(initial.source || "")}">
          </label>
        </div>
        <label>
          <span>${escapeHtml(text("promptFieldSourceUrl"))}</span>
          <input id="promptEditorSourceUrl" maxlength="500" value="${escapeHtml(initial.sourceUrl || "")}" placeholder="https://...">
        </label>
        <div class="prompt-editor-grid">
          <label>
            <span>${escapeHtml(text("promptFieldStatus"))}</span>
            <select id="promptEditorStatus">
              <option value="active"${initial.status !== "hidden" ? " selected" : ""}>${escapeHtml(text("promptStatusActive"))}</option>
              <option value="hidden"${initial.status === "hidden" ? " selected" : ""}>${escapeHtml(text("promptStatusHidden"))}</option>
            </select>
          </label>
          <label>
            <span>${escapeHtml(text("promptFieldSortOrder"))}</span>
            <input id="promptEditorSortOrder" type="number" step="1" value="${escapeHtml(String(initial.sortOrder || 0))}">
          </label>
        </div>
        <div class="prompt-editor-actions">
          <button class="modal-primary" type="submit">${escapeHtml(text(isCreate ? "promptCreate" : "promptSave"))}</button>
          ${isCreate ? "" : `<button class="modal-secondary" type="button" data-prompt-soft-delete>${escapeHtml(text("promptSoftDelete"))}</button>`}
        </div>
      </form>
    </section>
  `);

  const form = $("#promptEditorForm", elements.modalLayer);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const titleValue = $("#promptEditorTitle", form).value.trim();
    const promptValue = $("#promptEditorContent", form).value.trim();
    if (promptValue.length < 3) {
      showToast(state.lang === "zh" ? "提示词内容太短" : "Prompt is too short", "ri-error-warning-line");
      return;
    }
    const payload = {
      title: titleValue,
      prompt: promptValue,
      image: $("#promptEditorImage", form).value.trim(),
      tags: $("#promptEditorTags", form).value
        .split(/[,，、#\s]+/)
        .map((tag) => tag.trim())
        .filter(Boolean),
      author: $("#promptEditorAuthor", form).value.trim(),
      source: $("#promptEditorSource", form).value.trim(),
      sourceUrl: $("#promptEditorSourceUrl", form).value.trim(),
      status: $("#promptEditorStatus", form).value === "hidden" ? "hidden" : "active",
      sortOrder: Number($("#promptEditorSortOrder", form).value || 0) || 0
    };
    try {
      if (isCreate) {
        await api("/api/prompts", { method: "POST", body: JSON.stringify(payload) });
        showToast(state.lang === "zh" ? "提示词已新建" : "Prompt created", "ri-checkbox-circle-line");
      } else {
        await api(`/api/prompts/${encodeURIComponent(initial.id)}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
        showToast(state.lang === "zh" ? "提示词已保存" : "Prompt saved", "ri-checkbox-circle-line");
      }
      closeModal();
      await loadPromptLibrary();
    } catch (error) {
      showToast(error.message, "ri-error-warning-line");
    }
  });
  $("[data-prompt-soft-delete]", form)?.addEventListener("click", async () => {
    if (!confirm(state.lang === "zh" ? "确认隐藏该提示词？" : "Hide this prompt?")) return;
    try {
      await api(`/api/prompts/${encodeURIComponent(initial.id)}`, { method: "DELETE" });
      showToast(state.lang === "zh" ? "已隐藏" : "Hidden", "ri-archive-line");
      closeModal();
      await loadPromptLibrary();
    } catch (error) {
      showToast(error.message, "ri-error-warning-line");
    }
  });
}

function openImageEditor(imageUrl = "", prompt = "") {
  state.editor.prompt = prompt || state.editor.prompt;
  setView("editor");
  if (imageUrl) setEditorImage(imageUrl);
  setTimeout(() => elements.editorPromptInput?.focus(), 80);
}

function renderEditor() {
  if (!elements.editorView) return;
  $$("[data-editor-tool]", elements.editorView).forEach((button) => {
    button.classList.toggle("active", button.dataset.editorTool === state.editor.tool);
  });
  if (document.activeElement !== elements.editorPromptInput) {
    elements.editorPromptInput.value = state.editor.prompt || "";
  }
  elements.editorColorInput.value = state.editor.color;
  elements.editorUploadCard.classList.toggle("hidden", Boolean(state.editor.imageUrl));
  elements.editorImageFrame.classList.toggle("hidden", !state.editor.imageUrl);
  elements.editorZoomText.textContent = `${Math.round(state.editor.zoom * 100)}%`;
  elements.editorImageScaler.style.transform = `scale(${state.editor.zoom})`;
  if (state.editor.imageUrl && elements.editorSourceImage.getAttribute("src") !== state.editor.imageUrl) {
    elements.editorSourceImage.src = state.editor.imageUrl;
  }
  syncEditorRecentStrip();
}

function setEditorImage(src, imageData = "") {
  state.editor.imageUrl = src;
  state.editor.imageData = imageData || (src.startsWith("data:") ? src : "");
  state.editor.zoom = 1;
  state.editor.history = [];
  renderEditor();
}

function resetEditorCanvas() {
  const image = elements.editorSourceImage;
  const canvas = elements.editorMaskCanvas;
  if (!image?.naturalWidth || !canvas) return;
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  state.editor.history = [canvas.toDataURL("image/png")];
}

function editorPoint(event) {
  const canvas = elements.editorMaskCanvas;
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function pushEditorHistory() {
  const canvas = elements.editorMaskCanvas;
  state.editor.history.push(canvas.toDataURL("image/png"));
  if (state.editor.history.length > 20) state.editor.history.shift();
}

function restoreEditorHistory(dataUrl) {
  const canvas = elements.editorMaskCanvas;
  const ctx = canvas.getContext("2d");
  const image = new Image();
  image.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
  };
  image.src = dataUrl;
}

function editorPointerDown(event) {
  if (!state.editor.imageUrl || state.editor.tool === "move") return;
  event.preventDefault();
  const canvas = elements.editorMaskCanvas;
  const ctx = canvas.getContext("2d");
  const point = editorPoint(event);
  state.editor.pointerDown = true;
  state.editor.startPoint = point;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (state.editor.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = 34 / state.editor.zoom;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  } else if (state.editor.tool === "rect") {
    state.editor.snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = hexToRgba(state.editor.color, 0.72);
    ctx.lineWidth = 18 / state.editor.zoom;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }
}

function editorPointerMove(event) {
  if (!state.editor.pointerDown) return;
  event.preventDefault();
  const canvas = elements.editorMaskCanvas;
  const ctx = canvas.getContext("2d");
  const point = editorPoint(event);
  if (state.editor.tool === "rect" && state.editor.snapshot) {
    ctx.putImageData(state.editor.snapshot, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = hexToRgba(state.editor.color, 0.78);
    ctx.lineWidth = 8 / state.editor.zoom;
    ctx.strokeRect(
      state.editor.startPoint.x,
      state.editor.startPoint.y,
      point.x - state.editor.startPoint.x,
      point.y - state.editor.startPoint.y
    );
  } else {
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }
}

function editorPointerUp() {
  if (!state.editor.pointerDown) return;
  const ctx = elements.editorMaskCanvas.getContext("2d");
  ctx.closePath();
  ctx.globalCompositeOperation = "source-over";
  state.editor.pointerDown = false;
  state.editor.snapshot = null;
  pushEditorHistory();
}

function undoEditorMark() {
  if (state.editor.history.length <= 1) return;
  state.editor.history.pop();
  restoreEditorHistory(state.editor.history[state.editor.history.length - 1]);
}

function zoomEditor(direction) {
  const factor = direction === "+" ? 1.12 : 0.88;
  state.editor.zoom = Math.max(0.25, Math.min(3, state.editor.zoom * factor));
  renderEditor();
}

function hexToRgba(hex, alpha) {
  const raw = hex.replace("#", "");
  const bigint = Number.parseInt(raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

async function handleEditorUpload(file) {
  if (!file) return;
  const dataUrl = await blobToDataUrl(file);
  setEditorImage(dataUrl, dataUrl);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function imageReferenceForEdit(src) {
  if (!src) return "";
  if (src.startsWith("data:")) return src;
  try {
    const response = await fetch(src, { credentials: "same-origin" });
    if (!response.ok) throw new Error("Image fetch failed");
    return await blobToDataUrl(await response.blob());
  } catch {
    return src;
  }
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function editorAnnotatedImageData(originalData) {
  const maskCanvas = elements.editorMaskCanvas;
  if (!canvasHasMarks(maskCanvas)) return { imageData: originalData, maskData: "" };
  const originalImage = await loadImageElement(originalData);
  const canvas = document.createElement("canvas");
  canvas.width = originalImage.naturalWidth || originalImage.width;
  canvas.height = originalImage.naturalHeight || originalImage.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
  ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
  return {
    imageData: canvas.toDataURL("image/png"),
    maskData: maskCanvas.toDataURL("image/png")
  };
}

function canvasHasMarks(canvas) {
  if (!canvas?.width || !canvas.height) return false;
  const ctx = canvas.getContext("2d");
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] > 0) return true;
  }
  return false;
}

function ensureEditorRecentStrip() {
  if (!elements.editorView) return null;
  let strip = $("#editorRecentStrip", elements.editorView);
  if (strip) return strip;
  strip = document.createElement("div");
  strip.id = "editorRecentStrip";
  strip.className = "editor-recent-strip hidden";
  strip.innerHTML = `
    <span class="editor-recent-title" data-recent-title></span>
    <div class="editor-recent-thumbs" data-recent-thumbs></div>
  `;
  // 挂到 editor-stage 顶部、editor-header 之后；找不到时挂到 editorView 起头。
  const stage = $(".editor-stage", elements.editorView) || elements.editorView;
  const header = $(".editor-header", stage);
  if (header && header.parentElement === stage) {
    header.insertAdjacentElement("afterend", strip);
  } else {
    stage.prepend(strip);
  }
  return strip;
}

function getRecentEditorBaseImages() {
  if (!state.user || !state.activeImageSessionId) return [];
  const session = state.imageSessions.find((entry) => entry.id === state.activeImageSessionId);
  const allowedIds = new Set((session?.generationIds || []).map(String));
  if (!allowedIds.size) return [];
  const currentImage = state.editor?.imageUrl || "";
  // 取本会话已完成图，过滤当前编辑器正在展示的那张，倒序取 3。
  return [...state.history]
    .filter((item) => item.status === "done" && item.images?.[0] && allowedIds.has(String(item.id)))
    .filter((item) => !item.userId || !state.user?.id || String(item.userId) === String(state.user.id))
    .reverse()
    .filter((item) => item.images[0] !== currentImage)
    .slice(0, 3);
}

function syncEditorRecentStrip() {
  const strip = ensureEditorRecentStrip();
  if (!strip) return;
  const items = getRecentEditorBaseImages();
  const titleNode = $("[data-recent-title]", strip);
  const thumbsNode = $("[data-recent-thumbs]", strip);
  if (titleNode) titleNode.textContent = text("editorRecentStripTitle");
  if (!items.length) {
    strip.classList.add("hidden");
    if (thumbsNode) thumbsNode.innerHTML = "";
    return;
  }
  strip.classList.remove("hidden");
  if (!thumbsNode) return;
  thumbsNode.innerHTML = items.map((item, index) => `
    <button type="button" class="editor-recent-thumb" data-recent-id="${escapeHtml(item.id)}" title="${escapeHtml(truncate(item.prompt || "", 80))}" ${imageFallbackContainerAttrs()}>
      <img src="${escapeHtml(imageVariantUrl(item.images[0]))}" ${imageFallbackImgAttrs()} alt="${escapeHtml(truncate(item.prompt || "", 60))}" loading="lazy" decoding="async">
      <em>${index + 1}</em>
    </button>
  `).join("");
  $$("[data-recent-id]", thumbsNode).forEach((button) => {
    button.addEventListener("click", () => {
      const target = items.find((item) => String(item.id) === button.dataset.recentId);
      if (!target?.images?.[0]) return;
      setEditorImage(target.images[0], target.sourceImageData || "");
      showToast(text("editorRecentSwitched"), "ri-image-edit-line");
    });
  });
}

function ensureEditorStatusBar() {
  if (!elements.editorView) return null;
  let bar = $("#editorStatusBar", elements.editorView);
  if (bar) return bar;
  const canvasArea = $(".editor-canvas-area", elements.editorView);
  if (!canvasArea) return null;
  bar = document.createElement("div");
  bar.id = "editorStatusBar";
  bar.className = "editor-status-bar hidden";
  bar.innerHTML = `
    <div class="editor-status-row" data-status-running hidden>
      <i class="ri-loader-4-line spinning"></i>
      <span class="editor-status-label" data-status-label></span>
      <span class="editor-status-elapsed" data-status-elapsed>00:00</span>
      <button type="button" class="editor-status-cancel" data-status-cancel>${escapeHtml(text("editorCancel"))}</button>
    </div>
    <div class="editor-status-row editor-status-failure" data-status-failure hidden>
      <i class="ri-error-warning-line"></i>
      <div class="editor-status-failure-body">
        <strong data-status-failure-title>${escapeHtml(text("editorRetry"))}</strong>
        <span data-status-failure-detail></span>
        <em>${escapeHtml(text("editorRetryHint"))}</em>
      </div>
      <button type="button" class="editor-status-retry" data-status-retry>${escapeHtml(text("editorRetry"))}</button>
      <button type="button" class="editor-status-dismiss" data-status-dismiss aria-label="dismiss"><i class="ri-close-line"></i></button>
    </div>
  `;
  canvasArea.parentElement?.insertBefore(bar, canvasArea);
  return bar;
}

function startEditorTimer(label) {
  const bar = ensureEditorStatusBar();
  if (!bar) return;
  state.editing = true;
  state.editStartedAt = Date.now();
  state.editLongRunningWarned = false;
  bar.classList.remove("hidden");
  $("[data-status-running]", bar)?.removeAttribute("hidden");
  $("[data-status-failure]", bar)?.setAttribute("hidden", "");
  const labelNode = $("[data-status-label]", bar);
  if (labelNode) labelNode.textContent = label || text("generating");
  if (state.editElapsedTimer) clearInterval(state.editElapsedTimer);
  state.editElapsedTimer = setInterval(updateEditorTimer, 500);
  updateEditorTimer();
}

function updateEditorTimer() {
  const bar = $("#editorStatusBar");
  if (!bar) return;
  const elapsedNode = $("[data-status-elapsed]", bar);
  if (!elapsedNode || !state.editStartedAt) return;
  const ms = Date.now() - state.editStartedAt;
  elapsedNode.textContent = formatElapsed(ms);
  if (!state.editLongRunningWarned && ms > 120_000) {
    state.editLongRunningWarned = true;
    showToast(text("editorElapsedLong"), "ri-time-line");
  }
}

function stopEditorTimer() {
  if (state.editElapsedTimer) {
    clearInterval(state.editElapsedTimer);
    state.editElapsedTimer = null;
  }
  state.editing = false;
  state.editStartedAt = 0;
  const bar = $("#editorStatusBar");
  if (bar) {
    $("[data-status-running]", bar)?.setAttribute("hidden", "");
    if (!state.editLastFailure) bar.classList.add("hidden");
  }
}

function showEditorFailureCard(error) {
  const bar = ensureEditorStatusBar();
  if (!bar) return;
  bar.classList.remove("hidden");
  $("[data-status-running]", bar)?.setAttribute("hidden", "");
  const failureRow = $("[data-status-failure]", bar);
  failureRow?.removeAttribute("hidden");
  const detail = $("[data-status-failure-detail]", bar);
  if (detail) {
    detail.textContent = String(error?.message || error || "").slice(0, 240);
  }
  state.editLastFailure = {
    message: String(error?.message || error || ""),
    when: Date.now()
  };
  if (state.editFailureHideTimer) clearTimeout(state.editFailureHideTimer);
  state.editFailureHideTimer = setTimeout(() => clearEditorFailure(), 30_000);
}

function clearEditorFailure() {
  state.editLastFailure = null;
  if (state.editFailureHideTimer) {
    clearTimeout(state.editFailureHideTimer);
    state.editFailureHideTimer = null;
  }
  const bar = $("#editorStatusBar");
  if (!bar) return;
  $("[data-status-failure]", bar)?.setAttribute("hidden", "");
  if (!state.editing) bar.classList.add("hidden");
}

async function submitImageEdit(event) {
  event.preventDefault();
  if (!state.user) {
    openAuthModal("login");
    return;
  }
  if (!state.settings?.hasApiKey) {
    showToast(state.lang === "zh" ? "请先在后台配置 OpenAI API Key" : "Configure the OpenAI API key first", "ri-key-2-line");
    return;
  }
  const prompt = elements.editorPromptInput.value.trim();
  if (!state.editor.imageUrl) {
    showToast(state.lang === "zh" ? "请先上传或选择一张图片" : "Choose an image first", "ri-image-add-line");
    return;
  }
  if (prompt.length < 3) {
    showToast(state.lang === "zh" ? "请输入编辑描述" : "Enter an edit prompt", "ri-edit-line");
    return;
  }

  const button = $("button[type='submit']", elements.editorPromptForm);
  button.disabled = true;
  state.editor.prompt = prompt;
  clearEditorFailure();
  // 取消旧的（如果有）然后新建一个，submit 期间保留引用，取消按钮调它的 abort()。
  state.editAbortController?.abort();
  state.editAbortController = new AbortController();
  startEditorTimer(text("generating"));
  try {
    const originalData = state.editor.imageData || await imageReferenceForEdit(state.editor.imageUrl);
    const { imageData, maskData } = await editorAnnotatedImageData(originalData);
    const draftRoute = conversationRouteWithDraft({
      id: `edit_${Date.now()}`,
      prompt,
      images: [],
      sourceImageData: originalData,
      time: new Date().toISOString()
    });
    const isPublic = Boolean(elements.editorPublicInput?.checked);
    if (isPublic) {
      // 图生图公开必须强制携带原图（参见 docs 4.3 / 6 P0）
      if (elements.editorPublishOriginalInput) {
        elements.editorPublishOriginalInput.checked = true;
      }
    }
    const publishOriginal = isPublic
      ? true
      : Boolean(elements.editorPublishOriginalInput?.checked);
    const data = await api("/api/images/edit", {
      method: "POST",
      signal: state.editAbortController?.signal,
      body: JSON.stringify({
        prompt: maskData
          ? `${prompt}。只修改图片中紫色标记框或紫色笔刷覆盖的区域，其他区域保持不变，最终结果不要保留紫色标记。`
          : prompt,
        imageData,
        maskData,
        isPublic,
        publishOriginal,
        sourceImageData: publishOriginal ? originalData : "",
        publicTags: [],
        conversationRoute: draftRoute
      })
    });
    const generation = data.generations[0];
    state.user.credits = data.credits;
    state.stats.todayGenerated += 1;
    addGenerationToActiveSession(generation.id, generation.prompt);
    const savedEntry = {
      id: generation.id,
      prompt: generation.prompt,
      images: [generation.imageUrl],
      sourceImageUrl: generation.sourceImageUrl || "",
      sourceImageData: originalData,
      publishOriginal: Boolean(generation.publishOriginal),
      conversation: generation.conversation || draftRoute,
        publicTags: generation.publicTags || [],
        userId: generation.userId || "",
        userName: generation.userName || "",
        status: "done",
      time: generation.createdAt,
      elapsedMs: Number(generation.durationMs || 0) || null,
      model: generation.model,
      isPublic: Boolean(generation.isPublic)
    };
    state.history.push(savedEntry);
    setEditorImage(generation.imageUrl);
    if (generation.isPublic) await loadPublicGallery();
    renderAll();
    showToast(state.lang === "zh" ? "编辑完成" : "Edit created", "ri-magic-line");
    if (savedEntry.isPublic) {
      setTimeout(() => openPublishModal(savedEntry, Boolean(generation.publishOriginal)), 180);
    }
    clearEditorFailure();
  } catch (error) {
    // 用户主动取消（前端或后端 close）静默处理，不弹失败卡片。
    if (error?.name === "AbortError") {
      clearEditorFailure();
    } else {
      if (/credit|额度|积分|Not enough/i.test(error.message)) openCreditsModal();
      showEditorFailureCard(error);
    }
  } finally {
    button.disabled = false;
    stopEditorTimer();
    state.editAbortController = null;
    setTimeout(maybeOpenUnreadAnnouncementModal, 260);
  }
}

function getPromptSource() {
  return state.promptItems.length ? state.promptItems : fallbackPrompts.map((prompt) => ({
    ...prompt,
    title: local(prompt.title),
    prompt: local(prompt.prompt),
    tags: [prompt.tag]
  }));
}

function publicGalleryPromptItems() {
  const seen = new Set();
  return [...state.publicGallery, ...state.galleryLeaderboard]
    .filter((item) => item.images?.[0] && item.prompt)
    .filter((item) => {
      const key = String(item.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item) => ({
      id: `square_${item.id}`,
      generationId: item.id,
      kind: "square",
      tag: "square",
      tags: ["square", isImageToImageItem(item) ? "image-to-image" : "text-to-image", ...normalizePublicTags(item.publicTags || [])],
      title: truncate(item.prompt, 38),
      prompt: item.prompt,
      image: item.images[0],
      images: item.images,
      source: "generation-square",
      author: displayUserName(item),
      userId: item.userId || "",
      userName: item.userName || "",
      colors: "linear-gradient(135deg,#0f172a,#94a3b8)",
      conversation: item.conversation || [],
      sourceImageUrl: item.sourceImageUrl || "",
      sourceImageId: item.sourceImageId || "",
      sourcePrompt: item.sourcePrompt || "",
      originGalleryId: item.originGalleryId || "",
      likeCount: Number(item.likeCount || 0),
      likedByCurrentUser: Boolean(item.likedByCurrentUser),
      publicTags: item.publicTags || [],
      isPublic: true,
      time: item.time
    }));
}

function getLibrarySource() {
  const prompts = getPromptSource();
  const publicItems = publicGalleryPromptItems();
  const seen = new Set();
  return [...publicItems, ...prompts].filter((item) => {
    const key = String(item.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getPromptById(id) {
  const key = String(id);
  return getLibrarySource().find((item) => String(item.id) === key);
}

function squareItemFromPrompt(prompt) {
  if (prompt.kind === "square") {
    return state.publicGallery.find((item) => String(item.id) === String(prompt.generationId)) || {
      id: prompt.generationId || String(prompt.id).replace(/^square_/, ""),
      prompt: prompt.prompt,
      images: prompt.images || [prompt.image],
      sourceImageUrl: prompt.sourceImageUrl || "",
      sourceImageId: prompt.sourceImageId || "",
      sourcePrompt: prompt.sourcePrompt || "",
      originGalleryId: prompt.originGalleryId || "",
      likeCount: Number(prompt.likeCount || 0),
      likedByCurrentUser: Boolean(prompt.likedByCurrentUser),
      conversation: prompt.conversation || [],
      publicTags: prompt.publicTags || [],
      userId: prompt.userId || "",
      userName: prompt.userName || prompt.author || "",
      time: prompt.time,
      isPublic: true
    };
  }
  return prompt;
}

function openGalleryUnavailableModal(id = "") {
  openModal(`
    <section class="modal square-empty-modal">
      <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
      <div class="modal-title">
        <i class="ri-image-close-line"></i>
        <h2>${escapeHtml(state.lang === "zh" ? "作品暂不可见" : "Work unavailable")}</h2>
        <p>${escapeHtml(state.lang === "zh" ? "该画廊作品不存在、已隐藏，或当前链接无法访问。" : "This gallery work does not exist, is hidden, or cannot be opened from this link.")}</p>
        ${id ? `<small>${escapeHtml(id)}</small>` : ""}
      </div>
    </section>
  `);
}

async function openSquarePreviewById(id, options = {}) {
  const key = String(id || "").replace(/^square_/, "");
  const localPrompt = getPromptById(`square_${key}`) || getPromptById(key);
  if (localPrompt) {
    openSquarePreview(localPrompt, options);
    return;
  }
  try {
    const data = await api(`/api/gallery/${encodeURIComponent(key)}`);
    const generation = generationEntryFromApi(data.generation, { status: "done" });
    state.publicGallery = [generation, ...state.publicGallery.filter((item) => String(item.id) !== String(generation.id))];
    openSquarePreview({ ...generation, id: `square_${generation.id}`, generationId: generation.id, kind: "square" }, options);
  } catch {
    openGalleryUnavailableModal(key);
  }
}

function openSquarePreview(prompt, options = {}) {
  const item = squareItemFromPrompt(prompt);
  const imageUrl = item.images?.[0] || item.image || "";
  if (!imageUrl) {
    openGalleryUnavailableModal(item.id || prompt.id || "");
    return;
  }
  const owned = isOwnedByCurrentUser(item);
  const isAdmin = state.user?.role === "admin";
  const canManage = owned || isAdmin;
  const isImageToImage = isImageToImageItem(item) || Boolean(item.sourceImageUrl || item.sourceImageId || item.sourcePrompt);
  const tags = normalizePublicTags(item.publicTags || []);
  const route = item.conversation || [];
  const sourcePrompt = item.sourcePrompt || "";
  openModal(`
    <section class="modal square-preview-modal" data-square-id="${escapeHtml(item.id || prompt.generationId || "")}">
      <button class="square-preview-close" type="button" aria-label="${text("close")}"><i class="ri-close-line"></i></button>
      <div class="square-preview-stage" ${imageFallbackContainerAttrs()}>
        <img class="square-preview-main" src="${escapeHtml(imageUrl)}" ${imageFallbackImgAttrs()} alt="${escapeHtml(truncate(item.prompt, 100))}">
      </div>
      <aside class="square-preview-side">
        <div class="square-preview-head">
          <span>${isImageToImage ? text("imageToImage") : text("textToImage")}</span>
          <strong>${escapeHtml(displayUserName(item))}</strong>
        </div>
        <div class="square-preview-section">
          <h3>${isImageToImage ? escapeHtml(text("currentPrompt")) : (state.lang === "zh" ? "原提示词" : "Prompt")}</h3>
          <p>${escapeHtml(item.prompt)}</p>
        </div>
        ${isImageToImage && sourcePrompt ? `
          <div class="square-preview-section source-prompt-section">
            <h3>${escapeHtml(text("sourcePrompt"))}</h3>
            <p>${escapeHtml(sourcePrompt)}</p>
          </div>
        ` : ""}
        <div class="square-preview-meta">
          <div><span>${text("authorBy")}</span><strong>${escapeHtml(displayUserName(item))}</strong></div>
          <div><span>${text("model")}</span><strong>${escapeHtml(item.model || "GPT-IMAGE-2")}</strong></div>
          <div><span>${text("format")}</span><strong>${escapeHtml(formatDate(item.time) || "-")}</strong></div>
          <div><span>${text("routeTitle")}</span><strong>${route.length || 1}</strong></div>
          ${isImageToImage ? `<div><span>${escapeHtml(text("sourceImageId"))}</span><strong>${escapeHtml(item.originGalleryId || item.sourceImageId || "-")}</strong></div>` : ""}
        </div>
        ${tags.length ? `
          <div class="square-preview-tags">
            ${tags.map((tag) => {
              const info = tagInfo(tag);
              return `<button type="button" class="tag-chip" style="--tag-hue:${info.hue}" data-square-tag="${escapeHtml(tag)}">${escapeHtml(info.label)}</button>`;
            }).join("")}
          </div>
        ` : ""}
        ${isImageToImage ? `
          <div class="square-source-pair">
            <figure ${imageFallbackContainerAttrs()}>
              ${item.sourceImageUrl
                ? `<img src="${escapeHtml(item.sourceImageUrl)}" ${imageFallbackImgAttrs()} alt="${text("inputImage")}">`
                : `<div class="source-private-placeholder"><i class="ri-eye-off-line"></i><span>${escapeHtml(state.lang === "zh" ? "原图未公开" : "Original not public")}</span></div>`}
              <figcaption>${text("inputImage")}</figcaption>
            </figure>
            <figure ${imageFallbackContainerAttrs()}>
              <img src="${escapeHtml(imageUrl)}" ${imageFallbackImgAttrs()} alt="${text("outputImage")}">
              <figcaption>${text("outputImage")}</figcaption>
            </figure>
          </div>
        ` : ""}
        ${route.length > 1 ? `
          <section class="square-route" data-route-section data-route-collapsed="${route.length > 5 ? "1" : "0"}">
            <header class="square-route-head">
              <h3>${escapeHtml(text("routeSectionTitle"))} <em>${route.length}</em></h3>
              ${route.length > 5 ? `<button type="button" class="square-route-toggle" data-route-toggle><span data-route-toggle-text>${escapeHtml(text("routeSectionExpand"))}</span> <i class="ri-arrow-down-s-line"></i></button>` : ""}
            </header>
            <ol class="square-route-list" data-route-list>
              ${route.map((step, index) => {
                const stepImage = step.imageUrl || imageUrl;
                const stepPrompt = step.prompt || text("routeStepUntitled");
                const stepLabel = String(index + 1).padStart(2, "0");
                return `
                  <li class="square-route-step" data-route-step="${index}" tabindex="0">
                    <div class="square-route-thumb" ${imageFallbackContainerAttrs()}>
                      ${stepImage ? `<img src="${escapeHtml(stepImage)}" ${imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="${escapeHtml(stepPrompt.slice(0, 80))}">` : `<i class="ri-sparkling-2-line"></i>`}
                      <em>${stepLabel}</em>
                    </div>
                    <div class="square-route-body">
                      <p>${escapeHtml(stepPrompt)}</p>
                      ${step.createdAt ? `<span>${escapeHtml(formatDate(step.createdAt))}</span>` : ""}
                    </div>
                  </li>
                `;
              }).join("")}
            </ol>
          </section>
        ` : ""}
        <div class="square-preview-actions">
          <button type="button" data-square-like="${escapeHtml(item.id)}" class="${item.likedByCurrentUser ? "liked" : ""}">
            <i class="${item.likedByCurrentUser ? "ri-heart-fill" : "ri-heart-line"}"></i>${Number(item.likeCount || 0)}
          </button>
          <button type="button" data-square-text><i class="ri-sparkling-2-line"></i>${text("textToImageAction")}</button>
          <button type="button" data-square-edit><i class="ri-image-edit-line"></i>${text("imageToImageAction")}</button>
          <button type="button" data-square-copy><i class="ri-file-copy-line"></i>${text("copy")}</button>
          <a href="${escapeHtml(imageUrl)}" download="${escapeHtml(item.id || "image")}.png"><i class="ri-download-line"></i>${text("download")}</a>
          <button type="button" data-square-report><i class="ri-flag-line"></i>${state.lang === "zh" ? "举报" : "Report"}</button>
          ${canManage ? `<button type="button" data-square-manage><i class="ri-price-tag-3-line"></i>${text("editPublicTags")}</button>` : ""}
          ${canManage ? `<button type="button" data-square-unpublish><i class="ri-eye-off-line"></i>${text("unpublish")}</button>` : ""}
        </div>
      </aside>
    </section>
  `);

  if (!state.routeSyncing && options.replaceRoute !== false && window.history?.pushState) {
    const route = routeState({ modal: "square", galleryId: item.id || prompt.generationId || "" });
    window.history.pushState(route, "", routeUrl(route));
  }

  $(".square-preview-close", elements.modalLayer)?.addEventListener("click", closeModal);
  $("[data-square-like]", elements.modalLayer)?.addEventListener("click", async () => {
    await toggleGalleryLike(item.id);
  });
  $("[data-square-text]", elements.modalLayer)?.addEventListener("click", () => {
    state.draftPrompt = item.prompt;
    closeModal();
    state.forceHero = true;
    setView("home");
    syncComposers();
    setTimeout(() => $(".prompt-box", elements.heroComposerMount)?.focus(), 120);
  });
  $("[data-square-edit]", elements.modalLayer)?.addEventListener("click", () => {
    closeModal();
    // exec4 P0 §4：广场点击「图生图」时不再带原提示词，editor 的 prompt 框为空，
    // 用户需要的话仍然可以走 [复制提示词] 或 [提示词文生图] 两个入口。
    openImageEditor(imageUrl, "");
  });
  $("[data-square-copy]", elements.modalLayer)?.addEventListener("click", async () => {
    await copyText(item.prompt);
    showToast(state.lang === "zh" ? "提示词已复制" : "Prompt copied", "ri-file-copy-line");
  });
  $("[data-square-report]", elements.modalLayer)?.addEventListener("click", async () => {
    if (!state.user) {
      closeModal();
      openAuthModal("login");
      return;
    }
    const reason = prompt(state.lang === "zh" ? "举报原因" : "Report reason", "policy_review") || "";
    if (!reason.trim()) return;
    await api(`/api/images/${encodeURIComponent(item.id)}/report`, {
      method: "POST",
      body: JSON.stringify({ reason })
    });
    showToast(state.lang === "zh" ? "已提交举报" : "Report submitted", "ri-flag-line");
  });
  $("[data-square-manage]", elements.modalLayer)?.addEventListener("click", () => {
    closeModal();
    openPublishModal(item, isImageToImage);
  });
  $("[data-square-unpublish]", elements.modalLayer)?.addEventListener("click", async () => {
    await unpublishGeneration(item);
    closeModal();
  });
  $$("[data-square-tag]", elements.modalLayer).forEach((button) => {
    button.addEventListener("click", () => {
      state.librarySearch = button.dataset.squareTag;
      state.libraryTag = "all";
      closeModal();
      navigate("library", { route: { librarySearch: button.dataset.squareTag || "", libraryTag: "all" } });
      renderLibrary();
    });
  });

  // exec4 P0 §3：路线区交互。点击某一轮缩略图 → 替换主图 + 原提示词；点击 toggle 折叠/展开。
  const routeSection = $("[data-route-section]", elements.modalLayer);
  if (routeSection) {
    const mainImage = $(".square-preview-main", elements.modalLayer);
    const mainPrompt = $(".square-preview-section p", elements.modalLayer);
    const toggleBtn = $("[data-route-toggle]", routeSection);
    const toggleText = $("[data-route-toggle-text]", routeSection);
    const list = $("[data-route-list]", routeSection);
    const applyCollapsed = () => {
      const collapsed = routeSection.dataset.routeCollapsed === "1";
      if (!list) return;
      [...list.children].forEach((step, index) => {
        // 折叠状态下只露出前 3 + 最后 1，中间隐藏。
        if (!collapsed) {
          step.classList.remove("hidden");
          return;
        }
        const total = list.children.length;
        const keep = index < 3 || index === total - 1;
        step.classList.toggle("hidden", !keep);
      });
      if (toggleText) {
        toggleText.textContent = text(collapsed ? "routeSectionExpand" : "routeSectionCollapse");
      }
    };
    applyCollapsed();
    toggleBtn?.addEventListener("click", () => {
      routeSection.dataset.routeCollapsed = routeSection.dataset.routeCollapsed === "1" ? "0" : "1";
      applyCollapsed();
    });
    $$("[data-route-step]", routeSection).forEach((stepNode) => {
      const activate = () => {
        const idx = Number.parseInt(stepNode.dataset.routeStep || "0", 10) || 0;
        const step = route[idx];
        if (!step) return;
        if (mainImage && step.imageUrl) mainImage.src = step.imageUrl;
        if (mainPrompt) mainPrompt.textContent = step.prompt || text("routeStepUntitled");
        $$("[data-route-step]", routeSection).forEach((other) => other.classList.remove("active"));
        stepNode.classList.add("active");
      };
      stepNode.addEventListener("click", activate);
      stepNode.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
    });
  }
}

function openPromptDetailModal(prompt) {
  if (!prompt) return;
  const imageUrl = prompt.image || "";
  if (!imageUrl) return;
  const tags = Array.isArray(prompt.tags) ? prompt.tags : (prompt.tag ? [prompt.tag] : []);
  const isAdmin = state.user?.role === "admin";
  const author = prompt.author || (state.lang === "zh" ? "公开来源" : "Public source");
  const sourceLabel = prompt.source || "-";
  const sourceUrl = prompt.sourceUrl || "";
  openModal(`
    <section class="modal square-preview-modal">
      <button class="square-preview-close" type="button" aria-label="${text("close")}"><i class="ri-close-line"></i></button>
      <div class="square-preview-stage" ${imageFallbackContainerAttrs()}>
        <img class="square-preview-main" src="${escapeHtml(imageUrl)}" ${imageFallbackImgAttrs()} alt="${escapeHtml(truncate(prompt.prompt || prompt.title || "", 100))}">
      </div>
      <aside class="square-preview-side">
        <div class="square-preview-head">
          <span>${escapeHtml(text("promptLibrary"))}</span>
          <strong>${escapeHtml(prompt.title || "")}</strong>
        </div>
        <div class="square-preview-section">
          <h3>${state.lang === "zh" ? "原提示词" : "Prompt"}</h3>
          <p>${escapeHtml(prompt.prompt || "")}</p>
        </div>
        <div class="square-preview-meta">
          <div><span>${escapeHtml(text("promptFieldAuthor"))}</span><strong>${escapeHtml(author)}</strong></div>
          <div><span>${escapeHtml(text("promptFieldSource"))}</span><strong>${escapeHtml(sourceLabel)}</strong></div>
          <div><span>ID</span><strong>${escapeHtml(String(prompt.id || "-"))}</strong></div>
          <div><span>${escapeHtml(text("promptFieldStatus"))}</span><strong>${escapeHtml(prompt.status === "hidden" ? text("promptStatusHidden") : text("promptStatusActive"))}</strong></div>
        </div>
        ${tags.length ? `
          <div class="square-preview-tags">
            ${tags.map((tag) => {
              const info = tagInfo(tag);
              return `<button type="button" class="tag-chip" style="--tag-hue:${info.hue}" data-prompt-tag="${escapeHtml(tag)}">${escapeHtml(info.label)}</button>`;
            }).join("")}
          </div>
        ` : ""}
        ${sourceUrl ? `
          <div class="square-preview-section">
            <h3>${escapeHtml(text("promptFieldSourceUrl"))}</h3>
            <p><a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(sourceUrl)}</a></p>
          </div>
        ` : ""}
        <div class="square-preview-actions">
          <button type="button" data-prompt-text><i class="ri-sparkling-2-line"></i>${text("textToImageAction")}</button>
          ${imageUrl ? `<button type="button" data-prompt-edit><i class="ri-image-edit-line"></i>${text("imageToImageAction")}</button>` : ""}
          <button type="button" data-prompt-copy><i class="ri-file-copy-line"></i>${text("copy")}</button>
          <a href="${escapeHtml(imageUrl)}" target="_blank" rel="noreferrer"><i class="ri-external-link-line"></i>${text("download")}</a>
          ${isAdmin ? `<button type="button" data-prompt-admin-edit><i class="ri-pencil-line"></i>${text("promptEdit")}</button>` : ""}
          ${isAdmin ? `<button type="button" data-prompt-admin-delete><i class="ri-delete-bin-line"></i>${text("promptDelete")}</button>` : ""}
        </div>
      </aside>
    </section>
  `);

  $(".square-preview-close", elements.modalLayer)?.addEventListener("click", closeModal);
  $("[data-prompt-text]", elements.modalLayer)?.addEventListener("click", () => {
    state.draftPrompt = prompt.prompt || "";
    closeModal();
    state.forceHero = true;
    setView("home");
    syncComposers();
    setTimeout(() => $(".prompt-box", elements.heroComposerMount)?.focus(), 120);
  });
  $("[data-prompt-edit]", elements.modalLayer)?.addEventListener("click", () => {
    closeModal();
    openImageEditor(imageUrl, prompt.prompt || "");
  });
  $("[data-prompt-copy]", elements.modalLayer)?.addEventListener("click", async () => {
    await copyText(prompt.prompt || "");
    showToast(state.lang === "zh" ? "提示词已复制" : "Prompt copied", "ri-file-copy-line");
  });
  $("[data-prompt-admin-edit]", elements.modalLayer)?.addEventListener("click", () => {
    closeModal();
    openPromptEditorModal(prompt);
  });
  $("[data-prompt-admin-delete]", elements.modalLayer)?.addEventListener("click", async () => {
    if (!confirm(state.lang === "zh"
      ? `确认隐藏提示词「${prompt.title || prompt.id}」？`
      : `Hide prompt "${prompt.title || prompt.id}"?`)) {
      return;
    }
    try {
      await api(`/api/prompts/${encodeURIComponent(prompt.id)}`, { method: "DELETE" });
      showToast(state.lang === "zh" ? "已隐藏提示词" : "Prompt hidden", "ri-archive-line");
      closeModal();
      await loadPromptLibrary();
    } catch (error) {
      showToast(error.message, "ri-error-warning-line");
    }
  });
  $$("[data-prompt-tag]", elements.modalLayer).forEach((button) => {
    button.addEventListener("click", () => {
      state.librarySearch = button.dataset.promptTag;
      state.libraryTag = "all";
      closeModal();
      navigate("library", { route: { librarySearch: button.dataset.promptTag || "", libraryTag: "all" } });
      renderLibrary();
    });
  });
}

const PUBLISH_ORIGINAL_NOTICE_KEY = "imageStudio.publishOriginalNoticeDismissedAt";
const PUBLISH_ORIGINAL_NOTICE_DAYS = 7;

function shouldShowPublishOriginalNotice() {
  try {
    const raw = localStorage.getItem(PUBLISH_ORIGINAL_NOTICE_KEY);
    if (!raw) return true;
    const dismissedAt = Number(raw) || 0;
    if (!dismissedAt) return true;
    return Date.now() - dismissedAt > PUBLISH_ORIGINAL_NOTICE_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return true;
  }
}

function markPublishOriginalNoticeDismissed() {
  try {
    localStorage.setItem(PUBLISH_ORIGINAL_NOTICE_KEY, String(Date.now()));
  } catch {
    /* storage may be unavailable; silently skip */
  }
}

// 仅当编辑器场景下、第一次勾选「公开到广场」并且未在 7 天内点过「不再提示」时调用。
// 调用方在 onConfirm 收到 true 时维持公开开关、自动勾选公开原图；onConfirm(false) 时把公开开关还原。
function openPublishOriginalNoticeModal({ onConfirm, onCancel } = {}) {
  openModal(`
    <section class="modal publish-notice-modal" role="alertdialog" aria-labelledby="publishNoticeTitle">
      <button class="close-modal" type="button" data-publish-notice-close><i class="ri-close-line"></i></button>
      <div class="publish-notice-head">
        <span class="publish-notice-icon"><i class="ri-image-edit-line"></i></span>
        <h2 id="publishNoticeTitle">${escapeHtml(text("publishOriginalNoticeTitle"))}</h2>
      </div>
      <p class="publish-notice-body">${escapeHtml(text("publishOriginalNoticeBody"))}</p>
      <label class="publish-notice-remember">
        <input type="checkbox" data-publish-notice-remember>
        <span>${escapeHtml(text("publishOriginalNoticeRemember"))}</span>
      </label>
      <div class="publish-notice-actions">
        <button type="button" class="modal-secondary" data-publish-notice-cancel>${escapeHtml(text("publishOriginalNoticeCancel"))}</button>
        <button type="button" class="modal-primary" data-publish-notice-confirm>${escapeHtml(text("publishOriginalNoticeConfirm"))}</button>
      </div>
    </section>
  `);
  const rememberInput = $("[data-publish-notice-remember]", elements.modalLayer);
  const dismissIfRemembered = () => {
    if (rememberInput?.checked) markPublishOriginalNoticeDismissed();
  };
  $("[data-publish-notice-confirm]", elements.modalLayer)?.addEventListener("click", () => {
    dismissIfRemembered();
    closeModal();
    onConfirm?.();
  });
  const cancelHandler = () => {
    dismissIfRemembered();
    closeModal();
    onCancel?.();
  };
  $("[data-publish-notice-cancel]", elements.modalLayer)?.addEventListener("click", cancelHandler);
  $("[data-publish-notice-close]", elements.modalLayer)?.addEventListener("click", cancelHandler);
}

function getTagCounts(source = getPromptSource()) {
  const counts = {};
  for (const prompt of source) {
    const promptTags = prompt.tags || [prompt.tag].filter(Boolean);
    for (const tag of promptTags) counts[tag] = (counts[tag] || 0) + 1;
  }
  return counts;
}

async function loadPromptLibrary() {
  state.promptLoading = true;
  if (state.view === "library") renderLibrary();
  let items = [];
  let usedFallback = false;
  let lastError = null;
  try {
    const data = await api(state.user?.role === "admin" ? "/api/prompts?includeHidden=1&sort=hot" : "/api/prompts?sort=hot");
    items = Array.isArray(data?.prompts) ? data.prompts : [];
  } catch (error) {
    lastError = error;
    usedFallback = true;
  }
  if (!items.length) {
    try {
      const data = await fetch("/prompts.json", { cache: "force-cache" }).then((response) => response.json());
      items = Array.isArray(data?.prompts) ? data.prompts : [];
      if (items.length) usedFallback = true;
    } catch (error) {
      if (!lastError) lastError = error;
    }
  }
  if (!items.length) {
    state.promptItems = [];
    state.promptLoading = false;
    showToast(state.lang === "zh" ? "画廊加载失败，已使用内置示例" : "Gallery failed, using fallback", "ri-error-warning-line");
    renderAll();
    return;
  }
  state.promptItems = items.map((prompt) => ({
    ...prompt,
    colors: prompt.colors || tagColor(prompt.tags?.[0] || prompt.tag || "other")
  }));
  state.promptLoading = false;
  if (usedFallback && state.user?.role === "admin") {
    showToast(state.lang === "zh" ? "画廊走 prompts.json 回退" : "Gallery fell back to prompts.json", "ri-information-line");
  }
  renderAll();
}

function setupHeroVideo() {
  const video = $(".hero-video-layer video");
  if (!video) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    video.pause();
    video.removeAttribute("autoplay");
    return;
  }
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.addEventListener("pause", () => playHeroVideo());
  video.addEventListener("stalled", restartHeroVideo);
  video.addEventListener("suspend", () => playHeroVideo());
  window.addEventListener("focus", () => playHeroVideo());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) playHeroVideo();
  });
  if (!heroVideoWatchdog) {
    let lastTime = -1;
    let stillTicks = 0;
    heroVideoWatchdog = window.setInterval(() => {
      const currentVideo = $(".hero-video-layer video");
      if (!currentVideo || elements.homeView.classList.contains("hidden") || document.hidden) return;
      if (currentVideo.paused) {
        playHeroVideo();
        return;
      }
      const currentTime = Number(currentVideo.currentTime || 0);
      if (Math.abs(currentTime - lastTime) < 0.01) {
        stillTicks += 1;
        if (stillTicks >= 2) restartHeroVideo();
      } else {
        stillTicks = 0;
      }
      lastTime = currentTime;
    }, 1400);
  }
  restartHeroVideo();
}

function playHeroVideo() {
  const video = $(".hero-video-layer video");
  if (!video || elements.homeView.classList.contains("hidden")) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  if (video.readyState === 0) video.load();
  video.play().catch(() => null);
}

function restartHeroVideo() {
  const video = $(".hero-video-layer video");
  if (!video || elements.homeView.classList.contains("hidden")) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  try {
    if (video.readyState < 2) video.load();
    video.currentTime = 0.05;
  } catch {
    video.load();
  }
  playHeroVideo();
}

async function loadStats() {
  try {
    const data = await api("/api/stats/today");
    state.stats.todayGenerated = Number(data.todayGenerated ?? data.count ?? state.stats.todayGenerated);
    updateDailyMetric();
  } catch {
    updateDailyMetric();
  }
}

async function loadVersion() {
  try {
    const info = await api("/api/version");
    state.versionInfo = info;
    if (info) {
      const startedLabel = info.startedAt ? new Date(info.startedAt).toISOString() : "";
      console.info(
        `[ImageStudio] backend ${info.version || "?"} | node ${info.node || "?"} | started ${startedLabel}`
      );
    }
  } catch (error) {
    console.warn("[ImageStudio] /api/version unavailable", error);
  }
}

async function loadTags() {
  try {
    const includeHidden = state.user?.role === "admin";
    const data = await api(`/api/tags?limit=500${includeHidden ? "&includeHidden=1" : ""}`);
    const list = Array.isArray(data?.tags) ? data.tags : [];
    const bySlug = {};
    for (const tag of list) {
      if (tag?.slug) bySlug[String(tag.slug).toLowerCase()] = tag;
    }
    state.tagsLibrary = { bySlug, list, summary: data?.summary || null, loadedAt: Date.now() };
  } catch (error) {
    console.warn("[ImageStudio] /api/tags unavailable", error);
  }
}

async function loadPublicGallery() {
  try {
    const data = await api("/api/images/public?limit=120");
    state.publicGallery = (data.generations || []).map((generation) => generationEntryFromApi(generation, { status: "done" }));
  } catch {
    state.publicGallery = [];
  }
}

async function loadGalleryLeaderboard() {
  state.galleryLeaderboardLoading = true;
  try {
    const params = new URLSearchParams({
      range: state.galleryLeaderboardRange || "week",
      limit: "24"
    });
    if (state.galleryLeaderboardType && state.galleryLeaderboardType !== "all") {
      params.set("type", state.galleryLeaderboardType);
    }
    const data = await api(`/api/gallery/leaderboard?${params.toString()}`);
    state.galleryLeaderboard = (data.generations || []).map((generation) => generationEntryFromApi(generation, { status: "done" }));
  } catch {
    state.galleryLeaderboard = [];
  } finally {
    state.galleryLeaderboardLoading = false;
  }
}

async function loadAnnouncements() {
  if (!state.user) {
    state.announcements = [];
    state.unreadAnnouncements = [];
    updateNotificationBadge();
    return;
  }
  try {
    const [all, unread] = await Promise.all([
      api("/api/announcements?limit=80"),
      api("/api/announcements/unread?limit=40")
    ]);
    state.announcements = all.announcements || [];
    state.unreadAnnouncements = unread.announcements || [];
  } catch {
    state.announcements = [];
    state.unreadAnnouncements = [];
  }
  updateNotificationBadge();
}

async function markAnnouncement(announcement, action = "read") {
  if (!announcement?.id) return null;
  const data = await api(`/api/announcements/${encodeURIComponent(announcement.id)}/${action}`, {
    method: "POST",
    body: "{}"
  });
  const updated = data.announcement || { ...announcement, userReadAt: new Date().toISOString() };
  state.announcements = state.announcements.map((item) => item.id === updated.id ? { ...item, ...updated } : item);
  state.unreadAnnouncements = state.unreadAnnouncements.filter((item) => item.id !== updated.id || (updated.requiresAck && !updated.userAckedAt));
  updateNotificationBadge();
  return updated;
}

function announcementTone(item = {}) {
  return item.level || item.severity || "info";
}

function announcementSummary(item = {}) {
  return String(item.body || "").replace(/\s+/g, " ").slice(0, 140);
}

function announcementIsUnread(item = {}) {
  return Boolean(item.unread || !item.userReadAt || (item.requiresAck && !item.userAckedAt));
}

function renderAnnouncementCard(item, { modal = false } = {}) {
  const unread = announcementIsUnread(item);
  return `
    <article class="announcement-card${unread ? " unread" : ""}" data-announcement-card="${escapeHtml(item.id)}" data-tone="${escapeHtml(announcementTone(item))}">
      <div class="announcement-card-head">
        <span>${escapeHtml(announcementTone(item))}</span>
        ${item.isImportant ? `<strong>${escapeHtml(text("notificationImportant"))}</strong>` : ""}
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(modal ? item.body : announcementSummary(item))}</p>
      <small>${escapeHtml(new Date(item.publishedAt || item.createdAt || Date.now()).toLocaleString(state.lang === "zh" ? "zh-CN" : "en-US"))}</small>
      <div class="announcement-actions">
        ${item.requiresAck && !item.userAckedAt
          ? `<button class="modal-primary" type="button" data-announcement-ack="${escapeHtml(item.id)}">${escapeHtml(text("notificationAck"))}</button>`
          : `<button class="modal-secondary" type="button" data-announcement-read="${escapeHtml(item.id)}">${escapeHtml(text("notificationRead"))}</button>`}
      </div>
    </article>
  `;
}

function bindAnnouncementActions(root = elements.modalLayer) {
  $$("[data-announcement-filter]", root).forEach((button) => {
    button.addEventListener("click", () => {
      state.notificationFilter = button.dataset.announcementFilter || "all";
      openNotificationsModal();
    });
  });
  $$("[data-announcement-read]", root).forEach((button) => {
    button.addEventListener("click", async () => {
      const item = state.announcements.find((entry) => entry.id === button.dataset.announcementRead)
        || state.unreadAnnouncements.find((entry) => entry.id === button.dataset.announcementRead);
      await markAnnouncement(item, "read");
      if ($(".announcement-modal-single", elements.modalLayer)) closeModal();
      else openNotificationsModal();
    });
  });
  $$("[data-announcement-ack]", root).forEach((button) => {
    button.addEventListener("click", async () => {
      const item = state.announcements.find((entry) => entry.id === button.dataset.announcementAck)
        || state.unreadAnnouncements.find((entry) => entry.id === button.dataset.announcementAck);
      await markAnnouncement(item, "ack");
      if ($(".announcement-modal-single", elements.modalLayer)) closeModal();
      else openNotificationsModal();
    });
  });
  $$("[data-announcement-close]", root).forEach((button) => {
    button.addEventListener("click", async () => {
      const item = state.unreadAnnouncements.find((entry) => entry.id === button.dataset.announcementClose);
      if (item && !item.requiresAck) await markAnnouncement(item, "read");
      closeModal();
    });
  });
}

async function openNotificationsModal() {
  if (!state.user) {
    openAuthModal("login");
    return;
  }
  await loadAnnouncements();
  const visibleAnnouncements = state.announcements.filter((item) => {
    if (state.notificationFilter === "unread") return announcementIsUnread(item);
    if (state.notificationFilter === "important") return Boolean(item.isImportant);
    return true;
  });
  openModal(`
    <section class="modal announcements-modal">
      <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
      <div class="modal-title">
        <i class="ri-notification-3-line" style="color:#f97316"></i>
        <h2>${escapeHtml(text("notificationsTitle"))}</h2>
        <p>${escapeHtml(text("notificationsUnread"))}: ${state.unreadAnnouncements.length}</p>
      </div>
      <div class="announcement-filters">
        ${["all", "unread", "important"].map((filter) => `
          <button type="button" class="${state.notificationFilter === filter ? "active" : ""}" data-announcement-filter="${filter}">
            ${escapeHtml(filter === "all" ? text("notificationsAll") : filter === "unread" ? text("notificationsUnread") : text("notificationsImportant"))}
          </button>
        `).join("")}
      </div>
      <div class="announcements-list">
        ${visibleAnnouncements.map((item) => renderAnnouncementCard(item)).join("") || `<p class="announcement-empty">${escapeHtml(text("notificationsEmpty"))}</p>`}
      </div>
    </section>
  `);
  bindAnnouncementActions(elements.modalLayer);
}

function maybeOpenUnreadAnnouncementModal() {
  if (!state.user || state.generating || state.editing) return;
  const item = state.unreadAnnouncements.find((entry) => (entry.displayMode || entry.displayType) === "modal" && !state.notificationModalShown.has(entry.id));
  if (!item) return;
  state.notificationModalShown.add(item.id);
  openModal(`
    <section class="modal announcement-modal-single">
      <button class="close-modal announcement-close" type="button" data-announcement-close="${escapeHtml(item.id)}"><i class="ri-close-line"></i></button>
      <div class="modal-title">
        <i class="ri-megaphone-line" style="color:#f97316"></i>
        <h2>${escapeHtml(text("notificationsTitle"))}</h2>
      </div>
      ${renderAnnouncementCard(item, { modal: true })}
    </section>
  `);
  bindAnnouncementActions(elements.modalLayer);
}

function updateGalleryLikeState(generation) {
  const updated = generationEntryFromApi(generation, { status: "done" });
  const apply = (item) => String(item.id) === String(updated.id) || String(item.generationId) === String(updated.id)
    ? { ...item, likeCount: updated.likeCount, likedByCurrentUser: updated.likedByCurrentUser }
    : item;
  state.publicGallery = state.publicGallery.map(apply);
  state.galleryLeaderboard = state.galleryLeaderboard.map(apply);
  state.history = state.history.map(apply);
  $$(`[data-like-gallery="${CSS.escape(String(updated.id))}"]`).forEach((button) => {
    button.classList.toggle("liked", updated.likedByCurrentUser);
    button.innerHTML = `<i class="${updated.likedByCurrentUser ? "ri-heart-fill" : "ri-heart-line"}"></i>${Number(updated.likeCount || 0)}`;
  });
  $$(`[data-square-like="${CSS.escape(String(updated.id))}"]`).forEach((button) => {
    button.classList.toggle("liked", updated.likedByCurrentUser);
    button.innerHTML = `<i class="${updated.likedByCurrentUser ? "ri-heart-fill" : "ri-heart-line"}"></i>${Number(updated.likeCount || 0)}`;
  });
}

async function toggleGalleryLike(generationId) {
  if (!state.user) {
    openAuthModal("login");
    return;
  }
  const item = [...state.publicGallery, ...state.galleryLeaderboard, ...state.history]
    .find((entry) => String(entry.id) === String(generationId) || String(entry.generationId) === String(generationId));
  const nextLiked = !item?.likedByCurrentUser;
  try {
    const data = await api(`/api/gallery/${encodeURIComponent(generationId)}/like`, {
      method: nextLiked ? "POST" : "DELETE",
      body: "{}"
    });
    if (data?.generation) updateGalleryLikeState(data.generation);
    if (state.view === "library") renderLibrary();
  } catch (error) {
    showToast(error.message || text("publishFailed"), "ri-error-warning-line");
  }
}

function tagColor(tag) {
  const colors = {
    ui: "linear-gradient(135deg, #38bdf8, #6366f1)",
    photo: "linear-gradient(135deg, #0f766e, #f59e0b)",
    poster: "linear-gradient(135deg, #111827, #2563eb)",
    portrait: "linear-gradient(135deg, #7c3aed, #ec4899)",
    illustration: "linear-gradient(135deg, #8b5cf6, #fbbf24)",
    anime: "linear-gradient(135deg, #f472b6, #a78bfa)",
    product: "linear-gradient(135deg, #0f172a, #64748b)",
    "3d": "linear-gradient(135deg, #f97316, #0f172a)",
    landscape: "linear-gradient(135deg, #22c55e, #38bdf8)",
    character: "linear-gradient(135deg, #7c3aed, #0ea5e9)",
    logo: "linear-gradient(135deg, #111827, #fbbf24)",
    fashion: "linear-gradient(135deg, #db2777, #fb7185)",
    cyberpunk: "linear-gradient(135deg, #0f172a, #a855f7)",
    infographic: "linear-gradient(135deg, #059669, #2563eb)",
    food: "linear-gradient(135deg, #dc2626, #f59e0b)"
  };
  return colors[tag] || "linear-gradient(135deg,#64748b,#cbd5e1)";
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function openModal(html) {
  elements.modalLayer.innerHTML = html;
  elements.modalLayer.classList.remove("hidden");
  $(".close-modal", elements.modalLayer)?.addEventListener("click", closeModal);
  elements.modalLayer.addEventListener("click", onModalBackdrop);
  applyI18n(elements.modalLayer);
}

function onModalBackdrop(event) {
  if (event.target === elements.modalLayer) closeModal();
}

function closeModal() {
  elements.modalLayer.classList.add("hidden");
  elements.modalLayer.innerHTML = "";
  elements.modalLayer.removeEventListener("click", onModalBackdrop);
  if (!state.routeSyncing && window.history?.pushState) {
    const route = routeState({ modal: "", workDetailId: "", galleryId: "" });
    window.history.replaceState(route, "", routeUrl(route));
  }
}

function openMyWorksModal(options = {}) {
  if (!state.user) {
    openAuthModal("login");
    return;
  }
  const shouldReplaceRoute = options.replaceRoute !== false;
  state.worksFilter = state.worksFilter || "all";
  const filters = [
    { id: "all", label: text("worksFilterAll") },
    { id: "public", label: text("worksFilterPublic") },
    { id: "private", label: text("worksFilterPrivate") },
    { id: "text", label: text("worksFilterText") },
    { id: "image", label: text("worksFilterImage") },
    { id: "archived", label: text("worksFilterArchived") }
  ];
  openModal(`
    <section class="modal works-modal works-workspace">
      <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
      <div class="works-head">
        <div>
          <h2>${text("myWorks")}</h2>
          <p>${state.lang === "zh" ? "搜索、批量公开、撤回或归档历史作品。" : "Search, publish, unpublish, or archive generated assets in bulk."}</p>
        </div>
        <button class="ghost-button works-refresh" type="button" data-works-refresh><i class="ri-refresh-line"></i></button>
      </div>
      <div class="works-toolbar">
        <label class="works-search"><i class="ri-search-line"></i><input id="worksSearchInput" value="${escapeHtml(state.worksSearch || "")}" placeholder="${state.lang === "zh" ? "搜索提示词、标签或时间" : "Search prompt, tags, or date"}"></label>
        <div class="works-bulk-actions">
          <span data-works-selection>0 ${text("worksSelected")}</span>
          <button type="button" data-works-bulk="download"><i class="ri-download-2-line"></i>${text("worksBatchDownload")}</button>
          <button type="button" data-works-bulk="publish"><i class="ri-gallery-upload-line"></i>${text("publishImage")}</button>
          <button type="button" data-works-bulk="unpublish"><i class="ri-eye-off-line"></i>${text("unpublish")}</button>
          <button type="button" data-works-bulk="archive"><i class="ri-archive-line"></i>${state.lang === "zh" ? "归档" : "Archive"}</button>
          <button type="button" data-works-bulk="unarchive"><i class="ri-inbox-unarchive-line"></i>${state.lang === "zh" ? "取消归档" : "Unarchive"}</button>
        </div>
      </div>
      <div class="works-filter-bar" role="tablist">
        ${filters.map((filter) => `<button type="button" data-works-filter="${filter.id}" class="works-filter-btn${state.worksFilter === filter.id ? " active" : ""}">${escapeHtml(filter.label)}</button>`).join("")}
      </div>
      <div id="worksGrid" class="works-grid"><div class="empty-message">${text("loadingPrompts")}</div></div>
    </section>
  `);
  $("[data-works-refresh]", elements.modalLayer).addEventListener("click", () => loadMyWorks(true));
  $("#worksSearchInput", elements.modalLayer).addEventListener("input", (event) => {
    state.worksSearch = event.target.value;
    loadMyWorks(false);
  });
  $$("[data-works-filter]", elements.modalLayer).forEach((button) => {
    button.addEventListener("click", () => {
      state.worksFilter = button.dataset.worksFilter || "all";
      $$("[data-works-filter]", elements.modalLayer).forEach((other) => {
        other.classList.toggle("active", other === button);
      });
      loadMyWorks(false);
    });
  });
  $$("[data-works-bulk]", elements.modalLayer).forEach((button) => {
    button.addEventListener("click", () => bulkUpdateWorks(button.dataset.worksBulk));
  });
  loadMyWorks(false);
  if (shouldReplaceRoute && !state.routeSyncing) {
    const route = routeState({ modal: "works" });
    window.history?.pushState?.(route, "", routeUrl(route));
  }
}

async function loadMyWorks(forceReload = false) {
  const grid = $("#worksGrid", elements.modalLayer);
  if (!grid) return;
  grid.innerHTML = `<div class="empty-message">${text("loadingPrompts")}</div>`;
  if (forceReload) await loadHistory();
  const filterId = state.worksFilter || "all";
  const query = String(state.worksSearch || "").trim().toLowerCase();
  const items = [...state.history]
    .filter((item) => item.status === "done" && item.images?.[0])
    .filter((item) => {
      const isImageToImage = isImageToImageItem(item);
      switch (filterId) {
        case "public":
          return Boolean(item.isPublic) && !item.archived;
        case "private":
          return !item.isPublic && !item.archived;
        case "text":
          return !isImageToImage && !item.archived;
        case "image":
          return isImageToImage && !item.archived;
        case "archived":
          return Boolean(item.archived);
        default:
          return !item.archived;
      }
    })
    .filter((item) => {
      if (!query) return true;
      return [
        item.prompt,
        formatDate(item.time),
        ...(item.publicTags || []).map(displayTag)
      ].some((value) => String(value || "").toLowerCase().includes(query));
    })
    .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
  renderWorksSelectionState();
  if (!items.length) {
    grid.innerHTML = `<div class="empty-message">${text(filterId === "all" ? "emptyWorks" : "worksFilterEmpty")}</div>`;
    return;
  }
  grid.innerHTML = items.map((item) => {
    const canPublishOriginal = Boolean(item.sourceImageData || item.sourceImageUrl);
    const isImageToImage = isImageToImageItem(item);
    const tagNote = item.publicTags?.length
      ? ` · ${item.publicTags.map(displayTag).join(" / ")}`
      : "";
    const rewardNote = item.isPublic
      ? publicRewardLabel(item)
      : "";
    const publishTools = `
      <div class="work-image-tools">
        <button type="button" data-work-publish="${escapeHtml(item.id)}">
          <i class="${item.isPublic ? "ri-price-tag-3-line" : "ri-gallery-upload-line"}"></i>
          ${item.isPublic ? text("editPublicTags") : text("publishImage")}
        </button>
        ${canPublishOriginal && !item.publishOriginal ? `<button type="button" data-work-publish-original="${escapeHtml(item.id)}"><i class="ri-image-add-line"></i>${text("publishWithOriginal")}</button>` : ""}
      </div>
    `;
    return `
    <article class="work-card${item.archived ? " archived" : ""}" data-work-id="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="${escapeHtml(text("worksOpenDetail"))}">
      <div class="work-visual" data-work-detail="${escapeHtml(item.id)}" ${imageFallbackContainerAttrs()}>
        <label class="work-select"><input type="checkbox" data-work-select="${escapeHtml(item.id)}"${state.worksSelected.has(String(item.id)) ? " checked" : ""}></label>
        <img src="${escapeHtml(imageVariantUrl(item.images[0]))}" ${imageFallbackImgAttrs()} loading="lazy" decoding="async" alt="${escapeHtml(truncate(item.prompt, 80))}">
        <span class="work-type-badge ${isImageToImage ? "image" : "text"}">${escapeHtml(text(isImageToImage ? "imageToImage" : "textToImage"))}</span>
        ${item.isPublic ? `<span class="work-visibility-badge published">${escapeHtml(text("publishedImage"))}</span>` : ""}
        ${item.archived ? `<span class="work-visibility-badge archived">${state.lang === "zh" ? "已归档" : "Archived"}</span>` : ""}
        ${publishTools}
      </div>
      <div class="work-body">
        <p>${escapeHtml(truncate(item.prompt, 92))}</p>
        <span>${escapeHtml(formatDate(item.time))}${item.isPublic ? ` · ${text("publishToSquare")}${escapeHtml(tagNote)}${rewardNote ? ` · ${escapeHtml(rewardNote)}` : ""}` : ""}</span>
        <div class="work-actions">
          <a href="${escapeHtml(item.images[0])}" download="${escapeHtml(item.id)}.png"><i class="ri-download-line"></i>${text("download")}</a>
          <button type="button" data-work-detail="${escapeHtml(item.id)}"><i class="ri-eye-line"></i>${text("worksOpenDetail")}</button>
          <button type="button" data-work-retry="${escapeHtml(item.id)}"><i class="ri-refresh-line"></i>${text("retry")}</button>
          <button type="button" data-work-editor="${escapeHtml(item.id)}"><i class="ri-magic-line"></i>${text("openEditor")}</button>
          ${item.isPublic ? `<button type="button" data-work-withdraw="${escapeHtml(item.id)}"><i class="ri-eye-off-line"></i>${text("unpublish")}</button>` : ""}
        </div>
      </div>
    </article>
  `;
  }).join("");
  $$("[data-work-select]", grid).forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", () => {
      if (input.checked) state.worksSelected.add(String(input.dataset.workSelect));
      else state.worksSelected.delete(String(input.dataset.workSelect));
      renderWorksSelectionState();
    });
  });
  $$("[data-work-detail]", grid).forEach((node) => {
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      openWorkDetail(node.dataset.workDetail);
    });
  });
  $$(".work-card", grid).forEach((card) => {
    const open = () => openWorkDetail(card.dataset.workId);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
  $$("a, button", grid).forEach((node) => {
    if (!node.hasAttribute("data-work-detail")) node.addEventListener("click", (event) => event.stopPropagation());
  });
  $$("[data-work-retry]", grid).forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.history.find((entry) => String(entry.id) === button.dataset.workRetry);
      if (!item) return;
      closeModal();
      state.forceHero = true;
      state.draftPrompt = item.prompt;
      setView("home");
      syncComposers();
      setTimeout(() => submitGeneration($(".composer", elements.heroComposerMount)), 80);
    });
  });
  $$("[data-work-editor]", grid).forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.history.find((entry) => String(entry.id) === button.dataset.workEditor);
      if (!item?.images?.[0]) return;
      closeModal();
      openImageEditor(item.images[0], item.prompt);
    });
  });
  $$("[data-work-publish]", grid).forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.history.find((entry) => String(entry.id) === button.dataset.workPublish);
      if (!item) return;
      openPublishModal(item, false);
    });
  });
  $$("[data-work-publish-original]", grid).forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.history.find((entry) => String(entry.id) === button.dataset.workPublishOriginal);
      if (!item) return;
      openPublishModal(item, true);
    });
  });
  $$("[data-work-withdraw]", grid).forEach((button) => {
    button.addEventListener("click", () => requestWorkWithdrawal(button.dataset.workWithdraw));
  });
}

function publicRewardLabel(item) {
  if (item.withdrawalStatus === "requested") return state.lang === "zh" ? "撤回审核中" : "withdrawal pending";
  if (item.publicRewardStatus === "pending") return state.lang === "zh"
    ? `奖励锁定 ${item.publicRewardAmount || 0} 分，满 12 小时入账`
    : `${item.publicRewardAmount || 0} credits locked until 12h`;
  if (item.publicRewardStatus === "awarded") return state.lang === "zh" ? "奖励已入账" : "reward awarded";
  if (item.publicRewardStatus === "cancelled") return state.lang === "zh" ? "奖励已取消" : "reward cancelled";
  return "";
}

async function requestWorkWithdrawal(id) {
  const item = state.history.find((entry) => String(entry.id) === String(id));
  if (!item) return;
  const withinWindow = !item.publishedAt || Date.now() - new Date(item.publishedAt).getTime() <= 12 * 60 * 60 * 1000;
  const message = withinWindow
    ? (state.lang === "zh" ? "确认撤回公开？12 小时内撤回会取消未入账奖励。" : "Unpublish this work? Pending reward will be cancelled.")
    : (state.lang === "zh" ? "已超过 12 小时，将提交撤回申请。" : "More than 12 hours passed. This will submit a withdrawal request.");
  if (!confirm(message)) return;
  try {
    await api(`/api/images/${encodeURIComponent(id)}/withdrawal`, {
      method: "POST",
      body: JSON.stringify({ reason: "user_request" })
    });
    await loadHistory();
    await loadPublicGallery();
    loadMyWorks(false);
    showToast(withinWindow ? text("unpublishDone") : (state.lang === "zh" ? "撤回申请已提交" : "Withdrawal request submitted"), "ri-checkbox-circle-line");
  } catch (error) {
    showToast(error.message, "ri-error-warning-line");
  }
}

function renderWorksSelectionState() {
  const label = $("[data-works-selection]", elements.modalLayer);
  if (!label) return;
  label.textContent = `${state.worksSelected.size} ${text("worksSelected")}`;
}

async function bulkUpdateWorks(action) {
  const ids = Array.from(state.worksSelected);
  if (!ids.length) return;
  if (action === "download") {
    downloadWorks(ids);
    return;
  }
  const dangerous = action === "unpublish" || action === "archive";
  const label = {
    publish: state.lang === "zh" ? "公开" : "publish",
    unpublish: state.lang === "zh" ? "撤回公开" : "unpublish",
    archive: state.lang === "zh" ? "归档" : "archive",
    unarchive: state.lang === "zh" ? "取消归档" : "unarchive"
  }[action] || action;
  if (dangerous && !confirm(`${state.lang === "zh" ? "确认" : "Confirm"}${label} ${ids.length} ${state.lang === "zh" ? "个作品？" : "works?"}`)) return;
  try {
    const selectedItems = ids.map(workById).filter(Boolean);
    const selectedKinds = [...new Set(selectedItems.map(publicKindTagForItem))];
    const publicTags = selectedKinds.length === 1 ? publicTagsForKind(selectedKinds[0], []) : [];
    const data = await api("/api/images/bulk", {
      method: "POST",
      body: JSON.stringify({ generationIds: ids, action, publicTags })
    });
    const okCount = (data.results || []).filter((item) => item.ok).length;
    state.worksSelected.clear();
    await loadHistory();
    await loadPublicGallery();
    showToast(`${label}: ${okCount}/${ids.length}`, "ri-checkbox-circle-line");
    loadMyWorks(false);
  } catch (error) {
    showToast(error.message, "ri-error-warning-line");
  }
}

function workById(id) {
  return state.history.find((entry) => String(entry.id) === String(id));
}

function downloadWorks(ids) {
  const items = ids.map(workById).filter((item) => item?.images?.[0]);
  items.forEach((item, index) => {
    setTimeout(() => {
      const link = document.createElement("a");
      link.href = item.images[0];
      link.download = `${item.id}.png`;
      link.rel = "noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }, index * 220);
  });
  showToast(`${text("worksDownloadStarted")}: ${items.length}`, "ri-download-2-line");
}

function openWorkDetail(id, options = {}) {
  const item = workById(id);
  if (!item?.images?.[0]) return;
  const shouldReplaceRoute = options.replaceRoute !== false;
  closeWorkDetail();
  const tags = (item.publicTags || []).map(displayTag).filter(Boolean);
  const isImageToImage = isImageToImageItem(item);
  const route = item.conversation?.length ? item.conversation : conversationRouteForItem(item);
  const optionRows = [
    [text("model"), item.model || "-"],
    [text("size"), item.options?.size || "-"],
    [text("quality"), item.options?.quality || "-"],
    [text("background"), item.options?.background || "-"],
    [text("format"), item.options?.outputFormat || "-"],
    [text("elapsed"), item.elapsedMs ? formatElapsed(item.elapsedMs) : "-"]
  ];
  elements.modalLayer.insertAdjacentHTML("beforeend", `
    <div class="works-detail-backdrop" data-work-detail-close></div>
    <aside class="works-detail-drawer" role="dialog" aria-modal="true" aria-label="${escapeHtml(text("worksDetailTitle"))}" data-work-id="${escapeHtml(item.id)}">
      <button class="works-detail-close" type="button" data-work-detail-close><i class="ri-close-line"></i></button>
      <div class="works-detail-stage" ${imageFallbackContainerAttrs()}>
        <img src="${escapeHtml(item.images[0])}" ${imageFallbackImgAttrs()} alt="${escapeHtml(truncate(item.prompt, 100))}">
      </div>
      <div class="works-detail-body">
        <div class="works-detail-title">
          <span class="work-type-badge ${isImageToImage ? "image" : "text"}">${escapeHtml(text(isImageToImage ? "imageToImage" : "textToImage"))}</span>
          <h3>${escapeHtml(text("worksDetailTitle"))}</h3>
          <p>${escapeHtml(item.prompt || "")}</p>
        </div>
        <div class="works-detail-actions">
          <button type="button" data-work-detail-copy><i class="ri-file-copy-line"></i>${text("worksCopyPrompt")}</button>
          <a href="${escapeHtml(item.images[0])}" download="${escapeHtml(item.id)}.png"><i class="ri-download-line"></i>${text("download")}</a>
          <button type="button" data-work-detail-editor><i class="ri-magic-line"></i>${text("openEditor")}</button>
          <button type="button" data-work-detail-continue><i class="ri-refresh-line"></i>${text("worksContinue")}</button>
        </div>
        <dl class="works-detail-meta">
          <dt>ID</dt><dd>${escapeHtml(String(item.id))}</dd>
          <dt>${escapeHtml(text("status"))}</dt><dd>${escapeHtml(item.isPublic ? text("publishedImage") : (item.archived ? (state.lang === "zh" ? "已归档" : "Archived") : text("worksFilterPrivate")))}</dd>
          <dt>${escapeHtml(text("publicTags"))}</dt><dd>${tags.length ? tags.map(escapeHtml).join(" / ") : "-"}</dd>
          <dt>${escapeHtml(state.lang === "zh" ? "创建时间" : "Created")}</dt><dd>${escapeHtml(formatDate(item.time) || "-")}</dd>
          ${optionRows.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value || "-"))}</dd>`).join("")}
        </dl>
        ${item.sourceImageUrl ? `<section class="works-detail-source" ${imageFallbackContainerAttrs()}><h4>${escapeHtml(text("sourceImage"))}</h4><img src="${escapeHtml(item.sourceImageUrl)}" ${imageFallbackImgAttrs()} alt="${escapeHtml(text("sourceImage"))}"></section>` : ""}
        ${route?.length ? `
          <section class="works-detail-route">
            <h4>${escapeHtml(text("routeTitle"))}</h4>
            ${route.map((step, index) => `
              <article>
                <strong>${index + 1}</strong>
                <p>${escapeHtml(step.prompt || item.prompt || "")}</p>
              </article>
            `).join("")}
          </section>
        ` : ""}
      </div>
    </aside>
  `);
  $$("[data-work-detail-close]", elements.modalLayer).forEach((node) => node.addEventListener("click", closeWorkDetail));
  $("[data-work-detail-copy]", elements.modalLayer)?.addEventListener("click", async () => {
    await copyText(item.prompt || "");
    showToast(state.lang === "zh" ? "提示词已复制" : "Prompt copied", "ri-file-copy-line");
  });
  $("[data-work-detail-editor]", elements.modalLayer)?.addEventListener("click", () => {
    closeModal();
    openImageEditor(item.images[0], item.prompt);
  });
  $("[data-work-detail-continue]", elements.modalLayer)?.addEventListener("click", () => {
    closeModal();
    state.forceHero = true;
    state.draftPrompt = item.prompt;
    navigate("home");
    syncComposers();
    setTimeout(() => $(".prompt-box", elements.heroComposerMount)?.focus(), 100);
  });
  if (shouldReplaceRoute && !state.routeSyncing) {
    const route = routeState({ modal: "works", workDetailId: item.id });
    window.history?.pushState?.(route, "", routeUrl(route));
  }
}

function closeWorkDetail() {
  $(".works-detail-drawer", elements.modalLayer)?.remove();
  $(".works-detail-backdrop", elements.modalLayer)?.remove();
  if (!state.routeSyncing && $(".works-modal", elements.modalLayer) && window.history?.pushState) {
    const route = routeState({ modal: "works", workDetailId: "" });
    window.history.replaceState(route, "", routeUrl(route));
  }
}

function openComplianceNotice() {
  const storageKey = "imageStudioComplianceNoticeV1";
  if (localStorage.getItem(storageKey) === "seen") return;
  openModal(`
    <section class="modal compliance-modal" role="dialog" aria-modal="true" aria-labelledby="complianceTitle">
      <button class="close-modal compliance-close" type="button" aria-label="${text("close")}"><i class="ri-close-line"></i></button>
      <div class="compliance-icon"><i class="ri-shield-check-line"></i></div>
      <div class="compliance-title">
        <h2 id="complianceTitle"><i class="ri-megaphone-fill"></i>${text("noticeTitle")}</h2>
        <p>${text("noticeSubtitle")}</p>
      </div>
      <div class="notice-card danger">
        <h3><span></span>${text("noticeCore")}</h3>
        <ul>
          <li><strong>严禁违规内容：</strong>平台（含“酒馆”等交互工具）严禁涉及低俗色情、暴力血腥、网络诈骗、政治敏感及其他违反法律法规的对话。</li>
          <li><strong>敏感词拦截：</strong>系统已启用内容安全审计功能，自动拦截不当言论及有害信息。</li>
          <li><strong>违规严厉处置：</strong>针对违规账号，我们将视情节严重程度采取：<em>警告 → 限制功能 → 临时封禁 → 永久销号 → 移送公安。</em></li>
        </ul>
      </div>
      <div class="notice-card privacy">
        <h3><i class="ri-shield-user-line"></i>${text("noticePrivacy")}</h3>
        <p><strong>信息安全：</strong>我们承诺！您的信息仅在系统内部加密存储，并严格用于系统运行及合规与安全保障相关用途。我们不会向任何个人或第三方出售、提供或披露您的数据。</p>
      </div>
      <div class="notice-card together">
        <p><strong>${text("noticeTogether").split("：")[0]}：</strong>${text("noticeTogether").split("：").slice(1).join("：") || text("noticeTogether")}</p>
      </div>
      <div class="compliance-actions">
        <button class="modal-primary" type="button" data-compliance-ack>${text("noticeAck")}</button>
      </div>
    </section>
  `);

  const markSeen = () => {
    localStorage.setItem(storageKey, "seen");
    closeModal();
  };
  $("[data-compliance-ack]", elements.modalLayer).addEventListener("click", markSeen);
  $(".compliance-close", elements.modalLayer).addEventListener("click", () => {
    localStorage.setItem(storageKey, "seen");
  });
}

function openAuthModal(mode = state.authMode) {
  state.authMode = mode;
  const isRegister = mode === "register";
  openModal(`
    <section class="modal">
      <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
      <div class="modal-title">
        <i class="ri-sparkling-2-fill"></i>
        <h2>${isRegister ? text("registerTitle") : text("loginTitle")}</h2>
        <p><i class="ri-gift-line"></i> ${text("authGift")}</p>
        <p class="auth-bonus"><i class="ri-flashlight-line"></i> ${text("authBonus")}</p>
      </div>
      <div class="auth-tabs">
        <button type="button" class="${!isRegister ? "active" : ""}" data-auth-mode="login">${text("submitLogin")}</button>
        <button type="button" class="${isRegister ? "active" : ""}" data-auth-mode="register">${text("submitRegister")}</button>
      </div>
      <form id="authForm" class="modal-form">
        ${isRegister ? `<label>${text("name")}<input id="authName" autocomplete="name"></label>` : ""}
        <label>${text("email")}<input id="authEmail" type="email" autocomplete="email" required></label>
        <label>${text("password")}<input id="authPassword" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" required></label>
        <button class="modal-primary" type="submit">${isRegister ? text("submitRegister") : text("submitLogin")}</button>
        <button class="link-button" type="button" data-auth-mode="${isRegister ? "login" : "register"}">
          ${isRegister ? text("switchToLogin") : text("switchToRegister")}
        </button>
        <button class="link-button" type="button" data-close-auth>${text("skip")}</button>
      </form>
    </section>
  `);
  $$("[data-auth-mode]", elements.modalLayer).forEach((button) => {
    button.addEventListener("click", () => openAuthModal(button.dataset.authMode));
  });
  $("[data-close-auth]", elements.modalLayer).addEventListener("click", closeModal);
  $("#authForm").addEventListener("submit", submitAuth);
}

async function submitAuth(event) {
  event.preventDefault();
  const submit = event.currentTarget.querySelector("button[type='submit']");
  submit.disabled = true;
  try {
    const payload = {
      email: $("#authEmail").value,
      password: $("#authPassword").value,
      name: $("#authName")?.value || ""
    };
    const data = await api(`/api/auth/${state.authMode}`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    if (data.pendingApproval) {
      showToast(state.lang === "zh" ? "账号已创建，等待管理员启用" : "Account created, waiting for approval", "ri-time-line");
      closeModal();
      return;
    }
    state.user = data.user;
    const me = await api("/api/auth/me");
    state.settings = me.settings;
    state.firstRun = me.firstRun;
    state.checkin = me.checkin || state.checkin;
    await loadHistory();
    ensureImageSessions();
    await loadAnnouncements();
    closeModal();
    state.forceHero = true;
    renderAll();
    setTimeout(maybeOpenUnreadAnnouncementModal, 300);
    window.scrollTo({ top: 0, behavior: "auto" });
    restartHeroVideo();
  } catch (error) {
    showToast(error.message, "ri-error-warning-line");
  } finally {
    submit.disabled = false;
  }
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" }).catch(() => null);
  state.user = null;
  state.history = [];
  state.imageSessions = [];
  state.activeImageSessionId = "";
  state.announcements = [];
  state.unreadAnnouncements = [];
  state.notificationModalShown.clear();
  state.checkin = { checkedInToday: false, credit: state.settings?.checkinCredit || 1 };
  state.forceHero = true;
  renderAll();
  window.scrollTo({ top: 0, behavior: "auto" });
  restartHeroVideo();
}

function openCreditsModal() {
  if (!state.user) {
    openAuthModal("login");
    return;
  }
  const credits = state.user?.credits ?? 0;
  const checkedIn = Boolean(state.checkin?.checkedInToday);
  const checkinCredit = Number(state.checkin?.credit || state.settings?.checkinCredit || 1);
  const generationCost = Number(state.settings?.generationCreditCost ?? 1);
  openModal(`
    <section class="modal">
      <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
      <div class="modal-title">
        <i class="ri-sparkling-2-fill"></i>
        <h2>${text("creditsTitle")}</h2>
        <p>${text("creditsBalance")}: <strong>${credits}</strong> · ${text("oneCredit")}: <strong>${generationCost}</strong></p>
      </div>
      <div class="checkin-card">
        <i class="ri-calendar-check-line"></i>
        <strong>+${checkinCredit}</strong>
        <span>${text("checkinReward")}</span>
      </div>
      <button class="modal-primary" type="button" data-checkin ${checkedIn ? "disabled" : ""}>
        ${checkedIn ? text("checkedIn") : text("checkinToday")}
      </button>
      <button class="modal-secondary" type="button" data-close-auth>${text("close")}</button>
    </section>
  `);
  $("[data-checkin]", elements.modalLayer).addEventListener("click", submitCheckin);
  $("[data-close-auth]", elements.modalLayer).addEventListener("click", closeModal);
}

async function submitCheckin(event) {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const data = await api("/api/checkin", { method: "POST" });
    state.user = data.user || { ...state.user, credits: data.credits };
    state.checkin = data.checkin || { checkedInToday: true, credit: state.checkin?.credit || 1 };
    showToast(data.checkedIn
      ? (state.lang === "zh" ? `签到成功，获得 ${data.awarded} 积分` : `Checked in, +${data.awarded} credit`)
      : text("checkedIn"), "ri-calendar-check-line");
    updateNav();
    openCreditsModal();
  } catch (error) {
    showToast(error.message, "ri-error-warning-line");
    button.disabled = false;
  }
}

function openContactModal() {
  const adminEmail = String(state.settings?.contactEmail ?? state.settings?.contactAdminEmail ?? "").trim();
  if (!adminEmail) return;
  const mailto = `mailto:${adminEmail}?subject=${encodeURIComponent("ai-image-studio support")}`;
  openModal(`
    <section class="modal">
      <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
      <div class="modal-title">
        <i class="ri-customer-service-2-line" style="color:#1677ff"></i>
        <h2>${text("contactTitle")}</h2>
        <p>${text("contactDesc")}</p>
      </div>
      <div class="contact-card">
        <span>${escapeHtml(text("contactEmailLabel"))}</span>
        <a class="contact-email" href="${escapeHtml(mailto)}">${escapeHtml(adminEmail)}</a>
        <button class="contact-copy" type="button" data-copy-contact-email>${escapeHtml(text("contactCopy"))}</button>
      </div>
      <button class="modal-secondary" type="button" data-close-auth>${text("close")}</button>
    </section>
  `);
  $("[data-copy-contact-email]", elements.modalLayer).addEventListener("click", async () => {
    await navigator.clipboard?.writeText(adminEmail);
    showToast(text("contactCopied"), "ri-file-copy-line");
  });
  $("[data-close-auth]", elements.modalLayer).addEventListener("click", closeModal);
}

async function openTagsAdminModal() {
  if (state.user?.role !== "admin") return;
  await loadTags();
  const renderRows = () => {
    const list = state.tagsLibrary.list || [];
    const body = $("#tagsAdminBody", elements.modalLayer);
    if (!body) return;
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="6" class="tags-admin-empty">${escapeHtml(text("tagsLibraryEmpty"))}</td></tr>`;
      return;
    }
    body.innerHTML = list.map((tag) => `
      <tr data-tag-row="${escapeHtml(tag.slug)}">
        <td>
          <span class="tag-chip" style="--tag-hue:${tag.hue}">${escapeHtml(tag.slug)}</span>
          <small style="color:#94a3b8;display:block;margin-top:4px;">${tag.source} · ${escapeHtml(tag.category || "general")}</small>
          <small style="color:#94a3b8;display:block;margin-top:4px;">${escapeHtml(text("tagsCoverage"))}: ${(tag.promptCount || 0) + (tag.galleryCount || 0)}</small>
        </td>
        <td><input data-tag-field="labelZh" value="${escapeHtml(tag.labelZh || "")}" maxlength="48"></td>
        <td><input data-tag-field="labelEn" value="${escapeHtml(tag.labelEn || "")}" maxlength="48"></td>
        <td><input data-tag-field="aliases" value="${escapeHtml((tag.aliases || []).join(", "))}" placeholder="alias1, alias2"></td>
        <td>
          <select data-tag-field="status">
            <option value="active"${tag.status !== "hidden" ? " selected" : ""}>${escapeHtml(text("tagsStatusActive"))}</option>
            <option value="hidden"${tag.status === "hidden" ? " selected" : ""}>${escapeHtml(text("tagsStatusHidden"))}</option>
          </select>
          <input data-tag-field="category" value="${escapeHtml(tag.category || "")}" placeholder="category" maxlength="32">
          <input data-tag-field="sortOrder" value="${Number(tag.sortOrder || 0)}" type="number" placeholder="sort">
          <label class="tags-admin-inline"><input data-tag-field="showInFilter" type="checkbox"${tag.showInFilter !== false ? " checked" : ""}> filter</label>
          <small style="color:#94a3b8;display:block;margin-top:4px;">${escapeHtml(text("tagsUsage"))}: ${tag.usageCount || 0}</small>
        </td>
        <td>
          <button type="button" data-tag-save="${escapeHtml(tag.slug)}">${escapeHtml(text("tagsSaveTag"))}</button>
          <button type="button" data-tag-merge="${escapeHtml(tag.slug)}">${escapeHtml(text("tagsMerge"))}</button>
        </td>
      </tr>
    `).join("");
    $$("[data-tag-save]", body).forEach((button) => {
      button.addEventListener("click", async () => {
        const slug = button.dataset.tagSave;
        const row = $(`[data-tag-row="${slug}"]`, body);
        if (!row) return;
        const aliasesText = $("[data-tag-field='aliases']", row)?.value || "";
        const payload = {
          labelZh: $("[data-tag-field='labelZh']", row)?.value.trim() || "",
          labelEn: $("[data-tag-field='labelEn']", row)?.value.trim() || "",
          aliases: aliasesText.split(/[,，\n]+/).map((alias) => alias.trim()).filter(Boolean),
          status: $("[data-tag-field='status']", row)?.value === "hidden" ? "hidden" : "active",
          category: $("[data-tag-field='category']", row)?.value.trim() || "",
          sortOrder: Number($("[data-tag-field='sortOrder']", row)?.value || 0),
          showInFilter: Boolean($("[data-tag-field='showInFilter']", row)?.checked)
        };
        try {
          await api(`/api/tags/${encodeURIComponent(slug)}`, {
            method: "PATCH",
            body: JSON.stringify(payload)
          });
          showToast(state.lang === "zh" ? "标签已保存" : "Tag saved", "ri-checkbox-circle-line");
          await loadTags();
          renderRows();
        } catch (error) {
          showToast(error.message, "ri-error-warning-line");
        }
      });
    });
    $$("[data-tag-merge]", body).forEach((button) => {
      button.addEventListener("click", async () => {
        const sourceSlug = button.dataset.tagMerge;
        const targetSlug = prompt(state.lang === "zh"
          ? `把「${sourceSlug}」合并到哪个标签的 slug？`
          : `Merge "${sourceSlug}" into which slug?`, "");
        if (!targetSlug) return;
        try {
          await api(`/api/tags/${encodeURIComponent(sourceSlug)}/merge`, {
            method: "POST",
            body: JSON.stringify({ targetSlug: targetSlug.trim().toLowerCase() })
          });
          showToast(state.lang === "zh" ? "已合并" : "Merged", "ri-git-merge-line");
          await loadTags();
          renderRows();
        } catch (error) {
          showToast(error.message, "ri-error-warning-line");
        }
      });
    });
  };

  openModal(`
    <section class="modal admin-modal tags-admin-modal" style="width:min(960px, calc(100vw - 32px));">
      <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
      <div class="modal-title">
        <i class="ri-price-tag-3-line"></i>
        <h2>${escapeHtml(text("tagsLibraryTitle"))}</h2>
      </div>
      <form id="tagsAdminAddForm" class="tags-admin-add">
        <input id="newTagSlug" placeholder="${escapeHtml(text("tagsSlug"))}" maxlength="48" required>
        <input id="newTagLabelZh" placeholder="${escapeHtml(text("tagsLabelZh"))}" maxlength="48">
        <input id="newTagLabelEn" placeholder="${escapeHtml(text("tagsLabelEn"))}" maxlength="48">
        <input id="newTagAliases" placeholder="${escapeHtml(text("tagsAliases"))} (alias1, alias2)">
        <button type="submit" class="modal-primary">${escapeHtml(text("tagsAddNew"))}</button>
      </form>
      <div class="tags-admin-table-wrap">
        <table class="tags-admin-table">
          <thead>
            <tr>
              <th>${escapeHtml(text("tagsSlug"))}</th>
              <th>${escapeHtml(text("tagsLabelZh"))}</th>
              <th>${escapeHtml(text("tagsLabelEn"))}</th>
              <th>${escapeHtml(text("tagsAliases"))}</th>
              <th>${escapeHtml(text("tagsStatus"))}</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="tagsAdminBody"></tbody>
        </table>
      </div>
    </section>
  `);
  renderRows();
  $("#tagsAdminAddForm", elements.modalLayer)?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const aliasesText = $("#newTagAliases", elements.modalLayer)?.value || "";
    const payload = {
      slug: ($("#newTagSlug", elements.modalLayer)?.value || "").trim().toLowerCase(),
      labelZh: ($("#newTagLabelZh", elements.modalLayer)?.value || "").trim(),
      labelEn: ($("#newTagLabelEn", elements.modalLayer)?.value || "").trim(),
      aliases: aliasesText.split(/[,，\n]+/).map((alias) => alias.trim()).filter(Boolean),
      source: "admin",
      status: "active"
    };
    try {
      await api("/api/tags", { method: "POST", body: JSON.stringify(payload) });
      showToast(state.lang === "zh" ? "标签已新建" : "Tag created", "ri-checkbox-circle-line");
      $("#newTagSlug", elements.modalLayer).value = "";
      $("#newTagLabelZh", elements.modalLayer).value = "";
      $("#newTagLabelEn", elements.modalLayer).value = "";
      $("#newTagAliases", elements.modalLayer).value = "";
      await loadTags();
      renderRows();
    } catch (error) {
      showToast(error.message, "ri-error-warning-line");
    }
  });
}

async function openAdminModal() {
  if (state.user?.role !== "admin") return;
  openModal(`
    <section class="modal admin-modal">
      <button class="close-modal" type="button"><i class="ri-close-line"></i></button>
      <div class="modal-title">
        <i class="ri-settings-3-line"></i>
        <h2>${text("adminTitle")}</h2>
      </div>
      <div class="admin-grid">
        <div class="admin-card">
          <h3>${text("settings")}</h3>
          <form id="settingsForm" class="admin-form">
        <label>${text("apiKey")}<input id="apiKeyInput" type="password" placeholder="Your API key"></label>
        <label>${text("apiBaseUrl")}<input id="apiBaseUrlInput" placeholder="AI API base URL"></label>
            <label>${text("model")}<input id="modelInput" placeholder="GPT-IMAGE-2"></label>
            <label>${text("defaultCredits")}<input id="defaultCreditsInput" type="number" min="0"></label>
            <label>${text("generationCost")}<input id="generationCreditCostInput" type="number" min="0"></label>
            <label>${text("maxImages")}<input id="maxImagesInput" type="number" min="1" max="4"></label>
            <label>${text("contactAdminEmail")}<input id="contactAdminEmailInput" type="email" placeholder="support@example.com"></label>
            <label class="admin-switch"><input id="allowRegistrationInput" type="checkbox">${text("allowRegistration")}</label>
            <label class="admin-switch"><input id="requireApprovalInput" type="checkbox">${text("requireApproval")}</label>
            <button class="modal-primary" type="submit">${text("save")}</button>
            <button id="clearApiKeyBtn" class="modal-secondary" type="button">${text("clearKey")}</button>
            <p id="apiKeyMask" style="color:#8b94a1;font-size:12px;margin:0"></p>
          </form>
          <div id="adminVersionPanel" class="admin-version" style="margin-top:14px;padding:12px;border-radius:10px;background:#f8fafc;color:#334155;font-size:12px;line-height:1.6;"></div>
          <button id="openTagsAdminBtn" type="button" class="modal-secondary" style="margin-top:12px;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:6px;">
            <i class="ri-price-tag-3-line"></i>${escapeHtml(text("tagsLibraryTitle"))}
          </button>
        </div>
        <div class="admin-card">
          <h3>${text("users")}</h3>
          <div class="users-table-wrap">
            <table class="users-table">
              <thead>
                <tr>
                  <th>${text("user")}</th>
                  <th>${text("role")}</th>
                  <th>${text("status")}</th>
                  <th>${text("credits")}</th>
                  <th>+/-</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="usersBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  `);
  await loadAdminSettings();
  await loadUsers();
  $("#openTagsAdminBtn", elements.modalLayer)?.addEventListener("click", openTagsAdminModal);
}

async function loadAdminSettings() {
  const settings = await api("/api/admin/settings");
  state.settings = settings;
  $("#apiBaseUrlInput").value = settings.apiBaseUrl || "";
  $("#modelInput").value = settings.model || "GPT-IMAGE-2";
  $("#defaultCreditsInput").value = settings.defaultCredits ?? 10;
  $("#generationCreditCostInput").value = settings.generationCreditCost ?? 1;
  $("#maxImagesInput").value = settings.maxImagesPerRequest ?? 1;
  $("#contactAdminEmailInput").value = settings.contactEmail ?? settings.contactAdminEmail ?? "";
  $("#allowRegistrationInput").checked = Boolean(settings.allowRegistration);
  $("#requireApprovalInput").checked = Boolean(settings.requireApproval);
  $("#apiKeyMask").textContent = settings.apiKeyMask
    ? `${text("currentKey")}: ${settings.apiKeyMask}`
    : text("noKey");
  $("#settingsForm").addEventListener("submit", saveSettings);
  $("#clearApiKeyBtn").addEventListener("click", clearApiKey);
  await renderAdminVersionPanel();
}

async function renderAdminVersionPanel() {
  const panel = $("#adminVersionPanel");
  if (!panel) return;
  if (!state.versionInfo) {
    await loadVersion();
  }
  const info = state.versionInfo;
  if (!info) {
    panel.textContent = state.lang === "zh" ? "暂无版本信息" : "Version info unavailable";
    return;
  }
  const startedLabel = info.startedAt ? new Date(info.startedAt).toLocaleString(state.lang === "zh" ? "zh-CN" : "en-US") : "-";
  const uptimeSeconds = Number(info.uptimeSeconds || 0);
  const uptimeText = uptimeSeconds < 60
    ? `${uptimeSeconds}${text("seconds")}`
    : uptimeSeconds < 3600
      ? `${Math.round(uptimeSeconds / 60)} min`
      : `${(uptimeSeconds / 3600).toFixed(1)} h`;
  const openaiTimeoutSeconds = Math.round(Number(info.timeoutMs?.openai || 0) / 1000);
  const downloadTimeoutSeconds = Math.round(Number(info.timeoutMs?.imageDownload || 0) / 1000);
  panel.innerHTML = `
    <strong style="display:block;margin-bottom:6px;color:#0f172a;">${escapeHtml(text("versionInfoTitle"))}</strong>
    <div>${escapeHtml(text("backendVersion"))}: <code>${escapeHtml(info.version || "-")}</code></div>
    <div>${escapeHtml(text("backendStartedAt"))}: ${escapeHtml(startedLabel)}</div>
    <div>${escapeHtml(text("backendUptime"))}: ${escapeHtml(uptimeText)}</div>
    <div>Node: ${escapeHtml(info.node || "-")} · ${escapeHtml(info.platform || "-")}</div>
    <div>${escapeHtml(text("timeoutOpenAI"))}: ${openaiTimeoutSeconds}${escapeHtml(text("seconds"))} · ${escapeHtml(text("timeoutDownload"))}: ${downloadTimeoutSeconds}${escapeHtml(text("seconds"))}</div>
  `;
}

async function saveSettings(event) {
  event.preventDefault();
  const settings = await api("/api/admin/settings", {
    method: "PATCH",
    body: JSON.stringify({
      openaiApiKey: $("#apiKeyInput").value.trim(),
      apiBaseUrl: $("#apiBaseUrlInput").value.trim(),
      model: $("#modelInput").value.trim(),
      defaultCredits: Number($("#defaultCreditsInput").value || 0),
      generationCreditCost: Number($("#generationCreditCostInput").value || 0),
      maxImagesPerRequest: Number($("#maxImagesInput").value || 1),
      contactEmail: $("#contactAdminEmailInput").value.trim(),
      allowRegistration: $("#allowRegistrationInput").checked,
      requireApproval: $("#requireApprovalInput").checked
    })
  });
  state.settings = settings;
  $("#apiKeyInput").value = "";
  $("#apiKeyMask").textContent = settings.apiKeyMask
    ? `${text("currentKey")}: ${settings.apiKeyMask}`
    : text("noKey");
  showToast(state.lang === "zh" ? "已保存" : "Saved", "ri-checkbox-circle-line");
  updateNav();
  syncComposers();
}

async function clearApiKey() {
  const settings = await api("/api/admin/settings", {
    method: "PATCH",
    body: JSON.stringify({ clearApiKey: true })
  });
  state.settings = settings;
  $("#apiKeyMask").textContent = text("noKey");
  showToast(state.lang === "zh" ? "已清除" : "Cleared", "ri-delete-bin-line");
  updateNav();
  syncComposers();
}

async function loadUsers() {
  const data = await api("/api/admin/users");
  const body = $("#usersBody");
  body.innerHTML = data.users.map((user) => `
    <tr data-user-id="${user.id}">
      <td class="user-cell"><strong>${escapeHtml(user.name || user.email)}</strong><span>${escapeHtml(user.email)}</span></td>
      <td>
        <select class="role-input" ${user.id === state.user.id ? "disabled" : ""}>
          <option value="user" ${user.role === "user" ? "selected" : ""}>${text("user")}</option>
          <option value="admin" ${user.role === "admin" ? "selected" : ""}>${text("adminRole")}</option>
        </select>
      </td>
      <td>
        <select class="status-input" ${user.id === state.user.id ? "disabled" : ""}>
          <option value="active" ${user.status === "active" ? "selected" : ""}>${text("active")}</option>
          <option value="disabled" ${user.status === "disabled" ? "selected" : ""}>${text("disabled")}</option>
        </select>
      </td>
      <td><input class="credits-input" type="number" min="0" value="${Number(user.credits || 0)}"></td>
      <td><input class="credit-delta-input" type="number" step="1" value="0"></td>
      <td><button class="tiny-button save-user" type="button"><i class="ri-save-line"></i>${text("save")}</button></td>
    </tr>
  `).join("");
  $$(".save-user", body).forEach((button) => {
    button.addEventListener("click", () => saveUser(button.closest("tr")));
  });
}

async function saveUser(row) {
  const id = row.dataset.userId;
  const user = await api(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      role: $(".role-input", row).value,
      status: $(".status-input", row).value,
      credits: Number($(".credits-input", row).value || 0),
      creditDelta: Number($(".credit-delta-input", row).value || 0)
    })
  });
  if (id === state.user.id) state.user = user.user;
  showToast(state.lang === "zh" ? "用户已保存" : "User saved", "ri-save-line");
  updateNav();
}

async function bootstrap() {
  setupRumMonitoring();
  renderComposers();
  loadImageSessionState();
  try {
    const data = await api("/api/auth/me");
    state.user = data.user;
    state.settings = data.settings;
    state.firstRun = data.firstRun;
    state.checkin = data.checkin || state.checkin;
    await loadHistory();
    await loadActiveGenerationRequests();
    ensureImageSessions();
    await loadStats();
    await loadVersion();
    await loadTags();
    await loadPublicGallery();
    await loadGalleryLeaderboard();
    await loadAnnouncements();
  } catch (error) {
    showToast(error.message, "ri-error-warning-line");
  }
  const initialRoute = routeFromLocation();
  state.view = initialRoute.view || "home";
  state.forceHero = initialRoute.view === "home" ? initialRoute.forceHero !== false : true;
  state.libraryTag = initialRoute.libraryTag || "all";
  state.librarySearch = initialRoute.librarySearch || "";
  renderAll();
  replaceRoute(initialRoute);
  if (initialRoute.modal === "works") {
    openMyWorksModal({ replaceRoute: false });
    if (initialRoute.workDetailId) {
      setTimeout(() => openWorkDetail(initialRoute.workDetailId, { replaceRoute: false }), 80);
    }
  } else if (initialRoute.modal === "square" && initialRoute.galleryId) {
    setTimeout(() => openSquarePreviewById(initialRoute.galleryId, { replaceRoute: false }), 80);
  }
  setupHeroVideo();
  if (state.view === "home") {
    setTimeout(openComplianceNotice, 260);
  }
  setTimeout(maybeOpenUnreadAnnouncementModal, 700);
}

function bindGlobalEvents() {
  elements.brandBtn.addEventListener("click", () => {
    openHomeHero({ scroll: true });
  });
  elements.promptLibraryBtn.addEventListener("click", () => navigate("library", { scrollTop: true }));
  elements.sessionDrawerToggle?.addEventListener("click", () => {
    if (state.view === "home" && !shouldShowHero()) {
      elements.app.classList.toggle("chat-panel-collapsed");
      elements.app.classList.remove("session-panel-open");
    } else {
      elements.app.classList.toggle("session-panel-open");
      elements.app.classList.remove("chat-panel-collapsed");
    }
    renderImageSessions();
  });
  elements.newImageSessionBtn?.addEventListener("click", () => {
    const session = createImageSession();
    state.imageSessions.unshift(session);
    state.activeImageSessionId = session.id;
    state.continuationLockedSessionId = "";
    state.continuationLastImageUrl = "";
    state.forceHero = false;
    elements.app.classList.remove("session-panel-open");
    elements.app.classList.remove("chat-panel-collapsed");
    saveImageSessionState();
    renderAll();
    setView("home");
    setTimeout(() => $(".prompt-box", elements.stickyComposerMount)?.focus(), 80);
  });
  elements.imageEditorBtn.addEventListener("click", () => openImageEditor());
  elements.openLibraryInlineBtn.addEventListener("click", () => navigate("library", { scrollTop: true }));
  elements.notificationBtn?.addEventListener("click", openNotificationsModal);
  elements.contactBtn.addEventListener("click", openContactModal);
  elements.langBtn.addEventListener("click", () => {
    state.lang = state.lang === "zh" ? "en" : "zh";
    localStorage.setItem("lang", state.lang);
    renderAll();
  });
  elements.loginBtn.addEventListener("click", () => openAuthModal("login"));
  elements.logoutBtn.addEventListener("click", logout);
  elements.creditsBtn.addEventListener("click", openCreditsModal);
  elements.myWorksBtn.addEventListener("click", () => openMyWorksModal());
  elements.adminBtn.addEventListener("click", () => {
    window.location.href = "/admin";
  });
  elements.librarySearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.librarySearch = elements.librarySearchInput.value;
    if (state.librarySearch.trim()) state.libraryTag = "all";
    state.promptVisible = 20;
    renderLibrary();
  });
  $("[data-editor-home]", elements.editorView).addEventListener("click", () => openHomeHero());
  $("[data-editor-create]", elements.editorView).addEventListener("click", () => {
    state.forceHero = true;
    navigate("home");
  });
  $$("[data-editor-tool]", elements.editorView).forEach((button) => {
    button.addEventListener("click", () => {
      state.editor.tool = button.dataset.editorTool;
      renderEditor();
    });
  });
  $("[data-editor-undo]", elements.editorView).addEventListener("click", undoEditorMark);
  $$("[data-editor-zoom]", elements.editorView).forEach((button) => {
    button.addEventListener("click", () => zoomEditor(button.dataset.editorZoom));
  });
  elements.editorColorInput.addEventListener("input", () => {
    state.editor.color = elements.editorColorInput.value;
  });
  elements.editorPromptInput.addEventListener("input", () => {
    state.editor.prompt = elements.editorPromptInput.value;
  });
  elements.editorUploadInput.addEventListener("change", (event) => handleEditorUpload(event.target.files?.[0]));
  elements.editorBottomUploadInput.addEventListener("change", (event) => handleEditorUpload(event.target.files?.[0]));
  elements.editorSourceImage.addEventListener("load", resetEditorCanvas);
  elements.editorMaskCanvas.addEventListener("pointerdown", editorPointerDown);
  elements.editorMaskCanvas.addEventListener("pointermove", editorPointerMove);
  window.addEventListener("pointerup", editorPointerUp);
  elements.editorPromptForm.addEventListener("submit", submitImageEdit);
  // 编辑器状态条按钮（重试 / 关闭失败提示 / 取消）走事件委托，
  // 因为 #editorStatusBar 由 ensureEditorStatusBar() 动态插入。
  elements.editorView?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest("[data-status-retry]")) {
      clearEditorFailure();
      elements.editorPromptForm?.requestSubmit();
      return;
    }
    if (target.closest("[data-status-dismiss]")) {
      clearEditorFailure();
      return;
    }
    if (target.closest("[data-status-cancel]")) {
      // 真正中断：通知 fetch + 后端 close，后端会把 generation_requests 标 cancelled 并退积分。
      const inflight = state.editAbortController || state.generateAbortController;
      if (inflight) {
        inflight.abort();
      }
      stopEditorTimer();
      const submitButton = $("button[type='submit']", elements.editorPromptForm);
      if (submitButton) submitButton.disabled = false;
      showToast(state.lang === "zh" ? "已取消生成，积分已退还" : "Cancelled; credits refunded", "ri-stop-circle-line");
    }
  });
  elements.editorPublicInput?.addEventListener("change", () => {
    if (!elements.editorPublicInput.checked) return;
    const finishCheck = () => {
      if (elements.editorPublishOriginalInput) {
        elements.editorPublishOriginalInput.checked = true;
      }
    };
    // 只有当编辑器里确实有图片（图生图场景）且首次勾选公开时才弹窗解释。
    const inImageToImage = Boolean(state.editor?.imageUrl);
    if (!inImageToImage || !shouldShowPublishOriginalNotice()) {
      finishCheck();
      return;
    }
    // 立即弹窗：用户在弹窗里二次决策。
    openPublishOriginalNoticeModal({
      onConfirm: () => finishCheck(),
      onCancel: () => {
        elements.editorPublicInput.checked = false;
        if (elements.editorPublishOriginalInput) {
          elements.editorPublishOriginalInput.checked = false;
        }
      }
    });
  });
  elements.editorPublishOriginalInput?.addEventListener("change", () => {
    if (elements.editorPublishOriginalInput.checked) {
      if (elements.editorPublicInput) elements.editorPublicInput.checked = true;
      return;
    }
    if (elements.editorPublicInput?.checked) {
      elements.editorPublishOriginalInput.checked = true;
      showToast(text("publishOriginalRequiredToast"), "ri-information-line");
    }
  });
  window.addEventListener("popstate", (event) => {
    applyRoute(event.state || routeFromLocation());
  });
}

bindGlobalEvents();
bootstrap();
loadPromptLibrary();
