import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE_URL = 'https://read.good666.cc';
const DEFAULT_KEYWORDS =
  '快速阅读,阅读速度,阅读理解,阅读理解能力,电子书,在线阅读,阅读训练,阅读效率,阅读测试';

const SEO_RULES = [
  {
    test: (pathname) => pathname === '/',
    title: '快速阅读训练平台 - 提升阅读速度与阅读理解能力',
    description:
      '快速阅读提供电子书在线阅读、阅读速度计时与阅读理解测试，帮助你在保持理解质量的同时系统提升阅读效率。',
    robots: 'index,follow',
    canonicalPath: '/',
  },
  {
    test: (pathname) => pathname === '/guest/read',
    title: '在线阅读训练 - 快速阅读与阅读理解测试',
    description:
      '从在线阅读训练开始，完成计时阅读与阅读理解测试，持续提升阅读速度和阅读理解能力。',
    robots: 'index,follow',
    canonicalPath: '/guest/read',
  },
  {
    test: (pathname) => pathname === '/login',
    title: '登录 - 快速阅读',
    description: '登录快速阅读平台，继续你的阅读训练和阅读理解测评。',
    robots: 'noindex,nofollow',
  },
  {
    test: (pathname) => pathname === '/register',
    title: '注册 - 快速阅读',
    description: '注册快速阅读账号，开始电子书在线阅读与阅读能力提升训练。',
    robots: 'noindex,nofollow',
  },
  {
    test: (pathname) => pathname === '/books',
    title: '书籍列表 - 快速阅读',
    description: '浏览可阅读书籍并开始阅读速度与阅读理解训练。',
    robots: 'noindex,nofollow',
  },
  {
    test: (pathname) => pathname === '/upload',
    title: '上传书籍 - 快速阅读',
    description: '上传电子书并用于快速阅读与阅读理解能力训练。',
    robots: 'noindex,nofollow',
  },
  {
    test: (pathname) => pathname === '/history',
    title: '历史记录 - 快速阅读',
    description: '查看阅读速度和阅读理解测试历史数据。',
    robots: 'noindex,nofollow',
  },
  {
    test: (pathname) => pathname === '/bookshelf',
    title: '我的书架 - 快速阅读',
    description: '管理个人书架，追踪阅读进度。',
    robots: 'noindex,nofollow',
  },
  {
    test: (pathname) => /^\/edit\/[^/]+$/.test(pathname),
    title: '编辑书籍 - 快速阅读',
    description: '编辑书籍内容并优化阅读训练素材。',
    robots: 'noindex,nofollow',
  },
  {
    test: (pathname) => /^\/read\/[^/]+$/.test(pathname),
    title: '阅读测试 - 快速阅读',
    description: '进行计时阅读并完成阅读理解测试。',
    robots: 'noindex,nofollow',
  },
  {
    test: (pathname) => /^\/result\/[^/]+$/.test(pathname),
    title: '测试结果 - 快速阅读',
    description: '查看本次阅读测试结果与表现分析。',
    robots: 'noindex,nofollow',
  },
  {
    test: (pathname) => pathname === '/guest/result',
    title: '测试结果 - 快速阅读',
    description: '查看本次游客模式阅读测试结果。',
    robots: 'noindex,nofollow',
  },
];

const FALLBACK_SEO = {
  title: '快速阅读',
  description:
    '快速阅读提供电子书在线阅读、阅读速度训练和阅读理解测试，帮助你稳步提升阅读能力。',
  robots: 'noindex,nofollow',
};

const upsertMetaByName = (name, content) => {
  if (!content) {
    return;
  }

  let meta = document.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', name);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
};

const upsertMetaByProperty = (property, content) => {
  if (!content) {
    return;
  }

  let meta = document.querySelector(`meta[property="${property}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', property);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
};

const upsertCanonical = (href) => {
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', href);
};

const buildCanonicalUrl = (pathname) => {
  if (!pathname || pathname === '/') {
    return `${SITE_URL}/`;
  }

  return `${SITE_URL}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
};

const getSeoByPathname = (pathname) => {
  const matched = SEO_RULES.find((rule) => rule.test(pathname));
  return matched || FALLBACK_SEO;
};

const SeoManager = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const seo = getSeoByPathname(pathname);
    const canonicalUrl = buildCanonicalUrl(seo.canonicalPath || pathname);

    document.title = seo.title;

    upsertMetaByName('description', seo.description);
    upsertMetaByName('keywords', DEFAULT_KEYWORDS);
    upsertMetaByName('robots', seo.robots);

    upsertMetaByProperty('og:type', 'website');
    upsertMetaByProperty('og:locale', 'zh_CN');
    upsertMetaByProperty('og:site_name', '快速阅读');
    upsertMetaByProperty('og:title', seo.title);
    upsertMetaByProperty('og:description', seo.description);
    upsertMetaByProperty('og:url', canonicalUrl);
    upsertMetaByProperty('og:image', 'https://read.good666.cc/favicon.ico');

    upsertMetaByName('twitter:card', 'summary');
    upsertMetaByName('twitter:title', seo.title);
    upsertMetaByName('twitter:description', seo.description);
    upsertMetaByName('twitter:image', 'https://read.good666.cc/favicon.ico');

    upsertCanonical(canonicalUrl);
  }, [pathname]);

  return null;
};

export default SeoManager;
