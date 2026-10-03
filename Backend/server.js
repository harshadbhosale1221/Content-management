import http from 'node:http'
import crypto from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const dataDir = join(root, 'data')
const files = { posts: join(dataDir, 'posts.json'), users: join(dataDir, 'users.json'), sessions: join(dataDir, 'sessions.json') }
const seedPosts = [
  { id: 'welcome-post', title: 'Welcome to Publishly', author: 'Editorial Team', category: 'Education', content: 'This is a shared space for ideas. Create an account and publish your thoughts with the community.', createdAt: '2026-10-02T08:00:00.000Z' },
  { id: 'writing-better-posts', title: 'Three habits for clearer writing', author: 'Maya Singh', category: 'Personal', content: 'Start with one useful idea, use short paragraphs, and finish with a practical next step for your reader.', createdAt: '2026-10-01T10:00:00.000Z' }
]

async function read(name, fallback = []) { try { return JSON.parse(await readFile(files[name], 'utf8')) } catch { await write(name, fallback); return fallback } }
async function write(name, data) { await mkdir(dataDir, { recursive: true }); await writeFile(files[name], JSON.stringify(data, null, 2)) }
function send(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }); res.end(JSON.stringify(data)) }
function body(req) { return new Promise((resolve, reject) => { let raw = ''; req.on('data', chunk => { raw += chunk; if (raw.length > 1_000_000) req.destroy() }); req.on('end', () => { try { resolve(JSON.parse(raw || '{}')) } catch { reject(new Error('Invalid JSON')) } }) }) }
function publicUser(user) { return { id: user.id, name: user.name, email: user.email } }
function hash(password, salt = crypto.randomBytes(16).toString('hex')) { return { salt, passwordHash: crypto.scryptSync(password, salt, 64).toString('hex') } }
async function currentUser(req) { const token = req.headers.authorization?.replace('Bearer ', ''); if (!token) return null; const sessions = await read('sessions'); const session = sessions.find(item => item.token === token && item.expiresAt > Date.now()); if (!session) return null; return (await read('users')).find(user => user.id === session.userId) || null }

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {})
  const path = new URL(req.url, `http://${req.headers.host}`).pathname
  const id = path.match(/^\/api\/posts\/([^/]+)$/)?.[1]
  try {
    if (req.method === 'POST' && path === '/api/auth/register') {
      const { name = '', email = '', password = '' } = await body(req)
      if (name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 6) return send(res, 400, { error: 'Enter a name, valid email, and password of at least 6 characters.' })
      const users = await read('users')
      if (users.some(user => user.email === email.trim().toLowerCase())) return send(res, 409, { error: 'An account with this email already exists.' })
      const user = { id: crypto.randomUUID(), name: name.trim(), email: email.trim().toLowerCase(), ...hash(password), createdAt: new Date().toISOString() }
      users.push(user); await write('users', users)
      return send(res, 201, { message: 'Registration successful. Please sign in.' })
    }
    if (req.method === 'POST' && path === '/api/auth/login') {
      const { email = '', password = '' } = await body(req); const user = (await read('users')).find(item => item.email === email.trim().toLowerCase())
      if (!user || hash(password, user.salt).passwordHash !== user.passwordHash) return send(res, 401, { error: 'Incorrect email or password.' })
      return send(res, 200, await createSession(user))
    }
    if (req.method === 'GET' && path === '/api/auth/me') { const user = await currentUser(req); return user ? send(res, 200, publicUser(user)) : send(res, 401, { error: 'Please sign in.' }) }
    if (req.method === 'POST' && path === '/api/auth/logout') { const token = req.headers.authorization?.replace('Bearer ', ''); await write('sessions', (await read('sessions')).filter(item => item.token !== token)); return send(res, 200, { message: 'Logged out' }) }

    const posts = await read('posts', seedPosts)
    if (req.method === 'GET' && path === '/api/stats') {
      const user = await currentUser(req)
      if (!user) return send(res, 401, { error: 'Please sign in to view website statistics.' })
      const users = await read('users')
      return send(res, 200, { totalUsers: users.length, totalPosts: posts.length, publicPosts: posts.filter(post => post.isPublic).length })
    }
    if (req.method === 'GET' && path === '/api/posts') return send(res, 200, posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
    const user = await currentUser(req)
    if (req.method === 'POST' && path === '/api/posts') {
      if (!user) return send(res, 401, { error: 'Please sign in to publish.' })
      const post = await body(req); if (!post.title?.trim() || !post.content?.trim()) return send(res, 400, { error: 'Title and content are required.' })
      const item = { id: crypto.randomUUID(), ownerId: user.id, author: user.name, title: post.title.trim(), category: post.category || 'General', content: post.content.trim(), isPublic: Boolean(post.isPublic), createdAt: new Date().toISOString() }
      posts.push(item); await write('posts', posts); return send(res, 201, item)
    }
    const index = posts.findIndex(post => post.id === id)
    if (id && index === -1) return send(res, 404, { error: 'Post not found.' })
    if (id && !user) return send(res, 401, { error: 'Please sign in.' })
    if (id && posts[index].ownerId !== user.id && !posts[index].isPublic) return send(res, 403, { error: 'You do not have permission to edit this private post.' })
    if (req.method === 'PUT' && id) { const update = await body(req); if (!update.title?.trim() || !update.content?.trim()) return send(res, 400, { error: 'Title and content are required.' }); posts[index] = { ...posts[index], title: update.title.trim(), category: update.category || 'General', content: update.content.trim(), isPublic: Boolean(update.isPublic) }; await write('posts', posts); return send(res, 200, posts[index]) }
    if (req.method === 'DELETE' && id) { if (posts[index].ownerId !== user.id) return send(res, 403, { error: 'Only the post owner can delete it.' }); const deleted = posts.splice(index, 1)[0]; await write('posts', posts); return send(res, 200, deleted) }
    return send(res, 404, { error: 'Route not found.' })
  } catch (error) { return send(res, 500, { error: error.message || 'Server error.' }) }
})
async function createSession(user) { const sessions = await read('sessions'); const token = crypto.randomBytes(32).toString('hex'); sessions.push({ token, userId: user.id, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 }); await write('sessions', sessions.filter(item => item.expiresAt > Date.now())); return { token, user: publicUser(user) } }
server.listen(process.env.PORT || 5000, () => console.log(`API running on http://localhost:${process.env.PORT || 5000}`))
