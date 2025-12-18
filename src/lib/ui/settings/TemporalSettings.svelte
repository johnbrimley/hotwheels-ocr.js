<script lang="ts">
  import ToggleSetting from '../ToggleSetting.svelte'
  import type { TemporalPassSettings } from '../../cv/passes/temporal/TemporalPassSettings'

  export let frontSettings: TemporalPassSettings
  export let rearSettings: TemporalPassSettings | undefined
  export let required: boolean = false

  let enabled = frontSettings.enabled

  function setEnabled(value: boolean): void {
    enabled = value
    frontSettings.enabled = value
    if (rearSettings) rearSettings.enabled = value
  }
</script>

<div class="settings">
  {#if !required}
    <ToggleSetting label="Enabled" checked={enabled} on:change={(e) => setEnabled(e.detail.checked)} />
  {/if}
  <div class="settingsEmpty">Uses last 4 frames (median). No tunable parameters.</div>
</div>

