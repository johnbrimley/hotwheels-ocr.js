<script lang="ts">
  import SliderSetting from '../SliderSetting.svelte'
  import ToggleSetting from '../ToggleSetting.svelte'
  import type { MagnatudeGatePassSettings } from '../../cv/passes/magnatude-gate/MagnatudeGatePassSettings'

  export let frontSettings: MagnatudeGatePassSettings
  export let rearSettings: MagnatudeGatePassSettings | undefined
  export let required: boolean = false

  let enabled = frontSettings.enabled
  let threshold = frontSettings.threshold

  function setEnabled(value: boolean): void {
    enabled = value
    frontSettings.enabled = value
    if (rearSettings) rearSettings.enabled = value
  }

  function setThreshold(value: number): void {
    threshold = value
    frontSettings.threshold = value
    if (rearSettings) rearSettings.threshold = value
  }
</script>

<div class="settings">
  {#if !required}
    <ToggleSetting label="Enabled" checked={enabled} on:change={(e) => setEnabled(e.detail.checked)} />
  {/if}

  <SliderSetting
    label="Threshold"
    min={0}
    max={1}
    step={0.01}
    value={threshold}
    on:input={(e) => setThreshold(e.detail.value)}
  />
</div>

