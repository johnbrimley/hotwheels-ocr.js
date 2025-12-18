<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { BoundaryPipeline, type BoundaryPipelinePass } from './lib/cv/pipelines/BoundaryPipeline'
  import { ImageCaptureContext } from './lib/cv/ImageCaptureContext'
  import PassTabs from './lib/ui/PassTabs.svelte'
  import BilateralSettings from './lib/ui/settings/BilateralSettings.svelte'
  import Rec709Settings from './lib/ui/settings/Rec709Settings.svelte'
  import type { BilateralPassSettings } from './lib/cv/passes/bilateral/BilateralPassSettings'
  import type { PassBase } from './lib/cv/passes/PassBase'

  type InputOption = { id: string; label: string }

  const passSettingsComponents: Record<string, any> = {
    'rec709-luma': Rec709Settings,
    bilateral: BilateralSettings,
  }

  let selectedPassId = ''

  let inputContexts: Map<string, ImageCaptureContext> = new Map()
  let inputOptions: InputOption[] = []

  let selectedFrontInputId = ''
  let selectedRearInputId = ''

  let frontCanvas: HTMLCanvasElement | null = null
  let rearCanvas: HTMLCanvasElement | null = null

  let frontBoundary: BoundaryPipeline | null = null
  let rearBoundary: BoundaryPipeline | null = null
  let passList: BoundaryPipelinePass[] = []

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

  function getPassSettings(passId: string, boundary: BoundaryPipeline | null): PassBase['settings'] | null {
    const pass = boundary?.getPass(passId)
    return pass ? pass.settings : null
  }

  async function renderSelected(boundary: BoundaryPipeline | null, inputId: string): Promise<void> {
    if (!boundary || !inputId) return
    const ctx = inputContexts.get(inputId)
    if (!ctx) return

    const bitmap = (await (ctx.imageCapture as any).grabFrame()) as ImageBitmap
    try {
      await boundary.pipeline.render(bitmap)
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
      await renderSelected(frontBoundary, selectedFrontInputId)
      await renderSelected(rearBoundary, selectedRearInputId)
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

      frontBoundary = new BoundaryPipeline(frontGl)
      rearBoundary = new BoundaryPipeline(rearGl)
      passList = frontBoundary.passes
      selectedPassId = passList[0]?.id ?? ''

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
    <PassTabs
      passes={passList.map((p) => ({ id: p.id, label: p.label }))}
      {selectedPassId}
      on:select={(e) => (selectedPassId = e.detail.passId)}
    />

    {#if selectedPassId}
      {@const passDef = passList.find((p) => p.id === selectedPassId)}
      {@const SettingsComponent = passDef ? passSettingsComponents[passDef.id] : null}
      {@const frontSettings = passDef ? getPassSettings(passDef.id, frontBoundary) : null}
      {@const rearSettings = passDef ? getPassSettings(passDef.id, rearBoundary) : null}
      {#if passDef && SettingsComponent && frontSettings}
        {#if passDef.id === 'bilateral'}
          <svelte:component
            this={SettingsComponent}
            required={passDef.required}
            frontSettings={frontSettings as BilateralPassSettings}
            rearSettings={rearSettings as BilateralPassSettings}
          />
        {:else}
          <svelte:component this={SettingsComponent} />
        {/if}
      {/if}
    {/if}
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

  :global(.passBar) {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  :global(.passButton) {
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

  :global(.passButtonActive) {
    transform: translateY(3px);
    box-shadow:
      0 0px 0 rgba(0, 0, 0, 0.65),
      0 3px 12px rgba(0, 0, 0, 0.35);
    background: #232323;
    border-color: rgba(255, 255, 255, 0.22);
  }

  :global(.settings) {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-end;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  }

  :global(.settingsEmpty) {
    opacity: 0.7;
    padding: 4px 0 12px 0;
  }

  :global(.setting) {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 220px;
    max-width: 320px;
  }

  :global(.settingLabel) {
    font-size: 12px;
    opacity: 0.8;
  }

  :global(.settingControl) {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  :global(.settingControl input[type='range']) {
    flex: 1 1 auto;
  }

  :global(.settingValue) {
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
