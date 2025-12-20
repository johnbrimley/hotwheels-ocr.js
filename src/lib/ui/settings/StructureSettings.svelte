<script lang="ts">
  import SliderSetting from '../SliderSetting.svelte'
  import ToggleSetting from '../ToggleSetting.svelte'
  import type { StructurePassSettings } from '../../cv/passes/structure/StructurePassSettings'

  export let settings: StructurePassSettings
  export let required: boolean = false

  let enabled = settings.enabled
  let sigmaSmall = settings.sigmaSmall
  let sigmaLarge = settings.sigmaLarge

  $: if (settings) {
    enabled = settings.enabled
    sigmaSmall = settings.sigmaSmall
    sigmaLarge = settings.sigmaLarge
  }

  function setEnabled(value: boolean): void {
    enabled = value
    settings.enabled = value
  }

  function setSigmaSmall(value: number): void {
    sigmaSmall = value
    settings.sigmaSmall = value
  }

  function setSigmaLarge(value: number): void {
    sigmaLarge = value
    settings.sigmaLarge = value
  }
</script>

<div class="settings">
  {#if !required}
    <ToggleSetting label="Enabled" checked={enabled} on:change={(e) => setEnabled(e.detail.checked)} />
  {/if}
  <SliderSetting
    label="Sigma Small"
    min={1}
    max={1.8}
    step={0.05}
    value={sigmaSmall}
    on:input={(e) => setSigmaSmall(e.detail.value)}
  />
  <SliderSetting
    label="Sigma Large"
    min={2}
    max={3}
    step={0.05}
    value={sigmaLarge}
    on:input={(e) => setSigmaLarge(e.detail.value)}
  />
</div>
