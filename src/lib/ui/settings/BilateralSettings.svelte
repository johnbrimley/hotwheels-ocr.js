<script lang="ts">
  import SliderSetting from '../SliderSetting.svelte'
  import ToggleSetting from '../ToggleSetting.svelte'
  import type { BilateralPassSettings } from '../../cv/passes/bilateral/BilateralPassSettings'

  export let settings: BilateralPassSettings
  export let required: boolean = false

  let enabled = settings.enabled
  let kernelRadius = settings.kernelRadius
  let sigmaSpatial = settings.sigmaSpatial
  let sigmaRange = settings.sigmaRange

  $: if (settings) {
    enabled = settings.enabled
    kernelRadius = settings.kernelRadius
    sigmaSpatial = settings.sigmaSpatial
    sigmaRange = settings.sigmaRange
  }

  function setEnabled(value: boolean): void {
    enabled = value
    settings.enabled = value
  }

  function setKernelRadius(value: number): void {
    kernelRadius = value
    settings.kernelRadius = value
  }

  function setSigmaSpatial(value: number): void {
    sigmaSpatial = value
    settings.sigmaSpatial = value
  }

  function setSigmaRange(value: number): void {
    sigmaRange = value
    settings.sigmaRange = value
  }
</script>

<div class="settings">
  {#if !required}
    <ToggleSetting label="Enabled" checked={enabled} on:change={(e) => setEnabled(e.detail.checked)} />
  {/if}

  <SliderSetting
    label="Kernel Radius"
    min={1}
    max={5}
    step={1}
    value={kernelRadius}
    on:input={(e) => setKernelRadius(e.detail.value)}
  />
  <SliderSetting
    label="Sigma Spatial"
    min={0.5}
    max={10}
    step={0.25}
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
