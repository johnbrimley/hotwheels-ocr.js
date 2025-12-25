<script lang="ts">
  import SliderSetting from '../SliderSetting.svelte'
  import ToggleSetting from '../ToggleSetting.svelte'
  import type { StructurePassSettings } from '../../cv/passes/structure/StructurePassSettings'

  export let settings: StructurePassSettings
  export let required: boolean = false

  let enabled = settings.enabled
  let continuityThreshold = settings.continuityThreshold
  let magnitudeThreshold = settings.magnitudeThreshold

  $: if (settings) {
    enabled = settings.enabled
    continuityThreshold = settings.continuityThreshold
    magnitudeThreshold = settings.magnitudeThreshold
  }

  function setEnabled(value: boolean): void {
    enabled = value
    settings.enabled = value
  }

  function setContinuityThreshold(value: number): void {
    continuityThreshold = value
    settings.continuityThreshold = value
  }

  function setMagnitudeThreshold(value: number): void {
    magnitudeThreshold = value
    settings.magnitudeThreshold = value
  }
</script>

<div class="settings">
  {#if !required}
    <ToggleSetting label="Enabled" checked={enabled} on:change={(e) => setEnabled(e.detail.checked)} />
  {/if}
  <SliderSetting
    label="Magnitude Threshold"
    min={0}
    max={1}
    step={0.01}
    value={magnitudeThreshold}
    on:input={(e) => setMagnitudeThreshold(e.detail.value)}
  />
  <SliderSetting
    label="Continuity Threshold"
    min={0}
    max={1}
    step={0.01}
    value={continuityThreshold}
    on:input={(e) => setContinuityThreshold(e.detail.value)}
  />
</div>
