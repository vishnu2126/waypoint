import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import {
  Roadmap, Skill, Progress, SkillStatus, currentPosition, dontLearnYet, mastery, moduleProgress, roadmapStages,
  nextBestStep, readiness, search, seedKnownProgress, skillDNA,
  statusOf, storage, weightedProgress, nextUnlocks, progressKey, STORAGE_KEYS,
  WaypointState, loadWaypointState, saveWaypointState, activateRoute, setPrimaryRoute,
  setRouteStatus, removeRoute, resetRouteProgress, completeRouteSkill, routeSummary,
  toggleChecklist, checklistProgress, requiredChecklistComplete,
  findSkillById, resolveSkillRoute, skillPath, roadmapPath,
} from './engine';

type Tab = 'HOME' | 'ROADMAP' | 'MY_ROUTES' | 'EXPLORE' | 'PROFILE' | 'COMPARE';
const tabPaths: Record<Tab, string> = {
  HOME: '/home',
  ROADMAP: '/roadmap',
  MY_ROUTES: '/my-routes',
  EXPLORE: '/explore',
  PROFILE: '/profile',
  COMPARE: '/compare',
};
type Profile = { name: string; career: string; knownSkills: string[]; experience: string; studyHours: number; goal: string };
type Item = [string, string, string, number, boolean?];
const sharedDescriptions: Record<string, string> = {
  html: 'Structure accessible, semantic web documents.', css: 'Build responsive layouts and visual systems.',
  javascript: 'Write interactive browser applications.', git: 'Track changes and collaborate safely.',
  sql: 'Model and query relational data.', docker: 'Package applications consistently.',
  linux: 'Operate services and automate a reliable host.', networking: 'Understand how applications communicate.',
  testing: 'Create confidence with repeatable automated checks.', http: 'Move data reliably across the web.',
};
const shared: Record<string, Skill> = {};
function makeSkill(id: string, name: string, category: string, level: Skill['level'], hours: number, prerequisites: string[], required = true, tags: string[] = []): Skill {
  const existing = shared[id];
  if (existing) return { ...existing, prerequisites: [...prerequisites], required };
  const subject = name.toLowerCase();
  const topics = [
    `Core concepts and vocabulary for ${subject}`,
    `Common patterns and trade-offs in ${subject}`,
    `Debugging and verification workflows`,
  ];
  const subtopics = [
    { id: `${id}-study`, title: `Study the foundations of ${subject}`, type: 'study' as const, required: true },
    { id: `${id}-practice`, title: `Complete guided ${subject} exercises`, type: 'practice' as const, required: true },
    { id: `${id}-build`, title: `Build a small working ${subject} example`, type: 'build' as const, required: true },
    { id: `${id}-prove`, title: `Explain the key decisions and trade-offs`, type: 'prove' as const, required: true },
  ];
  const skill: Skill = {
    id, name, category, level, hours, importance: required ? 5 : 3, required,
    careerRelevance: required ? 5 : 3, prerequisites, tags: [id, name, ...tags],
    tier: required ? (prerequisites.length < 2 ? 'Core' : 'Important') : 'Optional',
    description: sharedDescriptions[id] ?? `Apply ${subject} in practical projects and production workflows.`,
    whyItMatters: `Strong ${subject} fundamentals make later modules easier to debug, design and ship.`,
    stage: category.replace(/[-_]/g, ' '),
    topics,
    subtopics,
    practiceExercises: [`Implement a focused ${subject} exercise`, `Review an example and identify one trade-off`],
    buildTasks: [`Build a small ${subject} feature and document how it works`],
    proveCriteria: [`Explain the core concepts of ${subject}`, `Diagnose a realistic failure or edge case`],
    completionCriteria: 'Complete all required study, practice, build and prove items.',
    resources: [{ label: `${name} official documentation`, url: id.includes('java') || id.includes('spring') ? 'https://dev.java/learn/' : id.includes('sql') ? 'https://www.postgresql.org/docs/' : id.includes('linux') ? 'https://man7.org/linux/man-pages/' : 'https://developer.mozilla.org/en-US/docs/Learn', official: true }],
  };
  shared[id] = skill;
  return skill;
}
function route(id: string, items: Item[]): Skill[] {
  let lastPrimary: string | null = null;
  return items.map(([key, name, category, hours, optional], index) => {
    const isOptional = Boolean(optional);
    const skill = makeSkill(`${id}-${key}`, name, category, index < 3 ? 'Beginner' : index < items.length - 4 ? 'Intermediate' : 'Advanced',
      hours, lastPrimary ? [lastPrimary] : [], !isOptional, [key, name]);
    if (!isOptional) lastPrimary = skill.id;
    return skill;
  });
}
function roadmap(id: string, name: string, blurb: string, items: Item[]): Roadmap {
  return { id, name, slug: id, blurb, skills: route(id, items) };
}
const frontend: Item[] = [
  ['html','HTML','FOUNDATIONS',6],['css','CSS','FOUNDATIONS',8],['web','Web platform','FOUNDATIONS',7],['javascript','JavaScript','FOUNDATIONS',12],
  ['git','Git','FOUNDATIONS',5],['dom','DOM and events','CORE',8],['http','HTTP','CORE',6],['async','Async JavaScript','CORE',8],
  ['modules','Modules and tooling','CORE',6],['accessibility','Accessibility','CORE',6],['react','React','FRAMEWORK',14],['components','Component architecture','FRAMEWORK',10],
  ['hooks','Hooks and composition','FRAMEWORK',8],['routing','Routing','FRAMEWORK',6],['typescript','TypeScript','SPECIALIZATION',10],['state','State management','SPECIALIZATION',8],
  ['forms','Forms and validation','SPECIALIZATION',7],['testing','Frontend testing','SPECIALIZATION',8],['storybook','Design systems','SPECIALIZATION',7],['performance','Web performance','PRODUCTION',8],
  ['security','Web security','PRODUCTION',8],['caching','Browser caching','PRODUCTION',5],['pwa','PWA fundamentals','PRODUCTION',7,true],['next','Next.js','PRODUCTION',12],
  ['ci','CI/CD','PRODUCTION',8],['hosting','Hosting and CDN','PRODUCTION',7],['observability','Frontend observability','PRODUCTION',6],['webgl','Web graphics','ADVANCED',10,true],
  ['websockets','WebSockets','ADVANCED',7,true],['microfrontends','Micro-frontends','ADVANCED',10,true],['architecture','Frontend architecture','ADVANCED',10],
  ['portfolio','Portfolio project','JOB READY',12],['interviews','Frontend interviews','JOB READY',8],['collaboration','Technical collaboration','JOB READY',5],
  ['seo','Technical SEO','JOB READY',6,true],['i18n','Internationalization','JOB READY',6,true],['profiling','Runtime profiling','ADVANCED',8],
  ['accessibility-audit','Accessibility audits','ADVANCED',6],['release','Release strategy','JOB READY',7],['leadership','Design critique','JOB READY',5,true],
];
const backend: Item[] = [
  ['programming','Programming fundamentals','FOUNDATIONS',12],['ds','Data structures','FOUNDATIONS',12],['git','Git','FOUNDATIONS',5],['linux','Linux','FOUNDATIONS',8],['networking','Networking','FOUNDATIONS',8],
  ['http','HTTP and REST','CORE',8],['apis','API design','CORE',8],['auth','Authentication','CORE',8],['testing','Backend testing','CORE',8],['sql','SQL','CORE',10],
  ['modeling','Data modeling','DATABASE',8],['indexes','Indexes and transactions','DATABASE',8],['java','Java','SPECIALIZATION',14],['jvm','JVM internals','SPECIALIZATION',10],
  ['spring','Spring Boot','SPECIALIZATION',14],['messaging','Messaging','SPECIALIZATION',8],['caching','Caching','SPECIALIZATION',7],['docker','Docker','PRODUCTION',8],
  ['config','Configuration','PRODUCTION',5],['cicd','CI/CD','PRODUCTION',8],['cloud','Cloud deployment','PRODUCTION',12],['observability','Observability','PRODUCTION',8],
  ['security','Application security','PRODUCTION',8],['queues','Queues and workers','ADVANCED',8],['concurrency','Concurrency','ADVANCED',10],['system','System design','ADVANCED',14],
  ['scaling','Scalability patterns','ADVANCED',10],['reliability','Reliability engineering','ADVANCED',10],['graphql','GraphQL','ADVANCED',8,true],['grpc','gRPC','ADVANCED',7,true],
  ['kafka','Kafka','ADVANCED',10,true],['profiling','Performance profiling','ADVANCED',8],['architecture','Service architecture','ADVANCED',10],['portfolio','Service project','JOB READY',14],
  ['interviews','Backend interviews','JOB READY',8],['documentation','API documentation','JOB READY',5],['code-review','Code review','JOB READY',5],['migration','Migration strategy','JOB READY',7,true],['capacity','Capacity planning','JOB READY',7,true],
];
const commonRoutes: Record<string, Item[]> = {
  'full-stack': [['html','HTML and CSS','FOUNDATIONS',10],['javascript','JavaScript','FOUNDATIONS',12],['git','Git','FOUNDATIONS',5],['http','HTTP','FOUNDATIONS',6],['dom','DOM and browser APIs','FOUNDATIONS',8],['react','React','CORE',14],['typescript','TypeScript','CORE',10],['components','Component systems','CORE',8],['testing','Testing','CORE',8],['api','API integration','CORE',8],['node','Node.js','BACKEND',12],['express','Service APIs','BACKEND',8],['auth','Authentication','BACKEND',8],['sql','SQL','DATABASE',8],['postgres','PostgreSQL and ORM','DATABASE',10],['modeling','Data modeling','DATABASE',7],['redis','Caching','DATABASE',7],['docker','Docker','PRODUCTION',8],['cicd','CI/CD','PRODUCTION',8],['hosting','Hosting','PRODUCTION',7],['security','Web security','PRODUCTION',8],['observability','Observability','PRODUCTION',8],['queues','Queues','ADVANCED',8],['system','System design','ADVANCED',14],['scaling','Scalability','ADVANCED',10],['performance','Performance','ADVANCED',8],['next','Next.js','SPECIALIZATION',12],['graphql','GraphQL','SPECIALIZATION',8,true],['kubernetes','Kubernetes','ADVANCED',12,true],['terraform','Terraform','ADVANCED',10,true],['portfolio','Full-stack project','JOB READY',16],['interviews','Full-stack interviews','JOB READY',8],['collaboration','Team delivery','JOB READY',6],['release','Release strategy','JOB READY',7],['seo','Technical SEO','JOB READY',6,true],['i18n','Internationalization','JOB READY',6,true],['payments','Payments','SPECIALIZATION',8,true],['realtime','Realtime apps','SPECIALIZATION',8,true],['architecture','Application architecture','ADVANCED',10],['documentation','Technical documentation','JOB READY',5],['migrations','Migration strategy','JOB READY',7,true],['capacity','Capacity planning','JOB READY',7,true],['accessibility','Accessibility','CORE',6],['linux','Linux','FOUNDATIONS',8],['networking','Networking fundamentals','FOUNDATIONS',8],['monitoring','Monitoring','PRODUCTION',7],['product','Product thinking','JOB READY',5,true],['security-testing','Security testing','PRODUCTION',8,true],['open-source','Open source workflow','JOB READY',6,true],['leadership','Technical leadership','JOB READY',6,true]],
  database: [['modeling','Data modeling','FOUNDATIONS',8],['sql','SQL','FOUNDATIONS',10],['joins','Joins and subqueries','FOUNDATIONS',8],['cte','CTEs and windows','FOUNDATIONS',8],['normalization','Normalization','CORE',8],['indexes','Indexes','CORE',8],['transactions','Transactions','CORE',8],['postgres','PostgreSQL','CORE',10],['mysql','MySQL','CORE',8],['redis','Redis','DATABASE',8],['nosql','NoSQL concepts','DATABASE',8],['document','Document stores','DATABASE',8],['query-plan','Query plans','DATABASE',10],['optimization','Query optimization','DATABASE',12],['replication','Replication','DATABASE',12],['partitioning','Partitioning','DATABASE',10],['backup','Backup and recovery','PRODUCTION',8],['monitoring','Database monitoring','PRODUCTION',8],['security','Database security','PRODUCTION',8],['warehouse','Data warehousing','SPECIALIZATION',10],['etl','ETL pipelines','SPECIALIZATION',10],['analytics','Analytics modeling','SPECIALIZATION',8],['streaming','Streaming data','ADVANCED',10],['sharding','Sharding','ADVANCED',12],['cap','CAP theorem','ADVANCED',7],['consistency','Consistency models','ADVANCED',8],['distributed','Distributed databases','ADVANCED',12],['cloud-db','Managed databases','PRODUCTION',8],['automation','Database automation','PRODUCTION',7],['portfolio','Database project','JOB READY',12],['interviews','Database interviews','JOB READY',8],['documentation','Schema documentation','JOB READY',5]],
  cloud: [['linux','Linux','FOUNDATIONS',8],['networking','Networking','FOUNDATIONS',8],['dns','DNS and HTTP/S','FOUNDATIONS',6],['virtualization','Virtualization','FOUNDATIONS',8],['compute','Compute and storage','CORE',10],['iam','IAM and security','CORE',8],['vpc','VPC networking','CORE',10],['containers','Docker and registries','CORE',8],['kubernetes','Kubernetes','CORE',12],['ha','High availability','PRODUCTION',10],['terraform','Terraform and IaC','SPECIALIZATION',12],['ansible','Configuration management','SPECIALIZATION',8],['serverless','Serverless','SPECIALIZATION',8],['observability','Observability','PRODUCTION',8],['cost','Cost optimization','PRODUCTION',6],['backup','Backup strategy','PRODUCTION',7],['cicd','Cloud CI/CD','PRODUCTION',8],['security','Cloud security','PRODUCTION',10],['sre','SRE fundamentals','ADVANCED',10],['scaling','Auto scaling','ADVANCED',8],['queues','Cloud queues','ADVANCED',8],['databases','Cloud databases','ADVANCED',8],['edge','Edge computing','ADVANCED',8,true],['mesh','Service mesh','ADVANCED',10,true],['finops','FinOps','JOB READY',7],['portfolio','Cloud architecture project','JOB READY',14],['interviews','Cloud interviews','JOB READY',8],['documentation','Architecture docs','JOB READY',5],['governance','Cloud governance','JOB READY',7],['disaster','Disaster recovery','PRODUCTION',8],['compliance','Compliance','PRODUCTION',7,true],['platform','Platform engineering','JOB READY',10],['migration','Migration planning','JOB READY',8],['release','Release engineering','JOB READY',7],['capacity','Capacity planning','JOB READY',7],['certification','Certification strategy','JOB READY',5,true]],
  devops: [['linux','Linux','FOUNDATIONS',8],['networking','Networking','FOUNDATIONS',8],['git','Git','FOUNDATIONS',5],['shell','Shell scripting','FOUNDATIONS',6],['docker','Docker','CORE',8],['k8s','Kubernetes','CORE',14],['actions','GitHub Actions','CORE',8],['pipelines','Deployment pipelines','CORE',10],['cloud','Cloud infrastructure','PRODUCTION',12],['terraform','Terraform','PRODUCTION',10],['ansible','Configuration management','PRODUCTION',8],['secrets','Secrets management','PRODUCTION',7],['observability','Logs, metrics and tracing','PRODUCTION',10],['alerting','Monitoring and alerting','PRODUCTION',8],['reliability','Reliability engineering','ADVANCED',12],['incident','Incident response','ADVANCED',8],['disaster','Disaster recovery','ADVANCED',8],['platform','Platform engineering','ADVANCED',12],['security','DevSecOps','ADVANCED',8],['supply','Software supply chain','ADVANCED',8],['gitops','GitOps','SPECIALIZATION',8],['service-mesh','Service mesh','SPECIALIZATION',10,true],['policy','Policy as code','SPECIALIZATION',8],['cost','Cost optimization','PRODUCTION',7],['capacity','Capacity planning','ADVANCED',7],['performance','Infrastructure performance','ADVANCED',8],['portfolio','Platform project','JOB READY',14],['interviews','DevOps interviews','JOB READY',8],['documentation','Runbooks','JOB READY',6],['oncall','On-call practice','JOB READY',8],['release','Release strategy','JOB READY',7],['testing','Infrastructure testing','PRODUCTION',8],['bluegreen','Blue/green deployment','PRODUCTION',7,true],['chaos','Chaos engineering','ADVANCED',8,true],['compliance','Compliance automation','JOB READY',7,true],['leadership','Technical leadership','JOB READY',6,true]],
  programming: [['variables','Variables and types','FOUNDATIONS',5],['conditions','Conditions and loops','FOUNDATIONS',6],['functions','Functions','FOUNDATIONS',6],['arrays','Arrays and strings','FOUNDATIONS',8],['objects','Objects','FOUNDATIONS',8],['debugging','Debugging','FOUNDATIONS',6],['git','Git','CORE',5],['recursion','Recursion','CORE',8],['structures','Data structures','CORE',12],['algorithms','Algorithms','CORE',14],['complexity','Complexity','CORE',8],['testing','Testing','CORE',8],['oop','Object-oriented design','CORE',8],['functional','Functional concepts','CORE',8],['memory','Memory and references','CORE',8],['concurrency','Concurrency','ADVANCED',10],['networking','Networking','ADVANCED',8],['databases','Databases','ADVANCED',8],['security','Security fundamentals','ADVANCED',8],['api','API design','ADVANCED',8],['architecture','Software architecture','ADVANCED',10],['performance','Performance','ADVANCED',8],['refactoring','Refactoring','JOB READY',8],['code-review','Code review','JOB READY',5],['documentation','Technical writing','JOB READY',5],['portfolio','Portfolio project','JOB READY',12],['interviews','Technical interviews','JOB READY',10],['collaboration','Collaboration','JOB READY',5],['open-source','Open source','JOB READY',6],['design-patterns','Design patterns','ADVANCED',10],['compilers','Compiler concepts','ADVANCED',12,true],['parsing','Parsing','ADVANCED',10,true]],
};
// Focused routes share foundational concepts but keep their own meaningful
// sequence so a learner can combine specialties without duplicate filler.
commonRoutes.dsa = [['complexity','Complexity analysis','FOUNDATIONS',7],['arrays','Arrays and strings','FOUNDATIONS',8],['recursion','Recursion','FOUNDATIONS',8],['structures','Data structures','CORE',12],['sorting','Sorting algorithms','CORE',10],['search','Searching and hashing','CORE',9],['trees','Trees and heaps','CORE',12],['graphs','Graphs','CORE',12],['dynamic','Dynamic programming','ADVANCED',14],['greedy','Greedy algorithms','ADVANCED',8],['testing','Algorithm testing','JOB READY',6],['interviews','Problem-solving interviews','JOB READY',12],['portfolio','Algorithms portfolio','JOB READY',10]];
commonRoutes.python = [['python','Python foundations','FOUNDATIONS',10],['stdlib','Standard library','FOUNDATIONS',8],['git','Git workflow','FOUNDATIONS',5],['testing','Pytest and testing','CORE',8],['sql','SQL for Python','CORE',8],['http','HTTP clients','CORE',7],['fastapi','FastAPI services','BACKEND',12],['async','Async Python','BACKEND',9],['data','Pandas and data wrangling','DATA',12],['packaging','Packaging and publishing','PRODUCTION',7],['docker','Dockerized Python','PRODUCTION',8],['portfolio','Python service project','JOB READY',14]];
commonRoutes.typescript = [['javascript','Modern JavaScript','FOUNDATIONS',12],['typescript','TypeScript type system','FOUNDATIONS',12],['git','Git workflow','FOUNDATIONS',5],['testing','Vitest testing','CORE',8],['node','Node.js runtime','BACKEND',10],['api','Typed API design','BACKEND',9],['react','React with TypeScript','UI',12],['next','Next.js application','UI',12],['performance','Web performance','PRODUCTION',8],['security','Type-safe security','PRODUCTION',8],['portfolio','TypeScript product','JOB READY',14]];
commonRoutes.qa = [['testing','Testing foundations','FOUNDATIONS',9],['git','Git workflow','FOUNDATIONS',5],['http','HTTP and APIs','CORE',7],['automation','Test automation','CORE',10],['unit','Unit testing','CORE',8],['integration','Integration testing','CORE',9],['e2e','End-to-end testing','CORE',10],['performance','Performance testing','PRODUCTION',8],['security','Security testing','PRODUCTION',8],['ci','Quality CI pipelines','PRODUCTION',8],['strategy','Quality strategy','JOB READY',8],['portfolio','Quality engineering project','JOB READY',12]];
commonRoutes.security = [['linux','Linux security basics','FOUNDATIONS',8],['networking','Network fundamentals','FOUNDATIONS',8],['git','Secure Git workflow','FOUNDATIONS',5],['http','HTTP security','CORE',8],['auth','Identity and access','CORE',10],['crypto','Applied cryptography','CORE',10],['web-security','Web application security','CORE',12],['threats','Threat modeling','PRODUCTION',8],['scanning','SAST and dependency scanning','PRODUCTION',8],['cloud-security','Cloud security','PRODUCTION',10],['incident','Incident response','ADVANCED',10],['portfolio','Security assessment','JOB READY',14]];
const roadmaps: Roadmap[] = [
  roadmap('frontend', 'Frontend Developer', 'Craft fast, accessible interfaces.', frontend),
  roadmap('backend', 'Java Backend Developer', 'Build reliable services, APIs and systems.', backend),
  roadmap('full-stack', 'Full Stack Developer', 'Move from UI to dependable APIs.', commonRoutes['full-stack']),
  roadmap('database', 'Database Engineer', 'Design, tune and operate dependable data systems.', commonRoutes.database),
  roadmap('cloud', 'Cloud Engineer', 'Design secure, scalable infrastructure.', commonRoutes.cloud),
  roadmap('devops', 'DevOps Engineer', 'Create the paved road to ship safely.', commonRoutes.devops),
  roadmap('programming', 'Programming Foundations', 'Build the concepts every technical route depends on.', commonRoutes.programming),
  roadmap('dsa', 'DSA & Computer Science', 'Build durable problem-solving and computer science fundamentals.', commonRoutes.dsa),
  roadmap('python', 'Python Developer', 'Build practical Python services, tooling and data workflows.', commonRoutes.python),
  roadmap('typescript', 'TypeScript Product Engineer', 'Ship typed, tested JavaScript products with confidence.', commonRoutes.typescript),
  roadmap('qa', 'Quality Engineer', 'Design automation and quality systems that scale with teams.', commonRoutes.qa),
  roadmap('security', 'Application Security Engineer', 'Find and fix vulnerabilities across modern systems.', commonRoutes.security),
];
const defaultProfile: Profile = { name: 'Developer', career: 'backend', knownSkills: [], experience: 'Beginner', studyHours: 2, goal: 'First job' };
const initialProgress = (r: Roadmap): Progress => Object.fromEntries(r.skills.map(s => [s.id, { status: 'not-started', mastery: 0 }]));
const siteUrl = 'https://waypoint.vish20nu26.workers.dev';
const publicPath = (pathname: string) => pathname === '/' || pathname === '/home' || pathname === '/explore' || pathname.startsWith('/roadmap/') || pathname.startsWith('/skill/');
function SeoHead({ pathname, roadmap, skill }: { pathname: string; roadmap: Roadmap; skill?: Skill }) {
  useEffect(() => {
    const isRoadmap = pathname.startsWith('/roadmap/');
    const isSkill = pathname.startsWith('/skill/');
    const title = isRoadmap ? `${roadmap.name} Roadmap 2026 | Waypoint` : isSkill && skill ? `${skill.name} Learning Module | Waypoint` : pathname === '/explore' ? 'Explore Developer Roadmaps | Waypoint' : 'Waypoint - Developer Navigation Engine';
    const description = isRoadmap ? `Follow a structured ${roadmap.name} roadmap covering practical skills, projects, testing, and real-world development workflows.` : isSkill && skill ? `Learn ${skill.name} with a structured Waypoint module covering concepts, practice, projects, and proof of understanding.` : pathname === '/explore' ? 'Explore structured developer roadmaps for frontend, backend, cloud, DevOps, databases, security, and more.' : 'Waypoint helps developers choose a destination, follow a structured roadmap, and find the next best learning move.';
    const canonical = publicPath(pathname) ? `${siteUrl}${pathname === '/' ? '/' : pathname}` : `${siteUrl}/home`;
    const setMeta = (selector: string, attributes: Record<string, string>) => {
      let element = document.head.querySelector(selector) as HTMLMetaElement | null;
      if (!element) { element = document.createElement('meta'); document.head.appendChild(element); }
      Object.entries(attributes).forEach(([key, value]) => element!.setAttribute(key, value));
    };
    document.title = title;
    setMeta('meta[name="description"]', { name: 'description', content: description });
    setMeta('meta[name="robots"]', { name: 'robots', content: publicPath(pathname) ? 'index,follow' : 'noindex,nofollow' });
    setMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    setMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    setMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    setMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    setMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Waypoint' });
    setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' });
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    let canonicalLink = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalLink) { canonicalLink = document.createElement('link'); canonicalLink.rel = 'canonical'; document.head.appendChild(canonicalLink); }
    canonicalLink.href = canonical;
    document.head.querySelector('script[data-waypoint-seo]')?.remove();
    if (publicPath(pathname)) {
      const graph: Record<string, unknown>[] = [{ '@type': isRoadmap ? 'WebPage' : 'WebSite', '@id': canonical, url: canonical, name: title, description }];
      if (isRoadmap) graph.push({ '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/home` }, { '@type': 'ListItem', position: 2, name: 'Roadmaps', item: `${siteUrl}/explore` }, { '@type': 'ListItem', position: 3, name: roadmap.name, item: canonical }] });
      const jsonLd = document.createElement('script');
      jsonLd.type = 'application/ld+json'; jsonLd.dataset.waypointSeo = 'true'; jsonLd.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }); document.head.appendChild(jsonLd);
    }
  }, [pathname, roadmap, skill]);
  return null;
}

function App() {
  const saved = storage.get<Profile>('profile', defaultProfile);
  const [waypoint, setWaypoint] = useState<WaypointState>(() => loadWaypointState(roadmaps));
  const [careerId, setCareerId] = useState(waypoint.primaryRoute || storage.get(STORAGE_KEYS.career, saved.career || 'backend'));
  const roadmap = roadmaps.find(r => r.id === careerId) ?? roadmaps[1];
  const [profile, setProfile] = useState<Profile>(saved);
  const [progress, setProgress] = useState<Progress>(() => waypoint.routes[roadmap.id]?.progress ?? storage.get(progressKey(roadmap.id), initialProgress(roadmap)));
  const [tab, setTab] = useState<Tab>('HOME');
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [zoom, setZoom] = useState(1);
  const [focusMode, setFocusMode] = useState<'path' | 'dependencies' | null>(null);
  const [toast, setToast] = useState('');
  const [onboard, setOnboard] = useState(!storage.get('onboarded', false));
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const routeMatch = useMemo(() => resolveSkillRoute(pathname, roadmaps), [pathname]);
  const navigate = (path: string, replace = false) => {
    (replace ? window.history.replaceState : window.history.pushState).call(window.history, {}, '', path);
    setPathname(path);
  };
  const activeTab = pathname.startsWith('/skill/') || pathname.startsWith('/roadmap') ? 'ROADMAP' : pathname === '/my-routes' ? 'MY_ROUTES' : pathname === '/explore' ? 'EXPLORE' : pathname === '/profile' ? 'PROFILE' : pathname === '/compare' ? 'COMPARE' : 'HOME';
  const goToTab = (target: Tab) => {
    setTab(target);
    navigate(target === 'ROADMAP' ? roadmapPath(careerId) : tabPaths[target]);
  };
  useEffect(() => {
    if (pathname === '/') {
      navigate('/home', true);
      return;
    }
    setTab(activeTab);
  }, [pathname]);
  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  useEffect(() => {
    if (pathname.startsWith('/roadmap/')) {
      const id = pathname.slice('/roadmap/'.length);
      const target = roadmaps.find(route => route.id === id);
      if (target) {
        setTab('ROADMAP');
        if (target.id !== careerId) {
          const nextState = activateRoute(waypoint, target.id, target.skills, false);
          setWaypoint(nextState); setCareerId(target.id); setProgress(nextState.routes[target.id].progress);
        }
      }
    }
  }, [pathname]);
  useEffect(() => {
    if (!routeMatch) return;
    const target = routeMatch.roadmap;
    if (target.id !== careerId) {
      const nextState = activateRoute(waypoint, target.id, target.skills, false);
      setWaypoint(nextState); setCareerId(target.id); setProgress(nextState.routes[target.id].progress);
    }
  }, [routeMatch?.roadmap.id]);
  useEffect(() => { if (onboard) return; storage.set(STORAGE_KEYS.career, careerId); storage.set(STORAGE_KEYS.profile, { ...profile, career: careerId }); storage.set(progressKey(roadmap.id), progress); saveWaypointState(waypoint); }, [careerId, profile, progress, roadmap.id, onboard, waypoint]);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2200); };
  const current = currentPosition(roadmap.skills, progress);
  const next = nextBestStep(roadmap.skills, progress) as Skill | null;
  const choose = (id: string) => { const target = roadmaps.find(r => r.id === id) ?? roadmap; const nextState = activateRoute(waypoint, id, target.skills, true); setWaypoint(nextState); setCareerId(id); setProgress(nextState.routes[id].progress); setSelected(null); setTab('ROADMAP'); navigate(roadmapPath(id)); notify('Destination changed - route recalculated.'); };
  const complete = (id: string, status: SkillStatus, value?: number) => { const nextState = completeRouteSkill(waypoint, roadmap, id, status, value); setWaypoint(nextState); setProgress(nextState.routes[roadmap.id].progress); notify(status === 'completed' ? 'Skill complete - route recalculated.' : status === 'in-progress' ? 'Learning started.' : 'Progress reset.'); };
  const toggleItem = (skillId: string, itemId: string, checked: boolean) => {
    const skill = roadmap.skills.find(item => item.id === skillId);
    if (!skill) return;
    const nextProgress = toggleChecklist(progress, skill, itemId, checked);
    const nextState = { ...waypoint, routes: { ...waypoint.routes, [roadmap.id]: { ...waypoint.routes[roadmap.id], progress: nextProgress, lastVisitedAt: new Date().toISOString() } } };
    setProgress(nextProgress); setWaypoint(nextState); saveWaypointState(nextState);
    notify(checked ? 'Checklist item saved.' : 'Checklist item reopened.');
  };
  const setCurrent = (id: string) => {
    setProgress(p => Object.fromEntries(roadmap.skills.map(skill => {
      const existing = p[skill.id] ?? { status: 'not-started' as SkillStatus, mastery: 0 };
      return [skill.id, {
        ...existing,
        status: skill.id === id ? 'in-progress' : existing.status === 'in-progress' ? 'not-started' : existing.status,
      }];
    })));
    setWaypoint(previous => ({ ...previous, routes: { ...previous.routes, [roadmap.id]: { ...previous.routes[roadmap.id], currentSkill: id, lastVisitedAt: new Date().toISOString() } } }));
    notify('Current waypoint set - route recalculated.');
  };
  const visible = useMemo(() => roadmap.skills.filter(s => (filter === 'ALL' || filter === s.category || filter === s.level || filter === s.tier || filter === statusOf(progress, s.id).replace('-', ' ')) && (!query || search([s], query).length)), [roadmap, filter, query, progress]);
  const resetProgress = () => { storage.resetProgress([roadmap.id]); const nextState = resetRouteProgress(waypoint, roadmap.id, roadmap.skills); setWaypoint(nextState); setProgress(nextState.routes[roadmap.id].progress); setSelected(null); notify('Progress reset - your route is ready to restart.'); };
  const resetEverything = () => { storage.resetAll(roadmaps.map(r => r.id)); const fresh = loadWaypointState(roadmaps); setWaypoint(fresh); setProfile(defaultProfile); setCareerId(defaultProfile.career); setProgress(initialProgress(roadmaps[1])); setSelected(null); setTab('HOME'); setOnboard(true); };
  const invalidSkillRoute = pathname.startsWith('/skill/');
  if (onboard && !routeMatch && !invalidSkillRoute) return <Onboarding profile={profile} onDone={p => { const r = roadmaps.find(x => x.id === p.career) ?? roadmap; const seeded = seedKnownProgress(r.skills, p.knownSkills, storage.get(progressKey(r.id), {})); const activated = activateRoute(waypoint, r.id, r.skills, true); activated.routes[r.id] = { ...activated.routes[r.id], progress: seeded }; setWaypoint(activated); setProfile(p); setCareerId(r.id); setProgress(seeded); storage.set(STORAGE_KEYS.onboarded, true); setOnboard(false); setTab('ROADMAP'); navigate(roadmapPath(r.id)); }} />;
  const openSkill = (skill: Skill, sourceRoadmap = roadmap) => {
    if (sourceRoadmap.id !== careerId) {
      const nextState = activateRoute(waypoint, sourceRoadmap.id, sourceRoadmap.skills, false);
      setWaypoint(nextState); setCareerId(sourceRoadmap.id); setProgress(nextState.routes[sourceRoadmap.id].progress);
    }
    setSelected(null); navigate(skillPath(skill.id));
  };
  const continueRoute = () => { if (next) openSkill(next); };
  const activeRoadmap = routeMatch?.roadmap ?? roadmap;
  const activeProgress = routeMatch ? (waypoint.routes[activeRoadmap.id]?.progress ?? progress) : progress;
  const toggleActiveItem = (skillId: string, itemId: string, checked: boolean) => {
    const targetRoadmap = activeRoadmap;
    const targetSkill = targetRoadmap.skills.find(item => item.id === skillId);
    if (!targetSkill) return;
    const currentProgress = waypoint.routes[targetRoadmap.id]?.progress ?? {};
    const nextProgress = toggleChecklist(currentProgress, targetSkill, itemId, checked);
    const nextState = { ...waypoint, routes: { ...waypoint.routes, [targetRoadmap.id]: { ...waypoint.routes[targetRoadmap.id], progress: nextProgress, lastVisitedAt: new Date().toISOString() } } };
    setWaypoint(nextState); saveWaypointState(nextState);
    if (targetRoadmap.id === careerId) setProgress(nextProgress);
    notify(checked ? 'Checklist item saved.' : 'Checklist item reopened.');
  };
  return <><SeoHead pathname={pathname} roadmap={activeRoadmap} skill={routeMatch?.skill} /><div className="app dark"><aside className="sidebar"><div className="brand"><span className="brand-mark">-&gt;</span><span>WAYPOINT</span><small>DEV NAV ENGINE</small></div><div className="side-label">NAVIGATION</div><nav>{(['HOME','ROADMAP','MY_ROUTES','EXPLORE','PROFILE','COMPARE'] as Tab[]).map(t => <button key={t} className={activeTab === t ? 'active' : ''} onClick={() => goToTab(t)}><b>{t === 'HOME' ? 'H' : t === 'ROADMAP' ? 'R' : t === 'MY_ROUTES' ? 'M' : t === 'EXPLORE' ? 'E' : t === 'PROFILE' ? 'P' : 'C'}</b>{t === 'MY_ROUTES' ? 'My Routes' : t[0] + t.slice(1).toLowerCase()}</button>)}</nav><div className="side-label gap">YOUR ROUTES</div>{roadmaps.filter(r => waypoint.routes[r.id]?.active).slice(0, 4).map(r => <button className="route-mini" key={r.id} onClick={() => choose(r.id)}><i className="route-dot"></i><div><strong>{r.name}</strong><small>{weightedProgress(r.skills, waypoint.routes[r.id].progress)}% COMPLETE</small></div>  <i>&gt;</i></button>)}<button className="text-btn" onClick={() => goToTab('MY_ROUTES')}>View all routes -&gt;</button><div className="sidebar-foot"><div className="avatar">{profile.name.slice(0, 2).toUpperCase()}</div><div><strong>{profile.name}</strong><small>LOCAL PROFILE</small></div></div></aside><main><header className="topbar"><div className="crumb"><span>MY NAVIGATION</span><i>/</i><strong>{activeRoadmap.name}</strong></div><label className="search"><span>E</span><input aria-label="Search skills" placeholder="Search skills, roles, technologies..." value={query} onChange={e => setQuery(e.target.value)} /><kbd>CTRL K</kbd></label></header>{query && <div className="search-results">{search(roadmaps, query).map(r => <button key={r.id} onClick={() => { choose(r.id); setQuery(''); }}><b>{r.name}</b><small>Career route</small></button>)}{search(roadmaps.flatMap(r => r.skills.map(s => ({ ...s, roadmap: r.id }))), query).slice(0, 8).map((s: any) => <button key={`${s.roadmap}-${s.id}`} onClick={() => { openSkill(s, roadmaps.find(r => r.id === s.roadmap) ?? roadmap); setQuery(''); }}><b>{s.name}</b><small>{s.roadmap}  -  {s.category}</small></button>)}  </div>}{invalidSkillRoute ? (routeMatch ? <SkillPage skill={routeMatch.skill} roadmap={activeRoadmap} progress={activeProgress} toggleItem={toggleActiveItem} complete={(id: string, status: SkillStatus, value?: number) => { const target = completeRouteSkill(waypoint, activeRoadmap, id, status, value); setWaypoint(target); saveWaypointState(target); setProgress(target.routes[activeRoadmap.id].progress); }} onBack={() => navigate(roadmapPath(activeRoadmap.id))} /> : <section className="page skill-not-found"><div className="eyebrow">LEARNING MODULE</div><h1>SKILL <i>NOT FOUND.</i></h1><p className="page-intro">This module route does not exist in the current learning catalog.</p><button className="primary" onClick={() => navigate(roadmapPath(careerId))}>Back to Roadmaps <span>-&gt;</span></button></section>) : <>{tab === 'MY_ROUTES' && <MyRoutes roadmaps={roadmaps} state={waypoint} onPrimary={(id: string) => { const nextState = setPrimaryRoute(waypoint, id); setWaypoint(nextState); setCareerId(id); setProgress(nextState.routes[id].progress); }} onPause={(id: string) => setWaypoint(setRouteStatus(waypoint, id, 'paused'))} onResume={(id: string) => setWaypoint(setRouteStatus(waypoint, id, 'active'))} onRemove={(id: string) => setWaypoint(removeRoute(waypoint, id))} onOpen={(id: string) => choose(id)} />}{tab === 'HOME' && <Home roadmap={roadmap} progress={progress} current={current} next={next} onStart={() => setOnboard(true)} onExplore={() => goToTab('EXPLORE')} choose={choose} onContinue={continueRoute} />    }{(tab === 'ROADMAP' || pathname === '/roadmap' || pathname.startsWith('/roadmap/')) && <RoadmapView roadmap={roadmap} progress={progress} selected={selected} setSelected={setSelected} complete={complete} setCurrent={setCurrent} toggleItem={toggleItem} current={current} next={next} visible={visible} filter={filter} setFilter={setFilter} zoom={zoom} setZoom={setZoom} focusMode={focusMode} setFocusMode={setFocusMode} onExplore={() => goToTab('EXPLORE')} onOpenSkill={openSkill} />}{tab === 'EXPLORE' && <Explore active={careerId} choose={choose} />}{tab === 'PROFILE' && <Profile roadmap={roadmap} progress={progress} profile={profile} setProfile={setProfile} current={current} onResetProgress={resetProgress} onResetEverything={resetEverything} />  }{tab === 'COMPARE' && <Compare roadmap={roadmap} progress={progress} choose={choose} />}</>}</main>{toast && <div className="toast"> {toast}</div>}</div></>;
}

function MyRoutes({ roadmaps, state, onPrimary, onPause, onResume, onRemove, onOpen }: any) {
  const active = roadmaps.filter((route: Roadmap) => state.routes[route.id]?.active);
  return <section className="page"><div className="page-kicker">MY ROUTES / YOUR ACTIVE LEARNING PATHS</div><h1>YOUR<br /><i>ROUTES.</i></h1><p className="page-intro">Keep several destinations moving without losing progress.</p><div className="career-grid">{active.map((route: Roadmap) => { const summary = routeSummary(route, state); const paused = state.routes[route.id].status === 'paused'; const routeStatus = summary.progressPercent >= 100 ? 'completed' : summary.progressPercent > 0 ? 'in-progress' : 'not-started'; const routeLabel = routeStatus === 'completed' ? 'COMPLETED' : routeStatus === 'in-progress' ? 'IN PROGRESS' : 'NOT STARTED'; return <article className={`career-card chosen route-card ${routeStatus}`} key={route.id}><span className="career-index lime">{state.primaryRoute === route.id ? '*' : ''}</span><span className="route-status">{routeLabel}</span><h2>{route.name}</h2><p>{route.blurb}</p><div className="route-progress"><b>{summary.progressPercent}%</b> complete  -  {summary.remainingHours}h remaining</div><small>Current: {summary.current?.name ?? 'Ready to begin'}  -  Next: {summary.next?.name ?? 'Complete'}</small><small>Last activity: {new Date(summary.lastVisitedAt).toLocaleDateString()}</small><div className="hero-actions"><button className="primary" onClick={() => onOpen(route.id)}>{paused ? 'View route' : 'Continue'} -&gt;</button>{state.primaryRoute !== route.id && <button className="text-btn" onClick={() => onPrimary(route.id)}>Set primary</button>}{paused ? <button className="text-btn" onClick={() => onResume(route.id)}>Resume</button> : <button className="text-btn" onClick={() => onPause(route.id)}>Pause</button>}<button className="text-btn" onClick={() => onRemove(route.id)}>Remove</button></div></article>})}</div>{!active.length && <div className="empty-detail"><h2>No active routes yet.</h2><p>Explore a destination to add your first learning path.</p></div>}</section>;
}

function Home({ roadmap, progress, current, next, onStart, onExplore, choose, onContinue }: any) {
  const done = roadmap.skills.filter((s: Skill) => statusOf(progress, s.id) === 'completed').slice(-4).reverse();
  const dna = skillDNA(roadmap.skills, progress);
  return <section className="page home-page"><div className="hero home-hero"><div><span className="eyebrow"><span className="pulse"></span> YOUR CURRENT ROUTE</span><h1>{roadmap.name.toUpperCase()}<br /><i>{weightedProgress(roadmap.skills, progress)}% COMPLETE.</i></h1><p>{roadmap.blurb} Your route responds to every completed waypoint.</p><div className="hero-actions"><button className="primary" onClick={onContinue}>{next ? 'Continue route' : 'Route complete'} <span>-&gt;</span></button><button className="text-btn" onClick={onExplore}>Change destination <span>-&gt;</span></button></div></div><div className="destination"><span>YOU ARE HERE</span><strong>{current?.name ?? (next?.name ?? 'Ready to begin')}</strong><small>NEXT BEST MOVE <b>{next?.name ?? 'Destination reached'}</b></small></div></div><div className="home-signal"><div><span className="eyebrow">RECENTLY COMPLETED</span><strong>{done.length ? done.map((s: Skill) => s.name).join('  -  ') : 'Your first waypoint is waiting.'}</strong></div><div><span className="eyebrow">NEXT UNLOCKS</span><strong>{nextUnlocks(roadmap.skills, progress).map(s => s.name).join('  -  ') || 'Complete your next skill to reveal the route.'}</strong></div><div><span className="eyebrow">SKILL DNA</span><strong>{Object.entries(dna).map(([k, v]) => `${k} ${v}%`).join('  -  ')}</strong></div></div><h2 className="section-title">EXPLORE <i>DESTINATIONS.</i></h2><div className="career-grid">{roadmaps.map((r, i) => <button className={`career-card ${r.id === roadmap.id ? 'chosen' : ''}`} key={r.id} onClick={() => choose(r.id)}><span className="career-index lime">0{i + 1}</span><h2>{r.name}</h2><p>{r.blurb}</p><small>{weightedProgress(r.skills, storage.get(progressKey(r.id), initialProgress(r)))}% complete  -  {r.skills.length} skills</small><strong>{r.id === roadmap.id ? 'Open route' : 'Choose route'} -&gt;</strong></button>)}</div></section>;
}

function RoadmapView({ roadmap, progress, selected, setSelected, complete, setCurrent, toggleItem, current, next, visible, filter, setFilter, onExplore, onOpenSkill }: any) {
  const stages = useMemo(() => roadmapStages(roadmap.skills, progress), [roadmap, progress]);
  const selectedSkill = roadmap.skills.find((s: Skill) => s.id === selected) ?? null;
  const completion = weightedProgress(roadmap.skills, progress);
  const remainingHours = roadmap.skills.reduce((hours: number, skill: Skill) => hours + (moduleProgress(skill, progress) < 100 ? skill.hours : 0), 0);
  const continueLearning = () => { if (next) onOpenSkill(next, roadmap); };
  return <>
    <section className="route-head curriculum-head"><div><div className="eyebrow"><span className="pulse"></span> YOUR LEARNING JOURNEY  -  {roadmap.skills.length} MODULES</div><h1>{roadmap.name.toUpperCase()}</h1><p>{roadmap.blurb} Follow the stages in order, with room to explore what helps you grow.</p><button className="primary route-continue" onClick={continueLearning}>{next ? 'Continue learning' : 'Journey complete ✓'} <span>→</span></button></div><div className="route-summary"><span>CALCULATED COMPLETION</span><strong>{completion}<em>%</em></strong><div className="route-progress"><i style={{width: `${completion}%`}} /></div><small>{remainingHours}h remaining · {roadmap.skills.filter((s: Skill) => statusOf(progress, s.id) === 'completed').length}/{roadmap.skills.length} modules complete</small></div></section>
    <section className="metrics journey-metrics"><div><span>CURRENT POSITION</span><strong>{current?.name ?? (next ? 'Ready to begin' : 'Destination reached')}</strong><small>{current?.stage ?? current?.category ?? 'START HERE'}</small></div><div><span>NEXT BEST MOVE</span><strong className="lime-text">{next?.name ?? 'All caught up'} <b>→</b></strong><small>{next ? `${next.hours} HOURS · ${next.level.toUpperCase()}` : 'JOURNEY COMPLETE'}</small></div><div><span>STAGES</span><strong>{stages.length}</strong><small>{stages.filter((stage: any) => stage.completed === stage.total).length} COMPLETE</small></div></section>
    <section className="curriculum-shell"><div className="curriculum-toolbar"><div><span className="eyebrow">CURRICULUM / {stages.length} STAGES</span><h2>The journey <small>· {completion}% complete</small></h2></div><div className="curriculum-filters"><label>SHOW <select value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">All modules</option><option value="Core">Core</option><option value="Important">Important</option><option value="Optional">Optional</option><option value="completed">Completed</option><option value="in progress">In progress</option><option value="not started">Not started</option></select></label><button className="text-btn" onClick={onExplore}>Change route <span>→</span></button></div></div><div className="stage-list">{stages.map((stage: any) => { const stageSkills = stage.skills.filter((skill: Skill) => visible.some((item: Skill) => item.id === skill.id)); return <section className="stage-section" key={stage.id}><div className="stage-rail"><span>{String(stage.number).padStart(2, '0')}</span><i></i></div><div className="stage-content"><div className="stage-heading"><div><span className="eyebrow">STAGE {String(stage.number).padStart(2, '0')}</span><h3>{stage.label}</h3><p>{stage.description}</p></div><div className="stage-stat"><strong>{stage.completed}/{stage.total}</strong><span>MODULES DONE</span><div className="progress-track"><i style={{width: `${stage.progress}%`}} /></div></div></div>{stageSkills.length ? <div className="module-grid">{stageSkills.map((skill: Skill) =>     <ModuleCard key={skill.id} skill={skill} progress={progress} current={current} next={next} onOpen={() => onOpenSkill(skill, roadmap)} />)}</div> : <div className="empty-stage">No modules match this filter.</div>}</div></section>; })}</div></section><div className="sheet-scrim" aria-hidden={!selectedSkill} onClick={() => setSelected(null)}></div><Inspector skill={selectedSkill} roadmap={roadmap} progress={progress} complete={complete} toggleItem={toggleItem} setCurrent={setCurrent} setSelected={setSelected} /></>;
}
function ModuleCard({ skill, progress, current, next, onOpen }: any) {
  const rawStatus = statusOf(progress, skill.id); const percent = moduleProgress(skill, progress);
  const visualStatus = percent >= 100 ? 'completed' : percent > 0 ? 'in-progress' : 'not-started';
  const stateLabel = visualStatus === 'completed' ? 'COMPLETED' : visualStatus === 'in-progress' ? 'IN PROGRESS' : 'NOT STARTED';
  return <button aria-label={`Open ${skill.name} learning module`} className={`module-card ${visualStatus} ${!skill.required ? 'optional' : ''}`} onClick={onOpen}><div className="module-top"><span className="module-state">{stateLabel}</span><span className="module-level">{skill.level}</span></div><h4>{skill.name}</h4><div className="module-meta"><span>{skill.subtopics?.length ?? 0} checklist items</span><span>{skill.hours}h</span></div><div className="module-progress"><i style={{width: `${percent}%`}} /></div><div className="module-foot"><span>{percent}% complete</span>{!skill.required && <span>Optional</span>}<span className="module-open-cue">Open module -&gt;</span></div></button>;
}

function Minimap({ layout, progress, current, next, onFocus }: any) {
  return <aside className="minimap" aria-label="Route minimap"><div className="minimap-head"><span>ROUTE OVERVIEW</span><small>{layout.sections.length} STAGES</small></div><div className="minimap-track">{layout.skills.map((s: any) => { const status = statusOf(progress, s.id); return <button key={s.id} aria-label={`Focus ${s.name}`} className={`mini-node ${status} ${current?.id === s.id ? 'current' : ''} ${next?.id === s.id ? 'next' : ''}`} style={{ left: `${Math.min(94, 5 + s.column * 18)}%`, top: `${7 + s.row * 13}%` }} onClick={() => onFocus(s.id)} />; })}<i className="mini-viewport" /></div><div className="minimap-key"><span><i className="mini-current" /> current</span><span><i className="mini-complete" /> complete</span></div></aside>;
}

function SkillPage({ skill, roadmap, progress, toggleItem, complete, onBack }: any) {
  return <section className="page skill-page">  <button className="back" onClick={onBack}>Back to Roadmap</button><div className="skill-page-inspector"><Inspector skill={skill} roadmap={roadmap} progress={progress} complete={complete} toggleItem={toggleItem} setCurrent={() => complete(skill.id, 'in-progress')} setSelected={() => undefined} /></div></section>;
}

function Inspector({ skill, roadmap, progress, complete, toggleItem, setCurrent, setSelected }: any) {
  const [tab, setTab] = React.useState<'overview'|'study'|'practice'|'build'|'prove'>('overview');
  if (!skill) return <aside className="detail empty-detail"><div className="eyebrow">SELECT A NODE</div><h2>Choose a skill to inspect</h2><p>Prerequisites, unlocks, mastery and the next action appear here.</p></aside>;
  const st = statusOf(progress, skill.id);
  const visualStatus = checklistProgress(skill, progress) >= 100 ? 'completed' : checklistProgress(skill, progress) > 0 ? 'in-progress' : 'not-started';
  const unlocks = roadmap.skills.filter((s: Skill) => s.prerequisites.includes(skill.id));
  const items: any[] = skill.subtopics ?? [];
  const done = items.filter((item: any) => progress[skill.id]?.checklist?.[item.id]).length;
  const shown = tab === 'overview' ? [] : items.filter((item: any) => item.type === tab);
  return <aside className="detail" role="dialog" aria-label={`${skill.name} inspector`}><button className="close-detail" aria-label="Close inspector" onClick={() => setSelected(null)}>X</button><div className="eyebrow">LEARNING MODULE</div><div className={`skill-status ${visualStatus}`}><div><small>{skill.stage ?? skill.category} - {skill.level}</small><h2>{skill.name}</h2><span className="module-state">{visualStatus === 'completed' ? 'COMPLETED' : visualStatus === 'in-progress' ? 'IN PROGRESS' : 'NOT STARTED'}</span></div></div><p className="detail-copy">{skill.description}</p><div className="why"><span>WHY THIS MATTERS</span><p>{skill.whyItMatters}</p></div><div className="detail-grid"><div><span>EST. TIME</span><strong>{skill.hours}h</strong></div><div><span>PROGRESS</span><strong className="lime-text">{done}/{items.length}  -  {checklistProgress(skill, progress)}%</strong></div></div><div className="inspector-tabs" role="tablist">{(['overview','study','practice','build','prove'] as const).map(value => <button role="tab" aria-selected={tab === value} className={tab === value ? 'active' : ''} key={value} onClick={() => setTab(value)}>{value}</button>)}</div>{tab === 'overview' ? <><div className="list-block"><span>TOPICS TO STUDY <b>{skill.topics?.length ?? 0}</b></span>  {(skill.topics ?? []).map((topic: string) => <div className="list-row" key={topic}><i>-</i>{topic}</div>)}</div><div className="list-block"><span>UNLOCKS <b>{unlocks.length}</b></span>{unlocks.slice(0, 3).map((s: Skill) => <div className="list-row" key={s.id}><i>-&gt;</i>{s.name}<small>{s.required ? 'REQUIRED' : 'OPTIONAL'}</small></div>)}</div></> : <div className="checklist" role="group" aria-label={`${tab} checklist`}>{  shown.map((item: any) => <label className="check-row" key={item.id}><input type="checkbox" checked={Boolean(progress[skill.id]?.checklist?.[item.id])} onChange={event => toggleItem(skill.id, item.id, event.target.checked)} /><span>{item.title}</span>{item.required !== false && <small>REQUIRED</small>}</label>)}</div>}<div className="progress-track" aria-label={`${checklistProgress(skill, progress)} percent complete`}><i style={{ width: `${checklistProgress(skill, progress)}%` }} /></div><p className="completion-note">{skill.completionCriteria} {!requiredChecklistComplete(skill, progress) && st !== 'completed' ? 'Required items remain; completing anyway may leave this module incomplete.' : ''}</p><label className="mastery-control">MASTERY <input type="range" min="0" max="100" value={mastery(skill, progress)} onChange={e => complete(skill.id, st, Number(e.target.value))} /></label>{  skill.resources?.map((resource: any) => <a className="resource-link" key={resource.url} href={resource.url} target="_blank" rel="noreferrer">{resource.official ? 'Official  -  ' : ''}{resource.label} -&gt;</a>)}<button className="primary full" onClick={() => { if (st !== 'completed' && !requiredChecklistComplete(skill, progress) && !window.confirm('Required checklist items are incomplete. Mark this module complete anyway?')) return; complete(skill.id, st === 'completed' ? 'not-started' : 'completed'); }}>{st === 'completed' ? 'Reset progress' : 'Mark module complete'} <span>-&gt;</span></button>{st !== 'completed' && <button className="text-btn" onClick={() => complete(skill.id, 'in-progress')}>Start learning <span>-&gt;</span></button>}{st !== 'completed' && <button className="text-btn" onClick={() => setCurrent(skill.id)}>Set as current <span>-&gt;</span></button>}</aside>;
}

function Explore({ active, choose }: { active: string; choose: (id: string) => void }) { return <section className="page"><div className="page-kicker">EXPLORE / CAREER DESTINATIONS</div><h1>EXPLORE THE<br /><i>MAP.</i></h1><p className="page-intro">Choose a destination. We'll show you the terrain.</p><div className="career-grid">{roadmaps.map((r, i) => <button className={`career-card ${active === r.id ? 'chosen' : ''}`} key={r.id} onClick={() => choose(r.id)}><span className="career-index lime">0{i + 1}</span><span className="career-type">{r.skills.length} NODES</span><h2>{r.name}</h2><p>{r.blurb}</p><small>{r.skills.length} skills  -  {r.skills.reduce((n, s) => n + s.hours, 0)}h  -  {active === r.id ? 'YOUR ROUTE' : 'AVAILABLE'}</small><strong>{active === r.id ? 'Open route' : 'Choose route'} -&gt;</strong></button>)}</div></section>; }
function Profile({ roadmap, progress, profile, setProfile, current, onResetProgress, onResetEverything }: any) { return <section className="page"><div className="page-kicker">PROFILE / YOUR SIGNAL</div><h1>YOUR<br /><i>POSITION.</i></h1><div className="profile-layout"><div className="profile-score"><span>READINESS SCORE</span><strong>{readiness(roadmap.skills, progress)}<small>/100</small></strong><p>{current ? `NEXT: ${current.name}` : 'ROUTE COMPLETE'}</p></div><div className="dna-large">{Object.entries(skillDNA(roadmap.skills, progress)).map(([k, v]) => <div className="dna-line" key={k}><div><span>{k}</span><b>{v}%</b></div><div className="bar"><i style={{ width: `${v}%` }}></i></div><small>Weighted mastery signal</small></div>)}<div className="readiness"><span>LOCAL PROFILE</span><h2>{profile.name}</h2><label className="text-input">DISPLAY NAME<input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} /></label></div></div></div><section className="danger-zone"><span className="eyebrow">DANGER ZONE</span><h2>Reset your local Waypoint state</h2><p>Progress can be restarted without losing your profile. Reset Everything clears this app's local data and returns to onboarding.</p><div><button className="danger-button" onClick={() => { if (window.confirm('RESET PROGRESS?\\n\\nThis clears roadmap completion but preserves your profile.')) onResetProgress(); }}>Reset Progress</button><button className="danger-button" onClick={() => { if (window.confirm('RESET WAYPOINT?\\n\\nThis permanently clears your local profile, roadmap progress and preferences on this device.')) onResetEverything(); }}>Reset Everything</button></div></section></section>; }
function Compare({ roadmap, progress, choose }: any) { return <section className="page"><div className="page-kicker">COMPARE / TERRAIN REPORT</div><h1>CHOOSE YOUR<br /><i>ROUTE.</i></h1><p className="page-intro">See the effort, depth and destination before you commit.</p><div className="compare-table"><div className="compare-head"><span>ROUTE</span><strong>SKILLS</strong><span>HOURS</span></div>{roadmaps.slice(0, 5).map((r: Roadmap) => <button className="compare-row" key={r.id} onClick={() => choose(r.id)}><b>{r.name}</b><span>{r.skills.length}</span><span>{r.skills.reduce((n, s) => n + s.hours, 0)}h</span></button>)}</div></section>; }
function Onboarding({ profile, onDone }: { profile: Profile; onDone: (p: Profile) => void }) { const [p, setP] = useState(profile); return <div className="onboarding"><div className="onboard-card"><div className="brand"><span className="brand-mark">-&gt;</span><span>WAYPOINT</span><small>DEV NAV ENGINE</small></div><span className="eyebrow">INITIALIZE YOUR ROUTE</span><h1>WHERE DO YOU<br /><i>WANT TO GO?</i></h1><p>Pick a destination. You can change course any time.</p><label>DESTINATION<select value={p.career} onChange={e => setP({ ...p, career: e.target.value })}>{roadmaps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label>YOUR NAME<input value={p.name} onChange={e => setP({ ...p, name: e.target.value })} /></label><button className="primary" onClick={() => onDone(p)}>Plot my route <span>-&gt;</span></button></div></div>; }
createRoot(document.getElementById('root')!).render(<App />);

