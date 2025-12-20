<script lang="ts">
  import SliderSetting from '../SliderSetting.svelte'
  import ToggleSetting from '../ToggleSetting.svelte'
  import type { BilateralPassSettings } from '../../cv/passes/bilateral/BilateralPassSettings'

  export let settings: BilateralPassSettings
  export let required: boolean = false

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  const MAX_KERNEL_RADIUS = 5
  const MIN_KERNEL_RADIUS = 2

  const MIN_SIGMA_SPATIAL = 0.5
  const MAX_SIGMA_SPATIAL = MAX_KERNEL_RADIUS / 3 // ≈ 1.67

  // ---------------------------------------------------------------------------
  // Local state mirrors settings
  // ---------------------------------------------------------------------------

  let enabled = settings.enabled
  let kernelRadius = settings.kernelRadius
  let sigmaSpatial = settings.sigmaSpatial
  let sigmaRange = settings.sigmaRange

  // Keep local state in sync if settings object updates externally
  $: if (settings) {
    enabled = settings.enabled
    kernelRadius = settings.kernelRadius
    sigmaSpatial = settings.sigmaSpatial
    sigmaRange = settings.sigmaRange
  }

  // ---------------------------------------------------------------------------
  // Utility functions
  // ---------------------------------------------------------------------------

  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }

  function requiredKernelRadiusForSigmaSpatial(sigma: number): number {
    // Gaussian support rule: radius >= 3 * sigma
    return Math.ceil(3 * sigma)
  }

  function maxSigmaSpatialForKernelRadius(radius: number): number {
    return radius / 3
  }

  // ---------------------------------------------------------------------------
  // Setters with constraint enforcement
  // ---------------------------------------------------------------------------

  function setEnabled(value: boolean): void {
    enabled = value
    settings.enabled = value
  }

  function setKernelRadius(value: number): void {
    const clampedKernelRadius =
      clamp(Math.round(value), MIN_KERNEL_RADIUS, MAX_KERNEL_RADIUS)

    // If kernel shrinks, sigmaSpatial may no longer fit — clamp it down
    const allowedSigmaSpatialMax =
      maxSigmaSpatialForKernelRadius(clampedKernelRadius)

    const clampedSigmaSpatial =
      Math.min(settings.sigmaSpatial, allowedSigmaSpatialMax)

    kernelRadius = clampedKernelRadius
    sigmaSpatial = clampedSigmaSpatial

    settings.kernelRadius = clampedKernelRadius
    settings.sigmaSpatial = clampedSigmaSpatial
  }

  function setSigmaSpatial(value: number): void {
    const clampedSigmaSpatial =
      clamp(value, MIN_SIGMA_SPATIAL, MAX_SIGMA_SPATIAL)

    // Ensure kernel radius is large enough to support sigmaSpatial
    const requiredKernelRadius =
      requiredKernelRadiusForSigmaSpatial(clampedSigmaSpatial)

    const clampedKernelRadius =
      clamp(requiredKernelRadius, MIN_KERNEL_RADIUS, MAX_KERNEL_RADIUS)

    sigmaSpatial = clampedSigmaSpatial
    kernelRadius = clampedKernelRadius

    settings.sigmaSpatial = clampedSigmaSpatial
    settings.kernelRadius = clampedKernelRadius
  }

  function setSigmaRange(value: number): void {
    sigmaRange = value
    settings.sigmaRange = value
  }
</script>

<div class="settings">
  {#if !required}
    <ToggleSetting
      label="Enabled"
      checked={enabled}
      on:change={(e) => setEnabled(e.detail.checked)}
    />
  {/if}

  <SliderSetting
    label="Kernel Radius"
    min={MIN_KERNEL_RADIUS}
    max={MAX_KERNEL_RADIUS}
    step={1}
    value={kernelRadius}
    on:input={(e) => setKernelRadius(e.detail.value)}
  />

  <SliderSetting
    label="Sigma Spatial"
    min={MIN_SIGMA_SPATIAL}
    max={MAX_SIGMA_SPATIAL}
    step={0.1}
    value={sigmaSpatial}
    on:input={(e) => setSigmaSpatial(e.detail.value)}
  />

  <SliderSetting
    label="Sigma Range"
    min={0.01}
    max={0.5}
    step={0.01}
    value={sigmaRange}
    on:input={(e) => setSigmaRange(e.detail.value)}
  />
</div>
