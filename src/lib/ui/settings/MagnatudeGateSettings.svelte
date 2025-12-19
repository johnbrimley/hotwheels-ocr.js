<script lang="ts">
  import SliderSetting from '../SliderSetting.svelte'
  import ToggleSetting from '../ToggleSetting.svelte'
  import type { MagnatudeGatePassSettings } from '../../cv/passes/magnatude-gate/MagnatudeGatePassSettings'

  export let settings: MagnatudeGatePassSettings
  export let required: boolean = false

  let enabled = settings.enabled
  let threshold = settings.threshold

  $: if (settings) {
    enabled = settings.enabled
    threshold = settings.threshold
  }

  function setEnabled(value: boolean): void {
    enabled = value
    settings.enabled = value
  }

  function setThreshold(value: number): void {
    threshold = value
    settings.threshold = value
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
</div>
