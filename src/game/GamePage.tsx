import { useEffect, useRef } from 'react'
import { Vector3 } from '@babylonjs/core'
import { createScene } from './engine/createScene'
import { buildApartment } from './engine/apartment'
import { Chibi } from './engine/chibi'
import { defaultLook } from './character/look'
import { sampleClip, type ClipName } from './character/poses'
import type { EmoteKind } from './types'

// Temporary scene preview (Task 7). Replaced by the full game page in later tasks.
export default function GamePage() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!
    const { engine, scene, camera, shadows } = createScene(canvas)
    let disposed = false
    const params = new URLSearchParams(location.search)
    const tx = Number(params.get('x') ?? 4.5), tz = Number(params.get('z') ?? 4.2)
    if (params.has('a')) camera.alpha = Number(params.get('a'))
    if (params.has('b')) camera.beta = Number(params.get('b'))
    if (params.has('r')) {
      camera.lowerRadiusLimit = 1
      camera.upperBetaLimit = 1.5
      camera.radius = Number(params.get('r'))
    }
    camera.target = new Vector3(tx, 0.6, tz)
    buildApartment(scene, shadows).then((apt) => {
      if (disposed) return
      if (params.has('chibi')) {
        const clip = (params.get('clip') ?? 'idle') as ClipName
        const t = Number(params.get('t') ?? 750)
        const her = new Chibi(scene, defaultLook('female'), shadows)
        const him = new Chibi(scene, defaultLook('male'), shadows)
        const front = params.has('front')
        her.setPosition({ x: tx - (front ? 0.4 : 0.28), z: tz }, front ? Math.PI : Math.PI / 2)
        him.setPosition({ x: tx + (front ? 0.4 : 0.28), z: tz }, front ? Math.PI : -Math.PI / 2)
        her.setPose(sampleClip(clip, t))
        him.setPose(sampleClip(clip === 'kiss' ? 'receive-kiss' : clip, t))
        if (params.has('expr')) her.setExpression(params.get('expr') as EmoteKind)
      }
      scene.onBeforeRenderObservable.add(() => apt.updateCutaway({ x: camera.position.x, z: camera.position.z }, { x: camera.target.x, z: camera.target.z }))
      engine.runRenderLoop(() => scene.render())
      ;(window as unknown as { __fps: () => number }).__fps = () => engine.getFps()
    })
    const onResize = () => engine.resize()
    window.addEventListener('resize', onResize)
    return () => {
      disposed = true
      window.removeEventListener('resize', onResize)
      engine.dispose()
    }
  }, [])
  return <canvas ref={ref} style={{ width: '100vw', height: '100dvh', display: 'block', touchAction: 'none' }} />
}
