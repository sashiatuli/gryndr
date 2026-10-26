import { test, after, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer as netServer } from 'node:net'
import { spawn } from 'node:child_process'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

let backend, vite, temp, root, act, React, App, base, dom
const nativeFetch = globalThis.fetch
const requests = []
let failure = null
const scrollTargets = []
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function eventually(check, message = 'Expected UI update') {
  const deadline = Date.now() + 15000
  let last
  while (Date.now() < deadline) {
    await act(async () => { await delay(25) })
    try { const result = check(); if (result) return result } catch (e) { last = e }
  }
  throw last ?? new Error(message + '\n' + document.body.textContent.slice(-2500))
}
function button(text, within = document) {
  const result = [...within.querySelectorAll('button')].find(b => b.textContent.trim() === text)
  assert.ok(result, `Button not found: ${text}`)
  return result
}
async function click(element) { assert.ok(element); await act(async () => { element.click() }) }
async function value(element, next) {
  assert.ok(element)
  await act(async () => {
    const prototype = element.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, String(next))
    element.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    element.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  })
}
async function navigate(id) {
  await click(document.querySelector(`#nav-${id}`) ?? document.querySelector('a[href="#settings"]'))
}
async function idle() { await eventually(() => ![...document.querySelectorAll('button')].find(b => b.textContent === 'Refresh')?.disabled) }
async function json(path) { const r = await nativeFetch(base + path); assert.equal(r.status, 200); return r.json() }

before(async () => {
  temp = await mkdtemp(join(tmpdir(), 'gryndr-ui-'))
  const socket = netServer()
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
  const port = socket.address().port
  await new Promise(resolve => socket.close(resolve))
  base = `http://127.0.0.1:${port}`
  backend = spawn(join(process.cwd(), '.venv', 'Scripts', 'python.exe'), ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, GRYNDR_DATABASE_URL: `sqlite:///${join(temp, 'test.db').replaceAll('\\', '/')}`, GRYNDR_SEED_DEMO: '0' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  backend.stdout.on('data', b => { output += b }); backend.stderr.on('data', b => { output += b })
  let started = false
  for (let i = 0; i < 100; i++) {
    try { if ((await nativeFetch(base + '/health')).ok) { started = true; break } } catch {}
    if (backend.exitCode !== null) throw new Error(output)
    await delay(100)
  }
  assert.ok(started, output)
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost:5173/', pretendToBeVisual: true })
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Event', 'MouseEvent', 'FormData', 'MutationObserver', 'getComputedStyle']) {
    Object.defineProperty(globalThis, key, { configurable: true, value: typeof dom.window[key] === 'function' && key === 'getComputedStyle' ? dom.window[key].bind(dom.window) : dom.window[key] })
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  globalThis.requestAnimationFrame = cb => setTimeout(cb, 0)
  globalThis.cancelAnimationFrame = clearTimeout
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  dom.window.scrollTo = () => {}
  dom.window.HTMLElement.prototype.scrollIntoView = function () { scrollTargets.push(this) }
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input)
    requests.push({ path: new URL(url).pathname, method: options.method ?? 'GET' })
    const blocked = failure?.(url, options)
    if (blocked) return blocked
    return nativeFetch(input, options)
  }
  process.env.VITE_API_URL = base
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } })
  React = await import('react'); act = React.act
  const { createRoot } = await import('react-dom/client')
  App = (await vite.ssrLoadModule('/src/App.tsx')).default
  root = createRoot(document.getElementById('root'))
  await act(async () => root.render(React.createElement(App)))
  await idle()
})

after(async () => {
  if (root) await act(async () => root.unmount())
  globalThis.fetch = nativeFetch
  await vite?.close()
  if (backend && backend.exitCode === null) {
    const exited = new Promise(resolve => backend.once('exit', resolve))
    backend.kill(); await exited
  }
  dom?.window.close()
  // temp is generated by mkdtemp above, never a repository/user-data path.
  if (temp) await rm(temp, { recursive: true, force: true })
})

test('React journey uses the real API and persists changes', async t => {
  await t.test('sidebar navigation and subject/topic forms', async () => {
    await navigate('subjects')
    assert.equal(document.querySelector('h1').textContent, 'Subjects')
    const subjectForm = [...document.forms].find(f => f.querySelector('[name="exam_date"]'))
    await value(subjectForm.elements.name, 'UI integration subject')
    await click(button('Add subject', subjectForm)); await idle()
    const subjects = await json('/subjects')
    assert.equal(subjects.length, 1)
    assert.match(document.body.textContent, /UI integration subject/)
    const topicForm = [...document.forms].find(f => f.querySelector('[name="confidence"]'))
    await value(topicForm.elements.subject_id, subjects[0].id)
    await value(topicForm.elements.name, 'UI integration topic')
    await click(button('Add topic', topicForm)); await idle()
    const topics = await json('/topics')
    assert.equal(topics.length, 1)
    assert.equal(topics[0].name, 'UI integration topic')
  })
  await t.test('prediction submits and displays probabilities', async () => {
    await click(button('Predict difficulty')); await idle()
    assert.ok(requests.some(r => r.path === '/predict-difficulty' && r.method === 'POST'))
    const [topic] = await json('/topics')
    assert.ok(topic.predicted_difficulty)
    assert.match(document.body.textContent, /Probability scores saved/)
  })
  await t.test('generate, complete, quiz and replan update saved records', async () => {
    await navigate('planner')
    await click(button('Generate study plan')); await idle()
    assert.ok(scrollTargets.some(el => el.hasAttribute('data-session-list')), 'Generated schedule should be revealed')
    const sessions = await json('/study-plan')
    assert.ok(sessions.length > 0)
    assert.match(document.body.textContent, /UI integration topic/)
    await click(button('Mark complete')); await idle()
    assert.equal((await json('/analytics')).sessions_completed, 1)
    const quizForm = [...document.forms].find(f => f.querySelector('[name="score"]'))
    await value(quizForm.elements.topic_id, (await json('/topics'))[0].id)
    await value(quizForm.elements.score, 25)
    await click(button('Save quiz result')); await idle()
    assert.equal((await json('/quiz-results')).length, 1)
    assert.equal((await json('/topics'))[0].prev_quiz_score, 25)
    assert.equal((await json('/study-plan')).filter(s => s.status === 'done').length, 1)
    await click(button('Replan now')); await idle()
    assert.match(document.body.textContent, /Priorities recalculated/)
    await navigate('analytics')
    assert.match(document.body.textContent, /25%/)
    await navigate('ai')
    assert.match(document.body.textContent, /replan complete/)
    await navigate('settings')
    assert.equal(document.querySelector('h1').textContent, 'Settings')
  })
  await t.test('navigation, session filter and disclosures work', async () => {
    await navigate('planner')
    assert.equal(window.location.hash, '#planner')
    const filter = document.querySelector('.inline-label select')
    await value(filter, 'done')
    assert.match(document.body.textContent, /done/)
    assert.equal([...document.querySelectorAll('button')].filter(b => b.textContent === 'Mark complete').length, 0)
    await click(button('Replan now')); await idle()
    assert.equal(filter.value, 'pending', 'Successful replan should reveal pending sessions even after completed filter')
    const history = document.querySelector('details')
    await click(history.querySelector('summary'))
    assert.equal(history.open, true)
    await click(history.querySelector('summary'))
    assert.equal(history.open, false)
    await act(async () => { window.location.hash = 'subjects'; window.dispatchEvent(new dom.window.HashChangeEvent('hashchange')) })
    assert.equal(document.querySelector('h1').textContent, 'Subjects')
    await click(document.getElementById('btn-collapse-sidebar'))
    assert.equal(document.querySelector('aside').style.width, '68px')
    await click(document.getElementById('btn-collapse-sidebar'))
    assert.equal(document.querySelector('aside').style.width, '220px')
  })
  await t.test('loading feedback is immediate and duplicate clicks are blocked', async () => {
    let release
    failure = (url, options) => {
      if (url.endsWith('/predict-difficulty') && options.method === 'POST') {
        return new Promise(resolve => { release = () => resolve(nativeFetch(url, options)) })
      }
      return null
    }
    const before = requests.filter(r => r.path === '/predict-difficulty' && r.method === 'POST').length
    const predictButton = button('Predict difficulty')
    await click(predictButton)
    assert.equal(predictButton.disabled, true)
    assert.equal(predictButton.textContent, 'Predicting...')
    assert.match(document.querySelector('[aria-label="Action feedback"]').textContent, /Predicting UI integration topic/)
    await click(predictButton)
    assert.equal(requests.filter(r => r.path === '/predict-difficulty' && r.method === 'POST').length, before + 1)
    release(); await idle(); failure = null
    assert.match(document.querySelector('[aria-label="Action feedback"]').textContent, /Probability scores saved/)
  })
  await t.test('failure keeps the action error even if refresh fails too', async () => {
    failure = (_url, options) => new Response(JSON.stringify({ detail: options.method === 'POST' ? 'Prediction service unavailable: rebuild the model' : 'Refresh service unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
    await click(button('Predict difficulty')); await idle()
    assert.match(document.querySelector('[role="alert"]').textContent, /Prediction service unavailable: rebuild the model/)
    assert.match(document.querySelector('[role="alert"]').textContent, /Could not refresh/)
    failure = null
    await click(button('Refresh')); await idle()
    assert.equal(document.querySelector('[role="alert"]'), null)
    assert.match(document.querySelector('[aria-label="Action feedback"]').textContent, /Study data refreshed/)
  })
  await t.test('a successful save stays visible when unrelated analytics refresh fails', async () => {
    failure = url => url.endsWith('/analytics') ? new Response(JSON.stringify({ detail: 'Analytics temporarily unavailable' }), { status: 503 }) : null
    const form = [...document.forms].find(f => f.querySelector('[name="exam_date"]'))
    await value(form.elements.name, 'Partial refresh subject')
    await click(button('Add subject', form)); await idle()
    assert.equal((await json('/subjects')).length, 2)
    assert.match(document.body.textContent, /Subject Partial refresh subject created/)
    assert.ok([...document.querySelectorAll('.record strong')].some(el => el.textContent === 'Partial refresh subject'))
    assert.match(document.querySelector('[role="alert"]').textContent, /Analytics temporarily unavailable/)
    failure = null
    await click(button('Refresh')); await idle()
  })
  await t.test('server validation errors preserve form values and show actionable feedback', async () => {
    const form = [...document.forms].find(f => f.querySelector('[name="exam_date"]'))
    await value(form.elements.name, 'UI integration subject')
    await click(button('Add subject', form)); await idle()
    assert.match(document.querySelector('[role="alert"]').textContent, /already exists/)
    assert.equal(form.elements.name.value, 'UI integration subject')
    assert.equal((await json('/subjects')).length, 2)
    await click(button('Dismiss'))
    assert.equal(document.querySelector('[aria-label="Action feedback"]'), null)
  })
  await t.test('network failure is visible, recoverable, and never reports success', async () => {
    failure = () => { throw new TypeError('simulated network offline') }
    await click(button('Predict difficulty')); await idle()
    assert.match(document.querySelector('[role="alert"]').textContent, /Cannot reach the API/)
    assert.doesNotMatch(document.querySelector('[aria-label="Action feedback"]').textContent, /Probability scores saved/)
    failure = null
    await click(button('Refresh')); await idle()
    assert.equal(document.querySelector('[role="alert"]'), null)
  })
  await t.test('completion uses the confirmed response even when the session-list refresh fails', async () => {
    await navigate('planner')
    const pending = (await json('/study-plan')).find(s => s.status === 'upcoming')
    assert.ok(pending)
    const before = await json('/analytics')
    await value(document.querySelector('.inline-label select'), 'all')
    failure = (url, options) => url.endsWith('/study-plan') && !options.method
      ? new Response(JSON.stringify({ detail: 'Session list temporarily unavailable' }), { status: 503 }) : null
    const targetButton = button('Mark complete')
    const row = targetButton.closest('.record')
    await click(targetButton); await idle()
    const persisted = (await json('/study-plan')).find(s => s.id === pending.id)
    assert.equal(persisted.status, 'done')
    assert.ok(requests.some(r => r.path === `/sessions/${pending.id}/complete` && r.method === 'POST'))
    assert.ok(row.querySelector('button') === null, 'A confirmed completion must not leave the completion button active after a failed refresh')
    assert.match(row.textContent, /Completed/)
    assert.equal((await json('/analytics')).sessions_completed, before.sessions_completed + 1)
    failure = null
    await click(button('Refresh')); await idle()
  })

  await t.test('completion failures and invalid responses do not change the row or database', async () => {
    await navigate('subjects')
    const form = [...document.forms].find(f => f.querySelector('[name="confidence"]'))
    await value(form.elements.subject_id, (await json('/subjects'))[0].id)
    await value(form.elements.name, 'Completion error test topic')
    await click(button('Add topic', form)); await idle()
    await navigate('planner')
    await click(button('Generate study plan')); await idle()
    const pending = (await json('/study-plan')).find(s => s.status === 'upcoming')
    const path = `/sessions/${pending.id}/complete`
    failure = (url, options) => url.endsWith(path) && options.method === 'POST'
      ? new Response(JSON.stringify({ detail: 'Completion rejected by the server' }), { status: 503 }) : null
    await click(button('Mark complete')); await idle()
    assert.match(document.querySelector('[role="alert"]').textContent, /Completion rejected by the server/)
    assert.equal((await json('/study-plan')).find(s => s.id === pending.id).status, 'upcoming')
    assert.ok(button('Mark complete'))
    failure = (url, options) => url.endsWith(path) && options.method === 'POST'
      ? new Response(JSON.stringify(pending), { status: 200 }) : null
    await click(button('Mark complete')); await idle()
    assert.match(document.querySelector('[role="alert"]').textContent, /did not confirm completion/)
    assert.equal((await json('/study-plan')).find(s => s.id === pending.id).status, 'upcoming')
    failure = null
    await click(button('Refresh')); await idle()
  })
  await t.test('completion shows loading, sends one exact-ID request, updates progress, and survives remount', async () => {
    const pending = (await json('/study-plan')).find(s => s.status === 'upcoming')
    const path = `/sessions/${pending.id}/complete`
    const before = await json('/analytics')
    let release
    failure = (url, options) => url.endsWith(path) && options.method === 'POST'
      ? new Promise(resolve => { release = () => resolve(nativeFetch(url, options)) }) : null
    const callsBefore = requests.filter(r => r.path === path && r.method === 'POST').length
    const target = button('Mark complete')
    await click(target)
    assert.equal(target.textContent, 'Completing...')
    assert.equal(target.disabled, true)
    await click(target)
    assert.equal(requests.filter(r => r.path === path && r.method === 'POST').length, callsBefore + 1)
    assert.equal((await json('/study-plan')).find(s => s.id === pending.id).status, 'upcoming')
    release(); await idle(); failure = null
    const after = await json('/analytics')
    assert.equal(after.sessions_completed, before.sessions_completed + 1)
    assert.equal(after.total_study_minutes, before.total_study_minutes + pending.duration_minutes)
    await navigate('analytics')
    const countCard = [...document.querySelectorAll('.stats-grid > div')].find(el => el.textContent.includes('Sessions done'))
    assert.ok(countCard, 'Completion count card must be rendered')
    assert.equal(countCard.querySelector('p').textContent, String(after.sessions_completed))
    const subjectId = (await json('/topics')).find(t => t.id === pending.topic_id).subject_id
    const topicIds = new Set((await json('/topics')).filter(t => t.subject_id === subjectId).map(t => t.id))
    const subjectSessions = (await json('/study-plan')).filter(s => topicIds.has(s.topic_id) && s.status !== 'skipped')
    const percent = Math.round(subjectSessions.filter(s => s.status === 'done').length / subjectSessions.length * 100)
    assert.equal(document.querySelector('progress').value, percent)
    // Recreate all React state to exercise reload behavior against persisted SQLite data.
    await act(async () => root.render(null))
    await act(async () => root.render(React.createElement(App)))
    await idle()
    await navigate('planner')
    await value(document.querySelector('.inline-label select'), 'done')
    const row = document.querySelector(`[data-session-id="${pending.id}"]`)
    assert.ok(row)
    assert.match(row.textContent, /Completed/)
    assert.ok(row.querySelector('button') === null)
  })

})
