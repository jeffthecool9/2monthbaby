import { useEffect, useRef } from 'react'
import { Vector3 } from '@babylonjs/core'
import { createScene } from './engine/createScene'
import { buildApartment } from './engine/apartment'

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
    if (params.has('r')) camera.radius = Number(params.get('r'))
    camera.target = new Vector3(tx, 0.6, tz)
    buildApartment(scene, shadows).then((apt) => {
      if (disposed) return
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
