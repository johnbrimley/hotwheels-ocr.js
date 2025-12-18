<script lang="ts">
  import SliderSetting from '../SliderSetting.svelte'
  import ToggleSetting from '../ToggleSetting.svelte'
  import type { RayBoxPassSettings } from '../../cv/passes/ray-box/RayBoxPassSettings'

  export let frontSettings: RayBoxPassSettings
  export let rearSettings: RayBoxPassSettings | undefined
  export let required: boolean = false

  let enabled = frontSettings.enabled
  let threshold = frontSettings.threshold
  let rayCount = frontSettings.rayCount
  let step = frontSettings.step
  let trimFraction = frontSettings.trimFraction

  function mirror<T>(fn: (settings: RayBoxPassSettings, value: T) => void, value: T) {
    fn(frontSettings, value)
    if (rearSettings) fn(rearSettings, value)
  }

  function setEnabled(value: boolean): void {
    enabled = value
    mirror((s, v) => (s.enabled = v), value)
  }
  function setThreshold(value: number): void {
    threshold = value
    mirror((s, v) => (s.threshold = v), value)
  }
  function setRayCount(value: number): void {
    rayCount = value
    mirror((s, v) => (s.rayCount = v), value)
  }
  function setStep(value: number): void {
    step = value
    mirror((s, v) => (s.step = v), value)
  }
  function setTrimFraction(value: number): void {
    trimFraction = value
    mirror((s, v) => (s.trimFraction = v), value)
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
