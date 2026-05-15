'use client'

import { useEffect, useRef, useCallback } from 'react'

// ---- Types ----
type GameState = 'IDLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'LEVEL_CLEAR'

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'NONE'

type GhostMode = 'CHASE' | 'SCATTER' | 'FRIGHTENED' | 'EATEN'

interface PacmanState {
  x: number
  y: number
  dir: Direction
  nextDir: Direction
  lives: number
  mouthAngle: number
  mouthDir: number
  dyingFrame: number
  dying: boolean
}

interface Ghost {
  x: number
  y: number
  dir: Direction
  mode: GhostMode
  color: string
  frightenedTimer: number
  flashTimer: number
  homeX: number
  homeY: number
  scatterTarget: { x: number; y: number }
  eyeDir: Direction
}

interface FullState {
  state: GameState
  score: number
  level: number
  maze: number[][]
  pacman: PacmanState
  ghosts: Ghost[]
  frightenedTimer: number
  levelClearTimer: number
  dotCount: number
  deathTimer: number
}

// ---- Constants ----
const CELL = 20
const COLS = 21
const ROWS = 23
const FPS = 20

// Maze template: 0=empty, 1=wall, 2=dot, 3=power pellet, 4=ghost house
const MAZE_TEMPLATE: number[][] = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
  [1,3,1,1,2,1,1,1,2,1,1,1,2,1,1,1,2,1,1,3,1],
  [1,2,1,1,2,1,1,1,2,1,1,1,2,1,1,1,2,1,1,2,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,2,1,1,1,1,1,1,1,2,1,2,1,1,2,1],
  [1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1],
  [1,1,1,1,2,1,1,1,0,0,0,0,0,1,1,1,2,1,1,1,1],
  [1,1,1,1,2,1,0,0,0,4,4,4,0,0,0,1,2,1,1,1,1],
  [1,1,1,1,2,1,0,4,4,4,4,4,4,4,0,1,2,1,1,1,1],
  [0,0,0,0,2,0,0,4,4,4,4,4,4,4,0,0,2,0,0,0,0],
  [1,1,1,1,2,1,0,4,4,4,4,4,4,4,0,1,2,1,1,1,1],
  [1,1,1,1,2,1,0,0,0,0,0,0,0,0,0,1,2,1,1,1,1],
  [1,1,1,1,2,1,0,1,1,1,1,1,1,1,0,1,2,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,1,1,2,1,1,1,2,1,1,1,2,1,1,2,1],
  [1,3,2,1,2,2,2,2,2,2,0,2,2,2,2,2,2,1,2,3,1],
  [1,1,2,1,2,1,2,1,1,1,1,1,1,1,2,1,2,1,2,1,1],
  [1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1],
  [1,2,1,1,1,1,1,1,2,1,1,1,2,1,1,1,1,1,1,2,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,1,2,1,1,1,1,1,2,1,1,2,1,1,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
]

function cloneMaze(template: number[][]): number[][] {
  return template.map(row => [...row])
}

function countDots(maze: number[][]): number {
  let count = 0
  for (const row of maze) {
    for (const cell of row) {
      if (cell === 2 || cell === 3) count++
    }
  }
  return count
}

function createPacman(lives: number): PacmanState {
  return {
    x: 10 * CELL + CELL / 2,
    y: 16 * CELL + CELL / 2,
    dir: 'NONE',
    nextDir: 'NONE',
    lives,
    mouthAngle: 0.25,
    mouthDir: 1,
    dyingFrame: 0,
    dying: false
  }
}

function createGhosts(): Ghost[] {
  return [
    { x: 9*CELL+CELL/2, y: 9*CELL+CELL/2, dir: 'LEFT', mode: 'CHASE', color: '#FF0000', frightenedTimer: 0, flashTimer: 0, homeX: 9*CELL+CELL/2, homeY: 9*CELL+CELL/2, scatterTarget: {x:0,y:0}, eyeDir: 'LEFT' },
    { x: 10*CELL+CELL/2, y: 9*CELL+CELL/2, dir: 'RIGHT', mode: 'CHASE', color: '#FFB8FF', frightenedTimer: 0, flashTimer: 0, homeX: 10*CELL+CELL/2, homeY: 9*CELL+CELL/2, scatterTarget: {x:COLS*CELL,y:0}, eyeDir: 'RIGHT' },
    { x: 11*CELL+CELL/2, y: 9*CELL+CELL/2, dir: 'UP', mode: 'CHASE', color: '#00FFFF', frightenedTimer: 0, flashTimer: 0, homeX: 11*CELL+CELL/2, homeY: 9*CELL+CELL/2, scatterTarget: {x:COLS*CELL,y:ROWS*CELL}, eyeDir: 'UP' },
    { x: 10*CELL+CELL/2, y: 10*CELL+CELL/2, dir: 'DOWN', mode: 'CHASE', color: '#FFB852', frightenedTimer: 0, flashTimer: 0, homeX: 10*CELL+CELL/2, homeY: 10*CELL+CELL/2, scatterTarget: {x:0,y:ROWS*CELL}, eyeDir: 'DOWN' },
  ]
}

function createFullState(level: number, score: number, lives: number): FullState {
  const maze = cloneMaze(MAZE_TEMPLATE)
  return {
    state: 'PLAYING' as GameState,
    score,
    level,
    maze,
    pacman: createPacman(lives),
    ghosts: createGhosts(),
    frightenedTimer: 0,
    levelClearTimer: 0,
    dotCount: countDots(maze),
    deathTimer: 0
  }
}

function isWall(maze: number[][], px: number, py: number): boolean {
  const col = Math.floor(px / CELL)
  const row = Math.floor(py / CELL)
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true
  return maze[row][col] === 1
}

function canMove(maze: number[][], cx: number, cy: number, dir: Direction, speed: number): boolean {
  const margin = 6
  if (dir === 'LEFT') {
    const nx = cx - speed
    return !isWall(maze, nx - margin, cy - margin + 1) && !isWall(maze, nx - margin, cy + margin - 1)
  } else if (dir === 'RIGHT') {
    const nx = cx + speed
    return !isWall(maze, nx + margin, cy - margin + 1) && !isWall(maze, nx + margin, cy + margin - 1)
  } else if (dir === 'UP') {
    const ny = cy - speed
    return !isWall(maze, cx - margin + 1, ny - margin) && !isWall(maze, cx + margin - 1, ny - margin)
  } else if (dir === 'DOWN') {
    const ny = cy + speed
    return !isWall(maze, cx - margin + 1, ny + margin) && !isWall(maze, cx + margin - 1, ny + margin)
  }
  return false
}

function snapToGrid(v: number): number {
  const cell = Math.floor(v / CELL)
  const offset = v - cell * CELL
  if (offset < 4) return cell * CELL + CELL / 2
  if (offset > CELL - 4) return (cell + 1) * CELL + CELL / 2
  return v
}

function directionVector(dir: Direction): { dx: number; dy: number } {
  switch (dir) {
    case 'UP': return { dx: 0, dy: -1 }
    case 'DOWN': return { dx: 0, dy: 1 }
    case 'LEFT': return { dx: -1, dy: 0 }
    case 'RIGHT': return { dx: 1, dy: 0 }
    default: return { dx: 0, dy: 0 }
  }
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)
}

function chooseGhostDir(ghost: Ghost, maze: number[][], targetX: number, targetY: number): Direction {
  const dirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT']
  const opposite: Record<Direction, Direction> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT', NONE: 'NONE' }
  let bestDir: Direction = ghost.dir
  let bestDist = Infinity
  let found = false

  for (const d of dirs) {
    if (d === opposite[ghost.dir]) continue
    const { dx, dy } = directionVector(d)
    const nx = ghost.x + dx * CELL
    const ny = ghost.y + dy * CELL
    const col = Math.round((ghost.x + dx * CELL / 2) / CELL)
    const row = Math.round((ghost.y + dy * CELL / 2) / CELL)
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) continue
    if (maze[row][col] === 1) continue
    const d2 = dist(nx, ny, targetX, targetY)
    if (d2 < bestDist) {
      bestDist = d2
      bestDir = d
      found = true
    }
  }
  if (!found) {
    // try reverse
    const rev = opposite[ghost.dir]
    if (rev !== 'NONE') bestDir = rev
  }
  return bestDir
}

function chooseGhostDirRandom(ghost: Ghost, maze: number[][]): Direction {
  const dirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT']
  const opposite: Record<Direction, Direction> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT', NONE: 'NONE' }
  const available: Direction[] = []
  for (const d of dirs) {
    if (d === opposite[ghost.dir]) continue
    const { dx, dy } = directionVector(d)
    const col = Math.round((ghost.x + dx * CELL / 2) / CELL)
    const row = Math.round((ghost.y + dy * CELL / 2) / CELL)
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) continue
    if (maze[row][col] === 1) continue
    available.push(d)
  }
  if (available.length === 0) return opposite[ghost.dir]
  return available[Math.floor(Math.random() * available.length)]
}

// ---- Drawing helpers ----
function drawMaze(ctx: CanvasRenderingContext2D, maze: number[][]) {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = maze[row][col]
      const x = col * CELL
      const y = row * CELL
      if (cell === 1) {
        ctx.fillStyle = '#1a1aff'
        ctx.fillRect(x, y, CELL, CELL)
        ctx.strokeStyle = '#0000aa'
        ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2)
      } else {
        ctx.fillStyle = '#000'
        ctx.fillRect(x, y, CELL, CELL)
        if (cell === 2) {
          ctx.fillStyle = '#fff'
          ctx.beginPath()
          ctx.arc(x + CELL / 2, y + CELL / 2, 2, 0, Math.PI * 2)
          ctx.fill()
        } else if (cell === 3) {
          ctx.fillStyle = '#fff'
          ctx.beginPath()
          ctx.arc(x + CELL / 2, y + CELL / 2, 5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
  }
}

function drawPacman(ctx: CanvasRenderingContext2D, pacman: PacmanState) {
  if (pacman.dying) {
    const angle = (pacman.dyingFrame / 20) * Math.PI
    ctx.fillStyle = '#FFD700'
    ctx.beginPath()
    ctx.moveTo(pacman.x, pacman.y)
    ctx.arc(pacman.x, pacman.y, CELL / 2 - 1, angle, Math.PI * 2 - angle)
    ctx.closePath()
    ctx.fill()
    return
  }
  let rotation = 0
  if (pacman.dir === 'RIGHT' || pacman.dir === 'NONE') rotation = 0
  else if (pacman.dir === 'LEFT') rotation = Math.PI
  else if (pacman.dir === 'UP') rotation = -Math.PI / 2
  else if (pacman.dir === 'DOWN') rotation = Math.PI / 2

  ctx.fillStyle = '#FFD700'
  ctx.beginPath()
  ctx.moveTo(pacman.x, pacman.y)
  ctx.arc(pacman.x, pacman.y, CELL / 2 - 1, rotation + pacman.mouthAngle * Math.PI, rotation + (2 - pacman.mouthAngle) * Math.PI)
  ctx.closePath()
  ctx.fill()
}

function drawGhost(ctx: CanvasRenderingContext2D, ghost: Ghost, frightenedTimer: number) {
  const r = CELL / 2 - 1
  const x = ghost.x
  const y = ghost.y
  let color = ghost.color
  if (ghost.mode === 'FRIGHTENED') {
    if (frightenedTimer < 60 && Math.floor(frightenedTimer / 10) % 2 === 0) {
      color = '#ffffff'
    } else {
      color = '#0000ff'
    }
  } else if (ghost.mode === 'EATEN') {
    // just draw eyes
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(x - 3, y - 2, 3, 0, Math.PI * 2)
    ctx.arc(x + 3, y - 2, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#00f'
    ctx.beginPath()
    ctx.arc(x - 3, y - 2, 1.5, 0, Math.PI * 2)
    ctx.arc(x + 3, y - 2, 1.5, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  // body
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y - r / 3, r, Math.PI, 0)
  ctx.lineTo(x + r, y + r)
  // wavy bottom
  const waves = 3
  const waveW = (r * 2) / waves
  for (let i = 0; i < waves; i++) {
    const wx = x + r - i * waveW
    ctx.quadraticCurveTo(wx - waveW / 4, y + r + 4, wx - waveW / 2, y + r)
    ctx.quadraticCurveTo(wx - waveW * 3 / 4, y + r - 4, wx - waveW, y + r)
  }
  ctx.closePath()
  ctx.fill()
  if (ghost.mode !== 'FRIGHTENED') {
    // eyes
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.ellipse(x - 3, y - 2, 3, 4, 0, 0, Math.PI * 2)
    ctx.ellipse(x + 3, y - 2, 3, 4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#00f'
    const { dx: edx, dy: edy } = directionVector(ghost.eyeDir)
    ctx.beginPath()
    ctx.arc(x - 3 + edx * 1.5, y - 2 + edy * 1.5, 1.5, 0, Math.PI * 2)
    ctx.arc(x + 3 + edx * 1.5, y - 2 + edy * 1.5, 1.5, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // frightened face
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(x - 4, y - 2, 2, 0, Math.PI * 2)
    ctx.arc(x + 4, y - 2, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x - 5, y + 3)
    ctx.lineTo(x - 3, y + 1)
    ctx.lineTo(x - 1, y + 3)
    ctx.lineTo(x + 1, y + 1)
    ctx.lineTo(x + 3, y + 3)
    ctx.lineTo(x + 5, y + 1)
    ctx.stroke()
    ctx.lineWidth = 1
  }
}

function drawHUD(ctx: CanvasRenderingContext2D, score: number, level: number, lives: number) {
  const hudY = ROWS * CELL + 5
  ctx.fillStyle = '#000'
  ctx.fillRect(0, ROWS * CELL, COLS * CELL, 40)
  ctx.fillStyle = '#FFD700'
  ctx.font = 'bold 14px monospace'
  ctx.fillText(`Score: ${score}`, 5, hudY + 14)
  ctx.fillText(`Level: ${level}`, COLS * CELL / 2 - 30, hudY + 14)
  ctx.fillText(`Lives:`, COLS * CELL - 90, hudY + 14)
  for (let i = 0; i < lives; i++) {
    ctx.fillStyle = '#FFD700'
    ctx.beginPath()
    ctx.arc(COLS * CELL - 35 + i * 18, hudY + 9, 6, 0.3, Math.PI * 2 - 0.3)
    ctx.closePath()
    ctx.fill()
  }
}

function drawOverlay(ctx: CanvasRenderingContext2D, text: string, sub: string) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL)
  ctx.fillStyle = '#FFD700'
  ctx.font = 'bold 28px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(text, COLS * CELL / 2, ROWS * CELL / 2 - 10)
  ctx.fillStyle = '#fff'
  ctx.font = '14px monospace'
  ctx.fillText(sub, COLS * CELL / 2, ROWS * CELL / 2 + 20)
  ctx.textAlign = 'left'
}

export default function PacmanPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<FullState | null>(null)
  const animRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const keysRef = useRef<Set<string>>(new Set())
  const ghostEatComboRef = useRef<number>(0)

  const gameLoop = useCallback((timestamp: number) => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    const elapsed = timestamp - lastTimeRef.current
    const interval = 1000 / FPS

    if (elapsed >= interval) {
      lastTimeRef.current = timestamp - (elapsed % interval)
      tick(ctx)
    }
    animRef.current = requestAnimationFrame(gameLoop)
  }, [])

  function tick(ctx: CanvasRenderingContext2D) {
    const fs = stateRef.current
    if (!fs) return

    // Clear
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, COLS * CELL, (ROWS + 2) * CELL)

    if (fs.state === 'IDLE') {
      drawMaze(ctx, fs.maze)
      drawOverlay(ctx, 'PAC-MAN', 'Press ENTER to Start')
      drawHUD(ctx, fs.score, fs.level, fs.pacman.lives)
      return
    }

    if (fs.state === 'GAME_OVER') {
      drawMaze(ctx, fs.maze)
      drawOverlay(ctx, 'GAME OVER', `Final Score: ${fs.score} — Press ENTER to Restart`)
      drawHUD(ctx, fs.score, fs.level, fs.pacman.lives)
      return
    }

    if (fs.state === 'LEVEL_CLEAR') {
      drawMaze(ctx, fs.maze)
      drawOverlay(ctx, `LEVEL ${fs.level} CLEAR!`, `Score: ${fs.score} — Next level starting...`)
      drawHUD(ctx, fs.score, fs.level, fs.pacman.lives)
      fs.levelClearTimer--
      if (fs.levelClearTimer <= 0) {
        const newState = createFullState(fs.level + 1, fs.score, fs.pacman.lives)
        stateRef.current = newState
      }
      return
    }

    if (fs.state === 'PAUSED') {
      drawMaze(ctx, fs.maze)
      drawPacman(ctx, fs.pacman)
      fs.ghosts.forEach(g => drawGhost(ctx, g, fs.frightenedTimer))
      drawOverlay(ctx, 'PAUSED', 'Press P to resume')
      drawHUD(ctx, fs.score, fs.level, fs.pacman.lives)
      return
    }

    // PLAYING state
    const gs = fs
    const pacman = gs.pacman

    // Death animation
    if (pacman.dying) {
      pacman.dyingFrame++
      drawMaze(ctx, gs.maze)
      drawPacman(ctx, pacman)
      drawHUD(ctx, gs.score, gs.level, pacman.lives)
      if (pacman.dyingFrame >= 20) {
        pacman.dying = false
        pacman.dyingFrame = 0
        if (pacman.lives <= 0) {
          gs.state = 'GAME_OVER'
        } else {
          // reset positions
          const fresh = createPacman(pacman.lives)
          Object.assign(pacman, fresh)
          gs.ghosts.forEach((g, i) => {
            const fresh2 = createGhosts()[i]
            Object.assign(g, fresh2)
          })
        }
      }
      return
    }

    // Input
    const speed = 3
    if (keysRef.current.has('ArrowLeft')) pacman.nextDir = 'LEFT'
    if (keysRef.current.has('ArrowRight')) pacman.nextDir = 'RIGHT'
    if (keysRef.current.has('ArrowUp')) pacman.nextDir = 'UP'
    if (keysRef.current.has('ArrowDown')) pacman.nextDir = 'DOWN'

    // Try to switch to nextDir
    if (pacman.nextDir !== 'NONE' && pacman.nextDir !== pacman.dir) {
      // Snap to grid before turning
      const snappedX = snapToGrid(pacman.x)
      const snappedY = snapToGrid(pacman.y)
      if (canMove(gs.maze, snappedX, snappedY, pacman.nextDir, speed)) {
        pacman.x = snappedX
        pacman.y = snappedY
        pacman.dir = pacman.nextDir
      }
    }

    // Move pacman
    if (pacman.dir !== 'NONE' && canMove(gs.maze, pacman.x, pacman.y, pacman.dir, speed)) {
      const { dx, dy } = directionVector(pacman.dir)
      pacman.x += dx * speed
      pacman.y += dy * speed
      // Tunnel wrap
      if (pacman.x < 0) pacman.x = COLS * CELL
      if (pacman.x > COLS * CELL) pacman.x = 0
    }

    // Animate mouth
    pacman.mouthAngle += 0.05 * pacman.mouthDir
    if (pacman.mouthAngle >= 0.4) pacman.mouthDir = -1
    if (pacman.mouthAngle <= 0.02) pacman.mouthDir = 1

    // Collect dots
    const pcol = Math.floor(pacman.x / CELL)
    const prow = Math.floor(pacman.y / CELL)
    if (prow >= 0 && prow < ROWS && pcol >= 0 && pcol < COLS) {
      const cell = gs.maze[prow][pcol]
      if (cell === 2) {
        gs.maze[prow][pcol] = 0
        gs.score += 10
        gs.dotCount--
      } else if (cell === 3) {
        gs.maze[prow][pcol] = 0
        gs.score += 50
        gs.dotCount--
        gs.frightenedTimer = 200
        ghostEatComboRef.current = 0
        gs.ghosts.forEach(g => {
          if (g.mode !== 'EATEN') {
            g.mode = 'FRIGHTENED'
          }
        })
      }
    }

    // Frightened timer
    if (gs.frightenedTimer > 0) {
      gs.frightenedTimer--
      if (gs.frightenedTimer === 0) {
        gs.ghosts.forEach(g => {
          if (g.mode === 'FRIGHTENED') g.mode = 'CHASE'
        })
      }
    }

    // Ghost movement — move on every 2 frames based on speed
    gs.ghosts.forEach(ghost => {
      // Update direction at cell center
      const gcol = Math.floor(ghost.x / CELL)
      const grow = Math.floor(ghost.y / CELL)
      const offX = ghost.x - gcol * CELL - CELL / 2
      const offY = ghost.y - grow * CELL - CELL / 2

      if (Math.abs(offX) < 2 && Math.abs(offY) < 2) {
        // snap
        ghost.x = gcol * CELL + CELL / 2
        ghost.y = grow * CELL + CELL / 2

        if (ghost.mode === 'EATEN') {
          // Head to home
          if (dist(ghost.x, ghost.y, ghost.homeX, ghost.homeY) < CELL) {
            ghost.mode = 'CHASE'
            ghost.x = ghost.homeX
            ghost.y = ghost.homeY
          } else {
            ghost.dir = chooseGhostDir(ghost, gs.maze, ghost.homeX, ghost.homeY)
          }
        } else if (ghost.mode === 'FRIGHTENED') {
          ghost.dir = chooseGhostDirRandom(ghost, gs.maze)
        } else if (ghost.mode === 'SCATTER') {
          ghost.dir = chooseGhostDir(ghost, gs.maze, ghost.scatterTarget.x, ghost.scatterTarget.y)
        } else {
          ghost.dir = chooseGhostDir(ghost, gs.maze, pacman.x, pacman.y)
        }
        ghost.eyeDir = ghost.dir
      }

      const ghostSpeed = ghost.mode === 'FRIGHTENED' ? 2 : ghost.mode === 'EATEN' ? 4 : 3
      if (canMove(gs.maze, ghost.x, ghost.y, ghost.dir, ghostSpeed)) {
        const { dx, dy } = directionVector(ghost.dir)
        ghost.x += dx * ghostSpeed
        ghost.y += dy * ghostSpeed
        // Tunnel
        if (ghost.x < 0) ghost.x = COLS * CELL
        if (ghost.x > COLS * CELL) ghost.x = 0
      } else {
        // Pick a new direction
        const dirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT']
        for (const d of dirs) {
          if (canMove(gs.maze, ghost.x, ghost.y, d, ghostSpeed)) {
            ghost.dir = d
            ghost.eyeDir = d
            break
          }
        }
      }
    })

    // Collision pacman <-> ghost
    gs.ghosts.forEach(ghost => {
      if (dist(pacman.x, pacman.y, ghost.x, ghost.y) < CELL - 4) {
        if (ghost.mode === 'FRIGHTENED') {
          ghost.mode = 'EATEN'
          ghostEatComboRef.current++
          gs.score += 200 * Math.pow(2, ghostEatComboRef.current - 1)
        } else if (ghost.mode === 'CHASE' || ghost.mode === 'SCATTER') {
          pacman.dying = true
          pacman.dyingFrame = 0
          pacman.lives--
        }
      }
    })

    // Level clear
    if (gs.dotCount <= 0) {
      gs.state = 'LEVEL_CLEAR'
      gs.levelClearTimer = 90
    }

    // Draw
    drawMaze(ctx, gs.maze)
    drawPacman(ctx, pacman)
    gs.ghosts.forEach(g => drawGhost(ctx, g, gs.frightenedTimer))
    drawHUD(ctx, gs.score, gs.level, pacman.lives)
  }

  useEffect(() => {
    const initialMaze = cloneMaze(MAZE_TEMPLATE)
    stateRef.current = {
      state: 'IDLE',
      score: 0,
      level: 1,
      maze: initialMaze,
      pacman: createPacman(3),
      ghosts: createGhosts(),
      frightenedTimer: 0,
      levelClearTimer: 0,
      dotCount: countDots(initialMaze),
      deathTimer: 0
    }

    function handleKey(e: KeyboardEvent) {
      const fs = stateRef.current
      if (!fs) return
      if (e.key === 'Enter') {
        if (fs.state === 'IDLE' || fs.state === 'GAME_OVER') {
          stateRef.current = createFullState(1, 0, 3)
        }
      }
      if (e.key === 'p' || e.key === 'P') {
        if (fs.state === 'PLAYING') fs.state = 'PAUSED'
        else if (fs.state === 'PAUSED') fs.state = 'PLAYING'
      }
      keysRef.current.add(e.key)
    }

    function handleKeyUp(e: KeyboardEvent) {
      keysRef.current.delete(e.key)
    }

    window.addEventListener('keydown', handleKey)
    window.addEventListener('keyup', handleKeyUp)
    animRef.current = requestAnimationFrame(gameLoop)

    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('keyup', handleKeyUp)
      cancelAnimationFrame(animRef.current)
    }
  }, [gameLoop])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black">
      <h1 className="text-yellow-400 text-3xl font-bold mb-4 font-mono tracking-widest">PAC-MAN</h1>
      <canvas
        ref={canvasRef}
        width={COLS * CELL}
        height={ROWS * CELL + 40}
        className="border-2 border-blue-600"
        style={{ imageRendering: 'pixelated' }}
      />
      <div className="mt-4 text-gray-400 text-sm font-mono">
        Arrow Keys: Move &nbsp;|&nbsp; P: Pause &nbsp;|&nbsp; Enter: Start
      </div>
    </div>
  )
}
