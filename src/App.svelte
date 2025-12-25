<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { BoundaryPipeline, type BoundaryPipelinePass } from './lib/cv/pipelines/BoundaryPipeline'
  import { ImageCaptureContext } from './lib/cv/ImageCaptureContext'
  import PassTabs from './lib/ui/PassTabs.svelte'
  import BilateralSettings from './lib/ui/settings/BilateralSettings.svelte'
  import Rec709Settings from './lib/ui/settings/Rec709Settings.svelte'
  import type { BilateralPassSettings } from './lib/cv/passes/bilateral/BilateralPassSettings'
  import StructureSettings from './lib/ui/settings/StructureSettings.svelte'
  import type { StructurePassSettings } from './lib/cv/passes/structure/StructurePassSettings'
  import DownscaleSettings from './lib/ui/settings/DownscaleSettings.svelte'
  import type { PassSettingsBase } from './lib/cv/passes/PassSettingsBase'
  import MagnatudeGateSettings from './lib/ui/settings/MagnatudeGateSettings.svelte'
  import type { MagnatudeGatePassSettings } from './lib/cv/passes/magnatude-gate/MagnatudeGatePassSettings'
  import TemporalSettings from './lib/ui/settings/TemporalSettings.svelte'
  import type { TemporalPassSettings } from './lib/cv/passes/temporal/TemporalPassSettings'
  import RayBoxSettings from './lib/ui/settings/RayBoxSettings.svelte'
  import type { RayBoxPassSettings } from './lib/cv/passes/ray-box/RayBoxPassSettings'
  import OrientationSettings from './lib/ui/settings/OrientationSettings.svelte'
  import type { OrientationPassSettings } from './lib/cv/passes/orientation/OrientationPassSettings'
  import type { PassBase } from './lib/cv/passes/PassBase'
  import FpsCounter from './lib/ui/FpsCounter.svelte'
  import Toast from './lib/ui/Toast.svelte'
  import frontDefaults from './lib/config/front-settings.json'
  import rearDefaults from './lib/config/rear-settings.json'

  type InputOption = { id: string; label: string }

  const passSettingsComponents: Record<string, any> = {
    'rec709-luma': Rec709Settings,
    bilateral: BilateralSettings,
    sobel: StructureSettings,
    downscale: DownscaleSettings,
    'magnatude-gate': MagnatudeGateSettings,
    temporal: TemporalSettings,
    'ray-box': RayBoxSettings,
    orientation: OrientationSettings,
  }

  let selectedPassId = ''

  let inputContexts: Map<string, ImageCaptureContext> = new Map()
  let inputOptions: InputOption[] = []

  let selectedFrontInputId = ''
  let selectedRearInputId = ''

  let selectedSide: 'front' | 'rear' = 'front'

  let frontCanvas: HTMLCanvasElement | null = null
  let rearCanvas: HTMLCanvasElement | null = null

  let frontBoundary: BoundaryPipeline | null = null
  let rearBoundary: BoundaryPipeline | null = null
  let passList: BoundaryPipelinePass[] = []

  let errorMessage: string | null = null
  let running = false
  let frameInFlight = false
  let fpsCounter: { measure: () => void } | null = null
  let toastOpen = false
  let toastMessage = ''

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

  function applyDefaults(boundary: BoundaryPipeline, defaults: any): void {
    const perPass = defaults?.passes ?? {}
    for (const entry of boundary.passes) {
      const cfg = perPass[entry.id]
      if (!cfg) continue
      if (typeof cfg.enabled === 'boolean') {
        entry.pass.enabled = cfg.enabled
      }
      for (const [key, value] of Object.entries(cfg)) {
        if (key === 'enabled') continue
        if (key in entry.pass.settings) {
          ;(entry.pass.settings as any)[key] = value
        }
      }
    }
  }

  function serializeBoundary(boundary: BoundaryPipeline): any {
    const result: Record<string, any> = {}
    for (const entry of boundary.passes) {
      const settings: Record<string, any> = { enabled: entry.pass.enabled }
      const s = entry.pass.settings as any
      switch (entry.id) {
        case 'bilateral':
          settings.kernelRadius = s.kernelRadius
          settings.sigmaSpatial = s.sigmaSpatial
          settings.sigmaRange = s.sigmaRange
          break
        case 'sobel':
          settings.continuityThreshold = s.continuityThreshold
          settings.magnitudeThreshold = s.magnitudeThreshold
          break
        case 'magnatude-gate':
          settings.threshold = s.threshold
          break
        case 'temporal':
          break
        case 'orientation':
          settings.flipX = s.flipX
          settings.flipY = s.flipY
          break
        case 'ray-box':
          settings.threshold = s.threshold
          settings.rayCount = s.rayCount
          settings.step = s.step
          settings.trimFraction = s.trimFraction
          break
        case 'rec709-luma':
        default:
          break
      }
      result[entry.id] = settings
    }
    return { passes: result }
  }

  async function exportSettings(side: 'front' | 'rear'): Promise<void> {
    const boundary = side === 'front' ? frontBoundary : rearBoundary
    if (!boundary) return
    const json = JSON.stringify(serializeBoundary(boundary), null, 2)
    await navigator.clipboard.writeText(json)
    toastMessage = `Exported ${side} settings to clipboard`
    toastOpen = true
  }

  async function renderSelected(boundary: BoundaryPipeline | null, inputId: string): Promise<void> {
    if (!boundary || !inputId) return
    const ctx = inputContexts.get(inputId)
    if (!ctx) return

    const bitmap = (await (ctx.imageCapture as any).grabFrame()) as ImageBitmap
    try {
      await boundary.render(bitmap)
    } finally {
      bitmap.close()
    }
  }

  async function loop(): Promise<void> {
    if (!running) return
    if (frameInFlight) {
      fpsCounter?.measure()
      requestAnimationFrame(() => void loop())
      return
    }

    frameInFlight = true
    try {
      fpsCounter?.measure()
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

      if (!frontCanvas || !rearCanvas) {
        errorMessage = 'Canvas not available for one or both views.'
        return
      }

      frontBoundary = new BoundaryPipeline(frontCanvas)
      rearBoundary = new BoundaryPipeline(rearCanvas)

      if (frontBoundary) applyDefaults(frontBoundary, frontDefaults)
      if (rearBoundary) applyDefaults(rearBoundary, rearDefaults)

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
    <div class="controlRow">
      <div class="sideSwitcher" role="group" aria-label="Side selector">
        <button
          type="button"
          class:sideActive={selectedSide === 'front'}
          on:click={() => (selectedSide = 'front')}
        >
          Front
        </button>
        <button
          type="button"
          class:sideActive={selectedSide === 'rear'}
          on:click={() => (selectedSide = 'rear')}
        >
          Rear
        </button>
      </div>

      <PassTabs
        passes={passList.map((p) => ({ id: p.id, label: p.label }))}
        {selectedPassId}
        on:select={(e) => (selectedPassId = e.detail.passId)}
      />

      <button class="exportButton" type="button" on:click={() => exportSettings(selectedSide)}>Export</button>
    </div>

    {#if selectedPassId}
      {@const passDef = passList.find((p) => p.id === selectedPassId)}
      {@const SettingsComponent = passDef ? passSettingsComponents[passDef.id] : null}
      {@const activeBoundary = selectedSide === 'front' ? frontBoundary : rearBoundary}
      {@const settings = passDef ? getPassSettings(passDef.id, activeBoundary) : null}
      {#if passDef && SettingsComponent && settings}
        {#if passDef.id === 'bilateral'}
          <svelte:component this={SettingsComponent} required={passDef.required} settings={settings as BilateralPassSettings} />
        {:else if passDef.id === 'downscale'}
          <svelte:component this={SettingsComponent} required={passDef.required} settings={settings as PassSettingsBase} />
        {:else if passDef.id === 'sobel'}
          <svelte:component this={SettingsComponent} required={passDef.required} settings={settings as StructurePassSettings} />
        {:else if passDef.id === 'orientation'}
          <svelte:component this={SettingsComponent} required={passDef.required} settings={settings as OrientationPassSettings} />
        {:else if passDef.id === 'magnatude-gate'}
          <svelte:component this={SettingsComponent} required={passDef.required} settings={settings as MagnatudeGatePassSettings} />
        {:else if passDef.id === 'temporal'}
          <svelte:component this={SettingsComponent} required={passDef.required} settings={settings as TemporalPassSettings} />
        {:else if passDef.id === 'ray-box'}
          <svelte:component this={SettingsComponent} required={passDef.required} settings={settings as RayBoxPassSettings} />
        {:else}
          <svelte:component this={SettingsComponent} required={passDef.required} />
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
  <FpsCounter bind:this={fpsCounter} />
  <Toast message={toastMessage} bind:open={toastOpen} />
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

  .controlRow {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .sideSwitcher button {
    padding: 8px 12px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(0, 0, 0, 0.35);
    color: inherit;
    border-radius: 10px;
  }

  .sideSwitcher .sideActive {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.35);
  }

  .exportButton {
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(0, 0, 0, 0.35);
    color: inherit;
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
