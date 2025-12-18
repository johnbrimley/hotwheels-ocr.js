<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { ComputerVisionPipeline } from './lib/cv/ComputerVisionPipeline'
  import { ImageCaptureContext } from './lib/cv/ImageCaptureContext'
  import { Rec709LumPass } from './lib/cv/passes/rec-709-luma/Rec709LumaPass'

  type InputOption = { id: string; label: string }

  type PassControlSpec = {
    key: string
    label: string
    min: number
    max: number
    step: number
    defaultValue: number
  }

  type PassDefinition = {
    id: string
    label: string
    create: (gl: WebGL2RenderingContext) => unknown
    controls: PassControlSpec[]
  }

  type PassControlState = PassControlSpec & { value: number }

  const passDefinitions: PassDefinition[] = [
    {
      id: 'rec709-luma',
      label: 'Rec709 Luma',
      create: (gl) => new Rec709LumPass(gl),
      controls: [],
    },
  ]

  let selectedPassId: string = passDefinitions[0]?.id ?? ''

  let inputContexts: Map<string, ImageCaptureContext> = new Map()
  let inputOptions: InputOption[] = []

  let selectedFrontInputId = ''
  let selectedRearInputId = ''

  let frontCanvas: HTMLCanvasElement | null = null
  let rearCanvas: HTMLCanvasElement | null = null

  let frontPipeline: ComputerVisionPipeline | null = null
  let rearPipeline: ComputerVisionPipeline | null = null

  let frontPasses: unknown[] = []
  let rearPasses: unknown[] = []

  let passControlsById: Record<string, PassControlState[]> = Object.fromEntries(
    passDefinitions.map((pass) => [
      pass.id,
      pass.controls.map((c) => ({ ...c, value: c.defaultValue })),
    ])
  )

  let errorMessage: string | null = null
  let running = false
  let frameInFlight = false

  function refreshInputOptions(): void {
    inputOptions = Array.from(inputContexts.entries()).map(([id, ctx]) => ({
      id,
      label: `${ctx.mediaStreamTrack.label || 'Camera'} (${id})`,
    }))
  }

  async function initializeInputs(): Promise<void> {
    await ImageCaptureContext.initialize()
    inputContexts = ImageCaptureContext.imageCaptureContexts
    refreshInputOptions()

    if (!selectedFrontInputId && inputOptions[0]) selectedFrontInputId = inputOptions[0].id
    if (!selectedRearInputId && inputOptions[1]) selectedRearInputId = inputOptions[1].id
    if (!selectedRearInputId && inputOptions[0]) selectedRearInputId = inputOptions[0].id
  }

  function buildPipeline(gl: WebGL2RenderingContext): { pipeline: ComputerVisionPipeline; passes: unknown[] } {
    const pipeline = new ComputerVisionPipeline(gl)
    const passes = passDefinitions.map((p) => p.create(gl))
    for (const pass of passes) {
      pipeline.addPass(pass as any)
    }
    return { pipeline, passes }
  }

  function applyControlsToPipelines(passId: string): void {
    const passIndex = passDefinitions.findIndex((p) => p.id === passId)
    if (passIndex < 0) return

    const controls = passControlsById[passId] ?? []

    const applyToPass = (pass: any) => {
      for (const control of controls) {
        pass.settings.uniforms[control.key] = control.value
      }
    }

    if (frontPasses[passIndex]) applyToPass(frontPasses[passIndex])
    if (rearPasses[passIndex]) applyToPass(rearPasses[passIndex])
  }

  function setControlValue(passId: string, controlKey: string, value: number): void {
    const controls = passControlsById[passId] ?? []
    passControlsById = {
      ...passControlsById,
      [passId]: controls.map((c) => (c.key === controlKey ? { ...c, value } : c)),
    }
    applyControlsToPipelines(passId)
  }

  async function renderSelected(pipeline: ComputerVisionPipeline | null, inputId: string): Promise<void> {
    if (!pipeline || !inputId) return
    const ctx = inputContexts.get(inputId)
    if (!ctx) return

    const bitmap = (await (ctx.imageCapture as any).grabFrame()) as ImageBitmap
    try {
      await pipeline.render(bitmap)
    } finally {
      bitmap.close()
    }
  }

  async function loop(): Promise<void> {
    if (!running) return
    if (frameInFlight) {
      requestAnimationFrame(() => void loop())
      return
    }

    frameInFlight = true
    try {
      await renderSelected(frontPipeline, selectedFrontInputId)
      await renderSelected(rearPipeline, selectedRearInputId)
      errorMessage = null
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err)
    } finally {
      frameInFlight = false
      requestAnimationFrame(() => void loop())
    }
  }

  onMount(async () => {
    try {
      await initializeInputs()

      const frontGl = frontCanvas?.getContext('webgl2')
      const rearGl = rearCanvas?.getContext('webgl2')

      if (!frontGl || !rearGl) {
        errorMessage = 'WebGL2 not available for one or both canvases.'
        return
      }

      const front = buildPipeline(frontGl)
      frontPipeline = front.pipeline
      frontPasses = front.passes

      const rear = buildPipeline(rearGl)
      rearPipeline = rear.pipeline
      rearPasses = rear.passes

      for (const pass of passDefinitions) {
        applyControlsToPipelines(pass.id)
      }

      running = true
      void loop()
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err)
    }
  })

  onDestroy(() => {
    running = false
  })
</script>

<main class="app">
  <section class="controls">
    <div class="passBar" role="tablist" aria-label="Pipeline passes">
      {#each passDefinitions as pass (pass.id)}
        <button
          type="button"
          class="passButton"
          class:passButtonActive={selectedPassId === pass.id}
          role="tab"
          aria-selected={selectedPassId === pass.id}
          on:click={() => (selectedPassId = pass.id)}
        >
          {pass.label}
        </button>
      {/each}
    </div>

    <div class="settings" aria-label="Pass settings">
      {#if selectedPassId && (passControlsById[selectedPassId]?.length ?? 0) > 0}
        {#each passControlsById[selectedPassId] as control (control.key)}
          <label class="setting">
            <div class="settingLabel">{control.label}</div>
            <div class="settingControl">
              <input
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={control.value}
                on:input={(e) =>
                  setControlValue(
                    selectedPassId,
                    control.key,
                    Number((e.currentTarget as HTMLInputElement).value)
                  )}
              />
              <div class="settingValue">{control.value}</div>
            </div>
          </label>
        {/each}
      {:else}
        <div class="settingsEmpty">No settings for this pass.</div>
      {/if}
    </div>
  </section>

  <section class="views">
    <div class="cameraPanel">
      <div class="cameraHeader">
        <div class="cameraTitle">Front</div>
        <select class="cameraSelect" bind:value={selectedFrontInputId}>
          <option value="" disabled>Select input…</option>
          {#each inputOptions as opt (opt.id)}
            <option value={opt.id}>{opt.id}</option>
          {/each}
        </select>
      </div>
      <canvas class="cameraCanvas" bind:this={frontCanvas}></canvas>
    </div>

    <div class="cameraPanel">
      <div class="cameraHeader">
        <div class="cameraTitle">Rear</div>
        <select class="cameraSelect" bind:value={selectedRearInputId}>
          <option value="" disabled>Select input…</option>
          {#each inputOptions as opt (opt.id)}
            <option value={opt.id}>{opt.id}</option>
          {/each}
        </select>
      </div>
      <canvas class="cameraCanvas" bind:this={rearCanvas}></canvas>
    </div>
  </section>

  {#if errorMessage}
    <div class="errorBanner" role="alert">{errorMessage}</div>
  {/if}
</main>

<style>
  .app {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .controls {
    flex: 0 0 auto;
    max-height: 33vh;
    overflow: auto;
    padding: 12px 12px 0 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .passBar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .passButton {
    background: #1b1b1b;
    color: inherit;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-bottom-color: rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 8px 12px;
    line-height: 1;
    box-shadow:
      0 3px 0 rgba(0, 0, 0, 0.65),
      0 6px 20px rgba(0, 0, 0, 0.35);
    transition:
      transform 80ms ease,
      box-shadow 80ms ease,
      background-color 120ms ease,
      border-color 120ms ease;
  }

  .passButtonActive {
    transform: translateY(3px);
    box-shadow:
      0 0px 0 rgba(0, 0, 0, 0.65),
      0 3px 12px rgba(0, 0, 0, 0.35);
    background: #232323;
    border-color: rgba(255, 255, 255, 0.22);
  }

  .settings {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-end;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  }

  .settingsEmpty {
    opacity: 0.7;
    padding: 4px 0 12px 0;
  }

  .setting {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 220px;
    max-width: 320px;
  }

  .settingLabel {
    font-size: 12px;
    opacity: 0.8;
  }

  .settingControl {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .settingControl input[type='range'] {
    flex: 1 1 auto;
  }

  .settingValue {
    width: 64px;
    text-align: right;
    font-variant-numeric: tabular-nums;
    opacity: 0.9;
  }

  .views {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    padding: 0 12px 12px 12px;
  }

  .cameraPanel {
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .cameraHeader {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .cameraTitle {
    font-weight: 600;
  }

  .cameraSelect {
    flex: 1 1 auto;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(0, 0, 0, 0.22);
    color: inherit;
  }

  .cameraCanvas {
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    height: 100%;
    background: #0d0d0d;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .errorBanner {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: 12px;
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(120, 15, 15, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.18);
    color: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(6px);
  }
</style>
