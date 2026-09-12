import {describe, expect, it, beforeEach} from 'vitest';
import {currentPosition, dontLearnYet, nextBestStep, nextUnlocks, prerequisitesMet, readiness, roadmapLayout, roadmapStages, search, seedKnownProgress, storage, weightedProgress, progressKey, toggleChecklist, checklistProgress, requiredChecklistComplete, validateRoadmaps, findSkillById, resolveSkillRoute, skillPath} from './engine';

const skills:any[] = [
  {id:'a', name:'A', category:'Core', level:'Beginner', hours:2, importance:5, required:true, careerRelevance:5, prerequisites:[], tags:['Java']},
  {id:'b', name:'B', category:'Core', level:'Intermediate', hours:4, importance:3, required:true, careerRelevance:5, prerequisites:['a'], tags:['SQL']},
  {id:'c', name:'C', category:'Optional', level:'Advanced', hours:1, importance:1, required:false, careerRelevance:1, prerequisites:['b'], tags:['Docker']},
];

describe('navigation engine', () => {
  beforeEach(() => {
    const values = new Map<string,string>();
    (globalThis as any).localStorage = {
      getItem: (key:string) => values.get(key) ?? null,
      setItem: (key:string, value:string) => values.set(key, value),
      removeItem: (key:string) => values.delete(key),
      clear: () => values.clear(),
    };
    localStorage.clear();
  });
  it('calculates weighted progress rather than node count', () => {
    expect(weightedProgress(skills, {a:{status:'completed',mastery:100},b:{status:'not-started',mastery:0},c:{status:'not-started',mastery:0}})).toBe(44);
  });
  it('tracks prerequisites, current position, and next step', () => {
    expect(prerequisitesMet(skills[1], {})).toBe(false);
    expect(currentPosition(skills, {a:{status:'completed',mastery:100}})?.id).toBe('a');
    expect(nextBestStep(skills, {a:{status:'completed',mastery:100}})?.id).toBe('b');
  });
  it('persists values through the storage adapter', () => {
    storage.set('profile', {name:'Developer', knownSkills:['Java']});
    expect(storage.get('profile', {name:'Fallback'})).toEqual({name:'Developer', knownSkills:['Java']});
  });
  it('searches names and technology tags', () => {
    expect(search(skills, 'docker')).toHaveLength(1);
  });
  it('seeds known skills without overwriting saved progress', () => {
    const seeded = seedKnownProgress(skills, ['Java', 'SQL'], {b:{status:'in-progress',mastery:40}});
    expect(seeded.a).toEqual({status:'completed', mastery:100});
    expect(seeded.b).toEqual({status:'in-progress', mastery:40});
  });
  it('calculates readiness from required mastery and exposes blocked prerequisites', () => {
    expect(readiness(skills, {a:{status:'completed',mastery:100},b:{status:'not-started',mastery:0}})).toBe(63);
    expect(dontLearnYet(skills, {a:{status:'not-started',mastery:0}})[0].skill.id).toBe('b');
  });
  it('returns no false search matches for an empty query', () => {
    expect(search(skills, '')).toHaveLength(0);
  });
  it('creates stable lane metadata without overlapping columns', () => {
    const first = roadmapLayout(skills);
    const second = roadmapLayout(skills);
    expect(first).toEqual(second);
    expect(first.sections.map(section => section.label)).toEqual(['Core', 'Optional']);
    expect(new Set(first.skills.map(skill => `${skill.x}:${skill.y}`)).size).toBe(first.skills.length);
    expect(first.width).toBeGreaterThan(0);
    expect(first.height).toBeGreaterThan(0);
    expect(Math.max(...first.skills.map(skill => skill.x))).toBeLessThan(first.width);
    expect(Math.max(...first.skills.map(skill => skill.y))).toBeLessThan(first.height);
  });
  it('groups modules into ordered stages and calculates stage progress', () => {
    const stages = roadmapStages(skills, {
      a: {status:'completed', mastery:100},
      b: {status:'in-progress', mastery:40},
      c: {status:'not-started', mastery:0},
    });
    expect(stages.map(stage => stage.label)).toEqual(['Core', 'Optional']);
    expect(stages[0].completed).toBe(1);
    expect(stages[0].total).toBe(2);
    expect(stages[0].progress).toBe(70);
    expect(stages[1].progress).toBe(0);
  });
  it('derives deferred reasons and the next unlocks from prerequisites', () => {
    const progress = {a:{status:'completed',mastery:100} as const};
    expect(dontLearnYet(skills, progress)[0].missing).toEqual(['b']);
    expect(nextUnlocks(skills, progress).map(s => s.id)).toEqual(['c']);
  });
  it('resets only Waypoint-owned progress and state', () => {
    storage.set(progressKey('route'), {a:{status:'completed', mastery:100}});
    storage.set('profile', {name:'A'});
    storage.set('preferences', {theme:'dark'});
    storage.resetProgress(['route']);
    expect(storage.get(progressKey('route'), null)).toBeNull();
    storage.set(progressKey('route'), {a:{status:'completed', mastery:100}});
    storage.resetAll(['route']);
    expect(storage.get('profile', null)).toBeNull();
    expect(storage.get('preferences', null)).toBeNull();
    expect(storage.get(progressKey('route'), null)).toBeNull();
  });
  it('recommends the newly unlocked skill after completion', () => {
    expect(nextBestStep(skills, {} as any)?.id).toBe('a');
    expect(nextBestStep(skills, {a:{status:'completed', mastery:100}})?.id).toBe('b');
    expect(nextBestStep(skills, {a:{status:'completed', mastery:100}, b:{status:'completed', mastery:100}})?.id).toBe('c');
  });
  it('tracks checklist items independently and derives completion', () => {
    const skill:any = {...skills[0], subtopics:[
      {id:'study', title:'Study', type:'study', required:true},
      {id:'optional', title:'Optional', type:'practice', required:false},
    ]};
    let progress:any = {};
    progress = toggleChecklist(progress, skill, 'study', true);
    expect(progress[skill.id].checklist).toEqual({study:true, optional:false});
    expect(checklistProgress(skill, progress)).toBe(50);
    expect(requiredChecklistComplete(skill, progress)).toBe(true);
  });
  it('validates module content and prerequisite cycles', () => {
    const skill:any = {...skills[0], description:'A module', stage:'FOUNDATIONS', completionCriteria:'Complete required work', subtopics:[{id:'one', title:'One', type:'study'}], resources:[{label:'Docs', url:'https://example.com'}]};
    const route:any = {id:'route', name:'Route', slug:'route', blurb:'Route', skills:[skill]};
    expect(validateRoadmaps([route]).valid).toBe(true);
    expect(validateRoadmaps([{...route, skills:[{...skill, prerequisites:['missing']}]}]).valid).toBe(false);
  });
  it('resolves module ids to stable internal skill routes', () => {
    const route:any = {id:'frontend', name:'Frontend', slug:'frontend', blurb:'', skills:[{...skills[0], id:'frontend-html'}]};
    expect(skillPath('frontend-html')).toBe('/skill/frontend-html');
    expect(findSkillById([route], 'frontend-html')?.roadmap.id).toBe('frontend');
    expect(resolveSkillRoute('/skill/frontend-html', [route])?.skill.name).toBe('A');
    expect(resolveSkillRoute('/skill/missing', [route])).toBeNull();
  });
});
