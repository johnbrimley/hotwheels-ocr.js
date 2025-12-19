<script lang="ts">
  import SliderSetting from '../SliderSetting.svelte'
  import ToggleSetting from '../ToggleSetting.svelte'
  import type { RayBoxPassSettings } from '../../cv/passes/ray-box/RayBoxPassSettings'

  export let settings: RayBoxPassSettings
  export let required: boolean = false

  let enabled = settings.enabled
  let threshold = settings.threshold
  let rayCount = settings.rayCount
  let step = settings.step
  let trimFraction = settings.trimFraction

  $: if (settings) {
    enabled = settings.enabled
    threshold = settings.threshold
    rayCount = settings.rayCount
    step = settings.step
    trimFraction = settings.trimFraction
  }

  function setEnabled(value: boolean): void {
    enabled = value
    settings.enabled = value
  }
  function setThreshold(value: number): void {
    threshold = value
    settings.threshold = value
  }
  function setRayCount(value: number): void {
    rayCount = value
    settings.rayCount = value
  }
  function setStep(value: number): void {
    step = value
    settings.step = value
  }
  function setTrimFraction(value: number): void {
    trimFraction = value
    settings.trimFraction = value
  }
</script>

<div class="settings">
  {#if !required}
    <ToggleSetting label="Enabled" checked={enabled} on:change={(e) => setEnabled(e.detail.checked)} />
  {/if}

  <SliderSetting
    label="Threshold"
    min={0}
    max={0.5}
    step={0.005}
    value={threshold}
    on:input={(e) => setThreshold(e.detail.value)}
  />
  <SliderSetting
    label="Ray Count"
    min={32}
    max={256}
    step={8}
    value={rayCount}
    on:input={(e) => setRayCount(Math.round(e.detail.value))}
  />
  <SliderSetting
    label="Step (px)"
    min={0.25}
    max={5}
    step={0.25}
    value={step}
    on:input={(e) => setStep(e.detail.value)}
  />
  <SliderSetting
    label="Trim Fraction"
    min={0}
    max={0.4}
    step={0.01}
    value={trimFraction}
    on:input={(e) => setTrimFraction(e.detail.value)}
  />
</div>
