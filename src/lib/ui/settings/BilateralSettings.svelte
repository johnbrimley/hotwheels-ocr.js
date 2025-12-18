<script lang="ts">
  import SliderSetting from '../SliderSetting.svelte'
  import ToggleSetting from '../ToggleSetting.svelte'
  import type { BilateralPassSettings } from '../../cv/passes/bilateral/BilateralPassSettings'

  export let frontSettings: BilateralPassSettings
  export let rearSettings: BilateralPassSettings | undefined
  export let required: boolean = false

  let enabled = frontSettings.enabled
  let kernelRadius = frontSettings.kernelRadius
  let sigmaSpatial = frontSettings.sigmaSpatial
  let sigmaRange = frontSettings.sigmaRange

  function setEnabled(value: boolean): void {
    enabled = value
    frontSettings.enabled = value
    if (rearSettings) rearSettings.enabled = value
  }

  function setKernelRadius(value: number): void {
    kernelRadius = value
    frontSettings.kernelRadius = value
    if (rearSettings) rearSettings.kernelRadius = value
  }

  function setSigmaSpatial(value: number): void {
    sigmaSpatial = value
    frontSettings.sigmaSpatial = value
    if (rearSettings) rearSettings.sigmaSpatial = value
  }

  function setSigmaRange(value: number): void {
    sigmaRange = value
    frontSettings.sigmaRange = value
    if (rearSettings) rearSettings.sigmaRange = value
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
