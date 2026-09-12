export type SkillStatus = 'not-started' | 'in-progress' | 'completed';
export type EngineSkill = {id:string; prerequisites:string[]; importance:number; careerRelevance:number; estimatedHours:number};
export type ChecklistType = 'study' | 'practice' | 'build' | 'prove';
export type ChecklistItem = { id: string; title: string; type: ChecklistType; required?: boolean };
export type Resource = { label: string; url: string; official?: boolean };
export type Skill = {
  id: string; name: string; category: string; level: 'Beginner'|'Intermediate'|'Advanced';
  hours: number; estimatedHours?: number; importance: number; required: boolean; careerRelevance: number;
  prerequisites: string[]; tags: string[]; tier?: 'Core'|'Important'|'Optional'; description?: string;
  whyItMatters?: string; stage?: string; topics?: string[]; subtopics?: ChecklistItem[];
  practiceExercises?: string[]; buildTasks?: string[]; proveCriteria?: string[];
  completionCriteria?: string; resources?: Resource[];
};
export type Roadmap = { id: string; name: string; slug: string; blurb: string; skills: Skill[] };
export type SkillRouteMatch = { skill: Skill; roadmap: Roadmap };
export function skillPath(skillId: string) { return `/skill/${encodeURIComponent(skillId)}`; }
export function roadmapPath(roadmapId: string) { return `/roadmap/${encodeURIComponent(roadmapId)}`; }
export function findSkillById(roadmaps: Roadmap[], skillId: string): SkillRouteMatch | null {
  const decoded = decodeURIComponent(skillId);
  for (const roadmap of roadmaps) {
    const skill = roadmap.skills.find(item => item.id === decoded);
    if (skill) return { skill, roadmap };
  }
  return null;
}
export function resolveSkillRoute(pathname: string, roadmaps: Roadmap[]): SkillRouteMatch | null {
  const match = pathname.match(/^\/skill\/([^/?#]+)/);
  return match ? findSkillById(roadmaps, match[1]) : null;
}
/** Persisted state for one route. Progress is route-local, while mastery is
 * resolved globally by `effectiveProgress` for skills shared by routes. */
export type RouteStatus = 'active' | 'paused' | 'completed';
export type RouteState = {
  routeId: string;
  active: boolean;
  status: RouteStatus;
  progress: Progress;
  currentSkill: string | null;
  startedAt: string;
  lastVisitedAt: string;
};
export type WaypointState = {
  version: 3;
  primaryRoute: string | null;
  routes: Record<string, RouteState>;
  globalMastery: Record<string, number>;
};
export type RouteSummary = RouteState & {
  roadmap: Roadmap;
  progressPercent: number;
  current: Skill | null;
  next: Skill | null;
  remainingHours: number;
};
export type LayoutSkill = Skill & { section: string; row: number; column: number; x: number; y: number };
export type RoadmapSection = { id: string; label: string; description: string; skills: string[] };
export type RoadmapLayout = { skills: LayoutSkill[]; sections: RoadmapSection[]; width: number; height: number };
export type RoadmapStage = {
  id: string;
  number: number;
  label: string;
  description: string;
  skills: Skill[];
  completed: number;
  total: number;
  progress: number;
};
export type SkillProgress = { status: SkillStatus; mastery: number; checklist?: Record<string, boolean>; updatedAt?: string };
export type Progress = Record<string, SkillProgress>;
export function emptySkillProgress(skill?: Skill): SkillProgress {
  return { status: 'not-started', mastery: 0, checklist: Object.fromEntries((skill?.subtopics ?? []).map(item => [item.id, false])) };
}
export function normalizeProgress(progress: Partial<Progress> | undefined, skills: Skill[] = []): Progress {
  const result: Progress = {};
  Object.entries(progress ?? {}).forEach(([id, value]) => {
    const raw = value as Partial<SkillProgress> & { checklist?: Record<string, boolean> };
    const skill = skills.find(item => item.id === id);
    const checklist = { ...Object.fromEntries((skill?.subtopics ?? []).map(item => [item.id, false])), ...(raw.checklist ?? {}) };
    result[id] = { status: raw.status ?? 'not-started', mastery: Math.max(0, Math.min(100, raw.mastery ?? 0)), checklist, ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}) };
  });
  skills.forEach(skill => { if (!result[skill.id]) result[skill.id] = emptySkillProgress(skill); });
  return result;
}
export function checklistProgress(skill: Skill, progress: Progress) {
  const items = skill.subtopics ?? [];
  if (!items.length) return mastery(skill, progress);
  const completed = items.filter(item => progress[skill.id]?.checklist?.[item.id]).length;
  return Math.round(completed / items.length * 100);
}
export function requiredChecklistComplete(skill: Skill, progress: Progress) {
  return (skill.subtopics ?? []).filter(item => item.required !== false).every(item => Boolean(progress[skill.id]?.checklist?.[item.id]));
}
export function moduleProgress(skill: Skill, progress: Progress) {
  return Math.max(checklistProgress(skill, progress), mastery(skill, progress));
}
/** Groups a route into its curriculum stages without changing route order. */
export function roadmapStages(skills: Skill[], progress: Progress): RoadmapStage[] {
  const groups = new Map<string, Skill[]>();
  skills.forEach(skill => {
    const label = (skill.stage ?? skill.category).trim() || 'Learning path';
    groups.set(label, [...(groups.get(label) ?? []), skill]);
  });
  return [...groups.entries()].map(([label, stageSkills], index) => {
    const completed = stageSkills.filter(skill => moduleProgress(skill, progress) >= 100).length;
    const total = stageSkills.length;
    return {
      id: `stage-${index + 1}-${label.toLowerCase().replace(/\W+/g, '-')}`,
      number: index + 1,
      label,
      description: `${stageSkills.filter(skill => skill.required).length} required · ${stageSkills.reduce((hours, skill) => hours + skill.hours, 0)} hours`,
      skills: stageSkills,
      completed,
      total,
      progress: total ? Math.round(stageSkills.reduce((sum, skill) => sum + moduleProgress(skill, progress), 0) / total) : 0,
    };
  });
}
export function toggleChecklist(progress: Progress, skill: Skill, itemId: string, checked: boolean): Progress {
  const current = normalizeProgress(progress, [skill])[skill.id];
  const nextChecklist = { ...current.checklist, [itemId]: checked };
  const nextMastery = checklistProgress(skill, { [skill.id]: { ...current, checklist: nextChecklist } });
  return { ...progress, [skill.id]: { ...current, checklist: nextChecklist, mastery: nextMastery, status: nextMastery >= 100 ? 'completed' : nextMastery > 0 ? 'in-progress' : 'not-started', updatedAt: new Date().toISOString() } };
}
export function seedKnownProgress(skills: Skill[], knownSkills: string[], existing: Progress = {}): Progress {
  const known = new Set(knownSkills.map(value => value.trim().toLowerCase()));
  const seeded = { ...existing };
  skills.forEach(skill => {
    const matches = [skill.name, ...skill.tags].some(value => known.has(value.toLowerCase()));
    if (matches && !Object.prototype.hasOwnProperty.call(existing, skill.id)) {
      seeded[skill.id] = skill.subtopics?.length
        ? { ...emptySkillProgress(skill), status: 'completed', mastery: 100, checklist: Object.fromEntries(skill.subtopics.map(item => [item.id, true])) }
        : { status: 'completed', mastery: 100 };
    }
  });
  return seeded;
}

export function statusOf(progress: Progress, id: string): SkillStatus { return progress[id]?.status ?? 'not-started'; }
export function prerequisitesMet(skill: Skill, progress: Progress) {
  return skill.prerequisites.every(id => statusOf(progress, id) === 'completed');
}
export function mastery(skill: Skill, progress: Progress) { return progress[skill.id]?.mastery ?? 0; }
export function weightedProgress(skills: Skill[], progress: Progress) {
  const total = skills.reduce((n, s) => n + s.hours * (s.required ? 1.25 : .7) * s.importance, 0);
  const done = skills.reduce((n, s) => n + (moduleProgress(s, progress) / 100) * s.hours * (s.required ? 1.25 : .7) * s.importance, 0);
  return total ? Math.round(done / total * 100) : 0;
}
/** Deterministic lane layout used by the roadmap renderer. */
export function roadmapLayout(skills: Skill[], columns = 5): RoadmapLayout {
  const safeColumns = Math.max(1, columns);
  const groups = [...new Set(skills.map(skill => skill.category))];
  const byGroup = new Map(groups.map(group => [group, skills.filter(skill => skill.category === group)]));
  const laidOut: LayoutSkill[] = [];
  const sections: RoadmapSection[] = [];
  let visualRow = 0;
  groups.forEach((group) => {
    const groupSkills = byGroup.get(group) ?? [];
    const sectionId = `section-${sections.length + 1}`;
    sections.push({ id: sectionId, label: group, description: `${groupSkills.length} skills`, skills: groupSkills.map(skill => skill.id) });
    groupSkills.forEach((skill, index) => {
      const column = index % safeColumns;
      const row = visualRow + Math.floor(index / safeColumns);
      laidOut.push({
        ...skill,
        section: sectionId,
        row,
        column,
        x: 76 + column * 196,
        y: 82 + row * 158,
      });
    });
    visualRow += Math.max(1, Math.ceil(groupSkills.length / safeColumns));
  });
  return { skills: laidOut, sections, width: safeColumns * 196 + 170, height: Math.max(520, visualRow * 158 + 120) };
}
export function currentPosition(skills: Skill[], progress: Progress) {
  return skills.find(s => statusOf(progress, s.id) === 'in-progress') ??
    [...skills].reverse().find(s => statusOf(progress, s.id) === 'completed') ?? null;
}
export function nextBestStep(skills: Skill[] | EngineSkill[], progress: Progress | Set<string>) {
  const state:Progress = progress instanceof Set ? Object.fromEntries([...progress].map(id=>[id,{status:'completed',mastery:100}])) : progress;
  return skills.filter(s => statusOf(state, s.id) !== 'completed' && s.prerequisites.every(id => statusOf(state,id)==='completed'))
    .sort((a, b) => (b.importance * b.careerRelevance / ('hours' in b ? b.hours : b.estimatedHours)) - (a.importance * a.careerRelevance / ('hours' in a ? a.hours : a.estimatedHours)))[0] ?? null;
}
export function readiness(skills: Skill[] | string[], progress: Progress | number) {
  if (Array.isArray(skills) && (skills.length === 0 || typeof skills[0] === 'string')) return progress ? Math.round((skills.length / (progress as number)) * 100) : 0;
  skills = skills as Skill[]; progress = progress as Progress;
  const required = skills.filter(s => s.required);
  return required.length ? Math.round(required.reduce((n, s) => n + mastery(s, progress as Progress) * s.importance, 0) / required.reduce((n, s) => n + s.importance, 0)) : 0;
}
export function skillDNA(skills: Skill[], progress: Progress) {
  const groups: Record<string, {sum:number; weight:number}> = {};
  skills.forEach(s => { const g = groups[s.category] ??= {sum:0, weight:0}; g.sum += mastery(s, progress) * s.importance; g.weight += s.importance; });
  return Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, Math.round(v.sum / v.weight)]));
}
export function dontLearnYet(skills: Skill[], progress: Progress) {
  return skills.filter(s => statusOf(progress, s.id) === 'not-started' && !prerequisitesMet(s, progress))
    .map(s => {
      const missing = s.prerequisites.filter(p => statusOf(progress, p) !== 'completed');
      return { skill: s, missing, reason: `Complete ${missing.map(p => skills.find(x => x.id === p)?.name ?? p).join(', ')} first` };
    });
}
export function nextUnlocks(skills: Skill[], progress: Progress, limit = 4) {
  const next = nextBestStep(skills, progress);
  if (!next) return [];
  return skills.filter(s => s.prerequisites.includes(next.id)).slice(0, limit);
}
export const STORAGE_KEYS = {
  profile: 'profile', career: 'career', onboarded: 'onboarded', preferences: 'preferences',
  progressPrefix: 'progress:',
} as const;
export function progressKey(roadmapId: string) { return `${STORAGE_KEYS.progressPrefix}${roadmapId}`; }
export function search<T extends {name:string; tags?:string[]; slug?:string}>(items:T[], query:string) {
  const q = query.trim().toLowerCase(); return q ? items.filter(i => `${i.name} ${(i.tags||[]).join(' ')} ${i.slug||''}`.toLowerCase().includes(q)) : [];
}
export const storage = {
  get<T>(key:string, fallback:T):T { try { const v = localStorage.getItem(`waypoint:${key}`); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set<T>(key:string, value:T) { try { localStorage.setItem(`waypoint:${key}`, JSON.stringify(value)); } catch {} }
  ,remove(key:string) { try { localStorage.removeItem(`waypoint:${key}`); } catch {} }
  ,resetProgress(roadmapIds: string[]) { roadmapIds.forEach(id => storage.remove(progressKey(id))); }
  ,resetAll(roadmapIds: string[]) {
    storage.resetProgress(roadmapIds);
    storage.remove(WAYPOINT_STATE_KEY);
    [STORAGE_KEYS.profile, STORAGE_KEYS.career, STORAGE_KEYS.onboarded, STORAGE_KEYS.preferences].forEach(storage.remove);
  }
};

export const WAYPOINT_STATE_KEY = 'waypoint-state';
const now = () => new Date().toISOString();
export function emptyRouteState(routeId: string, skills: Skill[] = [], timestamp = now()): RouteState {
  return {
    routeId, active: true, status: 'active', currentSkill: null,
    progress: Object.fromEntries(skills.map(skill => [skill.id, { status: 'not-started', mastery: 0 }])),
    startedAt: timestamp, lastVisitedAt: timestamp,
  };
}

/** Resolve old `career` + `progress:<id>` data without destroying it. */
export function migrateWaypointState(
  saved: Partial<WaypointState> | null | undefined,
  roadmaps: Roadmap[],
  legacy?: { career?: string; progress?: Record<string, Progress> },
): WaypointState {
  const routes: Record<string, RouteState> = {};
  const input = saved?.routes ?? {};
  roadmaps.forEach(route => {
    const old = input[route.id];
    const legacyProgress = legacy?.progress?.[route.id];
    routes[route.id] = old ? {
      ...emptyRouteState(route.id, route.skills),
      ...old,
      progress: normalizeProgress({ ...emptyRouteState(route.id, route.skills).progress, ...(old.progress ?? {}) }, route.skills),
    } : legacyProgress ? {
      ...emptyRouteState(route.id, route.skills),
      progress: normalizeProgress(legacyProgress, route.skills),
      active: route.id === (legacy?.career ?? roadmaps[0]?.id),
    } : emptyRouteState(route.id, route.skills);
  });
  const primary = saved?.primaryRoute ?? legacy?.career ?? roadmaps.find(r => routes[r.id]?.active)?.id ?? null;
  return {
    version: 3,
    primaryRoute: primary && routes[primary] ? primary : roadmaps[0]?.id ?? null,
    routes,
    globalMastery: { ...(saved?.globalMastery ?? {}) },
  };
}

export function loadWaypointState(roadmaps: Roadmap[]): WaypointState {
  const saved = storage.get<Partial<WaypointState> | null>(WAYPOINT_STATE_KEY, null);
  const legacyProgress: Record<string, Progress> = {};
  roadmaps.forEach(route => { legacyProgress[route.id] = storage.get(progressKey(route.id), {}); });
  const state = migrateWaypointState(saved, roadmaps, {
    career: storage.get<string>(STORAGE_KEYS.career, roadmaps[0]?.id),
    progress: legacyProgress,
  });
  storage.set(WAYPOINT_STATE_KEY, state);
  return state;
}

export function saveWaypointState(state: WaypointState) { storage.set(WAYPOINT_STATE_KEY, { ...state, version: 3 }); }
export function routeProgress(state: WaypointState, routeId: string): Progress {
  return state.routes[routeId]?.progress ?? {};
}
export function sharedSkillId(skill: Skill): string {
  // Route-prefixed IDs are retained for graph identity, but tags provide the
  // stable cross-route identity. This also handles legacy route data.
  return skill.tags?.[0]?.toLowerCase() || skill.name.toLowerCase().replace(/\W+/g, '-');
}
export function effectiveProgress(route: Roadmap, routeState: RouteState, allRoutes: Roadmap[], state: WaypointState): Progress {
  const result = { ...routeState.progress };
  route.skills.forEach(skill => {
    const key = sharedSkillId(skill);
    const global = state.globalMastery[key];
    if (typeof global === 'number' && global > (result[skill.id]?.mastery ?? 0)) {
      result[skill.id] = { ...emptySkillProgress(skill), ...(result[skill.id] ?? {}), status: global >= 100 ? 'completed' : 'in-progress', mastery: global };
    }
  });
  return result;
}
export function completeRouteSkill(state: WaypointState, route: Roadmap, skillId: string, status: SkillStatus, masteryValue = status === 'completed' ? 100 : 20): WaypointState {
  const current = state.routes[route.id] ?? emptyRouteState(route.id, route.skills);
  const skill = route.skills.find(item => item.id === skillId);
  if (!skill) return state;
  const mastery = Math.max(0, Math.min(100, masteryValue));
  const progress = { ...current.progress, [skillId]: { ...emptySkillProgress(skill), ...(current.progress[skillId] ?? {}), status, mastery, checklist: status === 'completed' ? Object.fromEntries((skill.subtopics ?? []).map(item => [item.id, true])) : (current.progress[skillId]?.checklist ?? {}) } };
  const key = sharedSkillId(skill);
  const globalMastery = { ...state.globalMastery, [key]: Math.max(state.globalMastery[key] ?? 0, mastery) };
  const timestamp = now();
  return { ...state, globalMastery, routes: { ...state.routes, [route.id]: { ...current, progress, currentSkill: status === 'in-progress' ? skillId : current.currentSkill, lastVisitedAt: timestamp } } };
}
export function activateRoute(state: WaypointState, routeId: string, skills: Skill[] = [], primary = false): WaypointState {
  const existing = state.routes[routeId] ?? emptyRouteState(routeId, skills);
  const routes: Record<string, RouteState> = { ...state.routes, [routeId]: { ...existing, active: true, status: (existing.status === 'completed' ? 'completed' : 'active') as RouteStatus, lastVisitedAt: now() } };
  return { ...state, routes, primaryRoute: primary || !state.primaryRoute ? routeId : state.primaryRoute };
}
export function setPrimaryRoute(state: WaypointState, routeId: string): WaypointState {
  return state.routes[routeId]?.active ? { ...state, primaryRoute: routeId } : state;
}
export function setRouteStatus(state: WaypointState, routeId: string, status: RouteStatus): WaypointState {
  const route = state.routes[routeId]; if (!route) return state;
  return { ...state, routes: { ...state.routes, [routeId]: { ...route, status, active: status !== 'completed' || route.active, lastVisitedAt: now() } } };
}
export function removeRoute(state: WaypointState, routeId: string): WaypointState {
  const route = state.routes[routeId]; if (!route) return state;
  const routes = { ...state.routes, [routeId]: { ...route, active: false, status: 'paused' as RouteStatus } };
  const primaryRoute = state.primaryRoute === routeId ? Object.values(routes).find(item => item.active)?.routeId ?? null : state.primaryRoute;
  return { ...state, routes, primaryRoute };
}
export function resetRouteProgress(state: WaypointState, routeId: string, skills: Skill[]): WaypointState {
  const route = state.routes[routeId]; if (!route) return state;
  return { ...state, routes: { ...state.routes, [routeId]: { ...route, progress: emptyRouteState(routeId, skills).progress, currentSkill: null, status: 'active', lastVisitedAt: now() } } };
}
export function resetAllRouteProgress(state: WaypointState, roadmaps: Roadmap[]): WaypointState {
  const routes = { ...state.routes };
  roadmaps.forEach(route => { if (routes[route.id]) routes[route.id] = { ...routes[route.id], progress: emptyRouteState(route.id, route.skills).progress, currentSkill: null, status: 'active' }; });
  return { ...state, routes, globalMastery: {} };
}
export function routeSummary(route: Roadmap, state: WaypointState): RouteSummary {
  const rs = state.routes[route.id] ?? emptyRouteState(route.id, route.skills);
  const progress = effectiveProgress(route, rs, [route], state);
  const current = rs.currentSkill ? route.skills.find(s => s.id === rs.currentSkill) ?? currentPosition(route.skills, progress) : currentPosition(route.skills, progress);
  const next = nextBestStep(route.skills, progress) as Skill | null;
  return { ...rs, roadmap: route, progressPercent: weightedProgress(route.skills, progress), current, next, remainingHours: route.skills.reduce((sum, skill) => sum + (mastery(skill, progress) < 100 ? skill.hours : 0), 0) };
}
export function recommendRoutes(roadmaps: Roadmap[], state: WaypointState, limit = 4): Roadmap[] {
  return roadmaps.filter(route => !state.routes[route.id]?.active).map(route => ({ route, score: (nextBestStep(route.skills, effectiveProgress(route, state.routes[route.id] ?? emptyRouteState(route.id, route.skills), roadmaps, state)) ? 2 : 0) + route.skills.filter(s => state.globalMastery[sharedSkillId(s)]).length / Math.max(1, route.skills.length) })).sort((a, b) => b.score - a.score).slice(0, limit).map(item => item.route);
}
export function validateRoadmaps(roadmaps: Roadmap[]) {
  const ids = new Set<string>(); const errors: string[] = [];
  roadmaps.forEach(route => route.skills.forEach(skill => {
    if (ids.has(skill.id)) errors.push(`Duplicate skill id: ${skill.id}`); ids.add(skill.id);
    if (!skill.description?.trim()) errors.push(`${route.id}:${skill.id} missing description`);
    if (!skill.stage?.trim()) errors.push(`${route.id}:${skill.id} missing stage`);
    if (!skill.hours || skill.hours <= 0) errors.push(`${route.id}:${skill.id} missing estimated time`);
    if (!skill.completionCriteria?.trim()) errors.push(`${route.id}:${skill.id} missing completion criteria`);
    const subtopics = skill.subtopics ?? [];
    if (!subtopics.length) errors.push(`${route.id}:${skill.id} missing subtopics`);
    const subIds = new Set<string>();
    subtopics.forEach(item => { if (subIds.has(item.id)) errors.push(`${route.id}:${skill.id} duplicate checklist id ${item.id}`); subIds.add(item.id); if (!item.title.trim()) errors.push(`${route.id}:${skill.id} empty checklist title`); });
    (skill.resources ?? []).forEach(resource => { if (!/^https:\/\//.test(resource.url)) errors.push(`${route.id}:${skill.id} resource must use https: ${resource.url}`); });
    skill.prerequisites.forEach(pre => { if (!route.skills.some(candidate => candidate.id === pre)) errors.push(`${route.id}:${skill.id} missing prerequisite ${pre}`); });
  }));
  roadmaps.forEach(route => {
    const visiting = new Set<string>(); const visited = new Set<string>();
    const visit = (id: string): boolean => { if (visiting.has(id)) return true; if (visited.has(id)) return false; visiting.add(id); const skill = route.skills.find(item => item.id === id); const cycle = Boolean(skill?.prerequisites.some(visit)); visiting.delete(id); visited.add(id); return cycle; };
    route.skills.forEach(skill => { if (visit(skill.id)) errors.push(`${route.id}: prerequisite cycle`); });
  });
  return { valid: errors.length === 0, errors };
}
